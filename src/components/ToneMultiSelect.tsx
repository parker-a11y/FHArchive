import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createToneOption, fetchToneOptions, mergeToneOptions } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function useToneOptions() {
  return useQuery({ queryKey: ["tone_options"], queryFn: fetchToneOptions });
}

export function ToneMultiSelect({
  value,
  onChange,
  placeholder = "Select tone / sentiment…",
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: custom = [] } = useToneOptions();

  const options = useMemo(
    () => mergeToneOptions(custom, value).sort((a, b) => a.localeCompare(b)),
    [custom, value],
  );

  const query = search.trim();
  const exists = options.some((o) => o.toLowerCase() === query.toLowerCase());

  const create = useMutation({
    mutationFn: (name: string) => createToneOption(name),
    onSuccess: async (_d, name) => {
      await qc.invalidateQueries({ queryKey: ["tone_options"] });
      toggle(name, true);
      setSearch("");
      toast.success(`Added “${name}” to Tone / Sentiment`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(name: string, force?: boolean) {
    const on = force ?? !value.includes(name);
    onChange(on ? Array.from(new Set([...value, name])) : value.filter((v) => v !== name));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between font-normal"
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {value.length ? `${value.length} selected` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder="Search tones…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No tones found.</CommandEmpty>
              <CommandGroup>
                {options.map((name) => (
                  <CommandItem key={name} value={name} onSelect={() => toggle(name)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(name) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value={`__add_new__${query}`}
                  disabled={create.isPending || (!!query && exists)}
                  onSelect={() => {
                    if (!query) {
                      toast.info("Type a new tone name above, then choose “+ Add New”.");
                      return;
                    }
                    if (exists) return;
                    create.mutate(query);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {query && !exists ? `+ Add New — “${query}”` : "+ Add New"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-xs"
            >
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => toggle(t, false)}>
                <X className="h-3 w-3 opacity-60 hover:opacity-100" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
