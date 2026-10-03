import type { Metadata } from 'next'

// Same fix as app/student/layout.tsx — previously only /docent-start had
// its own metadata/icon, every page under /teacher/* fell back to the
// generic root icon once actually logged in and using the app.
export const metadata: Metadata = {
  title: 'PV Docent',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PV Docent' },
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-teacher-headings bg-paper-warm min-h-screen">
      {children}
    </div>
  )
}
