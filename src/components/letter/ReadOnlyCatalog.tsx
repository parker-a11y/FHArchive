import { Link } from "@tanstack/react-router";
import { DateLink } from "@/components/DateLink";
import {
  DATE_CERTAINTY,
  DATE_PRECISION,
  IDENTIFICATION_STATUS,
  PERIODS,
  RECORD_TYPES,
  displayDate,
  isLetterType,
  labelOf,
} from "@/lib/archive";
import type { Letter } from "@/lib/queries";

/**
 * Read-only catalog for view-only accounts. Guests never see form controls,
 * empty fields, or internal workflow/administrative metadata — only the
 * archival information the record actually holds.
 */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="mt-0.5 text-sm break-words">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  columns = true,
}: {
  title: string;
  children: React.ReactNode;
  columns?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display mb-4 text-base font-semibold">{title}</h2>
      <div className={columns ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
        {children}
      </div>
    </section>
  );
}

const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

export function ReadOnlyCatalog({ letter }: { letter: Letter }) {
  const isLetter = isLetterType(letter.record_type);

  const details: { label: string; value: React.ReactNode }[] = [];
  const push = (label: string, value: unknown, node?: React.ReactNode) => {
    if (has(value)) details.push({ label, value: node ?? String(value) });
  };

  push("Record type", labelOf(RECORD_TYPES, letter.record_type));
  push("Subtype", letter.subtype);
  push("Title / short description", letter.title);
  details.push({
    label: "Date",
    value: (
      <span>
        <DateLink date={letter.normalized_date}>{displayDate(letter)}</DateLink>
        {letter.date_from_postmark ? (
          <span className="text-muted-foreground"> · Postmark date</span>
        ) : null}
      </span>
    ),
  });
  push("Date as written", letter.date_as_written);
  push("End date", letter.date_end);
  push("Date precision", labelOf(DATE_PRECISION, letter.date_precision));
  push("Date certainty", labelOf(DATE_CERTAINTY, letter.date_certainty));
  push("Period", labelOf(PERIODS, letter.period));
  push("Identification", labelOf(IDENTIFICATION_STATUS, letter.identification_status));
  push("Primary person", letter.primary_person);
  if (isLetter) {
    push("Author (from)", letter.author);
    push("Recipient (to)", letter.recipient);
  }
  push("Mailing origin / location", letter.origin);
  if (isLetter) push("Mailing destination", letter.destination);
  push("Sheets", letter.sheets);
  if (letter.image_count) push("Scanned images", letter.image_count);
  if (letter.has_envelope) push("Envelope", "Yes");
  if (letter.has_enclosures) push("Enclosures", "Yes");
  if (letter.tones?.length) push("Tone / sentiment", letter.tones.join(", "));

  const postal: { label: string; value: React.ReactNode }[] = [];
  if (isLetter) {
    if (letter.forwarded)
      postal.push({
        label: "Forwarded",
        value: has(letter.forwarded_to) ? `Yes — to ${letter.forwarded_to}` : "Yes",
      });
    if (has(letter.postal_service))
      postal.push({ label: "Postal service / postage", value: letter.postal_service });
    if (letter.censor_mark) postal.push({ label: "Censor mark", value: "Yes" });
    if (has(letter.postal_notes))
      postal.push({ label: "Postal notes", value: letter.postal_notes });
  }

  const correspondence: { label: string; value: React.ReactNode }[] = [];
  if (isLetter) {
    const rows: [string, string | null][] = [
      ["Salutation — as written", letter.salutation_as_written],
      ["Addressee — normalized", letter.addressee_normalized],
      ["Closing — as written", letter.closing_as_written],
      ["Signature — as written", letter.signature_as_written],
    ];
    for (const [label, value] of rows) if (has(value)) correspondence.push({ label, value });
  }

  const photo: { label: string; value: React.ReactNode }[] = [];
  const photoRows: [string, unknown][] = [
    ["Occasion", letter.photo_occasion],
    ["Photographer", letter.photographer],
    ["Print size", letter.print_size],
    ["Medium", letter.photo_medium],
    ["Inscription on back", letter.photo_back_inscription],
  ];
  for (const [label, value] of photoRows) if (has(value)) photo.push({ label, value: String(value) });

  const narrative: { label: string; value: string }[] = [];
  const narrativeRows: [string, unknown][] = [
    ["Short summary", letter.summary_short],
    ["Detailed summary", letter.summary_long],
    ["General notes", letter.notes],
    ["Physical description", letter.physical_description],
    ["Provenance", letter.provenance],
    ["Historical context", letter.historical_notes],
    ["Citations / sources", letter.citations],
  ];
  for (const [label, value] of narrativeRows)
    if (has(value)) narrative.push({ label, value: String(value) });

  return (
    <div className="max-w-5xl space-y-6">
      <Section title="Catalog">
        {details.map((d) => (
          <Field key={d.label} label={d.label} value={d.value} />
        ))}
      </Section>

      {postal.length > 0 && (
        <Section title="Mailing & postal">
          {postal.map((d) => (
            <Field key={d.label} label={d.label} value={d.value} />
          ))}
        </Section>
      )}

      {correspondence.length > 0 && (
        <Section title="Correspondence details">
          {correspondence.map((d) => (
            <Field key={d.label} label={d.label} value={d.value} />
          ))}
        </Section>
      )}

      {photo.length > 0 && (
        <Section title="Photograph details">
          {photo.map((d) => (
            <Field key={d.label} label={d.label} value={d.value} />
          ))}
        </Section>
      )}

      {narrative.length > 0 && (
        <Section title="Notes & summaries" columns={false}>
          {narrative.map((d) => (
            <div key={d.label}>
              <div className="field-label">{d.label}</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{d.value}</p>
            </div>
          ))}
        </Section>
      )}

      {letter.normalized_date && (
        <p className="text-sm">
          <Link
            to="/on-this-date/$date"
            params={{ date: letter.normalized_date.slice(0, 10) }}
            className="text-primary hover:underline"
          >
            What was happening in the world this day?
          </Link>
        </p>
      )}
    </div>
  );
}
