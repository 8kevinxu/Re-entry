// Opt-in git pre-push nudge: after you push (often the last act before
// stepping away), a one-line reminder suggests writing a letter if the
// last one is stale. Never blocks the push.

import fs from "node:fs";
import path from "node:path";

const MARKER = "# re-entry nudge (managed by `reentry hook`)";

function prePushPath(repo: string): string {
  return path.join(repo, ".git", "hooks", "pre-push");
}

export function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

export function installNudge(
  repo: string,
  slug: string,
  cliPath: string
): "installed" | "already installed" {
  const hook = prePushPath(repo);
  const command = `node ${JSON.stringify(cliPath)} nudge ${slug} || true`;
  const block = `${MARKER}\n${command}`;
  if (fs.existsSync(hook)) {
    const current = fs.readFileSync(hook, "utf8");
    if (current.includes(MARKER)) return "already installed";
    fs.writeFileSync(hook, `${current.replace(/\n*$/, "\n\n")}${block}\n`);
  } else {
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, `#!/bin/sh\n${block}\n`);
  }
  fs.chmodSync(hook, 0o755);
  return "installed";
}

export function uninstallNudge(repo: string): boolean {
  const hook = prePushPath(repo);
  if (!fs.existsSync(hook)) return false;
  const lines = fs.readFileSync(hook, "utf8").split("\n");
  const at = lines.indexOf(MARKER);
  if (at === -1) return false;
  lines.splice(at, 2); // the marker and its command line
  const rest = lines.join("\n").trim();
  if (rest === "" || rest === "#!/bin/sh") {
    fs.unlinkSync(hook);
  } else {
    fs.writeFileSync(hook, lines.join("\n"));
  }
  return true;
}
