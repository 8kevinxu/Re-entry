import { useEffect, useState } from "react";
import type { Briefing, ProjectDetail } from "../../shared/types";
import { api } from "../api";
import { navigate } from "../App";
import { longDate, writtenAgo } from "../time";
import { Prose } from "../ui";

export function Letter({
  slug,
  briefingId,
}: {
  slug: string;
  briefingId?: string;
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProject(null);
    setBriefing(null);
    api.getProject(slug).then((detail) => {
      setProject(detail);
      if (briefingId && briefingId !== detail.latest?.id) {
        api.getBriefing(slug, briefingId).then(setBriefing, (e) => setError(e.message));
      } else {
        setBriefing(detail.latest);
      }
    }, (e) => setError(e.message));
  }, [slug, briefingId]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!project) return <div className="page" />;

  const isOlderLetter = briefingId != null && briefingId !== project.latest?.id;
  const olderLetters = project.briefings.filter(
    (b) => b.id !== briefing?.id && b.id !== project.latest?.id
  );
  const hasArchive = olderLetters.length > 0 || isOlderLetter;
  const leaveHref = `#/p/${encodeURIComponent(slug)}/leave`;

  async function archive() {
    if (!window.confirm(`Archive “${project!.name}”? Its files stay on disk.`)) return;
    await api.updateProject(slug, { archived: true });
    navigate("/");
  }

  return (
    <div className="page">
      <a className="back" href="#/">← All projects</a>

      <header className="project-header">
        <h1 className="screen-title">{project.name}</h1>
        <a className="button primary" href={leaveHref}>
          I'm stepping away
        </a>
      </header>

      {project.links.length > 0 && (
        <nav className="pile">
          <span className="pile-label">The pile:</span>
          {project.links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      )}

      {!briefing ? (
        <section className="first-run">
          <p>
            No letters yet. When you step away, Re-entry will walk you through
            leaving a sixty-second briefing for the person who comes back.
          </p>
          <p>For now — you're here. Get to work.</p>
        </section>
      ) : (
        <article className="letter">
          <p className="dateline">
            {isOlderLetter ? "An earlier letter" : "Written by past-you"} ·{" "}
            <time dateTime={briefing.writtenAt} title={longDate(briefing.writtenAt)}>
              {writtenAgo(briefing.writtenAt)}
            </time>
          </p>

          <div className="next-move">
            <span className="next-move-label">Your next move</span>
            <div className="next-move-body">
              <Prose text={briefing.sections.nextMove} />
            </div>
          </div>

          <section className="letter-section">
            <h2>Where things stand</h2>
            <Prose text={briefing.sections.standNow} />
          </section>

          {briefing.sections.why && (
            <section className="letter-section">
              <h2>Why</h2>
              <Prose text={briefing.sections.why} />
            </section>
          )}

          {briefing.sections.openQuestions && (
            <section className="letter-section">
              <h2>Open questions</h2>
              <Prose text={briefing.sections.openQuestions} />
            </section>
          )}

          {briefing.sections.ignore && (
            <section className="letter-section">
              <h2>Ignore this</h2>
              <Prose text={briefing.sections.ignore} />
            </section>
          )}

          {briefing.sections.letter && (
            <footer className="signoff">
              <Prose text={briefing.sections.letter} />
              <p className="signature">— past you</p>
            </footer>
          )}
        </article>
      )}

      {hasArchive && (
        <section className="archive">
          <h2 className="list-title">Previous letters</h2>
          <ul>
            {isOlderLetter && project.latest && (
              <li>
                <a href={`#/p/${encodeURIComponent(slug)}`}>
                  {longDate(project.latest.writtenAt)}
                  <span className="ago"> · latest</span>
                </a>
              </li>
            )}
            {olderLetters.map((b) => (
                <li key={b.id}>
                  <a href={`#/p/${encodeURIComponent(slug)}/b/${encodeURIComponent(b.id)}`}>
                    {longDate(b.writtenAt)}
                    <span className="ago"> · {writtenAgo(b.writtenAt)}</span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      )}

      <footer className="project-footer">
        <button className="button subtle" onClick={archive}>
          Archive project
        </button>
      </footer>
    </div>
  );
}
