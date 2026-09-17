import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, PenLine } from "lucide-react";
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
import { generateBlogPost } from "@/lib/recaps.functions";

/** Writes a blog post from a pasted outline, evidenced with real records and quotes. */
export function BlogPostDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const run = useServerFn(generateBlogPost);

  const [outline, setOutline] = useState("");
  const [refs, setRefs] = useState("");
  const [supporting, setSupporting] = useState(true);
  const [outsideResearch, setOutsideResearch] = useState(false);
  const [detail, setDetail] = useState<"brief" | "standard" | "deep">("standard");
  const [audience, setAudience] = useState("");
  const [instructions, setInstructions] = useState("");

  const generate = useMutation({
    mutationFn: async () =>
      run({ data: { outline, refs, supporting, outsideResearch, detail, audience, instructions } }),
    onSuccess: async (result: any) => {
      await qc.invalidateQueries({ queryKey: ["weekly-recaps"] });
      toast.success("Blog post drafted.");
      onOpenChange(false);
      if (result?.slug) navigate({ to: "/recaps/$weekStart", params: { weekStart: result.slug } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !generate.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a blog post</DialogTitle>
          <DialogDescription>
            Paste your outline. The archive supplies the evidence — real records, quotations and
            links — while your structure and argument are kept exactly as written.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <Label className="field-label">Your outline</Label>
            <Textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={12}
              placeholder={"Paste the outline, draft or notes for the post.\n\nHeadings, bullets and sentences are all followed in the order you write them."}
            />
          </div>

          <div>
            <Label className="field-label">Records to include</Label>
            <Input
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
              placeholder="FH0042, FH0087, DS0011"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              These are always pulled in. Numbers written inside the outline are used too.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={supporting}
              onCheckedChange={(v) => setSupporting(v === true)}
              className="mt-0.5"
            />
            <span>
              Also search the archive for supporting material
              <span className="block text-xs text-muted-foreground">
                Finds further letters, photographs, sources and accepted quotations that fit the outline.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={outsideResearch}
              onCheckedChange={(v) => setOutsideResearch(v === true)}
              className="mt-0.5"
            />
            <span>
              Add outside historical research
              <span className="block text-xs text-muted-foreground">
                Looks up published background history for context the files don't cover. Outside
                facts are cited with links and kept separate from archive evidence.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="field-label">Length</Label>
              <Select value={detail} onValueChange={(v) => setDetail(v as typeof detail)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">Deep</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="field-label">Audience &amp; tone</Label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. family readers, warm and plainspoken"
              />
            </div>
          </div>

          <div>
            <Label className="field-label">Extra instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Anything else the writing should do or avoid."
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
              <PenLine className="size-4 text-archive-gold" />
            )}
            {generate.isPending ? "Writing…" : "Create blog post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
