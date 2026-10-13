/** Format scalar wire values without invoking an object's coercion hooks. */
export function primitiveText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values: readonly unknown[] = value;
    const scalar = values.every(
      (item) =>
        item === null ||
        item === undefined ||
        ['string', 'number', 'boolean', 'bigint'].includes(typeof item),
    );
    if (scalar) return values.map((item) => primitiveText(item)).join(',');
  }
  return fallback;
}
