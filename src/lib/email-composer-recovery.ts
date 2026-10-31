/** Stable slots survive reloads without mixing saved drafts or composer entry points. */
export function emailComposerRecoveryKey(input: {
  draftId?: string;
  scope?: string;
  recordKey: string;
  pathname: string;
  seed: string;
}) {
  if (input.draftId) return `fh-email-composer:draft:${input.draftId}`;
  if (input.scope) return `fh-email-composer:compose:${input.scope}`;
  if (input.recordKey) return `fh-email-composer:${input.recordKey}`;
  return `fh-email-composer:context:${JSON.stringify([input.pathname, input.seed])}`;
}