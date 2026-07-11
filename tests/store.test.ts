import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("listProjects sees everything created", () => {
  const slugs = store.listProjects().map((p) => p.slug);
  assert.ok(slugs.includes("round-trip"));
  assert.ok(slugs.includes("same-name-2"));
});
