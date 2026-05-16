'use client';

import ReactMarkdown from 'react-markdown';

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h3: ({ children }) => <p className="font-bold text-slate-800 mt-3 mb-1 first:mt-0">{children}</p>,
        h4: ({ children }) => <p className="font-semibold text-slate-700 mt-2 mb-1 first:mt-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-black/10">{children}</code>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-black/10">{children}</thead>,
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-semibold border border-black/15">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border border-black/10">{children}</td>
        ),
        hr: () => <hr className="my-2 border-black/10" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
