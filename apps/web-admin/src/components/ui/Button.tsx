import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 dark:bg-saffron dark:text-[#12203B] dark:hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-alt',
  ghost:     'text-ink hover:bg-surface-alt',
  danger:    'border border-bad/40 bg-surface text-bad hover:bg-bad/10',
}

/** Class names for a button-looking element (e.g. a Next <Link>). */
export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cn(
    'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, disabled, className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})
