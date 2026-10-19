import { describe, expect, test } from "bun:test";
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
    expect(rows).toEqual(["FH0112/derivatives/page.jpg"]);
    expect(calls).toBe(3);
    expect(delays).toEqual([1000, 2000]);
  });

  test("stops after four attempts if connections remain exhausted", async () => {
    let calls = 0;
    await expect(retryBackupRead(async () => {
      calls++;
      throw new Error("Too many connections issued to the database");
    }, async () => {})).rejects.toThrow("Too many connections");
    expect(calls).toBe(4);
  });

  test("does not retry permission failures", async () => {
    let calls = 0;
    await expect(retryBackupRead(async () => {
      calls++;
      throw new Error("Permission denied");
    }, async () => {})).rejects.toThrow("Permission denied");
    expect(calls).toBe(1);
  });
});