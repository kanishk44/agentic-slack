# Agentic Slack

An AI-native Slack-style workspace where **agents are channel members**. @mention an agent (`@frontend`, `@essay`, …) and it replies in a thread, streaming tokens live and using the conversation as context. Humans and agents share channels; you can create your own agents with a custom system prompt and any free OpenRouter model.

**Stack:** MongoDB · Express 5 · React 19 · Node — TypeScript throughout, pnpm monorepo, Socket.IO, Zustand, Tailwind v4 + shadcn/ui, Winston logging, OpenRouter.

## Quick start

```bash
pnpm install
cp .env.example .env          # then set OPENROUTER_API_KEY and JWT_SECRET
pnpm db:up                    # MongoDB 7 via docker compose
pnpm dev                      # shared (watch) + API on :4000 + web on :5173
```

Open http://localhost:5173, sign up, and you'll land in `#general` with five built-in agents.

Get a free OpenRouter key at https://openrouter.ai/keys. Free models don't cost anything, but you still need a key.

## Layout

```
packages/shared   zod schemas, DTO types, typed Socket.IO event map, @mention parsing
apps/server       Express + Socket.IO + Mongoose
  src/services/agentRunner.ts    queue → placeholder msg → stream → persist (core loop)
  src/services/contextBuilder.ts system prompt + channel background + thread history
  src/services/openrouter.ts     SSE streaming client, retry/backoff, free-model list
  src/lib/logger.ts              Winston config (console + daily-rotated files)
apps/web          Vite + React + shadcn/ui + Zustand
  src/stores/                    auth, workspace, messages (streaming deltas), ui, theme
  src/components/composer/       composer with @mention autocomplete
```

## How an agent reply works

1. The client emits `message:send`. The server validates and persists the message, then broadcasts `message:new` to the channel room.
2. `@handles` are resolved to workspace agents. An agent that isn't in the channel yet gets added automatically.
3. Each mentioned agent is queued. Runs share a global concurrency limit (`AGENT_CONCURRENCY`), and the same agent can't run twice at once in one thread.
4. A placeholder message (`status: streaming`) is created in the thread, then tokens stream from OpenRouter and are flushed to clients as `message:delta` every 50 ms.
5. When the stream ends, the message is saved with token usage and latency (`message:complete`). If it fails, the user sees a friendly error with a **Retry** button (`message:error`).

Agents always reply in a thread. Their context is the thread so far, plus, for a new thread, the last few channel messages as background. If the server restarts mid-reply, the unfinished replies are marked as failed on the next boot so they can be retried.

## Logging

Logging uses Winston (`apps/server/src/lib/logger.ts`):
- In dev, logs go to a colorized console. In production, they're JSON. Both also write to `apps/server/logs/app-YYYY-MM-DD.log` and `error-*.log`, which rotate daily.
- Every HTTP request and socket event gets a `requestId` (via AsyncLocalStorage), and it carries through into async agent runs.
- Logged events include boot and shutdown, DB connect/retry, HTTP requests, auth success and failure, socket connect/join, messages created, the agent run lifecycle (queued, started, first-token time, completed with tokens and latency, failed), and OpenRouter retries and 429s.
- Passwords, tokens, cookies and keys are redacted.

## Configuration (`.env`)

| Var | Default | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | — | Required for agents to reply |
| `OPENROUTER_DEFAULT_MODEL` | `openrouter/free` | Auto-routes to an available free model. Free model IDs change often, so the router is the safest default. |
| `MONGO_URI` | `mongodb://localhost:27017/agentic-slack` | |
| `JWT_SECRET` | — | At least 16 characters |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS + socket origin |
| `LOG_LEVEL` | `info` | `error`/`warn`/`info`/`http`/`debug` |
| `AGENT_CONCURRENCY` / `AGENT_TIMEOUT_MS` | `4` / `120000` | |

## Scripts

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm db:up` / `pnpm db:down`

## Not in V1

Agent-to-agent handoffs, tool use (web search, code execution), DMs, file uploads, unread counts, and message editing.
