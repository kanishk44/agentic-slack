import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { AtSign, SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_LENGTH, type MessageDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { getSocket } from '@/lib/socket';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMessageStore } from '@/stores/messageStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { MentionMenu } from './MentionMenu';

export interface ComposerHandle {
  insert: (text: string) => void;
  focus: () => void;
}

interface Props {
  channelId: string;
  threadId?: string | null;
  placeholder: string;
  onSent?: (message: MessageDTO) => void;
  autoFocus?: boolean;
}

const MENTION_QUERY = /(^|\s)@([a-z0-9_-]*)$/i;
const TYPING_THROTTLE_MS = 2500;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ channelId, threadId = null, placeholder, onSent, autoFocus }, ref) {
  const send = useMessageStore((s) => s.send);
  const agents = useWorkspaceStore((s) => s.agents);
  const channel = useWorkspaceStore((s) => s.channels.find((c) => c.id === channelId));
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingAt = useRef(0);
  /** Caret position to restore after a programmatic value change (applied synchronously, before further keystrokes). */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || pendingCaret.current === null) return;
    el.focus();
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  useImperativeHandle(ref, () => ({
    insert: (text) => {
      pendingCaret.current = text.length;
      setValue(text);
    },
    focus: () => textareaRef.current?.focus(),
  }));

  // Channel members first, then the rest of the workspace.
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const inChannel = new Set(channel?.agentIds ?? []);
    return agents
      .filter((a) => a.handle.startsWith(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => Number(inChannel.has(b.id)) - Number(inChannel.has(a.id)))
      .slice(0, 8)
      .map((a) => ({ agent: a, inChannel: inChannel.has(a.id) }));
  }, [mention, agents, channel?.agentIds]);

  useEffect(() => setActiveIndex(0), [mention?.query]);

  // Auto-grow up to a max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const updateMention = (text: string, caret: number) => {
    const match = text.slice(0, caret).match(MENTION_QUERY);
    setMention(match ? { query: match[2], start: caret - match[2].length - 1 } : null);
  };

  const pickMention = (handle: string) => {
    if (!mention) return;
    const caret = textareaRef.current!.selectionStart;
    const next = `${value.slice(0, mention.start)}@${handle} ${value.slice(caret)}`;
    pendingCaret.current = mention.start + handle.length + 2;
    setValue(next);
    setMention(null);
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || sending) return;
    if (content.length > MAX_MESSAGE_LENGTH) return toast.error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters`);
    setSending(true);
    setValue('');
    setMention(null);
    try {
      const message = await send({ channelId, threadId, content });
      onSent?.(message);
    } catch (err) {
      setValue(content);
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(suggestions[activeIndex]!.agent.handle);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const onChange = (text: string, caret: number) => {
    setValue(text);
    updateMention(text, caret);
    const now = Date.now();
    if (text && now - lastTypingAt.current > TYPING_THROTTLE_MS) {
      lastTypingAt.current = now;
      getSocket().emit('typing', channelId);
    }
  };

  const startMention = () => {
    const el = textareaRef.current!;
    const caret = el.selectionStart;
    const needsSpace = caret > 0 && !/\s/.test(value[caret - 1] ?? '');
    const next = `${value.slice(0, caret)}${needsSpace ? ' ' : ''}@${value.slice(caret)}`;
    const pos = caret + (needsSpace ? 2 : 1);
    pendingCaret.current = pos;
    setValue(next);
    setMention({ query: '', start: pos - 1 });
  };

  return (
    <div className="relative">
      {mention && suggestions.length > 0 && (
        <MentionMenu
          items={suggestions}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onPick={(a) => pickMention(a.handle)}
        />
      )}
      <div className="rounded-xl border bg-background shadow-sm focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          onClick={(e) => updateMention(value, e.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          className="block max-h-60 w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground"
          aria-label={placeholder}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={startMention} aria-label="Mention an agent">
            <AtSign className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> new line
            </span>
            <Button
              type="button"
              size="icon"
              className={cn('size-7', !value.trim() && 'opacity-50')}
              disabled={!value.trim() || sending}
              onClick={() => void submit()}
              aria-label="Send message"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
