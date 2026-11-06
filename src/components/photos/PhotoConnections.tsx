import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addPhotoLink, CERTAINTY_LABEL, fetchPhotoLinks, removePhotoLink, searchLinkCandidates, updatePhotoLink,
  type Certainty, type LinkType, type PhotoLink,
} from "@/lib/photo-links";

const TYPE_LABEL: Record<LinkType, string> = { letter: "Letters", photo: "Photographs", person: "People" };

export function usePhotoLinks(photoId: string) {
  return useQuery({ queryKey: ["photo-links", photoId], queryFn: () => fetchPhotoLinks(photoId) });
}

/** Read-only list of connections, grouped by kind, with certainty shown on each. */
export function PhotoConnectionList({ links, onRemove, onCertainty, tone = "default" }: {
  links: PhotoLink[]; onRemove?: (l: PhotoLink) => void; onCertainty?: (l: PhotoLink, c: Certainty) => void; tone?: "default" | "stage";
}) {
  const muted = tone === "stage" ? "opacity-60" : "text-muted-foreground";
  return (
    <div className="space-y-3">
      {(["letter", "photo", "person"] as LinkType[]).map((t) => {
        const list = links.filter((l) => l.target_type === t);
        if (!list.length) return null;
        return (
          <div key={t}>
            <p className={`text-[11px] uppercase tracking-widest ${muted}`}>{TYPE_LABEL[t]}</p>
            <ul className="mt-1 space-y-1.5">
              {list.map((l) => (
                <li key={l.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <a href={l.href} className="min-w-0 flex-1 underline-offset-2 hover:underline">
                      {l.code && <span className="mr-1 font-mono text-xs">{l.code}</span>}{l.code !== l.label && l.label}
                    </a>
                    {onRemove && (
                      <button type="button" aria-label="Remove connection" className={muted} onClick={() => onRemove(l)}><X className="size-3.5" /></button>
                    )}
                  </div>
                  {onCertainty ? (
                    <select aria-label="Certainty" value={l.certainty} onChange={(e) => onCertainty(l, e.target.value as Certainty)}
                      className="mt-0.5 rounded border border-input bg-background px-1 py-0.5 text-xs">
                      {Object.entries(CERTAINTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs ${muted}`}>{CERTAINTY_LABEL[l.certainty]}</span>
                  )}
                  {l.note && <p className={`text-xs ${muted}`}>{l.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Editor panel used in the Photo Organizer. Links only reference records; no files are copied. */
export function PhotoConnectionsEditor({ photoId }: { photoId: string }) {
  const qc = useQueryClient();
  const { data: links = [] } = usePhotoLinks(photoId);
  const [type, setType] = useState<LinkType>("letter");
  const [q, setQ] = useState("");
  const [certainty, setCertainty] = useState<Certainty>("documented");
  const [note, setNote] = useState("");
  const { data: hits = [] } = useQuery({
    queryKey: ["photo-link-search", type, q, photoId],
    queryFn: () => searchLinkCandidates(type, q, photoId),
    enabled: q.trim().length > 0,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["photo-links"] });
  const run = async (f: () => Promise<void>, ok?: string) => {
    try { await f(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">Connections</p>
      <p className="text-xs text-muted-foreground">Letters, other photographs, and people this photo relates to.</p>
      <div className="mt-3">
        {links.length ? (
          <PhotoConnectionList links={links}
            onRemove={(l) => run(() => removePhotoLink(l.id), "Connection removed")}
            onCertainty={(l, c) => run(() => updatePhotoLink(l.id, c))} />
        ) : <p className="text-xs text-muted-foreground">No connections yet.</p>}
      </div>
      <div className="mt-3 space-y-2 border-t pt-3">
        <div className="flex gap-1">
          {(["letter", "photo", "person"] as LinkType[]).map((t) => (
            <Button key={t} type="button" size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
              {t === "letter" ? "Letter" : t === "photo" ? "Photo" : "Person"}
            </Button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={type === "letter" ? "FH number or title" : type === "photo" ? "PH number or title" : "Name"} />
        <div className="flex gap-2">
          <select aria-label="Certainty" value={certainty} onChange={(e) => setCertainty(e.target.value as Certainty)}
            className="rounded-md border border-input bg-background px-2 text-sm">
            {Object.entries(CERTAINTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        </div>
        {hits.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-md border">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => run(async () => { await addPhotoLink(photoId, h, certainty, note); setQ(""); setNote(""); }, "Connected")}>
                  <Plus className="size-3.5 shrink-0" />
                  {h.code && <span className="font-mono text-xs">{h.code}</span>}
                  <span className="truncate">{h.code !== h.label && h.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


