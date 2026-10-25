export function indianLoginPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9][0-9]{9}$/.test(local)) throw new Error('Enter a valid 10-digit Indian mobile number.');
  return `+91${local}`;
}
export function phoneAuthError(error: unknown): string {
  switch ((error as { code?: string })?.code) {
    case 'auth/invalid-verification-code': return 'That code is incorrect. Check the SMS and try again.';
    case 'auth/code-expired': case 'auth/session-expired': case 'auth/invalid-verification-id': return 'This code has expired. Request a new code.';
    case 'auth/invalid-phone-number': return 'Enter a valid 10-digit Indian mobile number.';
    case 'auth/too-many-requests': case 'auth/quota-exceeded': return 'SMS is temporarily unavailable. Wait before retrying, or use email or Google.';
    case 'auth/captcha-check-failed': case 'auth/missing-app-credential': case 'auth/invalid-app-credential': return 'The security check could not be completed. Please try again.';
    case 'auth/billing-not-enabled': case 'auth/operation-not-allowed': case 'auth/unauthorized-domain': return 'Phone sign-in is not available on this site yet. Please use email or Google.';
    case 'auth/network-request-failed': return 'Check your internet connection and try again.';
    default: return error instanceof Error && error.message === 'Enter a valid 10-digit Indian mobile number.' ? error.message : 'Could not complete phone sign-in. Please try again or use email.';
  }
}
