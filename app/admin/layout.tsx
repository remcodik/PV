import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PV Beheer',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PV Beheer' },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
