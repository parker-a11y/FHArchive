/**
 * Daily digest of archivist activity.
 *
 * Reads edit_history for the last 24 hours, keeps only rows whose actor holds
 * the `archivist` role, and turns them into short plain-language lines such as
 * "Riley Harrington changed keywords and added people for FH0014, FH0021".
 */

type Row = {
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  letter_id: string | null;
  entity: string;
  field_key: string;
};

const FIELD_GROUPS: { test: (k: string) => boolean; label: string }[] = [
  { test: (k) => k.startsWith("transcription"), label: "updated transcriptions" },
  { test: (k) => k.includes("summary"), label: "updated summaries" },
  { test: (k) => k.includes("date"), label: "updated dates" },
  { test: (k) => k.includes("notes"), label: "updated notes" },
  { test: (k) => k.includes("storage") || k.includes("container"), label: "updated storage details" },
  { test: (k) => k.includes("status"), label: "changed statuses" },
];

const ENTITY_LABELS: Record<string, string> = {
  letter_people: "people",
  letter_places: "places",
  letter_keywords: "keywords",
  letter_organizations: "organizations",
  letter_events: "events",
};

function describe(rows: Row[]): string[] {
  const actions = new Set<string>();
  for (const r of rows) {
    const entityLabel = ENTITY_LABELS[r.entity];
    if (entityLabel) {
      actions.add(
        `${r.field_key === "unlinked" ? "removed" : "added"} ${entityLabel}`,
      );
      continue;
    }
    const group = FIELD_GROUPS.find((g) => g.test(r.field_key));
    actions.add(group ? group.label : "edited record details");
  }
  return [...actions];
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export async function buildArchivistDigest(hours = 24) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data: archivistRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "archivist");
  const archivistIds = new Set((archivistRoles ?? []).map((r) => r.user_id));
  if (!archivistIds.size) return { lines: [] as string[], since };

  const { data: history, error } = await supabaseAdmin
    .from("edit_history")
    .select("actor_id, actor_name, actor_email, letter_id, entity, field_key")
    .gte("created_at", since)
    .not("actor_id", "is", null)
    .limit(5000);
  if (error) throw error;

  const rows = ((history ?? []) as Row[]).filter(
    (r) => r.actor_id && archivistIds.has(r.actor_id),
  );
  if (!rows.length) return { lines: [] as string[], since };

  const letterIds = [...new Set(rows.map((r) => r.letter_id).filter(Boolean))] as string[];
  const archiveIdById = new Map<string, string>();
  if (letterIds.length) {
    const { data: letters } = await supabaseAdmin
      .from("letters")
      .select("id, archive_id")
      .in("id", letterIds);
    for (const l of letters ?? []) archiveIdById.set(l.id, l.archive_id);
  }

  const byActor = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byActor.get(r.actor_id!) ?? [];
    list.push(r);
    byActor.set(r.actor_id!, list);
  }

  const lines: string[] = [];
  for (const [, actorRows] of byActor) {
    const first = actorRows[0]!;
    const name = first.actor_name || first.actor_email || "An archivist";
    const refs = [
      ...new Set(
        actorRows
          .map((r) => (r.letter_id ? archiveIdById.get(r.letter_id) : null))
          .filter(Boolean) as string[],
      ),
    ].sort();
    const shown = refs.slice(0, 8).join(", ");
    const extra = refs.length > 8 ? ` and ${refs.length - 8} more` : "";
    const actions = joinList(describe(actorRows));
    const where = refs.length ? ` for ${shown}${extra}` : "";
    lines.push(
      `${name} ${actions}${where} (${actorRows.length} change${actorRows.length === 1 ? "" : "s"}).`,
    );
  }

  return { lines, since };
}

/** Builds the digest and emails it to every admin account. */
export async function sendArchivistDigest(hours = 24) {
  const { lines, since } = await buildArchivistDigest(hours);
  if (!lines.length) return { status: "skipped", reason: "no archivist activity", since };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: adminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = (adminRoles ?? []).map((r) => r.user_id);
  if (!adminIds.length) return { status: "skipped", reason: "no admins", since };

  const { data: adminProfiles } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .in("id", adminIds);

  const periodLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  let sent = 0;
  for (const admin of adminProfiles ?? []) {
    if (!admin.email) continue;
    await sendTemplateEmail("archivist-activity", admin.email, {
      idempotencyKey: `archivist-activity-${periodLabel}-${admin.email}`,
      templateData: { periodLabel, lines, archiveUrl: "https://fharchive.com" },
    });
    sent += 1;
  }

  return { status: "ok", sent, lines: lines.length, since };
}
