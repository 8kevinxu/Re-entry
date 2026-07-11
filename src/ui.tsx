/** Render free text as paragraphs, preserving single line breaks. */
export function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim() !== "");
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>
          {paragraph.split("\n").map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

export function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}
