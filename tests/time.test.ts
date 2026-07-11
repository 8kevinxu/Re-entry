import { test } from "node:test";
import assert from "node:assert/strict";
import { awayFor, spanBetween, writtenAgo } from "../src/time.ts";

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("awayFor buckets read naturally", () => {
  assert.equal(awayFor(ago(30_000)), "moments");
  assert.equal(awayFor(ago(5 * MINUTE)), "5 minutes");
  assert.equal(awayFor(ago(90 * MINUTE)), "an hour");
  assert.equal(awayFor(ago(10 * HOUR)), "10 hours");
  assert.equal(awayFor(ago(23 * HOUR)), "a day");
  assert.equal(awayFor(ago(3 * DAY)), "3 days");
  assert.equal(awayFor(ago(8 * DAY)), "8 days");
  assert.equal(awayFor(ago(21 * DAY)), "3 weeks");
  assert.equal(awayFor(ago(92 * DAY)), "3 months");
  assert.equal(awayFor(ago(400 * DAY)), "over a year");
  assert.equal(awayFor(ago(800 * DAY)), "2 years");
});

test("spanBetween narrates the gap between letters", () => {
  const start = "2026-01-01T00:00:00.000Z";
  const plus = (ms: number) => new Date(Date.parse(start) + ms).toISOString();
  assert.equal(spanBetween(start, plus(30_000)), "moments pass");
  assert.equal(spanBetween(start, plus(90 * MINUTE)), "an hour passes");
  assert.equal(spanBetween(start, plus(23 * HOUR)), "a day passes");
  assert.equal(spanBetween(start, plus(21 * DAY)), "3 weeks pass");
  assert.equal(spanBetween(start, plus(400 * DAY)), "over a year passes");
});

test("writtenAgo phrases correctly", () => {
  assert.equal(writtenAgo(ago(10_000)), "moments ago");
  assert.equal(writtenAgo(ago(21 * DAY)), "3 weeks ago");
});
