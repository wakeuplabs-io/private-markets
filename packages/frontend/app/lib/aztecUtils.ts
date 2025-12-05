/**
 * Aztec utility functions for handling Field types and conversions
 */

/**
 * Convert Aztec Field to string
 * Handles both Field objects with value property and direct bigint values
 */
export function fieldToString(field: unknown): string {
  if (field && typeof field === 'object' && field !== null && 'value' in field) {
    const fieldObj = field as { value: unknown };
    if (typeof fieldObj.value === 'bigint') {
      return bigintToString(fieldObj.value);
    }
  }

  if (typeof field === 'string') return field;
  if (typeof field === 'bigint') return bigintToString(field);

  if (field && typeof field === 'object' && field !== null && 'toString' in field && typeof field.toString === 'function') {
    return field.toString();
  }

  return String(field);
}

/**
 * Convert bigint Field value to string (Aztec encoding)
 * Converts bigint to hex, then to ASCII characters
 */
export function bigintToString(value: bigint): string {
  try {
    const hex = value.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;

    const bytes = [];
    for (let i = 0; i < paddedHex.length; i += 2) {
      const byte = parseInt(paddedHex.substring(i, i + 2), 16);
      if (byte !== 0) {
        bytes.push(byte);
      }
    }

    const result = String.fromCharCode(...bytes);
    return result.replace(/\0/g, '');
  } catch {
    return value.toString();
  }
}
