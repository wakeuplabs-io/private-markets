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
 * @param hex - Hex string or BigInt to normalize
 * @returns Normalized hex string with 0x prefix and 64 characters
 */
export function normalizeHex64(hex: string | bigint): string {
  let hexStr: string;
  
  if (typeof hex === 'bigint') {
    hexStr = hex.toString(16);
  } else {
    hexStr = hex.startsWith('0x') ? hex.slice(2) : hex;
  }
  const paddedHex = hexStr.padStart(64, '0');
  return '0x' + paddedHex;
}
