# Guest account request flow

## Goal
Make the "Request New Account" path create a pending guest account. New users can sign in, but they cannot view or edit archive data until an admin approves them.

## Current state
- `profiles` and `user_roles` tables already exist with `pending`/`approved` status and `admin`/`guest` roles.
- RLS already restricts archive reads to admins or approved guests, and writes to admins.
- The sign-up flow in `src/routes/auth.tsx` currently creates only a Supabase auth user; it does not insert a profile or role, so a new user has no archive access.
- There is no authenticated route layout and no admin UI to approve guests.

## Plan

1. Gate workspace routes
   - Create `src/routes/_authenticated/route.tsx` with `ssr: false` and a `beforeLoad` check that redirects to `/auth` when there is no session.
   - Move protected workspace routes under `src/routes/_authenticated/` so they keep their current URLs but are behind the gate. Public routes (`/auth`, `/forgot-password`, `/reset-password`, public share links, API) stay at the top level.
   - Replace `src/routes/index.tsx` with `src/routes/_authenticated/index.tsx` so the dashboard is the signed-in home.

2. Auto-create pending guest on first sign-in
   - Add a `createPendingGuestProfile` server function (authenticated, SECURITY DEFINER) that inserts a `profiles` row with `status = 'pending'` and a `user_roles` row with `role = 'guest'` for `auth.uid()`, but only if neither exists.
   - Update `src/hooks/useAuth.tsx` so that on `SIGNED_IN` it calls this function once. This covers both email/password and Google OAuth sign-ups.

3. Enforce approval before archive access
   - Extend the auth context to expose `isAdmin`, `isApprovedGuest`, and `isPendingGuest`.
   - In the authenticated layout component, after confirming a session exists, render a "Request pending" screen for pending guests with a sign-out option. Approved guests and admins see the normal `<Outlet />`.

4. Admin approval UI
   - Create `src/routes/_authenticated/admin/users.tsx` (URL `/admin/users`) listing all users from `profiles` joined with `user_roles`.
   - Admins can approve a pending guest (set `status = 'approved'`, `approved_at = now()`), revoke approval, or delete a guest's profile/role rows.
   - Show the admin link in the navigation only when the current user is an admin.

5. Sign-up messaging
   - Update `src/routes/auth.tsx` so after email sign-up it shows: "Check your email to confirm. Once confirmed, your account will be pending admin approval."
   - Keep the "Request New Account" / "I already have an account" toggle.

6. Security
   - No new tables are required.
   - The pending-profile creation runs through a server function so `user_roles` does not need a broad INSERT policy for authenticated users.
   - Existing RLS policies continue to enforce the admin/approved-guest split on archive data.
