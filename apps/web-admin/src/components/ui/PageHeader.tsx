export function PageHeader({
  title, description, action,
}: {
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-mute">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
