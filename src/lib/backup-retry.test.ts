import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { retryBackupRead } from "./backup-retry";

describe("backup transient storage reads", () => {
  test("recovers after a temporary connection limit without skipping files", async () => {
    let calls = 0;
    const delays: number[] = [];
    const rows = await retryBackupRead(async () => {
      calls++;
      if (calls < 3) throw new Error("Too many connections issued to the database");
      return ["FH0112/derivatives/page.jpg"];
    }, async (ms) => { delays.push(ms); });
    assert.deepEqual(rows, ["FH0112/derivatives/page.jpg"]);
    assert.equal(calls, 3);
    assert.deepEqual(delays, [1000, 2000]);
  });

  test("stops after four attempts if connections remain exhausted", async () => {
    let calls = 0;
    await assert.rejects(retryBackupRead(async () => {
      calls++;
      throw new Error("Too many connections issued to the database");
    }, async () => {}), /Too many connections/);
    assert.equal(calls, 4);
  });

  test("does not retry permission failures", async () => {
    let calls = 0;
    await assert.rejects(retryBackupRead(async () => {
      calls++;
      throw new Error("Permission denied");
    }, async () => {}), /Permission denied/);
    assert.equal(calls, 1);
  });
});