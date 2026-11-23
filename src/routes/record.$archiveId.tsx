import { createFileRoute } from "@tanstack/react-router";
import { getPublicRecord } from "@/lib/shares.functions";
import { SharedRecordView } from "@/components/share/SharedRecordView";
import { publicRecordUrl } from "@/lib/timeline-export";

export const Route = createFileRoute("/record/$archiveId")({
  loader: ({ params }) => getPublicRecord({ data: { archiveId: params.archiveId } }),
  head: ({ params, loaderData }) => {
    const title = loaderData
      ? `${loaderData.archiveId}${loaderData.title ? ` — ${loaderData.title}` : ""} — The Francis Files`
      : "Record unavailable — The Francis Files";
    const description = loaderData?.summary?.slice(0, 160) ?? `Archival record ${params.archiveId} from The Francis Files.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: publicRecordUrl(params.archiveId) },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  errorComponent: () => <p className="p-8 text-center">This record could not be loaded.</p>,
  notFoundComponent: () => <p className="p-8 text-center">Record not found.</p>,
  component: PublicRecordPage,
});

function PublicRecordPage() {
  return <SharedRecordView record={Route.useLoaderData()} footer="public record link" />;
}
