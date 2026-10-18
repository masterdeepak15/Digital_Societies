import { StatusPill } from './StatusPill'

// Kept for existing pages; new code should use StatusPill directly.
export function Badge({ label, className }: { label: string; className?: string }) {
  return <StatusPill label={label} className={className} />
}
