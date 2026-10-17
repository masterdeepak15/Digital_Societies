import { type LucideIcon } from 'lucide-react'

/** Say what is missing and what to do about it. */
export function EmptyState({ icon: Icon, title, description }: {
  icon: LucideIcon; title: string; description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-4 rounded-full bg-surface-alt p-4">
        <Icon className="h-7 w-7 text-mute" aria-hidden="true" />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-mute">{description}</p>}
    </div>
  )
}
