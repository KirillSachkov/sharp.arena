import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type CodeFrameProps = {
  /** Source code as an array of lines so we can render line numbers. */
  lines: string[];
  language?: string;
  filename?: string;
  className?: string;
  trailing?: ReactNode;
};

/**
 * Visual placeholder for a Monaco editor. Renders a read-only code surface
 * with line numbers and basic C#-flavored keyword/string/comment colorization.
 * Swap with the real Monaco component once Phase 1 lands the runner.
 */
export function CodeFrame({
  lines,
  language = "csharp",
  filename,
  className,
  trailing,
}: CodeFrameProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border-subtle bg-bg-deep",
        className,
      )}
    >
      {filename ? (
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-panel/60 px-3 py-2 font-mono text-xs">
          <div className="inline-flex items-center gap-2 rounded-md bg-bg-elevated px-2.5 py-1 text-text">
            <span className="size-2 rounded-full bg-primary/80" aria-hidden />
            <span>{filename}</span>
          </div>
          {trailing ?? null}
        </div>
      ) : null}
      <pre
        className="m-0 flex min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-6"
        aria-label={`${language} sample`}
      >
        <code className="block w-full">
          <div className="grid grid-cols-[auto_1fr]">
            <div className="select-none border-r border-border-subtle bg-bg-panel/50 px-3 py-3 text-right text-text-muted">
              {lines.map((_, i) => (
                <div key={i} className="tabular-nums">
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="px-4 py-3 text-text">
              {lines.map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {tokenize(line)}
                </div>
              ))}
            </div>
          </div>
        </code>
      </pre>
    </div>
  );
}

const KEYWORDS = new Set([
  "using",
  "public",
  "private",
  "class",
  "static",
  "void",
  "int",
  "string",
  "bool",
  "var",
  "new",
  "return",
  "for",
  "foreach",
  "while",
  "if",
  "else",
  "true",
  "false",
  "null",
  "namespace",
]);

const TOKEN_RE = /("(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z0-9_]*|\d+|\s+|.)/g;

function tokenize(line: string) {
  const out: ReactNode[] = [];
  const commentIdx = line.indexOf("//");
  const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const comment = commentIdx >= 0 ? line.slice(commentIdx) : null;

  let key = 0;
  for (const match of code.matchAll(TOKEN_RE)) {
    const tok = match[0];
    if (tok.startsWith('"')) {
      out.push(
        <span key={key++} className="text-accent-green">
          {tok}
        </span>,
      );
    } else if (/^\d+$/.test(tok)) {
      out.push(
        <span key={key++} className="text-accent-gold">
          {tok}
        </span>,
      );
    } else if (KEYWORDS.has(tok)) {
      out.push(
        <span key={key++} className="text-primary-soft">
          {tok}
        </span>,
      );
    } else {
      out.push(<span key={key++}>{tok}</span>);
    }
  }

  if (comment) {
    out.push(
      <span key="c" className="text-text-muted">
        {comment}
      </span>,
    );
  }
  return out;
}
