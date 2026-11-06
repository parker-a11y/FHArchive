import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Signed URLs for private photo files, requested in batches (one call for many
 * thumbnails) and cached for the session so large galleries stay quick.
 */
const cache = new Map<string, { url: string; at: number }>();
const waiting = new Map<string, ((u: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
const TTL = 50 * 60 * 1000;

async function flush() {
  timer = null;
  const paths = [...waiting.keys()];
  const cbs = new Map(waiting);
  waiting.clear();
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data } = await supabase.storage.from("scans").createSignedUrls(chunk, 3600);
    for (const p of chunk) {
      const url = data?.find((d) => d.path === p)?.signedUrl ?? null;
      if (url) cache.set(p, { url, at: Date.now() });
      cbs.get(p)?.forEach((cb) => cb(url));
    }
  }
}

export function signPhotoPath(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    const list = waiting.get(path) ?? [];
    list.push(resolve);
    waiting.set(path, list);
    if (!timer) timer = setTimeout(flush, 30);
  });
}

export function useSignedPath(path: string | null) {
  const [url, setUrl] = useState<string | null>(() => (path ? cache.get(path)?.url ?? null : null));
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    signPhotoPath(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function SignedImg({ path, alt, className, eager }: { path: string | null; alt: string; className?: string; eager?: boolean }) {
  const url = useSignedPath(path);
  if (!url) return <div className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ""}`} style={{ minHeight: 120 }}>{path ? "" : "No preview"}</div>;
  return <img src={url} alt={alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />;
}
