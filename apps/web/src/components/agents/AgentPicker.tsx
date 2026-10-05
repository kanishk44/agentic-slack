import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentAvatar } from '@/components/messages/AuthorAvatar';

/** Multi-select list of workspace agents. */
export function AgentPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const agents = useWorkspaceStore((s) => s.agents);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
      {agents.map((a) => {
        const selected = value.includes(a.id);
        return (
          <button
            type="button"
            key={a.id}
            onClick={() => toggle(a.id)}
            aria-pressed={selected}
            className={cn('flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent', selected && 'bg-accent')}
          >
            <AgentAvatar emoji={a.avatar} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {a.name} <span className="font-normal text-muted-foreground">@{a.handle}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{a.description || a.model}</div>
            </div>
            <div
              className={cn(
                'flex size-5 items-center justify-center rounded border',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              )}
            >
              {selected && <Check className="size-3.5" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
