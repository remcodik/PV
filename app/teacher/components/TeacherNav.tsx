'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { key: 'dashboard', label: 'Overzicht', href: '/teacher/dashboard' },
  { key: 'cases', label: 'Cases', href: '/teacher/cases' },
  { key: 'users', label: 'Gebruikers', href: '/teacher/users' },
] as const

export default function TeacherNav() {
  const pathname = usePathname()
  const active = TABS.find(t => pathname.startsWith(t.href))?.key ?? 'dashboard'

  return (
    <nav className="sticky top-16 z-10 bg-ink-800 border-b border-black/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              active === t.key
                ? 'border-gold-600 text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
