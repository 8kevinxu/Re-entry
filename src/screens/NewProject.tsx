import { useState } from "react";
import type { FormEvent } from "react";
import type { ProjectLink } from "../../shared/types";
import { api } from "../api";
import { navigate } from "../App";

export function NewProject() {
  const [name, setName] = useState("");
  const [links, setLinks] = useState<ProjectLink[]>([{ label: "", url: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setLink(index: number, patch: Partial<ProjectLink>) {
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const project = await api.createProject(name, links);
      navigate(`/p/${encodeURIComponent(project.slug)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="page narrow">
      <a className="back" href="#/">← All projects</a>
      <h1 className="screen-title">A new project</h1>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you working on?"
          />
        </label>

        <div className="field">
          <span className="field-label">
            The pile <em>(optional)</em>
          </span>
          <p className="field-hint">
            Links or paths future-you will need — the repo, a doc, a folder.
          </p>
          {links.map((link, i) => (
            <div className="link-row" key={i}>
              <input
                value={link.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Label"
              />
              <input
                value={link.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://… or /path/to/it"
              />
            </div>
          ))}
          <button
            type="button"
            className="button subtle"
            onClick={() => setLinks([...links, { label: "", url: "" }])}
          >
            + Another link
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="button primary" disabled={!name.trim() || saving}>
          Create project
        </button>
      </form>
    </div>
  );
}
