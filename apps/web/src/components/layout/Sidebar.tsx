import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bot, Check, ChevronDown, Copy, Hash, LogOut, Moon, Plus, Sun, UserPlus, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUIStore } from '@/stores/uiStore';
import { useActiveWorkspace, useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentAvatar, UserAvatar } from '@/components/messages/AuthorAvatar';
import { CreateChannelDialog } from '@/components/channels/CreateChannelDialog';
import { WorkspaceDialog } from '@/components/layout/WorkspaceDialog';
import { AgentFormDialog } from '@/components/agents/AgentFormDialog';
import type { AgentDTO } from '@slack/shared';

function SectionHeader({ label, onAdd, addLabel }: { label: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="group flex items-center justify-between px-3 pb-1 pt-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{label}</span>
      {onAdd && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAdd}
              className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={addLabel}
            >
              <Plus className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{addLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-[0.9rem] transition-colors',
    isActive ? 'bg-sidebar-primary text-white' : 'text-sidebar-foreground/85 hover:bg-sidebar-accent',
  );

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const channels = useWorkspaceStore((s) => s.channels);
  const agents = useWorkspaceStore((s) => s.agents);
  const thinking = useWorkspaceStore((s) => s.thinking);
  const workspace = useActiveWorkspace();
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [channelDialog, setChannelDialog] = useState(false);
  const [workspaceDialog, setWorkspaceDialog] = useState<'create' | 'join' | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentDTO | null>(null);

  if (!workspace || !user) return null;
  const busyAgents = new Set(Object.values(thinking).map((t) => t.agentId));

  const copyInvite = async () => {
    await navigator.clipboard.writeText(workspace.inviteCode);
    toast.success(`Invite code ${workspace.inviteCode} copied`);
  };

  const closeMobile = () => setMobileSidebarOpen(false);

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3 text-left hover:bg-sidebar-accent/60">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-indigo-900">
            {workspace.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{workspace.name}</div>
            <div className="text-xs text-sidebar-muted">{workspace.members.length} {workspace.members.length === 1 ? 'human' : 'humans'} · {agents.length} agents</div>
          </div>
          <ChevronDown className="size-4 text-sidebar-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => navigate(`/w/${w.id}`)}>
              <span className="truncate">{w.name}</span>
              {w.id === workspace.id && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copyInvite}>
            <Copy /> Copy invite code <span className="ml-auto font-mono text-xs text-muted-foreground">{workspace.inviteCode}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setWorkspaceDialog('join')}>
            <UserPlus /> Join a workspace
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setWorkspaceDialog('create')}>
            <Plus /> Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav className="flex-1 overflow-y-auto pb-4">
        <SectionHeader label="Channels" onAdd={() => setChannelDialog(true)} addLabel="Create channel" />
        {channels.map((c) => (
          <NavLink key={c.id} to={`/w/${workspace.id}/c/${c.id}`} className={navItem} onClick={closeMobile}>
            <Hash className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{c.name}</span>
          </NavLink>
        ))}

        <SectionHeader label="Agents" onAdd={() => navigate(`/w/${workspace.id}/agents?new=1`)} addLabel="Create agent" />
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setEditingAgent(a)}
            className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1 text-left text-[0.9rem] text-sidebar-foreground/85 hover:bg-sidebar-accent"
          >
            <span className="relative">
              <AgentAvatar emoji={a.avatar} size="sm" className="ring-0" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar',
                  busyAgents.has(a.id) ? 'animate-pulse bg-amber-400' : 'bg-emerald-400',
                )}
              />
            </span>
            <span className="truncate">{a.name}</span>
            <span className="ml-auto truncate text-xs text-sidebar-muted">@{a.handle}</span>
          </button>
        ))}
        <NavLink to={`/w/${workspace.id}/agents`} className={navItem} onClick={closeMobile} end>
          <Bot className="size-4 shrink-0 opacity-70" />
          <span>Agent directory</span>
        </NavLink>

        <SectionHeader label="Humans" />
        {workspace.members.map((m) => (
          <div key={m.id} className="mx-2 flex items-center gap-2 px-2 py-1 text-[0.9rem] text-sidebar-foreground/85">
            <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
            <span className="truncate">{m.name}{m.id === user.id && <span className="text-sidebar-muted"> (you)</span>}</span>
          </div>
        ))}
        <button
          onClick={copyInvite}
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1 text-left text-[0.9rem] text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Users className="size-4" /> Invite people
        </button>
      </nav>

      <div className="flex items-center gap-2 border-t border-sidebar-border px-3 py-2.5">
        <UserAvatar name={user.name} color={user.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-sidebar-muted">{user.email}</div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="rounded p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="rounded p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => void logout().then(() => navigate('/login'))}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>

      <CreateChannelDialog open={channelDialog} onOpenChange={setChannelDialog} />
      <WorkspaceDialog mode={workspaceDialog} onClose={() => setWorkspaceDialog(null)} />
      <AgentFormDialog
        open={!!editingAgent}
        agent={editingAgent}
        onOpenChange={(open) => !open && setEditingAgent(null)}
      />
    </aside>
  );
}
