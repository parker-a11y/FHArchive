import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteLetterInput = z.object({
  letterId: z.string().uuid(),
});

export const deleteLetterRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterId: string }) => deleteLetterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error("Could not verify administrator access. Please try again.");
    if (!isAdmin) throw new Error("Only an administrator can delete archive records.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: letter, error: letterError } = await supabaseAdmin
      .from("letters")
      .select("id, archive_id, fh_seq")
      .eq("id", data.letterId)
      .maybeSingle();
    if (letterError) throw new Error(`Could not load the record: ${letterError.message}`);
    if (!letter) throw new Error("This record has already been deleted.");

    const [masters, derivatives] = await Promise.all([
      supabaseAdmin.from("digital_files").select("master_path").eq("letter_id", letter.id),
      supabaseAdmin.from("file_derivatives").select("storage_path").eq("letter_id", letter.id),
    ]);
    if (masters.error) throw new Error(`Could not list the record scans: ${masters.error.message}`);
    if (derivatives.error) {
      throw new Error(`Could not list the record previews: ${derivatives.error.message}`);
    }

    const paths = Array.from(
      new Set(
        [
          ...(masters.data ?? []).map((file) => file.master_path),
          ...(derivatives.data ?? []).map((file) => file.storage_path),
        ].filter((path): path is string => Boolean(path)),
      ),
    );
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await supabaseAdmin.storage.from("scans").remove(paths.slice(index, index + 100));
      if (error) throw new Error(`Could not remove the record scans: ${error.message}`);
    }

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from("letters")
      .delete()
      .eq("id", letter.id)
      .select("id");
    if (deleteError) throw new Error(`Could not delete ${letter.archive_id}: ${deleteError.message}`);
    if (!deleted?.length) throw new Error(`${letter.archive_id} was not deleted. Please try again.`);

    await Promise.all([
      supabaseAdmin.from("ffn_occurrences").delete().eq("kind", "letter").eq("ref_id", letter.id),
      supabaseAdmin.from("research_index").delete().eq("kind", "letter").eq("ref_id", letter.id),
    ]);

    const { data: counter } = await supabaseAdmin
      .from("archive_counter")
      .select("owner_id, last_seq")
      .eq("last_seq", letter.fh_seq)
      .maybeSingle();
    let reused = false;
    if (counter) {
      const { data: latest } = await supabaseAdmin
        .from("letters")
        .select("fh_seq")
        .order("fh_seq", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error: counterError } = await supabaseAdmin
        .from("archive_counter")
        .update({ last_seq: latest?.fh_seq ?? 0 })
        .eq("owner_id", counter.owner_id)
        .eq("last_seq", letter.fh_seq);
      if (counterError) throw new Error(`Record deleted, but its number could not be released: ${counterError.message}`);
      reused = true;
    }

    return { archiveId: letter.archive_id, reused };
  });