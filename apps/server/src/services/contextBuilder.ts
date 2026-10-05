import type { Types } from 'mongoose';
import { MessageModel, type MessageDoc } from '../models/Message.js';
import type { AgentDoc } from '../models/Agent.js';
import type { ChannelDoc } from '../models/Channel.js';
import type { ChatMessage } from './openrouter.js';

/** How many top-level channel messages before a new thread to include as background. */
const CHANNEL_BACKGROUND = 8;

function formatForAgent(m: MessageDoc, agent: AgentDoc): ChatMessage | null {
  if (m.author.kind === 'system' || m.status !== 'complete' || !m.content.trim()) return null;
  if (m.author.kind === 'agent' && m.author.id?.toString() === agent.id) {
    return { role: 'assistant', content: m.content };
  }
  const label = m.author.kind === 'agent' ? `${m.author.name} (AI agent)` : m.author.name;
  return { role: 'user', content: `[${label}]: ${m.content}` };
}

/** Collapses consecutive same-role turns, which some models reject. */
function mergeConsecutive(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ ...m });
  }
  return out;
}

/**
 * Builds the prompt for an agent replying in a thread:
 * system prompt + (for fresh threads) recent channel background + the thread conversation.
 */
export async function buildContext(opts: {
  agent: AgentDoc;
  channel: ChannelDoc;
  threadRootId: Types.ObjectId;
  excludeMessageId: Types.ObjectId;
  participants: { humans: string[]; agents: { name: string; handle: string }[] };
}): Promise<{ messages: ChatMessage[]; historyCount: number }> {
  const { agent, channel, threadRootId, excludeMessageId, participants } = opts;
  const window = agent.contextWindow ?? 20;

  const root = await MessageModel.findById(threadRootId);
  const replies = await MessageModel.find({ threadId: threadRootId, _id: { $ne: excludeMessageId } })
    .sort({ createdAt: -1 })
    .limit(Math.max(window - 1, 1));
  replies.reverse();

  let background: MessageDoc[] = [];
  if (root && replies.length === 0) {
    background = await MessageModel.find({
      channelId: channel._id,
      threadId: null,
      createdAt: { $lt: root.createdAt },
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(CHANNEL_BACKGROUND, window));
    background.reverse();
  }

  const others = participants.agents
    .filter((a) => a.handle !== agent.handle)
    .map((a) => `${a.name} (@${a.handle})`)
    .join(', ');

  const system = [
    agent.systemPrompt,
    '',
    `## Context`,
    `- You are "${agent.name}" (@${agent.handle}) in the #${channel.name} channel${channel.description ? ` — ${channel.description}` : ''}.`,
    participants.humans.length ? `- Humans in this workspace: ${participants.humans.join(', ')}.` : '',
    others ? `- Other AI agents in this channel: ${others}. You cannot invoke them; suggest the user @mention them if relevant.` : '',
    `- You were @mentioned and are replying in a thread. Answer the most recent message that mentions you.`,
    `- Current date: ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const history: ChatMessage[] = [];
  const bg = background.map((m) => formatForAgent(m, agent)).filter((m): m is ChatMessage => m !== null);
  if (bg.length) {
    history.push({
      role: 'user',
      content: `(Earlier messages in #${channel.name}, for background only)\n${bg.map((m) => (m.role === 'assistant' ? `[${agent.name} (you)]: ${m.content}` : m.content)).join('\n')}`,
    });
  }
  for (const m of [root, ...replies]) {
    if (!m) continue;
    const formatted = formatForAgent(m, agent);
    if (formatted) history.push(formatted);
  }

  const merged = mergeConsecutive(history);
  // Models expect the conversation to end on a user turn.
  if (merged.length === 0 || merged[merged.length - 1].role !== 'user') {
    merged.push({ role: 'user', content: '(Please continue.)' });
  }

  return { messages: [{ role: 'system', content: system }, ...merged], historyCount: history.length };
}
