import { create } from 'zustand';
import type {
  AgentDTO,
  AgentStatusPayload,
  ChannelDTO,
  CreateAgentInput,
  CreateChannelInput,
  FreeModelDTO,
  UpdateAgentInput,
  WorkspaceDTO,
} from '@slack/shared';
import { api } from '@/lib/api';

interface WorkspaceState {
  workspaces: WorkspaceDTO[];
  workspacesLoaded: boolean;
  activeWorkspaceId: string | null;
  channels: ChannelDTO[];
  agents: AgentDTO[];
  models: FreeModelDTO[];
  defaultModel: string;
  /** Keys of `${agentId}:${threadId}` currently generating. */
  thinking: Record<string, AgentStatusPayload>;

  loadWorkspaces: () => Promise<WorkspaceDTO[]>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceDTO>;
  joinWorkspace: (inviteCode: string) => Promise<WorkspaceDTO>;
  upsertWorkspace: (workspace: WorkspaceDTO) => void;

  createChannel: (input: CreateChannelInput) => Promise<ChannelDTO>;
  setChannelAgents: (channelId: string, agentIds: string[]) => Promise<void>;
  upsertChannel: (channel: ChannelDTO) => void;

  createAgent: (input: CreateAgentInput) => Promise<AgentDTO>;
  updateAgent: (agentId: string, input: UpdateAgentInput) => Promise<AgentDTO>;
  deleteAgent: (agentId: string) => Promise<void>;
  upsertAgent: (agent: AgentDTO) => void;
  removeAgent: (agentId: string) => void;

  loadModels: () => Promise<void>;
  setAgentStatus: (payload: AgentStatusPayload) => void;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const agentOrder = (a: AgentDTO, b: AgentDTO) => Number(b.isBuiltIn) - Number(a.isBuiltIn) || byName(a, b);

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  workspacesLoaded: false,
  activeWorkspaceId: null,
  channels: [],
  agents: [],
  models: [],
  defaultModel: '',
  thinking: {},

  loadWorkspaces: async () => {
    const { workspaces } = await api.get<{ workspaces: WorkspaceDTO[] }>('/workspaces');
    set({ workspaces, workspacesLoaded: true });
    return workspaces;
  },

  selectWorkspace: async (workspaceId) => {
    if (get().activeWorkspaceId === workspaceId && get().channels.length) return;
    set({ activeWorkspaceId: workspaceId, channels: [], agents: [], thinking: {} });
    const [{ channels }, { agents }] = await Promise.all([
      api.get<{ channels: ChannelDTO[] }>(`/workspaces/${workspaceId}/channels`),
      api.get<{ agents: AgentDTO[] }>(`/workspaces/${workspaceId}/agents`),
    ]);
    if (get().activeWorkspaceId === workspaceId) set({ channels, agents });
  },

  createWorkspace: async (name) => {
    const { workspace } = await api.post<{ workspace: WorkspaceDTO }>('/workspaces', { name });
    set((s) => ({ workspaces: [...s.workspaces, workspace] }));
    return workspace;
  },

  joinWorkspace: async (inviteCode) => {
    const { workspace } = await api.post<{ workspace: WorkspaceDTO }>('/workspaces/join', { inviteCode });
    set((s) => ({ workspaces: [...s.workspaces.filter((w) => w.id !== workspace.id), workspace] }));
    return workspace;
  },

  upsertWorkspace: (workspace) =>
    set((s) => ({
      workspaces: s.workspaces.some((w) => w.id === workspace.id)
        ? s.workspaces.map((w) => (w.id === workspace.id ? workspace : w))
        : [...s.workspaces, workspace],
    })),

  createChannel: async (input) => {
    const { channel } = await api.post<{ channel: ChannelDTO }>(`/workspaces/${get().activeWorkspaceId}/channels`, input);
    get().upsertChannel(channel);
    return channel;
  },

  setChannelAgents: async (channelId, agentIds) => {
    const { channel } = await api.patch<{ channel: ChannelDTO }>(`/channels/${channelId}/agents`, { agentIds });
    get().upsertChannel(channel);
  },

  upsertChannel: (channel) => {
    if (channel.workspaceId !== get().activeWorkspaceId) return;
    set((s) => ({ channels: [...s.channels.filter((c) => c.id !== channel.id), channel].sort(byName) }));
  },

  createAgent: async (input) => {
    const { agent } = await api.post<{ agent: AgentDTO }>(`/workspaces/${get().activeWorkspaceId}/agents`, input);
    get().upsertAgent(agent);
    return agent;
  },

  updateAgent: async (agentId, input) => {
    const { agent } = await api.patch<{ agent: AgentDTO }>(`/agents/${agentId}`, input);
    get().upsertAgent(agent);
    return agent;
  },

  deleteAgent: async (agentId) => {
    await api.del(`/agents/${agentId}`);
    get().removeAgent(agentId);
  },

  upsertAgent: (agent) => {
    if (agent.workspaceId !== get().activeWorkspaceId) return;
    set((s) => ({ agents: [...s.agents.filter((a) => a.id !== agent.id), agent].sort(agentOrder) }));
  },

  removeAgent: (agentId) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== agentId),
      channels: s.channels.map((c) => ({ ...c, agentIds: c.agentIds.filter((id) => id !== agentId) })),
    })),

  loadModels: async () => {
    if (get().models.length) return;
    const { models, defaultModel } = await api.get<{ models: FreeModelDTO[]; defaultModel: string }>('/models');
    set({ models, defaultModel });
  },

  setAgentStatus: (payload) =>
    set((s) => {
      const key = `${payload.agentId}:${payload.threadId}`;
      const thinking = { ...s.thinking };
      if (payload.state === 'thinking') thinking[key] = payload;
      else delete thinking[key];
      return { thinking };
    }),
}));

export const useActiveWorkspace = () =>
  useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null);
