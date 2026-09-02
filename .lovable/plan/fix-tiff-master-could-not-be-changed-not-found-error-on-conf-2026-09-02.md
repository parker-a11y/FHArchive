# Fix TIFF "master could not be changed / not found" error on Confirm Upload Complete

## Problem
On record FH0021, clicking **Confirm Upload Complete** for large TIFF masters produces an error the user paraphrases as "master could not be changed / master not found." The record has three TIFF masters (two ~89 MB, one ~37 MB) and no derivatives yet. The exact toast text is not hardcoded in the app, but the closest code message is `Master could not be renamed: ${error.message}` in `src/lib/scan-rename.ts`. The `confirmUploadComplete` flow currently swallows rename errors silently, and the browser-side TIFF decode/derivative generation for very large files can hit memory or canvas limits without a clear message.

## Plan

1. **Improve error visibility in the confirm flow**
   - Stop silently catching rename errors in `DigitizationPanel.confirmUploadComplete`.
   - Surface the actual Supabase/storage error so the user sees what failed and why.
   - If renaming fails, halt derivative generation for that file instead of continuing with a stale path.

2. **Harden `renameScanFile` and derivative generation**
   - Verify the source object exists with a lightweight storage call before attempting `move`.
   - Wrap the derivative-generation loop with clearer per-file progress and error toasts.
   - Preserve the existing invariant: archival masters are never altered.

3. **Add large-TIFF safeguards**
   - Estimate decoded pixel memory before decoding and warn when a TIFF is likely to exceed safe browser canvas limits.
   - Provide a fallback message suggesting the user contact support or downsample very large scans if decoding fails.

4. **Test and verify**
   - Reproduce the Confirm Upload Complete action on FH0021.
   - Confirm derivatives are generated and the error toast no longer appears.
   - Ensure smaller TIFFs and non-TIFF images still process normally.

## Outcome
The user will get a clear, actionable error message if a step fails, and the most common causes (silent rename failure or oversized TIFF decode) will be fixed or explained.
