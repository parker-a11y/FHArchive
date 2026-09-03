import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePeopleNames } from "@/components/PersonCombobox";
import { usePersonMatcher } from "@/components/MatchPersonDialog";
import { comparePeopleNames } from "@/lib/archive";

export type PersonRef = { id: string; name: string };

/**
 * Multi-select of people from the People database. Names not yet in the
 * database can be added inline; that path runs through the fuzzy-match /
 * confirm-create dialog so no duplicate person records are created.
 */
export function PersonMultiSelect({
  value,
  onAdd,
  onRemove,
  placeholder = "Add a person…",
  className,
}: {
  value: PersonRef[];
  onAdd: (person: PersonRef) => void | Promise<void>;
  onRemove: (person: PersonRef) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: people = [], refetch } = usePeopleNames();
  const { resolvePerson, dialog: personDialog } = usePersonMatcher();

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);
  const options = useMemo(
    () =>
      people
        .filter((p) => p.name && !selectedIds.has(p.id))
        .sort((a, b) => comparePeopleNames(a.name, b.name)),
    [people, selectedIds],
  );

  const query = search.trim();
  const exists = people.some((p) => p.name?.toLowerCase() === query.toLowerCase());

  async function add(person: PersonRef) {
    if (selectedIds.has(person.id)) return;
    setBusy(true);
    try {
      await onAdd(person);
      setSearch("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that person");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(name: string) {
    setBusy(true);
    try {
      const person = await resolvePerson(name);
      if (!person) return;
      await qc.invalidateQueries({ queryKey: ["people"] });
      if (selectedIds.has(person.id)) {
        toast.info(`${person.name} is already listed`);
        return;
      }
      await onAdd({ id: person.id, name: person.name });
      setSearch("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the person");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {personDialog}
      <div className={cn("space-y-2", className)}>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-2 py-0.5 text-xs"
              >
                {p.name}
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onRemove(p)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-9 w-full justify-between font-normal"
            >
              <span className="truncate text-muted-foreground">{placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter>
              <CommandInput
                placeholder="Search or type a new name…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {query && !exists && (
                  <CommandGroup>
                    <CommandItem
                      value={`__create__${query}`}
                      disabled={busy}
                      onSelect={() => createAndAdd(query)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add “{query}” as a new person
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>No people found.</CommandEmpty>
                <CommandGroup>
                  {options.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      disabled={busy}
                      onSelect={() => add({ id: p.id, name: p.name })}
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
