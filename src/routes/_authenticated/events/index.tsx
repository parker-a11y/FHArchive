import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, labelOf } from "@/lib/archive";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({
    meta: [
      { title: "Events — The Francis Files" },
      {
        name: "description",
        content:
          "Reusable event records — marriages, births, wartime service and trips — linked to items in The Francis Files.",
      },
      { property: "og:title", content: "Events — The Francis Files" },
      {
        property: "og:description",
        content: "Family and historical events linked to archive items.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Events />
    </AppShell>
  ),
});

function Events() {
  const { isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("family");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("events").insert({
      name: name.trim(),
      event_type: eventType,
      start_date: start || null,
      end_date: end || null,
    });
    if (error) return toast.error(error.message);
    setName("");
    setStart("");
    setEnd("");
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["entities"] });
  }

  return (
    <>
      <PageHeader title="Events" description={`${events.length} event records — never required`} />
      <div className="max-w-4xl p-4 sm:p-8">
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-[1fr_10rem_9rem_9rem_auto] gap-2">
          <Input
            placeholder="e.g. Marriage of Francis & Jacqueline"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select
            className="h-9 rounded border border-input bg-background px-2 text-sm"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {EVENT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Button onClick={add}>Add</Button>
        </div>

        <div className="divide-y divide-border rounded border border-border bg-card">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-baseline gap-4 px-4 py-2.5 text-sm">
              <span className="font-medium">{ev.name}</span>
              <span className="text-xs text-muted-foreground">
                {labelOf(EVENT_TYPES, ev.event_type)}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {[ev.start_date, ev.end_date].filter(Boolean).join(" – ")}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No events yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
