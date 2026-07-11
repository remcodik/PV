'use client'

import { Shield, LogOut } from 'lucide-react'

/**
 * Shared top bar for every signed-in screen — one identity (dark navy,
 * badge mark) for teacher and student alike. Role/user shown as a small
 * uppercase label under the app name, like an ID badge, rather than a
 * separate color scheme per role.
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
  return (
    <header className="sticky top-0 z-20 bg-ink-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-md bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" strokeWidth={2} />
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
