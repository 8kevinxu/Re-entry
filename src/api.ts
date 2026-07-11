import type {
  Briefing,
  BriefingSections,
  Project,
  ProjectDetail,
  ProjectLink,
  ProjectListing,
  SearchHit,
} from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  listProjects: () => request<ProjectListing[]>("/projects"),

  getProject: (slug: string) =>
    request<ProjectDetail>(`/projects/${encodeURIComponent(slug)}`),

  createProject: (name: string, links: ProjectLink[]) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, links }),
    }),

  updateProject: (slug: string, patch: Partial<Project>) =>
    request<Project>(`/projects/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  createBriefing: (slug: string, sections: BriefingSections) =>
    request<Briefing>(`/projects/${encodeURIComponent(slug)}/briefings`, {
      method: "POST",
      body: JSON.stringify({ sections }),
    }),

  getBriefing: (slug: string, id: string) =>
    request<Briefing>(
      `/projects/${encodeURIComponent(slug)}/briefings/${encodeURIComponent(id)}`
    ),

  getThread: (slug: string) =>
    request<Briefing[]>(`/projects/${encodeURIComponent(slug)}/thread`),

  deleteBriefing: (slug: string, id: string) =>
    request<{ ok: boolean }>(
      `/projects/${encodeURIComponent(slug)}/briefings/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  search: (query: string) =>
    request<SearchHit[]>(`/search?q=${encodeURIComponent(query)}`),
};
