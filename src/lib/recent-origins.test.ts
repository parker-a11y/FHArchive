import assert from "node:assert/strict";
import { test } from "node:test";
import { pickRecentOrigins } from "./recent-origins";

test("quick picks are the two origins used most recently", () => {
  const picks = pickRecentOrigins([
    { origin: "Worcester", created_at: "2026-10-26T16:45:01Z", updated_at: "2026-10-26T16:45:01Z" },
    { origin: "Miami", created_at: "2026-10-28T16:53:35Z", updated_at: "2026-10-28T16:53:35Z" },
    {
      origin: "Waycross, GA - Hotel Ware",
      created_at: "2026-10-28T16:35:47Z",
      updated_at: "2026-10-28T16:35:47Z",
    },
    { origin: "Ft Schuyler", created_at: "2026-01-04T12:00:00Z", updated_at: "2026-01-04T12:00:00Z" },
  ]);
  assert.deepEqual(picks, ["Miami", "Waycross, GA - Hotel Ware"]);
});

test("blanks never become a pick and repeats of one place collapse to one button", () => {
  const picks = pickRecentOrigins([
    { origin: "   ", created_at: "2026-10-28T17:00:00Z", updated_at: "2026-10-28T17:00:00Z" },
    { origin: null, created_at: "2026-10-28T16:59:00Z", updated_at: "2026-10-28T16:59:00Z" },
    { origin: "Miami ", created_at: "2026-10-28T16:53:35Z", updated_at: "2026-10-28T16:53:35Z" },
    { origin: "Miami", created_at: "2026-10-28T16:50:00Z", updated_at: "2026-10-28T16:50:00Z" },
    { origin: "Camp DeWitt", created_at: "2026-10-26T14:50:27Z", updated_at: "2026-10-26T14:50:27Z" },
  ]);
  assert.deepEqual(picks, ["Miami", "Camp DeWitt"]);
});

test("re-editing an old letter returns its origin to the quick picks", () => {
  const picks = pickRecentOrigins([
    { origin: "Miami", created_at: "2026-10-28T16:53:35Z", updated_at: "2026-10-28T16:53:35Z" },
    {
      origin: "Waycross, GA - Hotel Ware",
      created_at: "2026-10-28T16:35:47Z",
      updated_at: "2026-10-28T16:35:47Z",
    },
    { origin: "Princeton", created_at: "2026-09-01T10:00:00Z", updated_at: "2026-10-28T17:10:00Z" },
  ]);
  assert.deepEqual(picks, ["Princeton", "Miami"]);
});
