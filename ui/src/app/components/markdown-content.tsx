"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  className?: string;
  content: string;
};

// 中文标点紧跟 URL 时，自动链接有时会把后面的中文也吃进去。
// 这里先做一次文本归一化，让链接边界更稳定。
const cjkRanges = "\\u3000-\\u303F\\u4E00-\\u9FFF\\uFF01-\\uFF60";
const urlFollowedByCjk = new RegExp(`(https?:\\/\\/[^\\s${cjkRanges}]+)([${cjkRanges}])`, "g");

function normalizeAutolinks(value: string) {
  return value.replace(urlFollowedByCjk, "$1 $2");
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-5 mb-3 text-xl leading-8 font-semibold text-zinc-50 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2.5 text-lg leading-7 font-semibold text-zinc-50 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base leading-7 font-semibold text-zinc-100 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-base leading-8 text-zinc-400 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-base leading-8 text-zinc-400 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-base leading-8 text-zinc-400 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-blue-500/45 pl-4 text-zinc-400">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => {
    if (href && /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(href)) {
      return <span>{children}</span>;
    }
    return (
      <a
        className="text-blue-300 underline-offset-4 hover:underline"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  },
  code: ({ children, className }) => {
    const value = String(children);
    const block = value.includes("\n") || className?.startsWith("language-");
    if (!block) {
      return (
        <code className="rounded-md border border-white/10 bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-100">
          {children}
        </code>
      );
    }
    return (
      <code className="block overflow-x-auto rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-sm leading-6 whitespace-pre text-zinc-100">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-4 overflow-x-auto">{children}</pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full border-collapse text-sm text-zinc-300">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 bg-white/[0.05] px-3 py-2 text-left font-semibold text-zinc-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/5 px-3 py-2 text-zinc-400">{children}</td>
  ),
};

export default function MarkdownContent({ className = "", content }: MarkdownContentProps) {
  return (
    <div className={`wrap-break-words ${className}`}>
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {normalizeAutolinks(content)}
      </ReactMarkdown>
    </div>
  );
}
