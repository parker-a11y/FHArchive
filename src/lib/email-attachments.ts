export type EmailAttachment = { filename: string; storagePath: string; fileSize: number };

/** Restrict file references to this sender's email-upload namespace. */
export function validateEmailAttachments(value: EmailAttachment[] | undefined, userId: string): EmailAttachment[] {
  return (value ?? []).map((file) => {
    if (!file.storagePath.startsWith(`${userId}/email-attachments/`) || file.storagePath.includes("..") || !file.filename.trim()) {
      throw new Error("That attachment does not belong to this email sender.");
    }
    return { filename: file.filename.slice(0, 255), storagePath: file.storagePath, fileSize: file.fileSize };
  });
}