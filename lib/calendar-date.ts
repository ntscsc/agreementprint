/** Date-only validation: no UTC conversion and no rollover of impossible dates. */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function parseTypedCalendarDate(value: string): string {
  const text = value.trim();
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : text;
  return isValidCalendarDate(iso) ? iso : '';
}

export function displayCalendarDate(value: string): string {
  return isValidCalendarDate(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
}
