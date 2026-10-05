import type { FreeModelDTO } from '@slack/shared';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('openrouter');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  delta?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    /** Safe, human-readable message to show in the chat. */
    public readonly userMessage: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

const MAX_ATTEMPTS = 3;

function headers() {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.CLIENT_ORIGIN,
    'X-Title': 'Agentic Slack',
  };
}

function toUserMessage(status: number, body: string): { msg: string; retryable: boolean } {
  if (status === 401) return { msg: 'The OpenRouter API key is missing or invalid.', retryable: false };
  if (status === 402) return { msg: 'OpenRouter reports insufficient credits for this model.', retryable: false };
  if (status === 404) return { msg: 'This model is not available on OpenRouter anymore. Pick another model in the agent settings.', retryable: false };
  if (status === 429) return { msg: 'The free model is rate-limited right now. Please try again in a minute.', retryable: true };
  if (status >= 500) return { msg: 'The model provider is having trouble. Please try again.', retryable: true };
  return { msg: `The model request failed (${status}). ${body.slice(0, 160)}`, retryable: false };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens a streaming request, retrying 429/5xx/network failures with exponential backoff (only before any token is received). */
async function openStream(body: object, signal: AbortSignal, ctx: Record<string, unknown>): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal,
      });
      if (res.ok && res.body) return res;

      const text = await res.text().catch(() => '');
      const { msg, retryable } = toUserMessage(res.status, text);
      if (retryable && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 1000 * 2 ** attempt;
        log.warn('OpenRouter request failed, retrying', { ...ctx, status: res.status, attempt, retryInMs: delay });
        await sleep(delay);
        continue;
      }
      log.error('OpenRouter request failed', { ...ctx, status: res.status, attempt, body: text.slice(0, 500) });
      throw new OpenRouterError(`OpenRouter ${res.status}`, res.status, msg, retryable);
    } catch (err) {
      if (err instanceof OpenRouterError) throw err;
      if (signal.aborted) throw new OpenRouterError('Request aborted', null, 'The model took too long to respond.', true);
      if (attempt < MAX_ATTEMPTS) {
        log.warn('OpenRouter network error, retrying', { ...ctx, attempt, error: (err as Error).message });
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      log.error('OpenRouter network error', { ...ctx, attempt, error: (err as Error).message });
      throw new OpenRouterError((err as Error).message, null, 'Could not reach the model provider.', true);
    }
  }
}

/**
 * Streams a chat completion from OpenRouter, yielding text deltas and a final usage chunk.
 * Parses the SSE stream manually (`data: {...}` lines, `: comment` keep-alives, `[DONE]`).
 */
export async function* streamChat(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal: AbortSignal;
  logContext?: Record<string, unknown>;
}): AsyncGenerator<StreamChunk> {
  if (!env.OPENROUTER_API_KEY) {
    throw new OpenRouterError('Missing OPENROUTER_API_KEY', 401, 'No OpenRouter API key is configured on the server (set OPENROUTER_API_KEY).');
  }
  const ctx = { model: opts.model, ...opts.logContext };
  const res = await openStream(
    {
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      stream: true,
      usage: { include: true },
    },
    opts.signal,
    ctx,
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          log.debug('Skipping unparsable SSE line', { ...ctx, line: data.slice(0, 200) });
          continue;
        }
        if (json.error) {
          const status = Number(json.error.code) || 500;
          log.error('OpenRouter stream error', { ...ctx, error: json.error });
          throw new OpenRouterError(json.error.message ?? 'Stream error', status, toUserMessage(status, json.error.message ?? '').msg);
        }
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield { delta };
        if (json.usage) {
          yield { usage: { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 } };
        }
      }
    }
  } catch (err) {
    if (opts.signal.aborted && !(err instanceof OpenRouterError)) {
      throw new OpenRouterError('Stream aborted', null, 'The model took too long to respond.', true);
    }
    throw err;
  } finally {
    reader.releaseLock();
  }
}

let modelCache: { at: number; models: FreeModelDTO[] } | null = null;
const MODEL_CACHE_TTL = 60 * 60 * 1000;

/** Lists free OpenRouter models (prompt + completion price of 0), cached for an hour. */
export async function listFreeModels(): Promise<FreeModelDTO[]> {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_TTL) return modelCache.models;
  const started = Date.now();
  let json: { data: any[] };
  try {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = (await res.json()) as { data: any[] };
    if (!Array.isArray(json.data)) throw new Error('Unexpected response shape');
  } catch (err) {
    log.error('Failed to fetch model list', { error: (err as Error).message });
    if (modelCache) return modelCache.models;
    throw new OpenRouterError(`Model list: ${(err as Error).message}`, null, 'Could not load models from OpenRouter.');
  }
  const models: FreeModelDTO[] = json.data
    .filter((m) => m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    // Chat agents need text-only output (excludes e.g. music/audio generators).
    .filter((m) => {
      const out: string[] | undefined = m.architecture?.output_modalities;
      return !out || (out.length === 1 && out[0] === 'text');
    })
    .map((m) => ({ id: m.id, name: m.name ?? m.id, contextLength: m.context_length ?? 0 }))
    // Keep the auto-router first: it survives individual free models being retired.
    .sort((a, b) => Number(b.id === 'openrouter/free') - Number(a.id === 'openrouter/free') || a.name.localeCompare(b.name));
  modelCache = { at: Date.now(), models };
  log.info('Fetched free model list', { count: models.length, durationMs: Date.now() - started });
  return models;
}
