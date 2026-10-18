import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-5', className)}>
      {children}
    </div>
  )
}

export function StatCard({
  label, value, sub, icon, delta, deltaClass,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  delta?: string
  deltaClass?: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-mute">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">{value}</p>
          {sub   && <p className="mt-0.5 text-xs text-mute">{sub}</p>}
          {delta && <p className={cn('mt-1 text-xs', deltaClass ?? 'text-good')}>{delta}</p>}
        </div>
        {icon && (
          <div className="ml-3 shrink-0 rounded-lg bg-surface-alt p-2.5">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
