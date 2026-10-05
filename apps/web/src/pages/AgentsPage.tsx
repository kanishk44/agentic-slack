import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Menu, Plus } from 'lucide-react';
import type { AgentDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentAvatar } from '@/components/messages/AuthorAvatar';
import { AgentFormDialog } from '@/components/agents/AgentFormDialog';

export function AgentsPage() {
  const agents = useWorkspaceStore((s) => s.agents);
  const channels = useWorkspaceStore((s) => s.channels);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<AgentDTO | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.get('new')) {
      setCreating(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar">
          <Menu />
        </Button>
        <Bot className="size-5 text-muted-foreground" />
        <div className="flex-1">
          <h1 className="font-semibold">Agent directory</h1>
          <p className="text-xs text-muted-foreground">Your AI teammates. Mention any of them in a channel with @handle.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New agent
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const inChannels = channels.filter((c) => c.agentIds.includes(a.id));
            return (
              <button
                key={a.id}
                onClick={() => setEditing(a)}
                className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <AgentAvatar emoji={a.avatar} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{a.name}</span>
                      {a.isBuiltIn && <Badge variant="secondary" className="text-[10px]">Built-in</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">@{a.handle}</div>
                  </div>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{a.description || 'No description.'}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">{a.model}</span>
                  <span>· {inChannels.length ? inChannels.map((c) => `#${c.name}`).join(' ') : 'no channels'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <AgentFormDialog open={creating || !!editing} agent={editing} onOpenChange={(open) => !open && (setCreating(false), setEditing(null))} />
    </div>
  );
}
