import { memo, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';
import { MENTION_REGEX } from '@slack/shared';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const MENTION_HREF = '#mention-';
/** Splits out fenced and inline code so mentions inside code are left alone. */
const CODE_SPLIT = /(```[\s\S]*?```|`[^`\n]*`)/g;

function linkifyMentions(content: string, handles: Set<string>) {
  return content
    .split(CODE_SPLIT)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(MENTION_REGEX, (full, pre: string, handle: string) =>
            handles.has(handle.toLowerCase()) ? `${pre}[@${handle}](${MENTION_HREF}${handle.toLowerCase()})` : full,
          ),
    )
    .join('');
}

function CodeBlock(props: React.ComponentProps<'pre'>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const child = props.children as React.ReactElement<{ className?: string }> | undefined;
  const lang = child?.props?.className?.match(/language-([\w-]+)/)?.[1];

  const copy = async () => {
    await navigator.clipboard.writeText(ref.current?.textContent ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-800 bg-[#0d1117] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1 text-xs text-zinc-400">
        <span className="font-mono">{lang ?? 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Copy code">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref} className="p-3">{props.children}</pre>
    </div>
  );
}

const components: Components = {
  pre: CodeBlock,
  a: ({ href, children }) => {
    if (href?.startsWith(MENTION_HREF)) {
      return <span className="rounded bg-mention px-1 py-px font-medium text-mention-foreground">{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

/** Safe markdown (no raw HTML) with syntax highlighting and @mention chips. */
export const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const agents = useWorkspaceStore((s) => s.agents);
  const handles = useMemo(() => new Set(agents.map((a) => a.handle)), [agents]);
  const source = useMemo(() => linkifyMentions(content, handles), [content, handles]);

  return (
    <div className="prose-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={components}
        urlTransform={(url) => (url.startsWith(MENTION_HREF) ? url : defaultUrlTransform(url))}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
