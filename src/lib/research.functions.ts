import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ask Francis: readers with research access; editors always. */
async function assertResearchAccess(context: any) {
  const [{ data: canEdit }, { data: canRead }] = await Promise.all([
    context.supabase.rpc("can_edit_archive", { _user_id: context.userId }),
    context.supabase.rpc("can_read_archive", { _user_id: context.userId }),
  ]);
  if (canEdit) return { canEdit: true };
  if (!canRead) throw new Error("You do not have access to the archive.");
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("ask_francis")
    .eq("id", context.userId)
    .maybeSingle();
  if (!profile?.ask_francis)
    throw new Error("Ask Francis is not enabled for your account. Ask the archive owner to turn it on.");
  return { canEdit: false };
}

export const askFrancis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    question: string;
    history?: { role: "user" | "assistant"; content: string }[];
  }) => ({
    question: String(data.question ?? "").trim().slice(0, 4000),
    history: (data.history ?? []).slice(-6).map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(h.content).slice(0, 4000),
    })),
  }))
  .handler(async ({ data, context }) => {
    if (!data.question) throw new Error("Ask a research question first.");
    await assertResearchAccess(context);
    // Retrieval and generation run with a read-only view of the research index.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { answerResearchQuestion } = await import("@/lib/research/agent.server");
    return answerResearchQuestion(supabaseAdmin, data.question, data.history);
  });

/** Manual "Refresh Research Snapshot" — editors and admins only. */
export const refreshResearchSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: canEdit } = await context.supabase.rpc("can_edit_archive", {
      _user_id: context.userId,
    });
    if (!canEdit) throw new Error("Only the archive owner or an archivist can refresh the snapshot.");
    const { runResearchSnapshot } = await import("@/lib/research/snapshot.server");
    return runResearchSnapshot("manual");
  });
