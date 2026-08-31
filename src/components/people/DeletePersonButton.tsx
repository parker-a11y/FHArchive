import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  personId: string;
  name: string;
  /** Trigger element (a button). */
  children: ReactNode;
  /** Navigate to /people after a successful delete. */
  redirectAfter?: boolean;
};

/** Confirms and deletes a person record; all record links and aliases go with it. */
export function DeletePersonButton({ personId, name, children, redirectAfter }: Props) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const { error } = await supabase.from("people").delete().eq("id", personId);
      if (error) throw error;
      toast.success(`Deleted ${name}`);
      await qc.invalidateQueries({ queryKey: ["people"] });
      await qc.invalidateQueries({ queryKey: ["entities"] });
      if (redirectAfter) navigate({ to: "/people" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      {isAdmin && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the person record, their alternate spellings, and their links to records
            and digital sources. The records themselves are not deleted. This cannot be undone — if
            this is the same person under another spelling, use the Duplicates tab to merge instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void remove();
            }}
          >
            Delete person
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
