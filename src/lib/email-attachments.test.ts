import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEmailAttachments } from "./email-attachments";

test("email uploads cannot reference another sender's private files", () => {
  assert.throws(() => validateEmailAttachments([{ filename: "letter.pdf", storagePath: "someone-else/email-attachments/letter.pdf", fileSize: 42 }], "admin"));
});
test("email uploads preserve a sender's attachment without requiring an FH record", () => {
  const files = [{ filename: "letter.pdf", storagePath: "admin/email-attachments/letter.pdf", fileSize: 42 }];
  assert.deepEqual(validateEmailAttachments(files, "admin"), files);
});