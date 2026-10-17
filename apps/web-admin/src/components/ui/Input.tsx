import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

/** Text input. Always pair with a <label htmlFor>; `invalid` switches the border to the danger color. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-[40px] w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-mute',
        'focus:outline-none focus:ring-2 focus:ring-saffron',
        invalid ? 'border-bad' : 'border-line',
        className,
      )}
      {...rest}
    />
  )
})
