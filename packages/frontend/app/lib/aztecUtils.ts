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
  } catch (error) {
    console.error("Failed to convert bigint to string:", error);
    return value.toString();
  }
}

/**
 * Convert string to Aztec Field format (bigint)
 * Useful for encoding string parameters for contract calls
 */
export function stringToField(str: string): bigint {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    let hex = '';
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0');
    }

    return BigInt('0x' + hex);
  } catch (error) {
    console.error("Failed to convert string to field:", error);
    return BigInt(0);
  }
}

/**
 * Debug function to log Field conversion details (development only)
 */
export function debugField(field: unknown, label = "Field"): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${label}:`, field);

    if (field && typeof field === 'object' && field !== null && 'value' in field) {
      const fieldObj = field as { value: unknown };
      if (typeof fieldObj.value === 'bigint') {
        const hex = fieldObj.value.toString(16);
        const converted = bigintToString(fieldObj.value);
        console.log(`${label} conversion:`, {
          bigint: fieldObj.value,
          hex,
          string: converted
        });
      }
    }
  }
}