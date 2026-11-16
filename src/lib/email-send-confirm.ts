/**
 * The composer's final step before an email leaves the archive.
 *
 * Sending used to happen on the first click of the send button, so one stray
 * click could mail a whole distribution list. This module decides, in one place,
 * whether that click needs a confirmation step and what the confirmation shows,
 * so the dialog can never claim a different action than the one about to run.
 */

export type SendConfirmRecipient = { email: string; name?: string | null };

export type SendConfirmInput = {
  recipients: SendConfirmRecipient[];
  subject: string;
  /** "Send later" is ticked. */
  later: boolean;
  /** Local datetime string from the datetime-local input. */
  sendAt: string;
  includeImages: boolean;
  includeEnvelope: boolean;
  includeTranscription: boolean;
  /** Whether any record being sent is a letter (envelopes only exist for letters). */
  hasLetter: boolean;
  /** Blog mode publishes a recap post instead of mailing anyone. */
  blogMode: boolean;
};

export type SendConfirmSummary = {
  title: string;
  /** Label for the button that actually performs the action. */
  actionLabel: string;
  recipientCount: number;
  /** Recipient addresses, in the order they will be mailed. */
  recipientEmails: string[];
  subject: string;
  /** Human-readable "when" line: immediately, or the scheduled date and time. */
  when: string;
  /** What will travel with the email (scans, envelope, transcription). */
  contents: string[];
};

export function describeSendConfirm(input: SendConfirmInput): SendConfirmSummary | null {
  // Blog mode writes a recap post; nobody is mailed, so there is nothing to confirm.
  if (input.blogMode) return null;

  const scheduled = input.later && Boolean(input.sendAt);
  const contents: string[] = [];
  if (input.includeImages) contents.push("scan images");
  if (input.includeEnvelope && input.hasLetter) contents.push("the envelope scan");
  if (input.includeTranscription) contents.push("the transcription");

  return {
    title: scheduled ? "Schedule this email?" : "Send this email now?",
    actionLabel: scheduled ? "Schedule email" : "Send now",
    recipientCount: input.recipients.length,
    recipientEmails: input.recipients.map((r) => r.email),
    subject: input.subject.trim() || "(no subject)",
    when: scheduled ? new Date(input.sendAt).toLocaleString() : "Immediately",
    contents,
  };
}
