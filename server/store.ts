import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  type Briefing,
  type BriefingSections,
  type BriefingSummary,
  type Project,
  type ProjectLink,
} from "../shared/types";

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

  const titleToKey = new Map(
    SECTION_ORDER.map((key) => [SECTION_TITLES[key], key])
  );
  const sections: BriefingSections = { standNow: "", nextMove: "" };
  for (const chunk of body.split(/^## /m).slice(1)) {
    const newline = chunk.indexOf("\n");
    const title = (newline === -1 ? chunk : chunk.slice(0, newline)).trim();
    const content = (newline === -1 ? "" : chunk.slice(newline + 1)).trim();
    const key = titleToKey.get(title);
    if (key) sections[key] = content;
  }

  return { id, writtenAt, sections };
}

export function createBriefing(
  slug: string,
  sections: BriefingSections
): Briefing {
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
