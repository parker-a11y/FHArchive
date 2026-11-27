import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsv, buildFullCsv, fullArchiveFilename, storedTranscription, sortExportRows, type SummaryExportRow } from "./timeline-export";

const row = (o: Partial<SummaryExportRow>): SummaryExportRow => ({
  date: "", sortDate: null, archiveId: "FH0001", title: "", from: "", to: "", origin: "", destination: "", summary: "", people: [], ...o,
});

test("sorts by date with undated records last", () => {
    const out = sortExportRows([
      row({ archiveId: "FH0003" }),
      row({ archiveId: "FH0002", sortDate: "1944-01-01" }),
      row({ archiveId: "FH0001", sortDate: "1943-05-01" }),
    ]);
    assert.deepEqual(out.map((r) => r.archiveId), ["FH0001", "FH0002", "FH0003"]);
  });
test("CSV quotes commas and joins people with semicolons", () => {
    const csv = buildCsv([row({ summary: 'Says "hi", home', people: ["Fran", "Jim"] })]);
    assert.equal(csv.split("\r\n")[1], `,FH0001,,,,,,"Says ""hi"", home",Fran; Jim,https://fharchive.com/record/FH0001,https://fharchive.com/record/FH0001/transcription`);
  });

test("CSV rows carry a public no-login link for each record", () => {
  const csv = buildCsv([row({ archiveId: "FH0817" })]);
  assert.ok(csv.split("\r\n")[0]!.endsWith(",Public Link,Transcription Link"));
  assert.ok(csv.endsWith(",https://fharchive.com/record/FH0817,https://fharchive.com/record/FH0817/transcription"));
});

test("Full archive CSV keeps multi-paragraph quoted transcription in one cell, unchanged", () => {
  const text = 'Dear Mom,\n\nIt rained, "again".\nLove, Fran';
  const csv = buildFullCsv([{ ...row({ archiveId: "FH0002" }), transcription: text }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.split("\r\n")[0]!.endsWith(",Public Link,Transcription Link,Full Transcription"));
  assert.ok(csv.endsWith(`,"Dear Mom,\n\nIt rained, ""again"".\nLove, Fran"`));
});

test("Full archive CSV leaves the transcription blank when missing but keeps the row", () => {
  const csv = buildFullCsv([{ ...row({ archiveId: "FH0003" }), transcription: "" }]);
  assert.equal(csv.split("\r\n").length, 2);
  assert.ok(csv.endsWith("/FH0003/transcription,"));
});

test("Full archive file name and stored text preference", () => {
  assert.equal(fullArchiveFilename(new Date("2026-11-23T12:00:00Z")), "FH_Archive_Full_2026-11-23.csv");
  assert.equal(storedTranscription({ transcription_verified: "", transcription_rollup_text: "R", transcription_raw_ai: "A" }), "R");
});

import { buildEmailsCsv, emailPlainText } from "./timeline-export";
test("sent emails CSV lists referenced FH records and full email text", () => {
  const rec = (id: string, d: string | null): SummaryExportRow => ({ date: d ?? "Undated", sortDate: d, archiveId: id, title: "T", from: "Fran", to: "Mom", origin: "A", destination: "B", summary: "", people: [] });
  const csv = buildEmailsCsv([{ subject: "Hi", body: "<p>One</p><p>Two, \"quoted\"</p>", records: [rec("FH0002", "1943-02-01"), rec("FH0001", "1943-01-01")] }]);
  const row = csv.split("\r\n")[1]!;
  assert.ok(row.startsWith("Hi,FH0001; FH0002,"));
  assert.ok(row.includes('"One\n\nTwo, ""quoted"""'));
  assert.equal(emailPlainText("a<br>b &amp; c"), "a\nb & c");
});
