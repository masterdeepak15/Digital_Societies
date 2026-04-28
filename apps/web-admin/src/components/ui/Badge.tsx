import { cn, statusColor } from '@/lib/utils'

export function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusColor(label), className)}>
      {label}
    </span>
  )
}
