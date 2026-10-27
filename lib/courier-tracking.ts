/** Open DTDC's India homepage; its tracking form does not accept a prefilled AWB. */
export function validCourierTrackingLink(value: string): boolean {
  try {
    const url = new URL(value.replaceAll('{trackingNumber}', 'SAMPLE123'));
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function courierTrackingUrl(courierName: string, trackingNumber: string, links: Record<string, string> = {}): string | null {
  if (!trackingNumber.trim()) return null;
  const key = Object.keys(links).find(name => name.toLowerCase() === courierName.trim().toLowerCase());
  const configured = key === undefined ? undefined : links[key];
  if (configured && validCourierTrackingLink(configured)) return configured.replaceAll('{trackingNumber}', encodeURIComponent(trackingNumber.trim()));
  return /\bdtdc\b/i.test(courierName) ? 'https://www.dtdc.com/in/' : null;
}
