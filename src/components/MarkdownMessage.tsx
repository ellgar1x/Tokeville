"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

/** Flatten a React children tree into its raw text (for the copy button). */
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors hover:text-foreground cursor-pointer"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Code fence: a header (language + copy) over the highlighted block. */
function PreBlock({ children }: { children?: ReactNode }) {
  const codeEl = Array.isArray(children) ? children[0] : children;
  const className =
    (codeEl && typeof codeEl === "object" && "props" in codeEl
      ? (codeEl as { props: { className?: string } }).props.className
      : "") ?? "";
  const lang = /language-([\w-]+)/.exec(className)?.[1] ?? "";
  const getText = () => nodeText(children);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border-strong bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-border-strong px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-subtle">{lang || "code"}</span>
        <CopyButton getText={getText} />
      </div>
      <pre className="scroll-thin overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: PreBlock,
          code({ className, children, ...props }) {
            // Block code carries a language- class (wrapped by PreBlock); leave it
            // for highlight.js. Everything else is inline code.
            if (className?.includes("language-") || className?.includes("hljs")) {
              return <code className={className} {...props}>{children}</code>;
            }
            return <code className="md-inline-code" {...props}>{children}</code>;
          },
          a({ children, ...props }) {
            return <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
