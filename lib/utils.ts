import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseDateOnly(date: string | Date): Date {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addExactMonths(date: string | Date, months: number): Date {
  const start = parseDateOnly(date);
  const originalDay = start.getDate();
  const targetMonthDate = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const targetMonth = targetMonthDate.getMonth();
  const targetYear = targetMonthDate.getFullYear();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  if (originalDay <= daysInTargetMonth) {
    return new Date(targetYear, targetMonth, originalDay);
  }

  const rolledDate = new Date(targetYear, targetMonth, originalDay);

  // February needs a one-day adjustment to match the product's expiry-date rules.
  if (targetMonth === 1) {
    rolledDate.setDate(rolledDate.getDate() - 1);
  }

  return rolledDate;
}
