import type { MessageAuthorDTO } from '@slack/shared';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

const SIZES = { sm: 'size-5 text-[10px] rounded', md: 'size-9 text-sm rounded-lg', lg: 'size-12 text-xl rounded-xl' } as const;

export function AgentAvatar({ emoji, size = 'md', className }: { emoji: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/30',
        SIZES[size],
        size === 'md' && 'text-lg',
        className,
      )}
      aria-hidden
    >
      {emoji}
    </div>
  );
}

export function UserAvatar({ name, color, size = 'md', className }: { name: string; color: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-semibold text-white', SIZES[size], className)}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function AuthorAvatar({ author, size = 'md' }: { author: MessageAuthorDTO; size?: keyof typeof SIZES }) {
  if (author.kind === 'user') return <UserAvatar name={author.name} color={author.avatar} size={size} />;
  if (author.kind === 'system')
    return (
      <div className={cn('flex shrink-0 items-center justify-center bg-amber-500/15 ring-1 ring-amber-500/30', SIZES[size])} aria-hidden>
        {author.avatar}
      </div>
    );
  return <AgentAvatar emoji={author.avatar} size={size} />;
}
