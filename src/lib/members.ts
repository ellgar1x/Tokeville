/**
 * Member accounts are provisioned by admins with a username + password. Supabase
 * Auth keys on email, so we map each username to a deterministic synthetic email
 * under a reserved domain. Members never see or type this email — only their
 * username. Usernames are therefore globally unique across the platform.
 */
export const MEMBER_EMAIL_DOMAIN = "members.tokeville.app";

/** Lowercase, trim, and strip anything that isn't a safe username character. */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

/** True when a username is well-formed (3–30 chars of [a-z0-9._-]). */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

/** Deterministic synthetic email used as the Supabase Auth identifier. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${MEMBER_EMAIL_DOMAIN}`;
}

/** Recover the username from a synthetic member email (for display). */
export function emailToUsername(email: string): string {
  return email.endsWith(`@${MEMBER_EMAIL_DOMAIN}`)
    ? email.slice(0, -1 * (MEMBER_EMAIL_DOMAIN.length + 1))
    : email;
}
