import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 8000;
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const joinWorkspaceSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, numbers, - or _'),
  description: z.string().trim().max(200).optional().default(''),
  agentIds: z.array(z.string()).optional().default([]),
});
export type CreateChannelInput = z.input<typeof createChannelSchema>;

export const updateChannelAgentsSchema = z.object({
  agentIds: z.array(z.string()),
});
export type UpdateChannelAgentsInput = z.infer<typeof updateChannelAgentsSchema>;

export const agentBaseSchema = z.object({
  name: z.string().trim().min(1).max(40),
  handle: z.string().trim().toLowerCase().regex(HANDLE_PATTERN, 'Use lowercase letters, numbers, - or _ (max 32)'),
  avatar: z.string().trim().min(1).max(8).default('🤖'),
  description: z.string().trim().max(200).default(''),
  systemPrompt: z.string().trim().min(10, 'Give the agent a meaningful system prompt').max(8000),
  model: z.string().trim().min(1).max(200),
  temperature: z.number().min(0).max(2).default(0.7),
  contextWindow: z.number().int().min(1).max(50).default(20),
});

export const createAgentSchema = agentBaseSchema;
export type CreateAgentInput = z.input<typeof createAgentSchema>;

export const updateAgentSchema = agentBaseSchema.partial();
export type UpdateAgentInput = z.input<typeof updateAgentSchema>;

export const sendMessageSchema = z.object({
  channelId: z.string().min(1),
  threadId: z.string().min(1).nullable().optional(),
  content: z.string().trim().min(1, 'Message is empty').max(MAX_MESSAGE_LENGTH),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
