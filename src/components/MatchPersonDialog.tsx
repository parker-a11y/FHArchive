import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  addPersonAlias,
  createPerson,
  lookupPerson,
  type PersonMatch,
} from "@/lib/person-match";

export type ResolvedPerson = { id: string; name: string } | null;

type Pending = {
  proposed: string;
  candidates: PersonMatch[];
  resolve: (value: ResolvedPerson) => void;
};

/**
 * Resolves an incoming person name to an existing archive person.
 *
 * Exact name/alias hits resolve silently. Close-but-not-equal names open a
 * dialog so the archivist decides: match to an existing person (optionally
 * remembering the spelling as an alias) or create a new person.
 */
export function usePersonMatcher() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const resolvePerson = useCallback(async (rawName: string): Promise<ResolvedPerson> => {
    const name = rawName.trim();
    if (!name) return null;
    const result = await lookupPerson(name);
    if (result.kind === "exact") return result.person;
    if (result.kind === "new") return await createPerson(name);

    return await new Promise<ResolvedPerson>((resolve) => {
      const next: Pending = { proposed: name, candidates: result.candidates, resolve };
      pendingRef.current = next;
      setChoice(result.candidates[0]?.id ?? "__new__");
      setRemember(true);
      setPending(next);
    });
  }, []);

  function finish(value: ResolvedPerson) {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  }

  async function confirm() {
    const current = pendingRef.current;
    if (!current) return;
    setBusy(true);
    try {
      if (choice === "__new__") {
        finish(await createPerson(current.proposed));
      } else {
        const match = current.candidates.find((c) => c.id === choice);
        if (!match) return;
        if (remember) await addPersonAlias(match.id, current.proposed);
        finish({ id: match.id, name: match.name });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the person");
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open && !busy) finish(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match “{pending?.proposed}” to a person?</DialogTitle>
          <DialogDescription>
            This name looks like someone already in the archive. Pick a match so the archive
            keeps one record per person.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={choice} onValueChange={setChoice} className="gap-2">
          {pending?.candidates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded border border-border p-2.5">
              <RadioGroupItem value={c.id} id={`m-${c.id}`} />
              <Label htmlFor={`m-${c.id}`} className="flex-1 cursor-pointer font-normal">
                <span className="font-medium">{c.name}</span>
                {c.matched_on !== c.name && (
                  <span className="text-muted-foreground"> — via “{c.matched_on}”</span>
                )}
              </Label>
              <span className="text-xs text-muted-foreground">
                {Math.round(c.score * 100)}% match
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded border border-border p-2.5">
            <RadioGroupItem value="__new__" id="m-new" />
            <Label htmlFor="m-new" className="flex-1 cursor-pointer font-normal">
              Create a new person “{pending?.proposed}”
            </Label>
          </div>
        </RadioGroup>

        {choice !== "__new__" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            Remember “{pending?.proposed}” as an alternate spelling
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => finish(null)} disabled={busy}>
            Skip
          </Button>
          <Button onClick={confirm} disabled={busy || !choice}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { resolvePerson, dialog };
}
