import { cn } from '@/lib/utils'

/** Scrolls sideways inside its own box on narrow screens instead of widening the page. */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-3 text-left text-xs font-semibold text-mute', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-ink', className)}>{children}</td>
}

export function Tr({ children, onClick, className }: {
  children: React.ReactNode; onClick?: () => void; className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-line last:border-0',
        onClick && 'cursor-pointer hover:bg-surface-alt',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-line bg-surface-alt/60">{children}</thead>
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}
