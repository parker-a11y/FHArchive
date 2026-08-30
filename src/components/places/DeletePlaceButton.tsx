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
  placeId: string;
  name: string;
  /** Trigger element (a button). */
  children: ReactNode;
  /** Navigate to /places after a successful delete. */
  redirectAfter?: boolean;
};

/** Confirms and deletes a place record; all record links go with it. */
export function DeletePlaceButton({ placeId, name, children, redirectAfter }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const { error } = await supabase.from("places").delete().eq("id", placeId);
      if (error) throw error;
      toast.success(`Deleted ${name}`);
      await qc.invalidateQueries({ queryKey: ["places"] });
      await qc.invalidateQueries({ queryKey: ["entities"] });
      if (redirectAfter) navigate({ to: "/places" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the place record and its links to records and digital sources. The records
            themselves are not deleted. This cannot be undone — if this is the same place under
            another spelling, merge it instead.
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
            Delete place
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
