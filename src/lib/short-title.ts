/**
 * Short-title generation for personal letters.
 *
 * Convention: "Letter from Fran to Jaq - 1944-12-03".
 * Francis A. Harrington and Jaquelyn Harrington always render as their
 * household nicknames; everyone else keeps their canonical name.
 */

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Spellings that resolve to the two household nicknames. */
const NICKNAMES: { short: string; variants: string[] }[] = [
  {
    short: "Fran",
    variants: [
      "Fran",
      "Francis",
      "Frank",
      "Francis Harrington",
      "Francis A. Harrington",
      "F. A. Harrington",
      "FA Harrington",
      "Harrington F A",
      "Lt. F. A. Harrington",
    ],
  },
  {
    short: "Jaq",
    variants: [
      "Jaq",
      "Jacqueline",
      "Jacquelyn",
      "Jaquelyn",
      "Jackie",
      "Jacqueline Harrington",
      "Jacquelyn Harrington",
      "Jaquelyn Harrington",
      "Mrs. Harrington",
      "Mrs. J. A. Harrington",
      "Mrs. F. A. Harrington",
      "Mrs. Francis Harrington",
    ],
  },
];

/** Fran / Jaq when the name is one of their known spellings, else the name as-is. */
export function shortPersonName(name: string | null | undefined): string {
  const value = (name ?? "").trim();
  if (!value) return "unknown";
  const key = norm(value);
  for (const n of NICKNAMES) {
    if (n.variants.some((v) => norm(v) === key)) return n.short;
  }
  return value;
}

export type ShortTitleInput = {
  author?: string | null;
  recipient?: string | null;
  normalized_date?: string | null;
  date_precision?: string | null;
};

/** Date fragment at whatever precision is known ("" when undated). */
function datePart(date?: string | null, precision?: string | null): string {
  if (!date) return "";
  const p = (precision ?? "exact").toLowerCase();
  if (p === "year") return date.slice(0, 4);
  if (p === "month") return date.slice(0, 7);
  if (p === "undated" || p === "unknown") return "";
  return date.slice(0, 10);
}

/** "Letter from Fran to Jaq - 1944-12-03" */
export function shortLetterTitle(input: ShortTitleInput): string {
  const from = shortPersonName(input.author);
  const to = shortPersonName(input.recipient);
  const d = datePart(input.normalized_date, input.date_precision);
  return `Letter from ${from} to ${to}${d ? ` - ${d}` : ""}`;
}

/** Records eligible for the Create Short Title button. */
export function isPersonalLetter(recordType?: string | null, subtype?: string | null): boolean {
  return (
    (recordType ?? "").toLowerCase() === "letter" &&
    norm(subtype ?? "") === norm("Personal letter")
  );
}
