import { useState } from 'react';
import { Hash, Menu, UserPlus } from 'lucide-react';
import type { ChannelDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/uiStore';
import { useActiveWorkspace, useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentAvatar } from '@/components/messages/AuthorAvatar';
import { ManageChannelAgentsDialog } from '@/components/channels/ManageChannelAgentsDialog';

export function ChannelHeader({ channel }: { channel: ChannelDTO }) {
  const agents = useWorkspaceStore((s) => s.agents);
  const workspace = useActiveWorkspace();
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const [manageOpen, setManageOpen] = useState(false);
  const channelAgents = agents.filter((a) => channel.agentIds.includes(a.id));

  return (
    <header className="flex items-center gap-3 border-b px-4 py-2.5">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar">
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-1 font-semibold">
          <Hash className="size-4 text-muted-foreground" />
          {channel.name}
        </h1>
        {channel.description && <p className="truncate text-xs text-muted-foreground">{channel.description}</p>}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-accent"
            aria-label="Manage channel agents"
          >
            {channelAgents.length ? (
              <span className="flex -space-x-1.5">
                {channelAgents.slice(0, 4).map((a) => (
                  <AgentAvatar key={a.id} emoji={a.avatar} size="sm" className="bg-background ring-2 ring-background" />
                ))}
              </span>
            ) : (
              <UserPlus className="size-4" />
            )}
            <span className="text-xs text-muted-foreground">
              {channelAgents.length} {channelAgents.length === 1 ? 'agent' : 'agents'} · {workspace?.members.length ?? 0} {workspace?.members.length === 1 ? 'human' : 'humans'}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Manage agents in this channel</TooltipContent>
      </Tooltip>
      <ManageChannelAgentsDialog channel={channel} open={manageOpen} onOpenChange={setManageOpen} />
    </header>
  );
}
