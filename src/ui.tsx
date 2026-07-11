import { useEffect, useRef, useState } from "react";
import type { ProjectLink } from "../shared/types";

/**
 * Render free text as paragraphs, preserving single line breaks.
 * A block whose lines all start with "- " or "* " becomes a list.
 */
export function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim() !== "");
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");
        if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^\s*[-*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {block.split("\n").map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Wrap case-insensitive matches of `query` in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      )}
    </>
  );
}

export function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

/** Web links open; local paths copy to the clipboard instead of 404ing. */
export function PileLink({ link }: { link: ProjectLink }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (/^https?:\/\//i.test(link.url)) {
    return (
      <a href={link.url} target="_blank" rel="noreferrer">
        {link.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="pile-path"
      title={`Copy ${link.url}`}
      onClick={() => {
        void navigator.clipboard.writeText(link.url);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "copied ✓" : link.label}
    </button>
  );
}
