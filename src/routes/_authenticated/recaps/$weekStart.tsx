import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { fetchContacts } from "@/lib/archive-email";
import { fetchRecapShares, setRecapShareEnabled } from "@/lib/recaps";
import {
  emailWeeklyRecapFn,
  generateWeeklyRecap,
  refineWeeklyRecapFn,
} from "@/lib/recaps.functions";

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
  const [addOpen, setAddOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const refineFn = useServerFn(refineWeeklyRecapFn);

  // Recaps are never emailed automatically — an admin sends them after review.
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipients, setRecipients] = useState<{ email: string; name?: string | null }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [note, setNote] = useState("");
  const [publicLinks, setPublicLinks] = useState(true);
  const [includeTranscription, setIncludeTranscription] = useState(false);
  const emailFn = useServerFn(emailWeeklyRecapFn);
  const { data: contacts = [] } = useQuery({
    queryKey: ["archive-contacts"],
    queryFn: fetchContacts,
    enabled: emailOpen,
  });

  const addRecipient = (email: string, name?: string | null) => {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setRecipients((list) =>
      list.some((r) => r.email === value) ? list : [...list, { email: value, name: name ?? null }],
    );
    setNewEmail("");
  };

  const sendEmail = useMutation({
    mutationFn: async () =>
      emailFn({
        data: { weekStart, recipients, message: note, publicLinks, includeTranscription },
      }),
    onSuccess: (result) => {
      if (result.sent.length)
        toast.success(`Recap sent to ${result.sent.length} recipient${result.sent.length === 1 ? "" : "s"}.`);
      if (result.suppressed.length)
        toast.warning(`Skipped (unsubscribed or bounced): ${result.suppressed.join(", ")}`);
      if (result.failed.length)
        toast.error(result.failed.map((f) => `${f.email}: ${f.error}`).join(" · "));
      if (result.sent.length) {
        setEmailOpen(false);
        setRecipients([]);
        setNote("");
        qc.invalidateQueries({ queryKey: ["recap-shares", weekStart] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: shares = [] } = useQuery({
    queryKey: ["recap-shares", weekStart],
    queryFn: () => fetchRecapShares(recap?.related_ids ?? []),
    enabled: isAdmin && Boolean(recap?.related_ids?.length),
  });

  const revoke = useMutation({
    mutationFn: (input: { kind: "letter" | "source"; id: string }) =>
      setRecapShareEnabled(input.kind, input.id, false),
    onSuccess: () => {
      toast.success("Public link turned off.");
      qc.invalidateQueries({ queryKey: ["recap-shares", weekStart] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const refine = useMutation({
    mutationFn: async () => refineFn({ data: { weekStart, instructions } }),
    onSuccess: async () => {
      await invalidate();
      setAddOpen(false);
      setInstructions("");
      toast.success("Recap updated with your notes.");
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
                  <Button variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
                    <Sparkles className="size-4 text-archive-gold" /> Add with AI
                  </Button>
                  <Button className="gap-2" onClick={() => setEmailOpen(true)}>
                    <Mail className="size-4" /> Email recap
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

        {isAdmin && shares.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="field-label mb-2">Public links from this recap</p>
            <ul className="divide-y divide-border text-sm">
              {shares.map((s) => (
                <li key={`${s.kind}-${s.id}`} className="flex items-center gap-3 py-2">
                  <span className="archive-id text-archive-gold">{s.ref}</span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-muted-foreground hover:underline"
                  >
                    {s.url}
                  </a>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {s.viewCount} view{s.viewCount === 1 ? "" : "s"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate({ kind: s.kind, id: s.id })}
                  >
                    Turn off
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Turning a link off immediately breaks it for anyone who received it.
            </p>
          </section>
        )}
      </div>

      <Dialog open={emailOpen} onOpenChange={(o) => !sendEmail.isPending && setEmailOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email this recap</DialogTitle>
            <DialogDescription>
              Recaps are never sent automatically — this goes out only when you send it, with the
              Francis Files Weekly Recap header.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="field-label mb-1.5">Recipients</p>
              <div className="flex gap-2">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient(newEmail);
                    }
                  }}
                  placeholder="name@example.com"
                  type="email"
                />
                <Button variant="outline" className="gap-1.5" onClick={() => addRecipient(newEmail)}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>

              {recipients.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {recipients.map((r) => (
                    <li key={r.email} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <span className="truncate">{r.name ? `${r.name} — ${r.email}` : r.email}</span>
                      <button
                        type="button"
                        className="ml-auto text-muted-foreground hover:text-tone-rose"
                        onClick={() =>
                          setRecipients((list) => list.filter((x) => x.email !== r.email))
                        }
                        aria-label={`Remove ${r.email}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {contacts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contacts
                    .filter((c) => !recipients.some((r) => r.email === c.email))
                    .slice(0, 12)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => addRecipient(c.email, c.name)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-archive-gold/50 hover:text-foreground"
                      >
                        {c.name || c.email}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              <p className="field-label mb-1.5">Personal note (optional)</p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="A short line at the top of the email."
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={publicLinks}
                  onCheckedChange={(v) => setPublicLinks(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Let recipients open linked records without signing in
                  <span className="block text-xs text-muted-foreground">
                    Creates unlisted, revocable links for the FH and DS records in this recap.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={includeTranscription}
                  disabled={!publicLinks}
                  onCheckedChange={(v) => setIncludeTranscription(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Include transcriptions in shared records
                  <span className="block text-xs text-muted-foreground">
                    Off by default — shared pages show catalog details and scans only.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sendEmail.isPending}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={() => sendEmail.mutate()}
              disabled={sendEmail.isPending || recipients.length === 0}
            >
              {sendEmail.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Send recap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(o) => !refine.isPending && setAddOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to this recap</DialogTitle>
            <DialogDescription>
              Tell the AI what to work in — it revises the existing recap rather than rewriting the
              week. For example: “Please mention the Christmas party” or “Don’t forget the quote in
              FH0087.”
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder="Also mention the Christmas party described in FH0092, and keep the closing paragraph as it is."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={refine.isPending}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={() => refine.mutate()}
              disabled={refine.isPending || instructions.trim().length < 3}
            >
              {refine.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Add to recap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
