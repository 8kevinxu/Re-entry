import { Router } from "express";
import type { BriefingSections, ProjectLink } from "../shared/types.ts";
import {
  createBriefing,
  createProject,
  deleteBriefing,
  getProject,
  listBriefings,
  listProjects,
  readBriefing,
  searchBriefings,
  updateProject,
} from "./store.ts";

function cleanLinks(input: unknown): ProjectLink[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((link) => ({
      label: String(link?.label ?? "").trim(),
      url: String(link?.url ??"").trim(),
    }))
    .filter((link) => link.url !== "")
    .map((link) => ({ ...link, label: link.label || link.url }));
}

export const api = Router();

api.get("/projects", (_req, res) => {
  const projects = listProjects().map((project) => {
    const [latest] = listBriefings(project.slug);
    const briefing = latest ? readBriefing(project.slug, latest.id) : null;
    return {
      ...project,
      lastBriefing: briefing
        ? {
            id: briefing.id,
            writtenAt: briefing.writtenAt,
            nextMove: briefing.sections.nextMove,
          }
        : null,
    };
  });
  res.json(projects);
});

api.get("/search", (req, res) => {
  res.json(searchBriefings(String(req.query.q ?? "")));
});

api.post("/projects", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "A project needs a name." });
    return;
  }
  res.status(201).json(createProject(name, cleanLinks(req.body?.links)));
});

api.get("/projects/:slug", (req, res) => {
  const project = getProject(req.params.slug);
  if (!project) {
    res.status(404).json({ error: "No such project." });
    return;
  }
  const briefings = listBriefings(project.slug);
  const latest = briefings.length
    ? readBriefing(project.slug, briefings[0].id)
    : null;
  res.json({ ...project, briefings, latest });
});

api.get("/projects/:slug/thread", (req, res) => {
  const project = getProject(req.params.slug);
  if (!project) {
    res.status(404).json({ error: "No such project." });
    return;
  }
  const thread = listBriefings(project.slug)
    .map((summary) => readBriefing(project.slug, summary.id))
    .filter((briefing) => briefing !== null)
    .reverse(); // oldest first — read the correspondence forward
  res.json(thread);
});

api.patch("/projects/:slug", (req, res) => {
  const patch: Parameters<typeof updateProject>[1] = {};
  if (req.body?.name !== undefined) patch.name = String(req.body.name);
  if (req.body?.links !== undefined) patch.links = cleanLinks(req.body.links);
  if (req.body?.archived !== undefined) patch.archived = Boolean(req.body.archived);
  const project = updateProject(req.params.slug, patch);
  if (!project) {
    res.status(404).json({ error: "No such project." });
    return;
  }
  res.json(project);
});

api.post("/projects/:slug/briefings", (req, res) => {
  const project = getProject(req.params.slug);
  if (!project) {
    res.status(404).json({ error: "No such project." });
    return;
  }
  const body = req.body?.sections ?? {};
  const sections: BriefingSections = {
    standNow: String(body.standNow ?? "").trim(),
    why: String(body.why ?? "").trim(),
    openQuestions: String(body.openQuestions ?? "").trim(),
    nextMove: String(body.nextMove ?? "").trim(),
    ignore: String(body.ignore ?? "").trim(),
    letter: String(body.letter ?? "").trim(),
  };
  if (!sections.standNow || !sections.nextMove) {
    res.status(400).json({
      error: "A briefing needs at least where things stand and a next move.",
    });
    return;
  }
  res.status(201).json(createBriefing(project.slug, sections));
});

api.delete("/projects/:slug/briefings/:id", (req, res) => {
  if (!getProject(req.params.slug) || !deleteBriefing(req.params.slug, req.params.id)) {
    res.status(404).json({ error: "No such briefing." });
    return;
  }
  res.json({ ok: true });
});

api.get("/projects/:slug/briefings/:id", (req, res) => {
  const briefing = getProject(req.params.slug)
    ? readBriefing(req.params.slug, req.params.id)
    : null;
  if (!briefing) {
    res.status(404).json({ error: "No such briefing." });
    return;
  }
  res.json(briefing);
});
