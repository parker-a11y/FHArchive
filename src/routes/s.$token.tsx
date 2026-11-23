import { retryUntilFound, NO_STORE_HEADERS } from "@/lib/share-retry";
import { createFileRoute } from "@tanstack/react-router";
import { getSharedRecord } from "@/lib/shares.functions";
import { SharedRecordView } from "@/components/share/SharedRecordView";

export const Route = createFileRoute("/s/$token")({
  loader: ({ params }) =>
    retryUntilFound(() => getSharedRecord({ data: { token: params.token } })),
  headers: () => NO_STORE_HEADERS,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.archiveId}${loaderData.title ? ` — ${loaderData.title}` : ""} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: loaderData
          ? `Shared archival record ${loaderData.archiveId} from The Francis Files.`
          : "This shared archive link is no longer available.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedRecordPage,
});

function SharedRecordPage() {
  return <SharedRecordView record={Route.useLoaderData()} />;
}
