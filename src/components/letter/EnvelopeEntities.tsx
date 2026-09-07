/**
 * People and places for the envelope in front of you.
 *
 * Envelope Review is often the first time a sender, addressee or postmark
 * town is read, so this panel lets those be created and linked without
 * leaving the review screen. Typed postal wording on the record is never
 * changed by linking — these are separate archive links.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonCombobox, usePeopleNames } from "@/components/PersonCombobox";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName, sameName } from "@/lib/normalize";

const PERSON_ROLES = [
  { value: "author", label: "Sender" },
  { value: "recipient", label: "Addressee" },
  { value: "mentioned", label: "Mentioned" },
] as const;

const PLACE_ROLES = [
  { value: "origin", label: "Origin" },
  { value: "destination", label: "Destination" },
  { value: "mentioned", label: "Mentioned" },
] as const;

const selectClass = "h-9 rounded border border-input bg-background px-2 text-sm";

export function EnvelopeEntities({ letterId }: { letterId: string }) {
  const qc = useQueryClient();
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState<string>("author");
  const [placeName, setPlaceName] = useState("");
  const [placeRole, setPlaceRole] = useState<string>("origin");
  const [busy, setBusy] = useState(false);

  const { data: people = [] } = usePeopleNames();

  const { data: places = [] } = useQuery({
    queryKey: ["places", "names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("places")
        .select("id, canonical_name")
        .order("canonical_name");
      if (error) throw error;
      return data ?? [];
    },
    refetchOnMount: "always",
  });

  const { data: links, refetch } = useQuery({
    queryKey: ["envelope-links", letterId],
    queryFn: async () => {
      const [p, pl] = await Promise.all([
        supabase
          .from("letter_people")
          .select("id, role, person_id, people(name)")
          .eq("letter_id", letterId),
        supabase
          .from("letter_places")
          .select("id, role, place_id, places(canonical_name)")
          .eq("letter_id", letterId),
      ]);
      return { people: p.data ?? [], places: pl.data ?? [] };
    },
  });

  async function addPerson() {
    const name = normalizeName(personName);
    if (!name) return;
    const person = people.find((p) => sameName(p.name ?? "", name));
    if (!person) {
      toast.error("Pick the person from the list so a canonical record is used.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("letter_people")
        .insert({ letter_id: letterId, person_id: person.id, role: personRole, source: "manual" });
      if (error && !/duplicate key/i.test(error.message)) throw error;
      setPersonName("");
      await refetch();
      toast.success(`${person.name} linked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link the person");
    } finally {
      setBusy(false);
    }
  }

  async function addPlace() {
    const name = normalizeName(placeName);
    if (!name) return;
    setBusy(true);
    try {
      let id = places.find((p) => sameName(p.canonical_name ?? "", name))?.id;
      if (!id) {
        const { data, error } = await supabase
          .from("places")
          .insert({ canonical_name: name })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        await qc.invalidateQueries({ queryKey: ["places"] });
      }
      const { error: linkError } = await supabase
        .from("letter_places")
        .insert({ letter_id: letterId, place_id: id, role: placeRole, source: "manual" });
      if (linkError && !/duplicate key/i.test(linkError.message)) throw linkError;
      setPlaceName("");
      await refetch();
      toast.success(`${name} linked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link the place");
    } finally {
      setBusy(false);
    }
  }

  async function remove(table: "letter_people" | "letter_places", id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refetch();
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
      <div className="space-y-2">
        <h3 className="field-label">People on this envelope</h3>
        <PersonCombobox value={personName} onChange={setPersonName} />
        <div className="flex gap-2">
          <select
            className={`${selectClass} flex-1`}
            value={personRole}
            onChange={(e) => setPersonRole(e.target.value)}
          >
            {PERSON_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addPerson} disabled={busy || !personName}>
            Link
          </Button>
        </div>
        {links?.people.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-0.5 text-sm">
            <span>
              {(r.people as { name?: string } | null)?.name}
              <span className="ml-1 text-xs text-muted-foreground">{r.role}</span>
            </span>
            <button type="button" onClick={() => remove("letter_people", r.id)}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="field-label">Places on this envelope</h3>
        <Input
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlace()}
          list="envelope-place-list"
        />
        <datalist id="envelope-place-list">
          {places.map((p) => (
            <option key={p.id} value={p.canonical_name} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <select
            className={`${selectClass} flex-1`}
            value={placeRole}
            onChange={(e) => setPlaceRole(e.target.value)}
          >
            {PLACE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addPlace} disabled={busy || !placeName.trim()}>
            Link
          </Button>
        </div>
        {links?.places.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-0.5 text-sm">
            <span>
              {(r.places as { canonical_name?: string } | null)?.canonical_name}
              <span className="ml-1 text-xs text-muted-foreground">{r.role}</span>
            </span>
            <button type="button" onClick={() => remove("letter_places", r.id)}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
