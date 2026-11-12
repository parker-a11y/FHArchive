import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchNextAttentionRecord } from "@/lib/next-attention-query";

export function NextAttentionButton({ sequence, tab, disabled = false }: {
  sequence: number;
  tab: "ai" | "transcription";
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  async function goNext() {
    setSearching(true);
    try {
      const archiveId = await fetchNextAttentionRecord(sequence);
      if (!archiveId) {
        toast.message("No lower-numbered records need attention.");
        return;
      }
      await navigate({ to: "/letters/$archiveId", params: { archiveId }, search: { tab } });
    } catch {
      toast.error("Could not find the next record. Please try again.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={goNext} disabled={disabled || searching}
      title="Go down in FH numbers to the next non-green record">
      {searching ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ArrowDown className="mr-1.5 size-4" />}
      {searching ? "Finding next…" : "NEXT NEED ATTENTION"}
    </Button>
  );
}