import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreToGrade(score: number): number {
  // Convert 0-100 score to Dutch 1-10 grade
  // 0-54 → 1.0-5.4, 55 → 5.5, 100 → 10.0
  const grade = (score / 100) * 9 + 1
  return Math.round(grade * 10) / 10
}

export function gradeColor(grade: number): string {
  if (grade >= 8) return 'text-green-600'
  if (grade >= 6) return 'text-yellow-600'
  return 'text-red-600'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function crimeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    vernieling: 'Vernieling',
    heling: 'Heling',
    diefstal: 'Diefstal',
    mishandeling: 'Mishandeling',
    inbraak: 'Inbraak',
    overig: 'Overig',
  }
  return labels[type] ?? type
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    assigned: 'Toegewezen',
    interviewing: 'Bezig met interview',
    writing_pv: 'PV aan het schrijven',
    submitted: 'Ingediend',
    evaluated: 'Beoordeeld',
  }
  return labels[status] ?? status
}
