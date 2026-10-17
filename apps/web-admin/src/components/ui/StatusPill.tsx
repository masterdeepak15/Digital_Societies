import { cn } from '@/lib/utils'
import { statusTone, type Tone } from '@/lib/status'

const tones: Record<Tone, string> = {
  good:    'bg-good/10 text-good',
  warn:    'bg-warn/10 text-warn',
  bad:     'bg-bad/10 text-bad',
  neutral: 'bg-mute/10 text-mute',
}

export function StatusPill({ label, tone, className }: { label: string; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone ?? statusTone(label)], className)}>
      {label}
    </span>
  )
}
