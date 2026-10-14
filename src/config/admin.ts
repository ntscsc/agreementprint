/**
 * Single source of truth for authorized vendor admin emails.
 * Allows both the repository account and secondary administrator email.
 */
export const ADMIN_EMAILS = [
  'pradeep1992official@gmail.com',
  'ntcsc@gmail.com',
];

export const ADMIN_EMAIL = 'pradeep1992official@gmail.com';

/**
 * Checks if the given email matches any designated administrator email.
 * If emailVerified is passed, also enforces that the email is verified.
 */
export function isUserAdmin(email?: string | null, emailVerified?: boolean): boolean {
  if (!email) return false;
  if (emailVerified !== undefined && !emailVerified) return false;
  const normalized = email.toLowerCase().trim();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase().trim() === normalized);
}


