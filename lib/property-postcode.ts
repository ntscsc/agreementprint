import directory from '@/src/content/tamil-nadu-postcodes.json';

const postcodes: Record<string, string[]> = directory;

/** Validate only the property PIN. Do not cross-check city or address text. */
export function propertyPostcodeError(pin?: string): string | null {
  if (!pin || !/^6\d{5}$/.test(pin) || !Object.hasOwn(postcodes, pin)) {
    return 'Enter a valid six-digit Tamil Nadu PIN code starting with 6 and listed in the postal directory.';
  }
  return null;
}
