import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

export function formatDate(iso: string, fmt = 'dd MMM yyyy'): string {
  try { return format(parseISO(iso), fmt) } catch { return iso }
}

export function formatDateTime(iso: string): string {
  return formatDate(iso, 'dd MMM yyyy, h:mm a')
}

export function initialsOf(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-800',
    paid:       'bg-green-100  text-green-800',
    overdue:    'bg-red-100    text-red-800',
    open:       'bg-blue-100   text-blue-800',
    assigned:   'bg-purple-100 text-purple-800',
    inprogress: 'bg-orange-100 text-orange-800',
    resolved:   'bg-green-100  text-green-800',
    closed:     'bg-gray-100   text-gray-800',
    approved:   'bg-green-100  text-green-800',
    rejected:   'bg-red-100    text-red-800',
    entered:    'bg-teal-100   text-teal-800',
    exited:     'bg-gray-100   text-gray-800',
  }
  return map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
}
