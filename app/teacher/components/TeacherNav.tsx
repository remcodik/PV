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
    <nav className="bg-white border-b-2 border-teacher-brass sticky top-[73px] z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-0.5 transition-colors ${
              active === t.key
                ? 'border-teacher-ink text-teacher-ink'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
