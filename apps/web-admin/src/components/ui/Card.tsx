import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-100 p-5', className)}>
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
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
          {sub   && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          {delta && <p className={cn('text-xs mt-1', deltaClass ?? 'text-green-600')}>{delta}</p>}
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-gray-50 shrink-0 ml-3">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
