const TONES = {
  neutral: 'bg-gray-100 text-gray-600',
  brand: 'bg-ink-100 text-ink-700',
  gold: 'bg-gold-100 text-gold-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-600',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
