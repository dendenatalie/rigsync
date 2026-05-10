import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/** Multi-day discount tiers */
export function calculateMultidayDiscount(days: number): number {
  if (days >= 28) return 30;
  if (days >= 14) return 20;
  if (days >= 7)  return 15;
  if (days >= 4)  return 10;
  if (days >= 2)  return 5;
  return 0;
}

/** Best rate: daily vs weekly pro-rated */
export function bestRate(dailyRate: number, weeklyRate: number | undefined | null, days: number): number {
  if (!weeklyRate || weeklyRate <= 0) return dailyRate * days;
  const fullWeeks = Math.floor(days / 7);
  const remainDays = days % 7;
  const weeklyTotal = fullWeeks * weeklyRate + remainDays * dailyRate;
  const dailyTotal = dailyRate * days;
  return Math.min(weeklyTotal, dailyTotal);
}

export function isOverdue(dueDate: string | undefined | null, status: string): boolean {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}

export function daysPastDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

export function customerFullName(customer: { first_name: string; last_name: string; company_name?: string | null }): string {
  const name = `${customer.first_name} ${customer.last_name}`;
  return customer.company_name ? `${customer.company_name} (${name})` : name;
}
