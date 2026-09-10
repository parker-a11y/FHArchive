import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateCustomRecap } from "@/lib/recaps.functions";

/** Lets an archivist write a recap over any period, with their own instructions. */
export function CustomRecapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const run = useServerFn(generateCustomRecap);

  const [wholeArchive, setWholeArchive] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateBasis, setDateBasis] = useState<"catalogued" | "written">("catalogued");
  const [limit, setLimit] = useState("40");
  const [detail, setDetail] = useState<"brief" | "standard" | "deep">("standard");
  const [focus, setFocus] = useState("");
  const [audience, setAudience] = useState("");
  const [instructions, setInstructions] = useState("");

  const generate = useMutation({
    mutationFn: async () =>
      run({
        data: {
          wholeArchive,
          fromDate: fromDate || null,
          toDate: toDate || null,
          dateBasis,
          limit: Number(limit) || 40,
          detail,
          focus,
          audience,
          instructions,
        },
      }),
    onSuccess: async (result: any) => {
      await qc.invalidateQueries({ queryKey: ["weekly-recaps"] });
      toast.success("Custom recap created.");
      onOpenChange(false);
      if (result?.slug) navigate({ to: "/recaps/$weekStart", params: { weekStart: result.slug } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !generate.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a custom recap</DialogTitle>
          <DialogDescription>
            Write a recap over any period you choose, with your own instructions. It is saved
            alongside the weekly recaps and never replaces one.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={wholeArchive}
              onCheckedChange={(v) => setWholeArchive(v === true)}
            />
            Cover the whole archive
          </label>

          {!wholeArchive && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="field-label">From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="field-label">To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="field-label">Dates refer to</Label>
                <Select value={dateBasis} onValueChange={(v) => setDateBasis(v as typeof dateBasis)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catalogued">When records were catalogued</SelectItem>
                    <SelectItem value="written">When the letters were written</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="field-label">Records to use (max 400)</Label>
              <Input
                type="number"
                min={5}
                max={400}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <div>
              <Label className="field-label">Length</Label>
              <Select value={detail} onValueChange={(v) => setDetail(v as typeof detail)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">In depth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="field-label">Focus (people, places, subjects)</Label>
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. Jacquelyn, Borneo, homesickness"
            />
          </div>

          <div>
            <Label className="field-label">Tone or audience</Label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. warm, for grandchildren"
            />
          </div>

          <div>
            <Label className="field-label">Other instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. Open with the strongest quotation, and end with what to look for next."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button className="gap-2" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-archive-gold" />
            )}
            Generate recap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
