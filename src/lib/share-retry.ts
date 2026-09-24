/**
 * Shared-link loaders: a freshly minted link can be read a split second
 * before the new token is visible. Retry a few times before giving up so
 * the viewer never sees "no longer available" on a brand-new link.
 */
export async function retryUntilFound<T>(
  fn: () => Promise<T | null>,
  attempts = 4,
  delayMs = 700,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {
      // treat transient errors like a miss and try again
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  return null;
}

export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};
