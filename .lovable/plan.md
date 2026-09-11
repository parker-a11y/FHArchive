# Fix Mac shortcuts: Ctrl+Option instead of Cmd+Option

The ⌘⌥N / ⌘⌥R shortcuts are reserved by Chrome (new window), so the page never receives them. Switch the Mac combo to **Ctrl+Option**, which no browser claims.

## Changes — `src/components/AppShell.tsx` only

1. **Mac shortcut detection**: change `e.metaKey && e.altKey` to `e.ctrlKey && e.altKey` for the Mac branch. Non-Mac branch (Alt+N / Alt+R) stays as-is.
2. **Shortcut badges in sidebar**: update the Mac labels from `⌘⌥N` / `⌘⌥R` to `⌃⌥N` / `⌃⌥R`.

No other behavior changes: shortcuts still ignore keystrokes inside text fields, Quick Entry requires edit permission, and both shortcuts navigate to `/catalog` and `/letters` respectively.

## Verify

Typecheck + preview build pass.
