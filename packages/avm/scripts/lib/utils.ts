/**
 * Converts a bigint value to string by interpreting hex bytes as characters
 */
export function bigintToString(bigintValue: bigint): string {
  const hex = bigintValue.toString(16);
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte !== 0) {
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

/**
 * Converts an Aztec field to string representation
 * Handles various field formats from Aztec contracts
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