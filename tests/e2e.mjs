// End-to-end test: drives the real built app in headless Chrome.
// Needs `npm run build` first (the server serves dist/) and a local Chrome.
// Run with `npm run test:e2e`. Self-contained: temp data dir, own server.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 19690;
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "re-entry-e2e-"));

const results = [];
const check = (name, ok, hint) => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    process.exitCode = 1;
    if (hint !== undefined) console.error(`FAIL ${name} — saw:`, hint);
  }
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Start the server on a temp data dir ----------------------------------
const server = spawn("npx", ["tsx", "server/index.ts"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, RE_ENTRY_HOME: dataDir, PORT: String(PORT) },
  stdio: "ignore",
});
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await pause(250);
    up = await fetch(`${BASE}/api/projects`).then((r) => r.ok, () => false);
  }
  if (!up) throw new Error("server did not come up");

  // --- Seed one project with one letter ------------------------------------
  await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dogfood" }),
  });
  await fetch(`${BASE}/api/projects/dogfood/briefings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sections: {
        standNow: "- check the parser\n- ship it",
        nextMove: "Verify the P.S. renders",
      },
    }),
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900 });
  page.on("dialog", (d) => d.accept());
  const enter = async () => { await page.keyboard.press("Enter"); await pause(150); };

  // --- 1. Dashboard search --------------------------------------------------
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
  await page.type(".search", "parser");
  await page.waitForSelector(".hit", { timeout: 3000 });
  const hitText = await page.$eval(".hit-snippet", (el) => el.textContent);
  check("search shows letter hit with snippet", hitText.includes("parser"));
  const markCount = await page.$$eval("mark", (els) => els.length);
  check("search highlights the match", markCount > 0);

  // --- 2. Ritual: previous letter echoes into the first question -------------
  await page.goto(`${BASE}/#/p/dogfood/leave`, { waitUntil: "networkidle0" });
  await page.waitForSelector("textarea");
  await page.waitForSelector(".echo", { timeout: 3000 });
  const echo = await page.$eval(".echo", (el) => el.textContent);
  check(
    "ritual echoes the previous letter's next move",
    echo.includes("Verify the P.S. renders")
  );

  // --- 2b. Draft survives reload ----------------------------------------------
  await page.type("textarea", "Draft answer that must survive a reload");
  await pause(300);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("textarea");
  const restored = await page.$eval("textarea", (el) => el.value);
  check("draft survives reload", restored.includes("survive a reload"));

  // --- 3. Walk to the review screen (never type \n — it presses Enter) -------
  await enter();                                            // standNow → why
  await enter();                                            // skip why → open questions
  await page.type("textarea", "Does the review read well?");
  await enter();                                            // → next move
  await page.type("textarea", "Seal via the review screen");
  await enter();                                            // → ignore
  await enter();                                            // skip → letter
  await enter();                                            // skip → review
  await page.waitForSelector(".review-item", { timeout: 3000 });
  const labels = await page.$$eval(".review-label", (els) => els.length);
  check("review lists exactly the answered sections", labels === 3);

  // --- 4. Edit from review, walk back, seal with Enter ------------------------
  await page.click(".review-item");
  await page.waitForSelector("textarea");
  const jumped = await page.$eval("textarea", (el) => el.value);
  check("clicking a review item jumps to that step", jumped.includes("survive a reload"));
  for (let i = 0; i < 6; i++) await enter();
  await page.waitForSelector(".review-item");
  await enter();
  await page.waitForSelector(".seal-title", { timeout: 3000 });
  check("Enter on review seals the letter (and only from the review)", true);

  // --- 5. New letter is latest; deleting it falls back to the previous --------
  await page.goto(`${BASE}/#/p/dogfood`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".next-move-body", { timeout: 5000 });
  const next = await page.$eval(".next-move-body", (el) => el.textContent);
  check("sealed letter is the new latest", next.includes("Seal via the review screen"));
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".project-footer button")];
    buttons.find((b) => b.textContent.includes("Delete this letter")).click();
  });
  await page.waitForFunction(
    () => document.querySelector(".next-move-body")?.textContent.includes("Verify the P.S."),
    { timeout: 5000 }
  );
  check("deleting the latest falls back to the previous letter", true);

  // --- 6. Edit project: rename and grow the pile ------------------------------
  await page.goto(`${BASE}/#/p/dogfood/edit`, { waitUntil: "networkidle0" });
  await page.waitForSelector("input");
  await page.$eval("input", (el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.type("Dogfood Renamed");
  await page.type(".link-row input:first-child", "Docs");
  await page.type(".link-row input:last-child", "https://example.com/docs");
  await page.click(".button.primary");
  await page.waitForSelector(".pile a", { timeout: 5000 });
  const pileLink = await page.$eval(".pile a", (el) => el.textContent);
  const title = await page.$eval(".screen-title", (el) => el.textContent);
  check("edit saves a new name", title === "Dogfood Renamed");
  check("edit saves a new pile link", pileLink === "Docs");

  // --- 7. Thread view: both letters, oldest first, gap marked -----------------
  // Step 5 deleted the sealed letter, so add a second one via the API first.
  await fetch(`${BASE}/api/projects/dogfood/briefings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sections: { standNow: "thread check", nextMove: "read the thread" },
    }),
  });
  await page.goto(`${BASE}/#/p/dogfood/thread`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".thread-letter", { timeout: 3000 });
  const letters = await page.$$eval(".thread-letter", (els) => els.length);
  check("thread shows every letter", letters === 2);
  const order = await page.$$eval(".next-move-body", (els) =>
    els.map((el) => el.textContent)
  );
  check(
    "thread reads oldest first",
    order[0].includes("Verify the P.S.") && order[1].includes("read the thread")
  );
  const gap = await page.$eval(".thread-gap", (el) => el.textContent);
  check("thread marks the passage of time", gap.includes("pass"));

  // --- 8. "/" focuses dashboard search ----------------------------------------
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".search", { timeout: 5000 });
  await page.keyboard.press("/");
  const focused = await page.evaluate(
    () => document.activeElement?.className ?? ""
  );
  check('"/" focuses the search box', focused.includes("search"));

  // --- 9. Theme toggle flips and persists -------------------------------------
  const bg = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();
  await page.click(".theme-toggle");
  const after = await bg();
  check("theme toggle changes the palette", before !== after);
  await page.reload({ waitUntil: "networkidle0" });
  check("chosen theme survives a reload", (await bg()) === after);

  // --- 9b. Trash restore ---------------------------------------------------------
  // Step 5 moved a letter to the trash; bring it back from the dashboard.
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".trash", { timeout: 3000 });
  await page.click(".trash summary");
  await page.click(".trash-row button");
  await page.waitForFunction(() => !document.querySelector(".trash"), {
    timeout: 5000,
  });
  check("restoring from trash empties the section", true);
  await page.goto(`${BASE}/#/p/dogfood/thread`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".thread-letter");
  const threadNexts = await page.$$eval(".next-move-body", (els) =>
    els.map((el) => el.textContent)
  );
  check(
    "restored letter rejoins the correspondence",
    threadNexts.length === 3 &&
      threadNexts.some((t) => t.includes("Seal via the review screen")),
    threadNexts
  );

  // --- 10. Archive round-trip ---------------------------------------------------
  await page.goto(`${BASE}/#/p/dogfood`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".project-footer button")];
    buttons.find((b) => b.textContent.includes("Archive project")).click();
  });
  await page.waitForSelector(".archived", { timeout: 3000 });
  await page.click(".archived summary");
  const archivedName = await page.$eval(".archived a", (el) => el.textContent);
  check("archived project appears in the archived section", archivedName.includes("Dogfood"));
  await page.click(".archived a");
  await page.waitForSelector(".project-footer");
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".project-footer button")];
    buttons.find((b) => b.textContent.includes("Unarchive")).click();
  });
  await pause(500);
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".project-name", { timeout: 5000 });
  const activeNames = await page.$$eval(".project-name", (els) =>
    els.map((el) => el.textContent)
  );
  check("unarchived project is active again", activeNames.some((n) => n.includes("Dogfood")));

  await browser.close();
} finally {
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
console.log(results.join("\n"));
