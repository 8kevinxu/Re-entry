import { useEffect, useState } from "react";
import type { ProjectListing } from "../../shared/types";
import { api } from "../api";
import { awayFor } from "../time";
import { firstLine } from "../ui";

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects, (e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!projects) return <div className="page" />;

  const active = projects
    .filter((project) => !project.archived)
    .sort((a, b) => {
      const lastA = a.lastBriefing?.writtenAt ?? a.createdAt;
      const lastB = b.lastBriefing?.writtenAt ?? b.createdAt;
      return lastA.localeCompare(lastB); // longest away first
    });

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">Re-entry</h1>
        <p className="tagline">Come back to a letter, not a pile.</p>
      </header>

      {active.length === 0 ? (
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
          <div className="list-header">
            <h2 className="list-title">Your projects</h2>
            <a className="button" href="#/new">
              New project
            </a>
          </div>
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
        </>
      )}
    </div>
  );
}
