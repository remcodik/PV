import type { LucideIcon } from 'lucide-react'

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{children}</p>
      {count !== undefined && (
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-mono">{count}</span>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className = 'p-12',
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <Card className={`text-center ${className}`}>
      <div className="w-11 h-11 bg-ink-50 border border-ink-100 rounded-md flex items-center justify-center mx-auto mb-4">
        <Icon className="w-5 h-5 text-ink-500" />
      </div>
      <p className="font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </Card>
  )
}
