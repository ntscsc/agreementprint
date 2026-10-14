export function omitUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : omitUndefinedValues(item)
    ) as T;
  }

  if (value instanceof Date) return value;

  if (value !== null && typeof value === 'object') {
    const definedEntries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, omitUndefinedValues(entryValue)]);

    return Object.fromEntries(definedEntries) as T;
  }

  return value;
}
