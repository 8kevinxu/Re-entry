import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installNudge, uninstallNudge, isGitRepo } from "../cli/hook.ts";

function fakeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "re-entry-hook-"));
  fs.mkdirSync(path.join(repo, ".git", "hooks"), { recursive: true });
  return repo;
}

test("installNudge creates an executable pre-push hook", () => {
  const repo = fakeRepo();
  assert.ok(isGitRepo(repo));
  assert.equal(installNudge(repo, "my-proj", "/cli/reentry.ts"), "installed");
  const hook = path.join(repo, ".git", "hooks", "pre-push");
  const content = fs.readFileSync(hook, "utf8");
  assert.ok(content.startsWith("#!/bin/sh"));
  assert.ok(content.includes('node "/cli/reentry.ts" nudge my-proj || true'));
  assert.ok(fs.statSync(hook).mode & 0o100);
  assert.equal(installNudge(repo, "my-proj", "/cli/reentry.ts"), "already installed");
});

test("installNudge appends to an existing hook without clobbering it", () => {
  const repo = fakeRepo();
  const hook = path.join(repo, ".git", "hooks", "pre-push");
  fs.writeFileSync(hook, "#!/bin/sh\necho existing-check\n");
  installNudge(repo, "p", "/cli.ts");
  const content = fs.readFileSync(hook, "utf8");
  assert.ok(content.includes("echo existing-check"));
  assert.ok(content.includes("nudge p"));
});

test("uninstallNudge removes only our block", () => {
  const repo = fakeRepo();
  const hook = path.join(repo, ".git", "hooks", "pre-push");
  fs.writeFileSync(hook, "#!/bin/sh\necho existing-check\n");
  installNudge(repo, "p", "/cli.ts");
  assert.equal(uninstallNudge(repo), true);
  const content = fs.readFileSync(hook, "utf8");
  assert.ok(content.includes("echo existing-check"));
  assert.ok(!content.includes("nudge"));
  assert.equal(uninstallNudge(repo), false);
});

test("uninstallNudge deletes the hook if we were the only content", () => {
  const repo = fakeRepo();
  installNudge(repo, "p", "/cli.ts");
  assert.equal(uninstallNudge(repo), true);
  assert.ok(!fs.existsSync(path.join(repo, ".git", "hooks", "pre-push")));
});
