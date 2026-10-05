import { useEffect, useState } from 'react';
import { useMessageStore } from '@/stores/messageStore';

const TYPING_TTL_MS = 4000;

export function TypingIndicator({ channelId }: { channelId: string }) {
  const typing = useMessageStore((s) => s.typing[channelId]);
  const [now, setNow] = useState(Date.now());

  const active = Object.values(typing ?? {}).filter((t) => now - t.at < TYPING_TTL_MS);

  useEffect(() => {
    if (!typing) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [typing]);

  return (
    <div className="h-5 px-1 pt-1 text-xs text-muted-foreground" aria-live="polite">
      {active.length > 0 && `${active.map((t) => t.name).join(', ')} ${active.length === 1 ? 'is' : 'are'} typing…`}
    </div>
  );
}
