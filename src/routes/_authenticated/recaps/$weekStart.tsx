import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, PenLine, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecapBody } from "@/components/RecapBody";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchRecap,
  formatWeekRange,
  saveRecapEdits,
  setRecapStatus,
  signRecapImage,
} from "@/lib/recaps";
import { generateWeeklyRecap, refineWeeklyRecapFn } from "@/lib/recaps.functions";

export const Route = createFileRoute("/_authenticated/recaps/$weekStart")({
  head: ({ params }) => ({
    meta: [
      { title: `Weekly Recap — ${params.weekStart} — The Francis Files` },
      {
        name: "description",
        content: "A one-page narrative of what the Francis Files archive uncovered during this week.",
      },
      { property: "og:title", content: "Weekly Recap — The Francis Files" },
      {
        property: "og:description",
        content: "What the archive uncovered this week, with linked FH and digital source records.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <RecapPage />
    </AppShell>
  ),
});

function RecapPage() {
  const { weekStart } = Route.useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(generateWeeklyRecap);

  const { data: recap, isLoading } = useQuery({
    queryKey: ["weekly-recap", weekStart],
    queryFn: () => fetchRecap(weekStart),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", lede: "", body_md: "" });
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (recap) setDraft({ title: recap.title, lede: recap.lede ?? "", body_md: recap.body_md });
  }, [recap]);

  useEffect(() => {
    let alive = true;
    if (recap) signRecapImage(recap).then((url) => alive && setImageUrl(url));
    return () => {
      alive = false;
    };
  }, [recap]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["weekly-recap", weekStart] }),
      qc.invalidateQueries({ queryKey: ["weekly-recaps"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: async () => saveRecapEdits(recap!.id, draft),
    onSuccess: async () => {
      await invalidate();
      setEditing(false);
      toast.success("Recap saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publish = useMutation({
    mutationFn: async (status: "published" | "draft") => setRecapStatus(recap!.id, status),
    onSuccess: async () => {
      await invalidate();
      toast.success("Visibility updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => generate({ data: { weekStart } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Recap regenerated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading)
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  if (!recap)
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">This recap is not available.</p>
        <Link to="/recaps" className="mt-3 inline-block text-sm text-archive-gold hover:underline">
          Back to Weekly Recaps
        </Link>
      </div>
    );

  return (
    <>
      <PageHeader
        title="Francis Files — Weekly Recap"
        description={`Week of ${formatWeekRange(recap.week_start, recap.week_end)}`}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button className="gap-2" onClick={() => save.mutate()} disabled={save.isPending}>
                    <Save className="size-4" /> Save
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setEditing(false)}>
                    <X className="size-4" /> Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="gap-2" onClick={() => setEditing(true)}>
                    <PenLine className="size-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => publish.mutate(recap.status === "published" ? "draft" : "published")}
                    disabled={publish.isPending}
                  >
                    {recap.status === "published" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {recap.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => (recap.manually_edited ? setConfirmRegen(true) : regenerate.mutate())}
                    disabled={regenerate.isPending}
                  >
                    {regenerate.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Regenerate
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <Link
          to="/recaps"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All recaps
        </Link>

        {recap.status !== "published" && (
          <p className="mb-4 rounded-lg bg-tone-ochre-soft px-3 py-2 text-xs text-tone-ochre">
            Draft — only administrators can see this recap until it is published.
          </p>
        )}

        {editing ? (
          <div className="space-y-4">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Headline"
            />
            <Textarea
              value={draft.lede}
              onChange={(e) => setDraft((d) => ({ ...d, lede: e.target.value }))}
              placeholder="One-sentence preview"
              rows={2}
            />
            <Textarea
              value={draft.body_md}
              onChange={(e) => setDraft((d) => ({ ...d, body_md: e.target.value }))}
              rows={28}
              className="font-mono text-xs"
            />
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="field-label mb-3">Preview</p>
              <RecapBody text={draft.body_md} />
            </div>
          </div>
        ) : (
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{recap.title}</h1>
            {recap.lede && <p className="mt-2 text-muted-foreground">{recap.lede}</p>}

            {imageUrl && (
              <figure className="my-6">
                {recap.image_archive_id ? (
                  <Link to="/letters/$archiveId" params={{ archiveId: recap.image_archive_id }}>
                    <img
                      src={imageUrl}
                      alt={recap.image_caption ?? `Scan from ${recap.image_archive_id}`}
                      loading="lazy"
                      className="w-full rounded-xl border border-border object-contain"
                    />
                  </Link>
                ) : (
                  <img
                    src={imageUrl}
                    alt={recap.image_caption ?? "Archive scan"}
                    loading="lazy"
                    className="w-full rounded-xl border border-border object-contain"
                  />
                )}
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  {recap.image_caption}
                  {recap.image_archive_id ? ` — ${recap.image_archive_id}` : ""}
                </figcaption>
              </figure>
            )}

            <div className="mt-6">
              <RecapBody text={recap.body_md} />
            </div>

            {recap.related_ids.length > 0 && (
              <div className="mt-8 border-t border-border pt-4">
                <p className="field-label mb-2">Related records</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {recap.related_ids.map((id, i) => (
                    <span key={id} className="flex items-center gap-2">
                      {i > 0 && <span className="text-muted-foreground">·</span>}
                      {id.startsWith("DS") ? (
                        <Link
                          to="/sources/$dsId"
                          params={{ dsId: id }}
                          className="archive-id text-archive-gold hover:underline"
                        >
                          {id}
                        </Link>
                      ) : (
                        <Link
                          to="/letters/$archiveId"
                          params={{ archiveId: id }}
                          className="archive-id text-archive-gold hover:underline"
                        >
                          {id}
                        </Link>
                      )}
                    </span>
                  ))}
                </p>
              </div>
            )}
          </article>
        )}
      </div>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the edited recap?</AlertDialogTitle>
            <AlertDialogDescription>
              This recap has been edited by hand. Regenerating will overwrite the edited text with a
              newly written version. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my version</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenerate.mutate()}>Regenerate anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
