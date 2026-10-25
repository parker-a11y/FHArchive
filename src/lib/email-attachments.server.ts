import { validateEmailAttachments, type EmailAttachment } from "./email-attachments";

export async function resolveEmailAttachments(db: any, userId: string, files?: EmailAttachment[]) {
  return Promise.all(validateEmailAttachments(files, userId).map(async (file) => {
    const { data, error } = await db.storage.from("ds-files").createSignedUrl(file.storagePath, 60 * 60 * 24 * 30, { download: file.filename });
    if (error || !data?.signedUrl) throw new Error(`Could not open attachment: ${file.filename}`);
    return { filename: file.filename, url: data.signedUrl };
  }));
}