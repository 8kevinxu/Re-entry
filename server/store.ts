import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  type Briefing,
  type BriefingSections,
  type BriefingSummary,
  type Project,
  type ProjectLink,
  type SearchHit,
} from "../shared/types.ts";

export function dataDir(): string {
  return process.env.RE_ENTRY_HOME || path.join(os.homedir(), ".re-entry");
}

function projectsDir(): string {
  return path.join(dataDir(), "projects");
}

function projectDir(slug: string): string {
  return path.join(projectsDir(), slug);
}

function briefingsDir(slug: string): string {
  return path.join(projectDir(slug), "briefings");
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project"
  );
}

function readProjectFile(slug: string): Project | null {
  const file = path.join(projectDir(slug), "project.json");
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    slug,
    name: raw.name ?? slug,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    archived: raw.archived ?? false,
    links: Array.isArray(raw.links) ? raw.links : [],
  };
}

function writeProjectFile(project: Project): void {
  const { slug, ...rest } = project;
  fs.mkdirSync(projectDir(slug), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir(slug), "project.json"),
    JSON.stringify(rest, null, 2) + "\n"
  );
}

export function listProjects(): Project[] {
  if (!fs.existsSync(projectsDir())) return [];
  return fs
    .readdirSync(projectsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readProjectFile(entry.name))
    .filter((project): project is Project => project !== null);
}

export function getProject(slug: string): Project | null {
  return readProjectFile(slug);
}

export function createProject(name: string, links: ProjectLink[]): Project {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; fs.existsSync(projectDir(slug)); n++) {
    slug = `${base}-${n}`;
  }
  const project: Project = {
    slug,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    archived: false,
    links,
  };
  writeProjectFile(project);
  return project;
}

export function updateProject(
  slug: string,
  patch: Partial<Pick<Project, "name" | "links" | "archived">>
): Project | null {
  const project = readProjectFile(slug);
  if (!project) return null;
  const updated: Project = {
    ...project,
    ...(patch.name !== undefined && { name: patch.name.trim() }),
    ...(patch.links !== undefined && { links: patch.links }),
    ...(patch.archived !== undefined && { archived: patch.archived }),
  };
  writeProjectFile(updated);
  return updated;
}

// --- Briefings -------------------------------------------------------------
//
// Each briefing is a plain markdown file: a small frontmatter block with the
// timestamp, then one `## Title` section per answered ritual step. The files
// are meant to be readable (and greppable) without the app.

export function listBriefings(slug: string): BriefingSummary[] {
  const dir = briefingsDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const id = name.replace(/\.md$/, "");
      const briefing = readBriefing(slug, id);
      return briefing ? { id, writtenAt: briefing.writtenAt } : null;
    })
    .filter((entry): entry is BriefingSummary => entry !== null)
    .sort((a, b) => b.writtenAt.localeCompare(a.writtenAt));
}

export function readBriefing(slug: string, id: string): Briefing | null {
  if (!/^[\w.-]+$/.test(id)) return null;
  const file = path.join(briefingsDir(slug), `${id}.md`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");

  let writtenAt = new Date(0).toISOString();
  let body = text;
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatter) {
    body = text.slice(frontmatter[0].length);
    const line = frontmatter[1].match(/^writtenAt:\s*(.+)$/m);
    if (line) writtenAt = line[1].trim();
  }

  // Walk line by line, starting a new section only on a heading that exactly
  // matches one of the known titles — so user text that happens to contain
  // "## something" survives a round-trip.
  const titleToKey = new Map(
    SECTION_ORDER.map((key) => [`## ${SECTION_TITLES[key]}`, key])
  );
  const sections: BriefingSections = { standNow: "", nextMove: "" };
  let currentKey: keyof BriefingSections | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (currentKey) sections[currentKey] = lines.join("\n").trim();
  };
  for (const line of body.split("\n")) {
    const key = titleToKey.get(line.trim());
    if (key) {
      flush();
      currentKey = key;
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();

  return { id, writtenAt, sections };
}

export function expandHome(p: string): string {
  return p.replace(/^~(?=\/|$)/, os.homedir());
}

/**
 * Resolve symlinks (macOS /tmp → /private/tmp) so path comparisons hold.
 * For paths that don't exist, canonicalize the nearest existing ancestor.
 */
function canonical(p: string): string {
  let dir = path.resolve(p);
  let suffix = "";
  for (;;) {
    try {
      return path.join(fs.realpathSync(dir), suffix);
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return path.join(dir, suffix);
      suffix = path.join(path.basename(dir), suffix);
      dir = parent;
    }
  }
}

/**
 * The project whose local pile links contain `absPath` (e.g. the cwd).
 * The deepest matching link wins if several projects claim a parent dir.
 */
export function findProjectByPath(absPath: string): Project | null {
  const target = canonical(absPath);
  let best: Project | null = null;
  let bestLength = -1;
  for (const project of listProjects()) {
    if (project.archived) continue;
    for (const link of project.links) {
      if (!/^[/~]/.test(link.url)) continue;
      const dir = canonical(expandHome(link.url));
      if (
        (target === dir || target.startsWith(dir + path.sep)) &&
        dir.length > bestLength
      ) {
        best = project;
        bestLength = dir.length;
      }
    }
  }
  return best;
}

/** Deleting a letter moves it to the trash — letters are too precious to unlink. */
export function deleteBriefing(slug: string, id: string): boolean {
  if (!/^[\w.-]+$/.test(id)) return false;
  const file = path.join(briefingsDir(slug), `${id}.md`);
  if (!fs.existsSync(file)) return false;
  const trash = path.join(dataDir(), "trash");
  fs.mkdirSync(trash, { recursive: true });
  fs.renameSync(file, path.join(trash, `${slug}--${id}.md`));
  return true;
}

function makeSnippet(content: string, at: number, matchLength: number): string {
  const start = Math.max(0, at - 60);
  const end = Math.min(content.length, at + matchLength + 60);
  const body = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

/** Case-insensitive full-text search across every letter, newest first. */
export function searchBriefings(query: string, limit = 50): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const project of listProjects()) {
    for (const summary of listBriefings(project.slug)) {
      const briefing = readBriefing(project.slug, summary.id);
      if (!briefing) continue;
      for (const key of SECTION_ORDER) {
        const content = briefing.sections[key];
        if (!content) continue;
        const at = content.toLowerCase().indexOf(q);
        if (at === -1) continue;
        hits.push({
          slug: project.slug,
          projectName: project.name,
          briefingId: briefing.id,
          writtenAt: briefing.writtenAt,
          section: key,
          snippet: makeSnippet(content, at, q.length),
        });
        break; // one hit per letter keeps the list scannable
      }
    }
  }
  return hits
    .sort((a, b) => b.writtenAt.localeCompare(a.writtenAt))
    .slice(0, limit);
}

/** Git state of any local-path pile links, one line per repo. "" if none. */
export function gitSnapshot(links: ProjectLink[]): string {
  const lines: string[] = [];
  for (const link of links) {
    if (!/^[/~]/.test(link.url)) continue;
    const cwd = expandHome(link.url);
    try {
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", cwd, ...args], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 3000,
        }).trim();
      git("rev-parse", "--is-inside-work-tree");
      const branch = git("branch", "--show-current") || "detached HEAD";
      const head = git("log", "-1", "--format=%h %s");
      const dirty = git("status", "--porcelain");
      const state = dirty
        ? `${dirty.split("\n").length} uncommitted change(s)`
        : "clean";
      lines.push(`${link.label}: ${branch} @ ${head} — ${state}`);
    } catch {
      // not a git repo, or git unavailable — say nothing
    }
  }
  return lines.join("\n");
}

export function createBriefing(
  slug: string,
  sections: BriefingSections
): Briefing {
  if (!sections.snapshot) {
    sections = {
      ...sections,
      snapshot: gitSnapshot(getProject(slug)?.links ?? []),
    };
  }
  const writtenAt = new Date();
  const id = writtenAt
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-");

  let markdown = `---\nwrittenAt: ${writtenAt.toISOString()}\n---\n`;
  for (const key of SECTION_ORDER) {
    const content = sections[key]?.trim();
    if (content) markdown += `\n## ${SECTION_TITLES[key]}\n\n${content}\n`;
  }

  fs.mkdirSync(briefingsDir(slug), { recursive: true });
  fs.writeFileSync(path.join(briefingsDir(slug), `${id}.md`), markdown);
  return { id, writtenAt: writtenAt.toISOString(), sections };
}
