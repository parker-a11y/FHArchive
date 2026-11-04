/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_WRITER_INSTRUCTIONS } from "./writer-default-instructions";

async function assertEditor(context: any) {
  const { data } = await context.supabase.rpc("can_edit_archive", { _user_id: context.userId });
  if (!data) throw new Error("Only archivists and administrators can use the writing assistant.");
}

function cleanIds(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? "").split(/[\s,;]+/);
  return Array.from(
    new Set(
      list
        .map((x) => String(x).toUpperCase().replace(/\s/g, ""))
        .map((x) => (/^FH-?\d{1,4}$/.test(x) ? `FH${x.replace(/\D/g, "").padStart(4, "0")}` : ""))
        .filter(Boolean),
    ),
  ).slice(0, 25);
}

export const getWriterSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { data } = await context.supabase.from("writing_settings").select("instructions").eq("id", 1).maybeSingle();
    const saved = (data as any)?.instructions?.trim();
    return { instructions: saved || DEFAULT_WRITER_INSTRUCTIONS, isDefault: !saved };
  });

export const saveWriterSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { instructions: string }) => ({ instructions: String(d?.instructions ?? "").slice(0, 40000) }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { error } = await context.supabase
      .from("writing_settings")
      .upsert({ id: 1, instructions: data.instructions, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWriterSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { data, error } = await context.supabase
      .from("writing_sessions")
      .select("id, title, record_ids, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWriterSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row, error } = await context.supabase.from("writing_sessions").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That session no longer exists.");
    const { data: recs } = await context.supabase
      .from("letters")
      .select("id, archive_id, title, date_as_written, normalized_date")
      .in("archive_id", (row as any).record_ids ?? []);
    return { session: row as any, records: recs ?? [] };
  });

export const deleteWriterSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    await context.supabase.from("writing_sessions").delete().eq("id", data.id);
    return { ok: true };
  });

/** Sends one message. Creates the session when none is given; records may change per turn. */
export const sendWriterMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId?: string | null; recordIds: string[]; prompt?: string }) => {
    const recordIds = cleanIds(d?.recordIds);
    const prompt = String(d?.prompt ?? "").trim().slice(0, 8000);
    if (!recordIds.length && !prompt) throw new Error("Pick at least one FH record or type a prompt.");
    return { sessionId: d?.sessionId ? String(d.sessionId) : null, recordIds, prompt };
  })
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { gatherRecordMaterial, gatherPriorWriting, runWriterTurn } = await import("./writer.server");
    const db = context.supabase;
    let session: any = null;
    if (data.sessionId) {
      const { data: row } = await db.from("writing_sessions").select("*").eq("id", data.sessionId).maybeSingle();
      session = row;
    }
    const history = Array.isArray(session?.messages) ? [...session.messages] : [];
    const userText =
      data.prompt ||
      (history.length ? "Please continue." : "Write a blog post from these records, following the standing instructions.");
    const now = new Date().toISOString();
    history.push({ role: "user", content: userText, at: now, records: data.recordIds });

    const { data: settings } = await db.from("writing_settings").select("instructions").eq("id", 1).maybeSingle();
    const instructions = (settings as any)?.instructions?.trim() || DEFAULT_WRITER_INSTRUCTIONS;
    const material = await gatherRecordMaterial(db, data.recordIds);
    const missing = data.recordIds.filter((id) => !material.found.some((f: any) => f.archive_id === id));
    if (missing.length) throw new Error(`Not found in the archive: ${missing.join(", ")}`);

    const prior = await gatherPriorWriting(db, data.recordIds).catch(() => "");
    const reply = await runWriterTurn({ instructions, material: material.text, history: history.slice(-20), prior });
    history.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    const titleMatch = reply.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const autoTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 140) : null;

    if (session) {
      const { error } = await db
        .from("writing_sessions")
        .update({ messages: history, record_ids: data.recordIds, updated_at: new Date().toISOString(), ...(session.title === "Untitled session" && autoTitle ? { title: autoTitle } : {}) })
        .eq("id", session.id);
      if (error) throw new Error(error.message);
      return { sessionId: session.id as string, reply };
    }
    const { data: created, error } = await db
      .from("writing_sessions")
      .insert({ created_by: context.userId, title: autoTitle || data.recordIds.join(", ") || "Untitled session", record_ids: data.recordIds, messages: history })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: (created as any).id as string, reply };
  });
