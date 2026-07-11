import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ProjectLink } from "../../shared/types";
import { api } from "../api";
import { navigate } from "../App";

export function EditProject({ slug }: { slug: string }) {
  const [name, setName] = useState<string | null>(null);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProject(slug).then((project) => {
      setName(project.name);
      setLinks(
        project.links.length > 0 ? project.links : [{ label: "", url: "" }]
      );
    }, (e) => setError(e.message));
  }, [slug]);

  function setLink(index: number, patch: Partial<ProjectLink>) {
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || name === null) return;
    setSaving(true);
    try {
      await api.updateProject(slug, { name, links });
      navigate(`/p/${encodeURIComponent(slug)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (name === null) return <div className="page" />;

  return (
    <div className="page narrow">
      <a className="back" href={`#/p/${encodeURIComponent(slug)}`}>← Back to the letter</a>
      <h1 className="screen-title">Edit project</h1>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="field">
          <span className="field-label">The pile</span>
          <p className="field-hint">
            Links or paths future-you will need — the repo, a doc, a folder.
            Local repo paths also power the automatic code snapshot.
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

        <button className="button primary" disabled={!name.trim() || saving}>
          Save
        </button>
      </form>
    </div>
  );
}
