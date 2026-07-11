export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  slug: string;
  name: string;
  createdAt: string;
  archived: boolean;
  links: ProjectLink[];
}

/** The six sections of a briefing, in ritual order. Optional ones may be absent. */
export interface BriefingSections {
  standNow: string;
  why?: string;
  openQuestions?: string;
  nextMove: string;
  ignore?: string;
  letter?: string;
}

export interface Briefing {
  id: string;
  writtenAt: string;
  sections: BriefingSections;
}

export interface BriefingSummary {
  id: string;
  writtenAt: string;
}

/** Dashboard listing: project plus a glimpse of its latest briefing. */
export interface ProjectListing extends Project {
  lastBriefing: { id: string; writtenAt: string; nextMove: string } | null;
}

/** Full project detail for the return view. */
export interface ProjectDetail extends Project {
  briefings: BriefingSummary[];
  latest: Briefing | null;
}

export const SECTION_ORDER: (keyof BriefingSections)[] = [
  "standNow",
  "why",
  "openQuestions",
  "nextMove",
  "ignore",
  "letter",
];

export const SECTION_TITLES: Record<keyof BriefingSections, string> = {
  standNow: "Where things stand",
  why: "Why",
  openQuestions: "Open questions",
  nextMove: "The very next move",
  ignore: "Ignore this",
  letter: "To future you",
};
