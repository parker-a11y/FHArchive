/**
 * Username accounts have no real email. Sign-in still needs an email, so a
 * username maps to a fixed, non-deliverable address on this private domain.
 */
export const USERNAME_EMAIL_DOMAIN = "users.fharchive.local";

export function isUsernameEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
}

/** Lowercase, letters/digits/._- only, 3–32 chars. Returns null if invalid. */
export function normalizeUsername(value: string): string | null {
  const u = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,32}$/.test(u) ? u : null;
}

/** Turn whatever the person typed (email or username) into the sign-in email. */
export function toLoginEmail(identifier: string): string | null {
  const v = identifier.trim().toLowerCase();
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
  const u = normalizeUsername(v);
  return u ? `${u}@${USERNAME_EMAIL_DOMAIN}` : null;
}

/** Friendly display: username accounts show just the username. */
export function displayLogin(email: string | null | undefined): string {
  if (!email) return "";
  return isUsernameEmail(email) ? email.split("@")[0] : email;
}
