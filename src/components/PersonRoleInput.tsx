import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { comparePeopleNames } from "@/lib/archive";
import { cn } from "@/lib/utils";
import { usePersonMatcher, type ResolvedPerson } from "@/components/MatchPersonDialog";
import { usePeopleNames } from "@/components/PersonCombobox";

// Single shared people list for every picker.
export { usePeopleNames };


export type PersonRoleValue = { id: string; name: string } | null;

/**
 * Single-select people picker for a specific record role (author, recipient,
 * etc.). The free-text name is always returned so plain-text columns stay in
 * sync, and the resolved person id is passed back for linking.
 */
export function PersonRoleInput({
  value,
  onChange,
  placeholder = "Select or add a person…",
  className,
  disabled,
}: {
  value: PersonRoleValue;
  onChange: (person: PersonRoleValue, name: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: people = [] } = usePeopleNames();
  const { resolvePerson, dialog: personDialog } = usePersonMatcher();

  const options = useMemo(
    () =>
      people
        .filter((p) => p.name)
        .sort((a, b) => comparePeopleNames(a.name, b.name)),
    [people],
  );

  const query = search.trim();
  const exists = people.some((p) => p.name?.toLowerCase() === query.toLowerCase());

  async function createPerson(name: string) {
    setCreating(true);
    try {
      const person = await resolvePerson(name);
      if (!person) return;
      await qc.invalidateQueries({ queryKey: ["people"] });
      toast.success(
        person.name.toLowerCase() === name.trim().toLowerCase()
          ? `Added ${person.name} to People`
          : `Matched to ${person.name}`,
      );
      onChange({ id: person.id, name: person.name }, person.name);
      setSearch("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the person");
    } finally {
      setCreating(false);
    }
  }

  function selectPerson(person: { id: string; name: string }) {
    onChange({ id: person.id, name: person.name }, person.name);
    setSearch("");
    setOpen(false);
  }

  function clear() {
    onChange(null, "");
    setOpen(false);
  }

  return (
    <>
      {personDialog}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-9 w-full justify-between font-normal", className)}
          >
            <span className={cn("truncate", !value?.name && "text-muted-foreground")}>
              {value?.name || placeholder}
            </span>
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
                    disabled={creating}
                    onSelect={() => createPerson(query)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add “{query}” as a new person
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandEmpty>No people found.</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem value="__clear__" onSelect={clear}>
                    <span className="text-muted-foreground">— Clear —</span>
                  </CommandItem>
                )}
                {options.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => selectPerson({ id: p.id, name: p.name })}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.id === p.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
