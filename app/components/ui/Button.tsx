import Link from 'next/link'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'

const VARIANTS = {
  primary: 'bg-ink-800 text-white hover:bg-ink-900 shadow-sm',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  danger: 'text-red-600 hover:bg-red-50',
  gold: 'bg-gold-600 text-white hover:bg-gold-700 shadow-sm',
} as const

const SIZES = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
} as const

type Variant = keyof typeof VARIANTS
type Size = keyof typeof SIZES

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: { variant?: Variant; size?: Size } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className = '',
  href,
  ...props
}: {
  variant?: Variant
  size?: Size
  className?: string
  href: string
} & Omit<React.ComponentProps<typeof Link>, 'className' | 'href'>) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />
}
