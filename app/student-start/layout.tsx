import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PV Student',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PV Student' },
}

export default function StudentStartLayout({ children }: { children: React.ReactNode }) {
  return children
}
