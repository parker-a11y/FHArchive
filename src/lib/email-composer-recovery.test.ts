import assert from "node:assert/strict";
import { test } from "node:test";
import { emailComposerRecoveryKey } from "./email-composer-recovery";

const base = { recordKey: "", pathname: "/emails", seed: "" };
  test("never restores an unrelated blank composer into a saved draft", () => {
    const key = emailComposerRecoveryKey({ ...base, scope: "email-admin-new" });
    assert.notEqual(emailComposerRecoveryKey({ ...base, draftId: "draft-a" }), key);
    assert.notEqual(emailComposerRecoveryKey({ ...base, draftId: "draft-a" }), emailComposerRecoveryKey({ ...base, draftId: "draft-b" }));
  });
  test("keeps blank Email Admin and Weekly Recap emails separate and reload-stable", () => {
    const admin = emailComposerRecoveryKey({ ...base, scope: "email-admin-new" });
    const recap = emailComposerRecoveryKey({ ...base, scope: "weekly-recap-new" });
    assert.notEqual(admin, recap);
    assert.equal(emailComposerRecoveryKey({ ...base, scope: "email-admin-new" }), admin);
    const storage = new Map([[admin, "unfinished email"], [recap, "other email"]]);
    storage.delete(recap);
    assert.equal(storage.get(admin), "unfinished email");
  });
  test("isolates record-less resends by original email", () => {
    assert.notEqual(emailComposerRecoveryKey({ ...base, scope: "resend:a" }), emailComposerRecoveryKey({ ...base, scope: "resend:b" }));
  });
  test("isolates other unlinked contexts and retains existing record recovery", () => {
    assert.notEqual(emailComposerRecoveryKey({ ...base, seed: "answer a" }), emailComposerRecoveryKey({ ...base, seed: "answer b" }));
    assert.equal(emailComposerRecoveryKey({ ...base, recordKey: "FH0001" }), "fh-email-composer:FH0001");
  });