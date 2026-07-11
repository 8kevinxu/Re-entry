import { useEffect, useState } from "react";
import type { Briefing, ProjectDetail } from "../../shared/types";
import { SECTION_TITLES } from "../../shared/types";
import { api } from "../api";
import { longDate, spanBetween, writtenAgo } from "../time";
import { Prose } from "../ui";

/** The whole correspondence, oldest first, with the passage of time marked. */
export function Thread({ slug }: { slug: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [thread, setThread] = useState<Briefing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProject(null);
    setThread(null);
    Promise.all([api.getProject(slug), api.getThread(slug)]).then(
      ([detail, letters]) => {
        setProject(detail);
        setThread(letters);
      },
      (e) => setError(e.message)
    );
  }, [slug]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!project || !thread) return <div className="page" />;

  return (
    <div className="page">
      <a className="back" href={`#/p/${encodeURIComponent(slug)}`}>
        ← Back to the latest letter
      </a>
      <header className="project-header">
        <h1 className="screen-title">{project.name}</h1>
      </header>
      <p className="thread-intro">
        The whole correspondence — {thread.length}{" "}
        {thread.length === 1 ? "letter" : "letters"}, oldest first.
      </p>

      {thread.map((briefing, i) => (
        <div key={briefing.id}>
          {i > 0 && (
            <p className="thread-gap">
              · {spanBetween(thread[i - 1].writtenAt, briefing.writtenAt)} ·
            </p>
          )}
          <article className="letter thread-letter">
            <p className="dateline">
              {longDate(briefing.writtenAt)} ·{" "}
              <time dateTime={briefing.writtenAt}>
                {writtenAgo(briefing.writtenAt)}
              </time>
            </p>

            <div className="next-move">
              <span className="next-move-label">The next move was</span>
              <div className="next-move-body">
                <Prose text={briefing.sections.nextMove} />
              </div>
            </div>

            <section className="letter-section">
              <h2>{SECTION_TITLES.standNow}</h2>
              <Prose text={briefing.sections.standNow} />
            </section>

            {briefing.sections.openQuestions && (
              <section className="letter-section">
                <h2>{SECTION_TITLES.openQuestions}</h2>
                <Prose text={briefing.sections.openQuestions} />
              </section>
            )}

            {briefing.sections.letter && (
              <footer className="signoff">
                <Prose text={briefing.sections.letter} />
              </footer>
            )}
          </article>
        </div>
      ))}
    </div>
  );
}
