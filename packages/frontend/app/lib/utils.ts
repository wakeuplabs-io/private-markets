import { safeFormatDate } from '@/utils/typeGuards'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDate = (date: Date | null | undefined, prefix?: string) => {
  const formattedDate = safeFormatDate(
      date,
      {
          month: "short",
          day: "numeric",
          year: "numeric",
      },
      "TBD"
  );
  return prefix ? `${prefix}: ${formattedDate}` : formattedDate;
};

export const formatTime = (date: Date | null | undefined) => {
  return safeFormatDate(date, {
    hour: '2-digit',
    minute: '2-digit'
  }, 'Unknown time')
}

/**
 * Normalize hex string to 64 characters (32 bytes) with leading zeros
 * Handles:
 * - BigInt: converted to hex
 * - String with 0x prefix: treated as hex
 * - String without 0x but all digits: treated as decimal, converted to hex
 * - Objects with toBigInt() (like Fr): use toBigInt() for accurate conversion
 * - Objects with only toString(): use toString() and parse
 *
 * @param hex - Hex string, BigInt, or object with toString()/toBigInt() (like AztecAddress, Fr)
 * @returns Normalized hex string with 0x prefix and 64 characters
 */
export function normalizeHex64(hex: string | bigint | { toString(): string; toBigInt?: () => bigint }): string {
  let hexStr: string;

  if (typeof hex === 'bigint') {
    hexStr = hex.toString(16);
  } else if (typeof hex === 'string') {
    // If string starts with 0x, it's already hex
    if (hex.startsWith('0x')) {
      hexStr = hex.slice(2);
    } else if (/^\d+$/.test(hex)) {
      // Pure decimal string - convert to bigint first, then to hex
      hexStr = BigInt(hex).toString(16);
    } else {
      // Assume it's already hex without prefix
      hexStr = hex;
    }
  } else {
    // For objects like Fr, prefer toBigInt() for accurate conversion
    // Fr.toString() returns decimal, but toBigInt() returns the actual value
    if ('toBigInt' in hex && typeof hex.toBigInt === 'function') {
      hexStr = hex.toBigInt().toString(16);
    } else {
      // Fallback to toString() and parse
      const str = hex.toString();
      if (str.startsWith('0x')) {
        hexStr = str.slice(2);
      } else if (/^\d+$/.test(str)) {
        hexStr = BigInt(str).toString(16);
      } else {
        hexStr = str;
      }
    }
  }

  const paddedHex = hexStr.padStart(64, '0');
  return '0x' + paddedHex;
}
