import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new version is published, an open tab may ask for page files that no
// longer exist. Reload once to pick up the new version instead of blanking.
if (typeof window !== "undefined") {
  const reloadOnce = () => {
    const key = "stale-chunk-reload";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e.reason as Error | undefined)?.message ?? e.reason ?? "");
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) {
      e.preventDefault();
      reloadOnce();
    }
  });
}

export const getRouter = () => {
  // Reference data (categories, tones, people, containers) changes rarely.
  // A shared stale window stops every form open from refetching it.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
