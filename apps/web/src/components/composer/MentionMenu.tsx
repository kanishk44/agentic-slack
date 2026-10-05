import type { AgentDTO } from '@slack/shared';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/messages/AuthorAvatar';

interface Props {
  items: { agent: AgentDTO; inChannel: boolean }[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (agent: AgentDTO) => void;
}

export function MentionMenu({ items, activeIndex, onHover, onPick }: Props) {
  return (
    <div
      role="listbox"
      aria-label="Mention an agent"
      className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agents</div>
      {items.map(({ agent, inChannel }, i) => (
        <button
          key={agent.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(agent);
          }}
          onMouseEnter={() => onHover(i)}
          className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', i === activeIndex && 'bg-accent')}
        >
          <AgentAvatar emoji={agent.avatar} size="sm" />
          <span className="font-medium">{agent.name}</span>
          <span className="text-muted-foreground">@{agent.handle}</span>
          {!inChannel && <span className="ml-auto text-[11px] text-muted-foreground">not in channel</span>}
        </button>
      ))}
    </div>
  );
}
