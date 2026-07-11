import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

before(() => {
  process.env.RE_ENTRY_HOME = fs.mkdtempSync(
    path.join(os.tmpdir(), "re-entry-test-")
  );
});

const store = await import("../server/store.ts");

test("createProject slugifies awkward names", () => {
  const project = store.createProject("  Café — Nº 9!!  ", []);
  assert.equal(project.slug, "caf-n-9");
  assert.equal(project.name, "Café — Nº 9!!");
});

test("createProject resolves slug collisions", () => {
  const first = store.createProject("Same Name", []);
  const second = store.createProject("Same  name", []);
  assert.equal(first.slug, "same-name");
  assert.equal(second.slug, "same-name-2");
});

test("briefings round-trip through markdown", () => {
  const project = store.createProject("Round Trip", []);
  const sections = {
    standNow: "First paragraph.\n\nSecond paragraph\nwith a soft break.",
    why: "Because reasons.",
    openQuestions: "",
    nextMove: "Do the thing.",
    ignore: "- the red herring\n- the dead end",
    letter: "Godspeed.",
  };
  const created = store.createBriefing(project.slug, sections);
  const read = store.readBriefing(project.slug, created.id);
  assert.ok(read);
  assert.equal(read.writtenAt, created.writtenAt);
  assert.equal(read.sections.standNow, sections.standNow);
  assert.equal(read.sections.why, sections.why);
  assert.equal(read.sections.nextMove, sections.nextMove);
  assert.equal(read.sections.ignore, sections.ignore);
  assert.equal(read.sections.letter, sections.letter);
  // empty optional section is omitted from the file entirely
  const file = fs.readFileSync(
    path.join(
      store.dataDir(),
      "projects",
      project.slug,
      "briefings",
      `${created.id}.md`
    ),
    "utf8"
  );
  assert.ok(!file.includes("## Open questions"));
});

test("user text containing '## ' lines survives a round-trip", () => {
  const project = store.createProject("Heading Hazard", []);
  const standNow = "Docs draft includes:\n## Getting started\n## API notes";
  const created = store.createBriefing(project.slug, {
    standNow,
    nextMove: "Finish the docs.",
  });
  const read = store.readBriefing(project.slug, created.id);
  assert.equal(read?.sections.standNow, standNow);
  assert.equal(read?.sections.nextMove, "Finish the docs.");
});

test("listBriefings returns newest first", () => {
  const project = store.createProject("Ordering", []);
  const dir = path.join(store.dataDir(), "projects", project.slug, "briefings");
  fs.mkdirSync(dir, { recursive: true });
  for (const stamp of ["2024-01-05T10-00-00", "2026-03-01T09-30-00", "2025-06-15T20-00-00"]) {
    fs.writeFileSync(
      path.join(dir, `${stamp}.md`),
      `---\nwrittenAt: ${stamp.slice(0, 10)}T12:00:00.000Z\n---\n\n## Where things stand\n\nx\n`
    );
  }
  const ids = store.listBriefings(project.slug).map((b) => b.id);
  assert.deepEqual(ids, [
    "2026-03-01T09-30-00",
    "2025-06-15T20-00-00",
    "2024-01-05T10-00-00",
  ]);
});

test("readBriefing rejects path-traversal ids", () => {
  const project = store.createProject("Traversal", []);
  assert.equal(store.readBriefing(project.slug, "../../../etc/passwd"), null);
  assert.equal(store.readBriefing(project.slug, "a/b"), null);
});

test("updateProject archives and renames", () => {
  const project = store.createProject("Mutable", []);
  const updated = store.updateProject(project.slug, {
    archived: true,
    name: "Renamed",
  });
  assert.equal(updated?.archived, true);
  assert.equal(updated?.name, "Renamed");
  assert.equal(store.getProject(project.slug)?.archived, true);
});

test("createBriefing captures a git snapshot of local pile links", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "re-entry-repo-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "hello world");
  fs.writeFileSync(path.join(repo, "dirty.txt"), "x");

  const project = store.createProject("Snapshotted", [
    { label: "Code", url: repo },
    { label: "Site", url: "https://example.com" },
  ]);
  const created = store.createBriefing(project.slug, {
    standNow: "s",
    nextMove: "n",
  });
  assert.ok(created.sections.snapshot?.includes("hello world"));
  assert.ok(created.sections.snapshot?.includes("1 uncommitted change"));
  assert.ok(!created.sections.snapshot?.includes("example.com"));
  const read = store.readBriefing(project.slug, created.id);
  assert.equal(read?.sections.snapshot, created.sections.snapshot);
});

test("projects without local repos get no snapshot section", () => {
  const project = store.createProject("No Repo", []);
  const created = store.createBriefing(project.slug, {
    standNow: "s",
    nextMove: "n",
  });
  assert.equal(created.sections.snapshot, "");
  const file = fs.readFileSync(
    path.join(store.dataDir(), "projects", project.slug, "briefings", `${created.id}.md`),
    "utf8"
  );
  assert.ok(!file.includes("## Code snapshot"));
});

test("searchBriefings finds text across projects, newest first", () => {
  const projectA = store.createProject("Search Alpha", []);
  const projectB = store.createProject("Search Beta", []);
  store.createBriefing(projectA.slug, {
    standNow: "The xylophone framework is half wired up.",
    nextMove: "n",
  });
  store.createBriefing(projectB.slug, {
    standNow: "s",
    nextMove: "Tune the XYLOPHONE before the demo.",
  });
  const hits = store.searchBriefings("xylophone");
  assert.equal(hits.length, 2);
  assert.ok(hits.every((h) => h.snippet.toLowerCase().includes("xylophone")));
  assert.ok(hits[0].writtenAt >= hits[1].writtenAt);
  assert.equal(store.searchBriefings("").length, 0);
  assert.equal(store.searchBriefings("no-such-word-anywhere").length, 0);
});

test("searchBriefings trims long snippets around the match", () => {
  const project = store.createProject("Snippets", []);
  store.createBriefing(project.slug, {
    standNow: `${"a ".repeat(100)}needle in here ${"b ".repeat(100)}`,
    nextMove: "n",
  });
  const [hit] = store.searchBriefings("needle");
  assert.ok(hit.snippet.includes("needle"));
  assert.ok(hit.snippet.length < 160);
  assert.ok(hit.snippet.startsWith("…"));
  assert.ok(hit.snippet.endsWith("…"));
});

test("deleteBriefing removes the file and nothing else", () => {
  const project = store.createProject("Deletable", []);
  const first = store.createBriefing(project.slug, { standNow: "1", nextMove: "1" });
  const dir = path.join(store.dataDir(), "projects", project.slug, "briefings");
  fs.writeFileSync(
    path.join(dir, "2020-01-01T00-00-00.md"),
    "---\nwrittenAt: 2020-01-01T00:00:00.000Z\n---\n\n## Where things stand\n\nold\n"
  );
  assert.equal(store.listBriefings(project.slug).length, 2);
  assert.equal(store.deleteBriefing(project.slug, "2020-01-01T00-00-00"), true);
  assert.deepEqual(
    store.listBriefings(project.slug).map((b) => b.id),
    [first.id]
  );
  assert.equal(store.deleteBriefing(project.slug, "2020-01-01T00-00-00"), false);
  assert.equal(store.deleteBriefing(project.slug, "../project"), false);
});

test("findProjectByPath matches cwd to the deepest local link", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "re-entry-cwd-"));
  const outer = path.join(base, "code");
  const inner = path.join(base, "code", "app");
  fs.mkdirSync(inner, { recursive: true });
  store.createProject("Outer Proj", [{ label: "Code", url: outer }]);
  const innerProject = store.createProject("Inner Proj", [
    { label: "Code", url: inner },
  ]);
  assert.equal(store.findProjectByPath(inner)?.name, "Inner Proj");
  assert.equal(
    store.findProjectByPath(path.join(inner, "src", "deep"))?.name,
    "Inner Proj"
  );
  assert.equal(store.findProjectByPath(outer)?.name, "Outer Proj");
  assert.equal(store.findProjectByPath("/nowhere/near"), null);
  store.updateProject(innerProject.slug, { archived: true });
  assert.equal(store.findProjectByPath(inner)?.name, "Outer Proj");
});

test("listProjects sees everything created", () => {
  const slugs = store.listProjects().map((p) => p.slug);
  assert.ok(slugs.includes("round-trip"));
  assert.ok(slugs.includes("same-name-2"));
});
