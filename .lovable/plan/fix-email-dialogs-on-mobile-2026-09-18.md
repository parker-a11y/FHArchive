# Fix email dialogs on mobile

On a phone, the "Email from the archive" and "Email this recap" screens open taller than the visible screen: the top (including the close X) is cut off, the Send button at the bottom can't be reached, and the contents don't scroll — so with more than a couple of addresses you're stuck.

## What's wrong

- The "Email from the archive" dialog caps its height at `90vh`. On phones the browser's address bar eats into that, so the real visible area is smaller than the dialog — the top gets clipped and scrolling is unreliable.
- The "Email this recap" dialog has **no** height limit or scrolling at all, so once the recipient list grows, everything below the fold is unreachable.
- Both use the same shared dialog box, so one careful fix covers every dialog in the app.

## Changes

### 1. Shared dialog box (`src/components/ui/dialog.tsx`)
- On phones (below `sm:`), dialogs become a full-height sheet that fills the visible screen (`100dvh`, the mobile-correct height that accounts for the address bar), anchored to the top instead of floating centered — so nothing is clipped above or below.
- The dialog body scrolls internally when content is taller than the screen, so the header and close button stay put and you can swipe down through recipients to the Send button.
- Desktop (`sm:` and up) is unchanged: same centered, rounded dialog.

### 2. "Email from the archive" (`src/components/letter/EmailArchiveDialog.tsx`)
- Switch its height cap from `90vh` to the mobile-correct `100dvh` equivalent so its built-in scrolling works properly on phones.
- Tighten mobile padding slightly so more of the composer fits without scrolling.

### 3. "Email this recap" (`src/routes/_authenticated/recaps/$weekStart.tsx`)
- No height cap exists here — it inherits the fixed shared dialog, gaining the full-height sheet + internal scrolling automatically. Just verify the recipient list, note box, and Send button are all reachable on a 375px screen.

## Out of scope
- No changes to desktop appearance, email content, sending logic, or any other feature.

## Verification
- Typecheck + build.
- View both dialogs at 375px width with several recipients added: top (title + close X) visible, page scrolls, Send button reachable at the bottom.
- Spot-check one other dialog on mobile and both dialogs on desktop to confirm nothing regressed.
