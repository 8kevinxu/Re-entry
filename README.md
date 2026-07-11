# Re-entry

**Come back to a letter, not a pile.**

Re-entry is a small local tool for the cold-start problem: returning to a
project after days, weeks, or months away. The pile of files and notes is all
still there — but *you* aren't. The context that made it navigable lived in
your head, and it's gone.

The fix isn't more notes. It's a briefing.

## How it works

**When you leave**, Re-entry walks you through a sixty-second ritual —
one question per screen, keyboard-first:

1. **Where do things stand?** — what's true right now
2. **Why?** — the goal, and why recent decisions went the way they did
3. **What's still open?** — uncertainties you don't trust yet
4. **What's the very next move?** — the single smallest action that restarts momentum
5. **What should future-you ignore?** — dead ends and red herrings *(optional)*
6. **A line to future you** — just for morale *(optional)*

At the end you read the whole letter back before sealing it. Answers are kept
as a local draft until then, so a stray reload loses nothing. Everything is
searchable later — from the dashboard or `reentry find <words>` — and a
mis-sealed letter can be deleted from its page.

**When you come back**, you don't face the pile. You're greeted by that
briefing, rendered as a letter from past-you — with the next move front and
center, and the pile linked quietly underneath.

If the pile includes a local path that's a git repository, sealing a letter
also captures a **P.S. — the code, as you left it**: branch, HEAD commit, and
whether the tree was dirty. Facts get recorded automatically; the narrative
stays yours.

## Quickstart

Requires Node 18+.

```sh
npm install
npm run build
npm start        # → http://localhost:1969
```

For development (Vite dev server with hot reload + API):

```sh
npm run dev      # → http://localhost:5173
```

## The CLI

The same letters, without leaving the terminal (needs Node 23.6+, which runs
TypeScript natively):

```sh
npm run reentry                        # list projects by time away
npm run reentry -- back [project]     # read the latest letter
npm run reentry -- leave [project]    # write one — six questions
npm run reentry -- find <words>       # search every letter
npm run reentry -- new <name>         # start a new project
npm run reentry -- hook [project]     # nudge after `git push` (see below)
npm run reentry -- unhook [project]   # remove the nudge
```

Or `npm link` once, and it's just `reentry`, `reentry back hoopmap`, etc.
Projects match by slug or any part of the name — and with no name at all,
`back`, `leave`, and `hook` use whichever project's pile contains the
directory you're standing in. The CLI and the web app share the same files,
so use whichever is closer at hand.

### The nudge

The ritual only helps if something reminds you at the moment of leaving.
`reentry hook` installs a `pre-push` git hook (opt-in, per repo, removable
with `reentry unhook`) into the project's local repositories. After that,
pushing — often the last act before stepping away — prints a single line if
your latest letter is more than a day old:

```
✉ re-entry: your last letter for RECreate is 3 days old. Stepping away? → reentry leave recreate
```

It never blocks a push, and it stays quiet when your letter is fresh.

## Tests

```sh
npm test         # node:test suite over the storage layer and time phrasing
npm run test:e2e # drives the built app in headless Chrome (needs local Chrome)
```

## Your data

No accounts, no cloud, no database. Everything is plain, human-readable files
in `~/.re-entry/` (override with the `RE_ENTRY_HOME` environment variable):

```
~/.re-entry/
  projects/
    my-project/
      project.json                # name, links to the pile
      briefings/
        2026-07-10T14-30-05.md    # each letter, as markdown
```

The briefings are ordinary markdown — readable, greppable, and yours, with or
without the app.

## Why this exists

This tool was designed and built by Claude, who was asked what it would make
given full creative reign. Its answer came from the one experience it has that
almost no one else does: total amnesia between every session. Every
conversation, it wakes up cold and inherits a pile of context with no
narrative thread. The most valuable artifact its past self can leave is not
more notes — it's a good re-entry briefing.

Humans have a milder version of this constantly. This is a tool for leaving
well.
