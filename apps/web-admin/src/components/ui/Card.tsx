import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-100 p-5', className)}>
      {children}
    </div>
  )
}

export function StatCard({
  label, value, sub, icon: Icon, color = 'blue',
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  )
}
