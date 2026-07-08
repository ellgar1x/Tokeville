/**
 * The single super-admin (platform owner) who can access the internal console
 * and is the only account allowed to create a workspace while access is
 * waitlisted. Kept in one place so the trigger, APIs, and UI agree.
 */
export const SUPER_ADMIN_EMAIL = "elliot@thegarcias.us";

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}
