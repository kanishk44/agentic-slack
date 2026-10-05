import { Fragment, useCallback, useLayoutEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { MessageDTO } from '@slack/shared';
import { formatDayDivider } from '@/lib/format';
import { isGrouped, MessageItem } from './MessageItem';

const NEAR_BOTTOM_PX = 120;

interface Props {
  messages: MessageDTO[];
  hasMore?: boolean;
  loading?: boolean;
  onLoadOlder?: () => Promise<number>;
  onOpenThread?: (id: string) => void;
  header?: React.ReactNode;
  showDayDividers?: boolean;
  /** Changes when switching channel/thread so we jump to the bottom. */
  resetKey: string;
}

/** Scrollable message list that sticks to the bottom while new content streams in. */
export function MessageList({ messages, hasMore, loading, onLoadOlder, onOpenThread, header, resetKey, showDayDividers = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prependAnchor = useRef<number | null>(null);
  const lastKey = useRef<string | null>(null);

  // Track content size (not just message count) so streamed deltas keep us pinned.
  const contentSignature = messages.length + ':' + (messages[messages.length - 1]?.content.length ?? 0) + ':' + (messages[messages.length - 1]?.replyCount ?? 0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      stickToBottom.current = true;
    }
    if (prependAnchor.current !== null) {
      el.scrollTop = el.scrollHeight - prependAnchor.current;
      prependAnchor.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [contentSignature, resetKey]);

  const onScroll = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (el.scrollTop < 80 && hasMore && !loading && onLoadOlder) {
      const fromBottom = el.scrollHeight - el.scrollTop;
      prependAnchor.current = fromBottom;
      const added = await onLoadOlder();
      if (!added) prependAnchor.current = null;
    }
  }, [hasMore, loading, onLoadOlder]);

  return (
    <div ref={ref} onScroll={onScroll} className="flex-1 overflow-y-auto pb-4">
      {hasMore ? (
        <div className="flex justify-center py-3 text-muted-foreground">{loading && <Loader2 className="size-4 animate-spin" />}</div>
      ) : (
        header
      )}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
        return (
          <Fragment key={m.id}>
            {newDay && showDayDividers && (
              <div className="relative my-3 flex items-center px-4">
                <div className="flex-1 border-t" />
                <span className="mx-3 rounded-full border bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">{formatDayDivider(m.createdAt)}</span>
                <div className="flex-1 border-t" />
              </div>
            )}
            <MessageItem message={m} compact={!newDay && isGrouped(prev, m)} onOpenThread={onOpenThread} />
          </Fragment>
        );
      })}
    </div>
  );
}
