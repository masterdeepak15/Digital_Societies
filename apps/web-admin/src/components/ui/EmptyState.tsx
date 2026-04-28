import { type LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, description }: {
  icon: LucideIcon; title: string; description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-gray-100 rounded-full p-4 mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  )
}
