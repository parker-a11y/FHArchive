import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsv, sortExportRows, type SummaryExportRow } from "./timeline-export";

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
    assert.equal(csv.split("\r\n")[1], `,FH0001,,,,,,"Says ""hi"", home",Fran; Jim,https://fharchive.com/record/FH0001`);
  });

test("CSV rows carry a public no-login link for each record", () => {
  const csv = buildCsv([row({ archiveId: "FH0817" })]);
  assert.ok(csv.split("\r\n")[0]!.endsWith(",Public Link"));
  assert.ok(csv.endsWith(",https://fharchive.com/record/FH0817"));
});
