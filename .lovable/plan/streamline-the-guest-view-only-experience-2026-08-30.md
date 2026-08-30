# Streamline the guest (view-only) experience

## Goal
Approved guests currently see the full admin interface: nav items like Quick Entry, Sent Email, Backups, Categories, Work Queues, plus edit/delete/upload/transcribe buttons everywhere. Since guests are view-only, those clicks fail (RLS denial, "Forbidden" errors, or the 404 the user hit). Guests should only ever see things that work for them.

## Plan

1. Single guest flag
   - `useAuth` already exposes `isAdmin` / `isApprovedGuest`. Derive and expose `isGuestViewer = isApprovedGuest && !isAdmin` so every page can gate on one clear flag.

2. Trim the sidebar for guests (`src/components/AppShell.tsx`)
   - Guest nav shows only read-only destinations: Dashboard, All Records, Digital Sources, Source Containers, Timeline, Search, People, Organizations, Events, Places, Keywords.
   - Hidden from guests: Quick Entry, Work Queues, Categories, Sent Email, Backups (and Users, already admin-only).

3. Guard write/admin routes against deep links
   - `/catalog` (Quick Entry), `/categories`, `/emails`, `/backups`, `/admin/users`: add a guest check that redirects to `/` instead of rendering a broken or erroring page. No more 404/dead-end — even if a guest has an old link, they land safely on the dashboard.

4. Hide write controls on shared pages when `isGuestViewer`
   - Dashboard: hide the "ADD NEXT ARCHIVE ITEM" button (keep the logo centered); tiles stay since they only link to filtered read views.
   - Record detail (`letters/$archiveId`): hide Edit, Delete, upload scans, rename, Transcribe, Human verify, and AI-suggestion apply buttons; scans/transcriptions remain readable.
   - Digital source detail/new: hide "Add Digital Source", upload, edit, delete.
   - People/Organizations/Places/Keywords: hide Add, Merge, Delete buttons (lists and detail stay clickable/sortable).
   - Keep: All Records table sorting/filtering/pagination, keyword highlighting, star toggle only if RLS permits guests (otherwise hide it too — verified during implementation).

5. Notes from the Archive
   - Guests keep read access to the notes ledger; the note composer stays admin-only (existing `ArchiveNotes` behavior, verified).

## What stays the same
- Pending guests still see the "Account request pending" screen (no change).
- Admin experience is unchanged.
- No database/schema changes; this is presentation and route-gating only.

## Verification
- Typecheck + build pass.
- Playwright: sign in as an approved guest, confirm sidebar shows only read-only items, dashboard has no add button, record pages show no edit/upload controls, direct visit to `/catalog` and `/backups` redirects to `/` with no errors.
