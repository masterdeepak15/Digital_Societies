import { cn } from '@/lib/utils'

export interface StatItem {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}

const hintTone = { neutral: 'text-mute', good: 'text-good', warn: 'text-warn', bad: 'text-bad' }

/** One bordered panel of key figures divided by hairlines (1 column on phones, 2, then 4). */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl className={cn(
      'grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-2 lg:grid-cols-4',
      'divide-y divide-line sm:divide-y-0 lg:divide-x',
      className,
    )}>
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4 sm:border-b sm:border-line lg:border-b-0">
          <dt className="text-sm text-mute">{it.label}</dt>
          <dd className="mt-1 text-[28px] font-extrabold leading-tight text-ink">{it.value}</dd>
          {it.hint && <p className={cn('mt-1 text-xs font-semibold', hintTone[it.tone ?? 'neutral'])}>{it.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
