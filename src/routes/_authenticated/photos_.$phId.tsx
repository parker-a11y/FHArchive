import { createFileRoute, redirect } from "@tanstack/react-router";

/** Stable, shareable photo link: /photos/PH00234 (or a former FH number) opens it in the Photo Archive. */
export const Route = createFileRoute("/_authenticated/photos_/$phId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/photos", search: { photo: params.phId.toUpperCase() }, replace: true });
  },
});
