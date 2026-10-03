'use client'

import { Shield, GraduationCap, LogOut } from 'lucide-react'

/**
 * Shared top bar for every signed-in screen. The bar itself stays one
 * shared dark-navy "official" chrome across both apps — but the badge
 * icon and its accent color DO differ per role (amber for student, gold
 * for teacher), matching the identity already used on /student-start,
 * /docent-start, and the home-screen icons. A previous version of this
 * component used the exact same icon/color for both roles everywhere
 * inside the app once logged in — the only place the role distinction
 * showed up was the entry pages and the home-screen icon, not the actual
 * app itself, which looked identical regardless of role. This fixes
 * that for every screen using this shared header.
 */
export default function AppHeader({
  roleLabel,
  userName,
  onLogout,
  actions,
}: {
  roleLabel: string
  userName?: string
  onLogout?: () => void
  actions?: React.ReactNode
}) {
  const isStudent = roleLabel.toLowerCase() === 'student'
  const Icon = isStudent ? GraduationCap : Shield
  const badgeClass = isStudent ? 'bg-amber-600' : 'bg-gold-600'

  return (
    <header className="sticky top-0 z-20 bg-ink-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-md ${badgeClass} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-ink-950" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm tracking-wide leading-tight truncate">PV Trainer</p>
            <p className="text-[11px] text-white/55 uppercase tracking-widest leading-tight truncate">
              {roleLabel}
              {userName ? ` · ${userName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actions}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Uitloggen"
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
