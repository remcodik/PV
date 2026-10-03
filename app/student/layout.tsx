import type { Metadata } from 'next'

// Previously only /student-start (the login page) had its own metadata
// and apple-icon — once logged in, every page under /student/* (the
// dashboard, cases, interview, etc.) fell back to the root app's generic
// navy "PV Trainer" title and icon. Since that's where people actually
// spend their time and are far more likely to "Add to Home Screen" from,
// this covers the whole section instead of just the entry page.
export const metadata: Metadata = {
  title: 'PV Student',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PV Student' },
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-student-headings bg-cream min-h-screen">
      {children}
    </div>
  )
}
