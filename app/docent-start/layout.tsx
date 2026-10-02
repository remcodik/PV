import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PV Docent',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PV Docent' },
}

export default function DocentStartLayout({ children }: { children: React.ReactNode }) {
  return children
}
