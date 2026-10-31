import { describe, expect, it } from "vitest";
import { emailComposerRecoveryKey } from "./email-composer-recovery";

const base = { recordKey: "", pathname: "/emails", seed: "" };
describe("email composer recovery isolation", () => {
  it("never restores an unrelated blank composer into a saved draft", () => {
    const key = emailComposerRecoveryKey({ ...base, scope: "email-admin-new" });
    expect(emailComposerRecoveryKey({ ...base, draftId: "draft-a" })).not.toBe(key);
    expect(emailComposerRecoveryKey({ ...base, draftId: "draft-a" })).not.toBe(emailComposerRecoveryKey({ ...base, draftId: "draft-b" }));
  });
  it("keeps blank Email Admin and Weekly Recap emails separate and reload-stable", () => {
    const admin = emailComposerRecoveryKey({ ...base, scope: "email-admin-new" });
    const recap = emailComposerRecoveryKey({ ...base, scope: "weekly-recap-new" });
    expect(admin).not.toBe(recap);
    expect(emailComposerRecoveryKey({ ...base, scope: "email-admin-new" })).toBe(admin);
    const storage = new Map([[admin, "unfinished email"], [recap, "other email"]]);
    storage.delete(recap);
    expect(storage.get(admin)).toBe("unfinished email");
  });
  it("isolates record-less resends by original email", () => {
    expect(emailComposerRecoveryKey({ ...base, scope: "resend:a" })).not.toBe(emailComposerRecoveryKey({ ...base, scope: "resend:b" }));
  });
  it("isolates other unlinked contexts and retains existing record recovery", () => {
    expect(emailComposerRecoveryKey({ ...base, seed: "answer a" })).not.toBe(emailComposerRecoveryKey({ ...base, seed: "answer b" }));
    expect(emailComposerRecoveryKey({ ...base, recordKey: "FH0001" })).toBe("fh-email-composer:FH0001");
  });
});