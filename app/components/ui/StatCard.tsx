import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export function StatCard({
  icon: Icon,
  label,
  value,
  href,
  valueClassName = 'text-ink-950',
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  href?: string
  valueClassName?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-2 sm:mb-2.5">
        <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
        <Icon className="w-4 h-4 text-ink-400 flex-shrink-0" strokeWidth={2} />
      </div>
      <p className={`font-mono text-2xl sm:text-3xl font-bold ${valueClassName}`}>{value}</p>
    </>
  )
  const cls = 'bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-5 block'

  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-ink-300 transition-colors`}>
        {content}
      </Link>
    )
  }
  return <div className={cls}>{content}</div>
}
