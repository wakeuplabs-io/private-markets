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