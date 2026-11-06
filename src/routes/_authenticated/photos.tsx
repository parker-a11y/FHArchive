import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { fetchPhotos, viewPath, type Photo } from "@/lib/photos";
import { fetchBoxes, fetchCategories, fetchCategoryLinks, linksByPhoto } from "@/lib/photo-catalog";
import { matchesCategories } from "@/lib/photo-archive";
import { SignedImg } from "@/components/photos/SignedImg";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";

type GallerySearch = { q?: string; cats?: string; all?: boolean; photo?: string; sort?: "curated" | "ph" | "date" };

export const galleryOptions = queryOptions({
  queryKey: ["photo-gallery"],
  queryFn: async () => {
    const [photos, categories, links, boxes] = await Promise.all([fetchPhotos(), fetchCategories(), fetchCategoryLinks(), fetchBoxes()]);
    return { photos, categories, links, boxes };
  },
});

export const Route = createFileRoute("/_authenticated/photos")({
  validateSearch: (s: Record<string, unknown>): GallerySearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    cats: typeof s.cats === "string" && s.cats ? s.cats : undefined,
    all: s.all === true || s.all === "true" ? true : undefined,
    photo: typeof s.photo === "string" && s.photo ? s.photo : undefined,
    sort: s.sort === "ph" || s.sort === "date" ? s.sort : undefined,
  }),
  head: () => ({ meta: [
    { title: "The Photo Archive — The Francis Files" },
    { name: "description", content: "A visual history of the Harrington and Harley families, preserved across generations." },
    { property: "og:title", content: "The Photo Archive — The Francis Files" },
    { property: "og:description", content: "Browse the Harrington and Harley family photographs by category, person, place and date." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryOptions),
  pendingComponent: () => <AppShell><p className="p-10 font-display text-xl text-muted-foreground">Opening the Photo Archive…</p></AppShell>,
  errorComponent: ({ reset }) => <AppShell><div className="space-y-3 p-10"><p>The Photo Archive could not be loaded.</p><Button variant="outline" onClick={reset}>Try again</Button></div></AppShell>,
  component: () => <AppShell><Gallery /></AppShell>,
});

const PAGE = 90;

function haystack(p: Photo, cats: string[]) {
  return [p.ph_id, p.legacy_archive_id, p.caption, p.people, p.date_text, p.location, p.inscription, p.notes, p.back_transcription, p.info_source, ...cats]
    .filter(Boolean).join(" ").toLowerCase();
}

function Gallery() {
  const { data } = useSuspenseQuery(galleryOptions);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/photos" });
  const { isAdmin, canEdit } = useAuth();
  const [qDraft, setQDraft] = useState(search.q ?? "");
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const catName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);
  const byPhoto = useMemo(() => linksByPhoto(data.links), [data.links]);
  const boxById = useMemo(() => new Map(data.boxes.map((b) => [b.id, b])), [data.boxes]);
  const chosen = useMemo(() => (search.cats ? search.cats.split(",").filter((id) => catName.has(id)) : []), [search.cats, catName]);
  const mode = search.all ? "all" : "any";

  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== qDraft.trim()) navigate({ search: (s) => ({ ...s, q: qDraft.trim() || undefined }), replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [qDraft, search.q, navigate]);

  const shown = useMemo(() => {
    const needle = (search.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    let list = data.photos.filter((p) => {
      const ids = byPhoto.get(p.id) ?? [];
      if (!matchesCategories(ids, chosen, mode)) return false;
      if (!needle.length) return true;
      const h = haystack(p, ids.map((id) => catName.get(id) ?? ""));
      return needle.every((w) => h.includes(w));
    });
    if (search.sort === "ph") list = [...list].sort((a, b) => (a.ph_seq ?? 1e9) - (b.ph_seq ?? 1e9));
    if (search.sort === "date") list = [...list].sort((a, b) => (a.date_year_start ?? 9999) - (b.date_year_start ?? 9999) || (a.ph_seq ?? 0) - (b.ph_seq ?? 0));
    return list;
  }, [data.photos, byPhoto, chosen, mode, search.q, search.sort, catName]);

  useEffect(() => setLimit(PAGE), [search.q, search.cats, search.all, search.sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setLimit((l) => l + PAGE); }, { rootMargin: "1200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length]);

  const openIndex = search.photo ? shown.findIndex((p) => p.ph_id === search.photo || p.id === search.photo || p.legacy_archive_id === search.photo) : -1;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of data.links) m.set(l.category_id, (m.get(l.category_id) ?? 0) + 1);
    return m;
  }, [data.links]);

  const toggleCat = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    navigate({ search: (s) => ({ ...s, cats: next.join(",") || undefined }), replace: true });
  };
  const reset = () => { setQDraft(""); navigate({ search: (s) => ({ sort: s.sort }), replace: true }); };
  const filtered = chosen.length > 0 || !!search.q;

  return (
    <div className="min-h-full bg-gallery-ivory text-gallery-ink">
      <header className="mx-auto max-w-6xl px-5 pb-8 pt-12 text-center sm:pt-16">
        <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">The Francis Files</p>
        <h1 className="mt-3 font-display text-4xl font-light tracking-tight sm:text-6xl">The Photo Archive</h1>
        <p className="mx-auto mt-4 max-w-xl font-display text-lg italic text-muted-foreground sm:text-xl">
          A visual history of the Harrington and Harley families, preserved across generations.
        </p>
        <div className="mx-auto mt-6 h-px w-16 bg-gallery-rule" />
        {(isAdmin || canEdit) && (
          <div className="mt-6 flex justify-center gap-2">
            {isAdmin && <Button asChild size="sm" variant="outline"><Link to="/photo-organizer">Photo Organizer</Link></Button>}
            {isAdmin && <Button asChild size="sm" variant="ghost"><Link to="/photo-organizer" search={{ tab: "upload" }}>Upload photographs</Link></Button>}
          </div>
        )}
      </header>

      <div className="sticky top-0 z-20 border-y border-gallery-rule bg-gallery-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search photographs" value={qDraft} onChange={(e) => setQDraft(e.target.value)}
                placeholder="Search people, places, dates, inscriptions, PH or FH numbers…"
                className="rounded-full border-gallery-rule bg-background/70 pl-9" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              <select aria-label="Sort photographs" value={search.sort ?? "curated"} onChange={(e) => navigate({ search: (s) => ({ ...s, sort: e.target.value === "curated" ? undefined : (e.target.value as "ph" | "date") }), replace: true })}
                className="rounded-full border border-gallery-rule bg-background/70 px-3 py-1.5 text-xs text-foreground">
                <option value="curated">Curated order</option>
                <option value="date">By date</option>
                <option value="ph">By PH number</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground">{shown.length} of {data.photos.length} photographs</span>
            {filtered && <Button size="sm" variant="ghost" onClick={reset}><X className="mr-1 size-3.5" />Reset</Button>}
          </div>
          {data.categories.length > 0 && (
            <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
              {data.categories.map((c) => {
                const on = chosen.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCat(c.id)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${on ? "border-gallery-ink bg-gallery-ink text-gallery-ivory" : "border-gallery-rule text-gallery-ink hover:border-gallery-ink/50"}`}>
                    {c.name} <span className="opacity-50">{counts.get(c.id) ?? 0}</span>
                  </button>
                );
              })}
              {chosen.length > 1 && (
                <button type="button" onClick={() => navigate({ search: (s) => ({ ...s, all: s.all ? undefined : true }), replace: true })}
                  className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                  {mode === "all" ? "Matching all · switch to any" : "Matching any · switch to all"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {shown.length === 0 ? (
          <p className="py-24 text-center font-display text-xl italic text-muted-foreground">{data.photos.length ? "No photographs match these filters." : "No photographs yet."}</p>
        ) : (
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 2xl:columns-5 [column-fill:_balance]">
            {shown.slice(0, limit).map((p) => (
              <figure key={p.id} className="mb-4 break-inside-avoid">
                <Link to="/photos" search={(s: GallerySearch) => ({ ...s, photo: p.ph_id ?? p.id })} replace={false} resetScroll={false}
                  className="group relative block overflow-hidden rounded-sm border border-gallery-rule bg-background shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <SignedImg path={p.front_thumb_path ?? viewPath(p.front_path, null, p.front_view_path)} alt={p.caption || p.ph_id || "Photograph"}
                    className="block h-auto w-full transition duration-500 group-hover:scale-[1.015]" />
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-gallery-stage/80 to-transparent px-3 pb-2.5 pt-8 text-gallery-stage-foreground opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="block font-mono text-[10px] tracking-widest opacity-80">{p.ph_id}</span>
                    {p.caption && <span className="block font-display text-base leading-tight">{p.caption}</span>}
                  </figcaption>
                </Link>
              </figure>
            ))}
          </div>
        )}
        {limit < shown.length && <div ref={sentinel} className="h-10" />}
      </main>

      {openIndex >= 0 && (
        <PhotoLightbox
          photos={shown}
          index={openIndex}
          canDownloadOriginal={!!canEdit}
          categoryNames={(p) => (byPhoto.get(p.id) ?? []).map((id) => catName.get(id) ?? "").filter(Boolean)}
          boxLabel={(p) => { const b = p.box_id ? boxById.get(p.box_id) : null; return b ? [b.code, b.name].filter(Boolean).join(" — ") : null; }}
          onIndex={(i) => navigate({ search: (s) => ({ ...s, photo: shown[i].ph_id ?? shown[i].id }), replace: true, resetScroll: false })}
          onClose={() => navigate({ search: (s) => ({ ...s, photo: undefined }), resetScroll: false })}
        />
      )}
    </div>
  );
}
