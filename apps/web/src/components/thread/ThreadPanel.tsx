import { useEffect } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { errorMessage } from '@/lib/api';
import { useMessageStore } from '@/stores/messageStore';
import { useUIStore } from '@/stores/uiStore';
import { MessageList } from '@/components/messages/MessageList';
import { MessageItem } from '@/components/messages/MessageItem';
import { Composer } from '@/components/composer/Composer';

export function ThreadPanel({ rootId, channelId, channelName }: { rootId: string; channelId: string; channelName: string }) {
  const thread = useMessageStore((s) => s.threads[rootId]);
  const channelRoot = useMessageStore((s) => s.channels[channelId]?.items.find((m) => m.id === rootId));
  const loadThread = useMessageStore((s) => s.loadThread);
  const closeThread = useUIStore((s) => s.closeThread);

  useEffect(() => {
    loadThread(rootId).catch((err) => {
      toast.error(errorMessage(err));
      closeThread();
    });
  }, [rootId, loadThread, closeThread]);

  const root = thread?.root ?? channelRoot;
  const replies = thread?.replies ?? [];

  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-background md:static md:z-auto md:w-[440px] md:border-l lg:w-[480px]">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Thread</h2>
          <p className="text-xs text-muted-foreground">#{channelName}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={closeThread} aria-label="Close thread">
          <X />
        </Button>
      </header>
      {!root ? (
        <FullPageSpinner />
      ) : (
        <>
          <MessageList
            resetKey={rootId}
            showDayDividers={false}
            messages={replies}
            header={
              <div className="pb-2">
                <MessageItem message={root} />
                <div className="flex items-center gap-3 px-4 pt-2 text-xs text-muted-foreground">
                  <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                  <div className="flex-1 border-t" />
                </div>
              </div>
            }
          />
          <div className="px-4 pb-3">
            <Composer channelId={channelId} threadId={rootId} placeholder="Reply… (@mention to bring in an agent)" autoFocus />
          </div>
        </>
      )}
    </aside>
  );
}
