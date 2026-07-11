#!/usr/bin/env node
// Re-entry CLI — the same letters, without leaving the terminal.
// Runs on plain Node ≥ 23.6 (native type stripping). Data: ~/.re-entry.

import readline from "node:readline";
import {
  SECTION_TITLES,
  type BriefingSections,
  type Project,
} from "../shared/types.ts";
import {
  createBriefing,
  createProject,
  dataDir,
  listBriefings,
  listProjects,
  readBriefing,
} from "../server/store.ts";
import { awayFor, writtenAgo } from "../src/time.ts";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const style = (code: string, text: string) =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
const bold = (t: string) => style("1", t);
const dim = (t: string) => style("2", t);
const italic = (t: string) => style("3", t);
const accent = (t: string) => style("38;5;131", t);

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function lastActivity(project: Project): string {
  const [latest] = listBriefings(project.slug);
  return latest?.writtenAt ?? project.createdAt;
}

function resolve(query: string): Project {
  const projects = listProjects().filter((p) => !p.archived);
  const q = query.toLowerCase();
  const exact = projects.find((p) => p.slug === q);
  if (exact) return exact;
  const matches = projects.filter(
    (p) => p.slug.includes(q) || p.name.toLowerCase().includes(q)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    console.error(`No project matches “${query}”. Try \`reentry list\`.`);
  } else {
    console.error(`“${query}” is ambiguous — did you mean:`);
    for (const p of matches) console.error(`  ${p.slug}`);
  }
  process.exit(1);
}

function list(): void {
  const projects = listProjects()
    .filter((p) => !p.archived)
    .sort((a, b) => lastActivity(a).localeCompare(lastActivity(b)));
  if (projects.length === 0) {
    console.log("No projects yet. Start one with `reentry new <name>`.");
    return;
  }
  console.log();
  for (const project of projects) {
    const [latest] = listBriefings(project.slug);
    const away = awayFor(latest?.writtenAt ?? project.createdAt);
    console.log(
      `  ${bold(project.name)} ${dim(`(${project.slug})`)} — away ${away}`
    );
    if (latest) {
      const briefing = readBriefing(project.slug, latest.id);
      const next = briefing?.sections.nextMove.split("\n")[0] ?? "";
      console.log(dim(`      next: ${next}`));
    } else {
      console.log(dim("      no letters yet"));
    }
  }
  console.log();
}

function back(query: string): void {
  const project = resolve(query);
  const [latest] = listBriefings(project.slug);
  if (!latest) {
    console.log(`No letters for ${project.name} yet — \`reentry leave ${project.slug}\` writes the first one.`);
    return;
  }
  const briefing = readBriefing(project.slug, latest.id)!;
  console.log();
  console.log(`  ${bold(project.name)}`);
  console.log(
    `  ${dim(`Written by past-you · ${writtenAgo(briefing.writtenAt)}`)}`
  );
  console.log();
  console.log(accent(bold("  YOUR NEXT MOVE")));
  console.log(indent(indent(briefing.sections.nextMove)));
  const rest: (keyof BriefingSections)[] = [
    "standNow",
    "why",
    "openQuestions",
    "ignore",
  ];
  for (const key of rest) {
    const content = briefing.sections[key];
    if (!content) continue;
    console.log();
    console.log(dim(bold(`  ${SECTION_TITLES[key].toUpperCase()}`)));
    console.log(indent(indent(content)));
  }
  if (briefing.sections.letter) {
    console.log();
    console.log(indent(indent(italic(briefing.sections.letter))));
    console.log(indent(indent(dim(italic("— past you")))));
  }
  if (project.links.length > 0) {
    console.log();
    console.log(dim(`  The pile: ${project.links.map((l) => `${l.label} → ${l.url}`).join("   ")}`));
  }
  console.log();
}

/** Queue of stdin lines that survives piped input arriving faster than we consume it. */
class LineReader {
  private queue: string[] = [];
  private waiters: ((line: string | null) => void)[] = [];
  private closed = false;

  constructor(rl: readline.Interface) {
    rl.on("line", (line) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(line);
      else this.queue.push(line);
    });
    rl.on("close", () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) waiter(null);
    });
  }

  next(): Promise<string | null> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

async function ask(
  reader: LineReader,
  prompt: string,
  hint: string,
  required: boolean
): Promise<string> {
  console.log();
  console.log(`${bold(prompt)}`);
  console.log(dim(`${hint} Finish with an empty line${required ? "" : "; empty right away skips"}.`));
  let sawEof = false;
  for (;;) {
    const lines: string[] = [];
    for (;;) {
      process.stdout.write(dim("> "));
      const line = await reader.next();
      if (!process.stdin.isTTY) process.stdout.write("\n");
      if (line === null) {
        sawEof = true;
        break;
      }
      if (line === "") break;
      lines.push(line);
    }
    const answer = lines.join("\n").trim();
    if (answer || !required) return answer;
    if (sawEof) {
      console.error("Input ended before the letter was finished — nothing saved.");
      process.exit(1);
    }
    console.log(dim("Future-you really does need this one."));
  }
}

async function leave(query: string): Promise<void> {
  const project = resolve(query);
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: process.stdin.isTTY,
  });
  const reader = new LineReader(rl);
  console.log();
  console.log(`Stepping away from ${bold(project.name)}. Sixty seconds, six questions.`);

  const sections: BriefingSections = {
    standNow: await ask(
      reader,
      "Where do things stand?",
      "What's true right now — what works, what's done, what's in motion.",
      true
    ),
    why: await ask(
      reader,
      "Why?",
      "The goal, and why recent decisions went the way they did.",
      false
    ),
    openQuestions: await ask(
      reader,
      "What's still open?",
      "Uncertainties, unresolved questions, things you don't trust yet.",
      false
    ),
    nextMove: await ask(
      reader,
      "What's the very next move?",
      "The single smallest action that restarts momentum. Just one.",
      true
    ),
    ignore: await ask(
      reader,
      "What should future-you ignore?",
      "Dead ends and red herrings — things that look important but aren't.",
      false
    ),
    letter: await ask(
      reader,
      "A line to future you?",
      "However you'd sign off a letter. This one's just for morale.",
      false
    ),
  };
  rl.close();

  createBriefing(project.slug, sections);
  console.log();
  console.log(`${accent("✉")}  ${bold("Letter sealed.")} See you when you get back.`);
  console.log();
}

function newProject(name: string): void {
  if (!name.trim()) {
    console.error("Usage: reentry new <name>");
    process.exit(1);
  }
  const project = createProject(name, []);
  console.log(`Created ${bold(project.name)} (${project.slug}) in ${dataDir()}.`);
  console.log(`Add links to the pile in the web app, or just get to work.`);
}

function help(): void {
  console.log(`
  ${bold("reentry")} — come back to a letter, not a pile.

  reentry                 list projects by time away
  reentry back <project>  read the latest letter
  reentry leave <project> write one — six questions, sixty seconds
  reentry new <name>      start a new project

  Projects match by slug or any part of the name.
  Letters are plain markdown in ${dataDir()}.
`);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case undefined:
  case "list":
    list();
    break;
  case "back":
    if (!args[0]) {
      console.error("Usage: reentry back <project>");
      process.exit(1);
    }
    back(args.join(" "));
    break;
  case "leave":
    if (!args[0]) {
      console.error("Usage: reentry leave <project>");
      process.exit(1);
    }
    await leave(args.join(" "));
    break;
  case "new":
    newProject(args.join(" "));
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default: {
    // Bare project name is a shortcut for `back`.
    back([command, ...args].join(" "));
  }
}
