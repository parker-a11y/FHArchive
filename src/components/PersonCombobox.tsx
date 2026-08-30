import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { PRIMARY_PERSONS } from "@/lib/archive";
import { cn } from "@/lib/utils";
import { usePersonMatcher } from "@/components/MatchPersonDialog";

export function usePeopleNames() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function PersonCombobox({
  value,
  onChange,
  placeholder = "Select or add a person…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: people = [] } = usePeopleNames();
  const { resolvePerson, dialog: personDialog } = usePersonMatcher();

  const options = useMemo(() => {
    const seeded = PRIMARY_PERSONS.map((p) => p.value).filter(Boolean);
    const names = new Set<string>(seeded);
    for (const p of people) if (p.name) names.add(p.name);
    if (value) names.add(value);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [people, value]);

  const query = search.trim();
  const exists = options.some((o) => o.toLowerCase() === query.toLowerCase());

  async function createPerson(name: string) {
    setCreating(true);
    try {
      // Near-duplicate names prompt a match dialog instead of silently
      // creating a second record for the same person.
      const person = await resolvePerson(name);
      if (!person) return;
      await qc.invalidateQueries({ queryKey: ["people"] });
      toast.success(
        person.name.toLowerCase() === name.trim().toLowerCase()
          ? `Added ${person.name} to People`
          : `Matched to ${person.name}`,
      );
      onChange(person.name);
      setSearch("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the person");
    } finally {
      setCreating(false);
    }
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
          className={cn("h-9 w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
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
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">— Clear —</span>
                </CommandItem>
              )}
              {options.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {name}
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
