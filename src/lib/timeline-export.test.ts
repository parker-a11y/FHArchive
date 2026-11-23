import { describe, expect, it } from "vitest";
import { buildCsv, sortExportRows, type SummaryExportRow } from "./timeline-export";

const row = (o: Partial<SummaryExportRow>): SummaryExportRow => ({
  date: "", sortDate: null, archiveId: "FH0001", title: "", from: "", to: "", origin: "", destination: "", summary: "", people: [], ...o,
});

describe("timeline summary export", () => {
  it("sorts by date with undated records last", () => {
    const out = sortExportRows([
      row({ archiveId: "FH0003" }),
      row({ archiveId: "FH0002", sortDate: "1944-01-01" }),
      row({ archiveId: "FH0001", sortDate: "1943-05-01" }),
    ]);
    expect(out.map((r) => r.archiveId)).toEqual(["FH0001", "FH0002", "FH0003"]);
  });
  it("CSV quotes commas and joins people with semicolons", () => {
    const csv = buildCsv([row({ summary: 'Says "hi", home', people: ["Fran", "Jim"] })]);
    expect(csv.split("\r\n")[1]).toBe(`,FH0001,,,,,,"Says ""hi"", home",Fran; Jim`);
  });
});
