import { useEffect, useRef, useState } from "react";
import type { ProjectListing, SearchHit } from "../../shared/types";
import { SECTION_TITLES } from "../../shared/types";
import { api } from "../api";
import { awayFor, writtenAgo } from "../time";
import { firstLine, Highlight } from "../ui";

type Trashed = Awaited<ReturnType<typeof api.listTrash>>[number];

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [trash, setTrash] = useState<Trashed[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listProjects().then(setProjects, (e) => setError(e.message));
    api.listTrash().then(setTrash, () => setTrash([]));
  }, []);

  async function restore(entry: Trashed) {
    await api.restoreLetter(entry.file);
    setTrash(trash.filter((t) => t.file !== entry.file));
    api.listProjects().then(setProjects, () => {});
  }

  // "/" focuses search, like everywhere else on the internet.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api.search(q).then(setHits, () => setHits([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!projects) return <div className="page" />;

  const q = query.trim().toLowerCase();
  const active = projects
    .filter((project) => !project.archived)
    .filter((project) => !q || project.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const lastA = a.lastBriefing?.writtenAt ?? a.createdAt;
      const lastB = b.lastBriefing?.writtenAt ?? b.createdAt;
      return lastA.localeCompare(lastB); // longest away first
    });
  const searching = q !== "";
  const firstRun = projects.length === 0;

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">Re-entry</h1>
        <p className="tagline">Come back to a letter, not a pile.</p>
      </header>

      {firstRun ? (
        <section className="first-run">
          <p>
            Every time you step away from a project, Re-entry walks you through
            a sixty-second ritual: write down where things stand, and the very
            next move.
          </p>
          <p>
            When you come back — in three days or three months — you're greeted
            by that briefing, like a letter from a slightly smarter past self.
          </p>
          <p>No accounts, no cloud. Plain markdown files on your disk.</p>
          <a className="button primary" href="#/new">
            Start your first project
          </a>
        </section>
      ) : (
        <>
          <input
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Search projects and letters…  ( / )"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="list-header">
            <h2 className="list-title">Your projects</h2>
            <a className="button" href="#/new">
              New project
            </a>
          </div>
          {active.length === 0 ? (
            <p className="empty-note">
              {searching
                ? `No project names match “${query.trim()}”.`
                : "Everything's archived. Quiet around here."}
            </p>
          ) : (
            <ul className="project-list">
              {active.map((project) => (
                <li key={project.slug}>
                  <a
                    className="project-card"
                    href={`#/p/${encodeURIComponent(project.slug)}`}
                  >
                    <div className="project-card-top">
                      <span className="project-name">{project.name}</span>
                      <span className="away-badge">
                        away {awayFor(project.lastBriefing?.writtenAt ?? project.createdAt)}
                      </span>
                    </div>
                    <p className="project-teaser">
                      {project.lastBriefing
                        ? `Next: ${firstLine(project.lastBriefing.nextMove)}`
                        : "No letters yet — step away well to write the first one."}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {searching && hits.length > 0 && (
            <section className="hits">
              <h2 className="list-title">In your letters</h2>
              <ul>
                {hits.map((hit) => (
                  <li key={`${hit.slug}/${hit.briefingId}/${hit.section}`}>
                    <a
                      className="hit"
                      href={`#/p/${encodeURIComponent(hit.slug)}/b/${encodeURIComponent(hit.briefingId)}`}
                    >
                      <span className="hit-meta">
                        {hit.projectName} · {SECTION_TITLES[hit.section]} ·{" "}
                        {writtenAgo(hit.writtenAt)}
                      </span>
                      <span className="hit-snippet">
                        <Highlight text={hit.snippet} query={query} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {searching && hits.length === 0 && active.length > 0 && (
            <p className="empty-note">Nothing in the letters themselves.</p>
          )}

          {!searching && trash.length > 0 && (
            <details className="archived trash">
              <summary className="list-title">Trash ({trash.length})</summary>
              <ul>
                {trash.map((entry) => (
                  <li key={entry.file} className="trash-row">
                    <span>
                      {entry.projectName}
                      <span className="ago"> · {writtenAgo(entry.writtenAt)}</span>
                    </span>
                    <button
                      className="button subtle"
                      onClick={() => void restore(entry)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!searching && projects.some((p) => p.archived) && (
            <details className="archived">
              <summary className="list-title">
                Archived ({projects.filter((p) => p.archived).length})
              </summary>
              <ul>
                {projects
                  .filter((p) => p.archived)
                  .map((project) => (
                    <li key={project.slug}>
                      <a href={`#/p/${encodeURIComponent(project.slug)}`}>
                        {project.name}
                      </a>
                    </li>
                  ))}
              </ul>
            </details>
          )}

          {!searching && <StatLine projects={projects} />}
        </>
      )}
    </div>
  );
}

function StatLine({ projects }: { projects: ProjectListing[] }) {
  const letters = projects.reduce((sum, p) => sum + p.letterCount, 0);
  if (letters === 0) return null;
  const since = projects
    .map((p) => p.firstWrittenAt)
    .filter((d): d is string => d !== null)
    .sort()[0];
  const sinceLabel = new Date(since).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <p className="stat-line">
      {letters} {letters === 1 ? "letter" : "letters"} across {projects.length}{" "}
      {projects.length === 1 ? "project" : "projects"} · writing since {sinceLabel}
    </p>
  );
}
