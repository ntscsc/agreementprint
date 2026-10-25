export function emailAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'The email or password is incorrect. Try again or reset your password.';
    case 'auth/email-already-in-use': case 'auth/account-exists-with-different-credential': return 'An account may already use this email. Sign in, use Google, or reset your password.';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements': return 'Choose a stronger password with at least 8 characters. Include uppercase and lowercase letters, a number and a symbol.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a few minutes before trying again.';
    case 'auth/network-request-failed': return 'Could not connect. Check your internet connection and try again.';
    case 'auth/operation-not-allowed': case 'auth/admin-restricted-operation': return 'Email sign-in is not enabled yet. Please use Google or contact support.';
    case 'auth/user-disabled': return 'This account is unavailable. Please contact support.';
    default: return 'Sign-in could not be completed. Please try again.';
  }
}
