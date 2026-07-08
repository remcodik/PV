'use client'

import { UserProfile, SCORE_CATEGORY_LABELS } from '@/lib/types'
import { Lightbulb } from 'lucide-react'

/**
 * Shows a student the standing attention note / focus categories their
 * teacher has set on their profile (see teacher/students/[id]). Renders
 * nothing if neither is set — safe to drop in anywhere unconditionally.
 */
export default function AttentionNoteBanner({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null
  const hasNote = !!profile.attentionNote
  const hasFocus = (profile.focusAreas?.length ?? 0) > 0
  if (!hasNote && !hasFocus) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
      <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-800">Aandachtspunt van je docent</p>
        {hasNote && <p className="text-amber-700 mt-0.5">{profile.attentionNote}</p>}
        {hasFocus && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.focusAreas!.map(cat => (
              <span key={cat} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">
                {SCORE_CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
