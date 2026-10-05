import { memo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Loader2, MessageSquareText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { MessageDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { errorMessage } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMessageStore } from '@/stores/messageStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentAvatar, AuthorAvatar } from './AuthorAvatar';
import { MarkdownContent } from './MarkdownContent';

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function UsageTooltip({ message, children }: { message: MessageDTO; children: React.ReactNode }) {
  const u = message.usage;
  if (!u?.model) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="font-mono text-xs">
        <div>{u.model}</div>
        <div>
          {u.latencyMs != null && `${(u.latencyMs / 1000).toFixed(1)}s`}
          {u.completionTokens != null && ` · ${u.promptTokens ?? 0}→${u.completionTokens} tokens`}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ThreadSummary({ message, onOpen }: { message: MessageDTO; onOpen: () => void }) {
  const thinking = useWorkspaceStore((s) => s.thinking);
  const agents = useWorkspaceStore((s) => s.agents);
  const busy = Object.values(thinking)
    .filter((t) => t.threadId === message.id)
    .map((t) => agents.find((a) => a.id === t.agentId))
    .filter((a) => a !== undefined);

  if (!message.replyCount && !busy.length) return null;
  return (
    <button
      onClick={onOpen}
      className="mt-1 flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-border hover:bg-background"
    >
      {busy.length > 0 && (
        <span className="flex -space-x-1">
          {busy.map((a) => (
            <AgentAvatar key={a.id} emoji={a.avatar} size="sm" />
          ))}
        </span>
      )}
      {message.replyCount > 0 && (
        <span className="font-semibold text-primary">
          {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
        </span>
      )}
      {busy.length > 0 ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {busy.map((a) => a.name).join(', ')} {busy.length === 1 ? 'is' : 'are'} replying…
        </span>
      ) : (
        message.lastReplyAt && <span className="text-muted-foreground">Last reply {formatDistanceToNow(new Date(message.lastReplyAt), { addSuffix: true })}</span>
      )}
    </button>
  );
}

interface Props {
  message: MessageDTO;
  /** Hide the header when grouped with the previous message from the same author. */
  compact?: boolean;
  onOpenThread?: (id: string) => void;
}

export const MessageItem = memo(function MessageItem({ message, compact, onOpenThread }: Props) {
  const retry = useMessageStore((s) => s.retry);
  const [retrying, setRetrying] = useState(false);
  const isAgent = message.author.kind === 'agent';
  const isSystem = message.author.kind === 'system';
  const streaming = message.status === 'streaming';

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retry(message.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={cn('group relative flex gap-3 px-4 py-1 hover:bg-muted/40', !compact && 'mt-2 pt-2', isSystem && 'bg-amber-500/[0.04]')}>
      <div className="w-9 shrink-0">
        {compact ? (
          <span className="invisible block pt-0.5 text-right text-[10px] text-muted-foreground group-hover:visible">{formatTime(message.createdAt)}</span>
        ) : (
          <AuthorAvatar author={message.author} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{message.author.name}</span>
            {isAgent && <span className="rounded bg-violet-500/15 px-1 text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-300">AI</span>}
            <UsageTooltip message={message}>
              <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
            </UsageTooltip>
          </div>
        )}

        {streaming && !message.content ? (
          <ThinkingDots />
        ) : (
          <div className={cn(streaming && 'is-streaming')}>
            <MarkdownContent content={message.content} />
          </div>
        )}

        {message.status === 'error' && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">{message.error ?? 'Failed to generate a reply.'}</span>
            {isAgent && (
              <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="h-7">
                {retrying ? <Loader2 className="animate-spin" /> : <RotateCcw />} Retry
              </Button>
            )}
          </div>
        )}

        {onOpenThread && !message.threadId && <ThreadSummary message={message} onOpen={() => onOpenThread(message.id)} />}
      </div>

      {onOpenThread && !message.threadId && !isSystem && (
        <div className="absolute -top-3 right-4 hidden rounded-md border bg-background shadow-sm group-hover:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenThread(message.id)} aria-label="Reply in thread">
                <MessageSquareText className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply in thread</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
});

/** Messages from the same author within 5 minutes are visually grouped. */
export function isGrouped(prev: MessageDTO | undefined, m: MessageDTO) {
  return (
    !!prev &&
    prev.author.kind === m.author.kind &&
    prev.author.id === m.author.id &&
    prev.author.kind !== 'system' &&
    !prev.replyCount &&
    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
  );
}
