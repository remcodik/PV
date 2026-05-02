import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'PV Trainer — Politieopleiding',
  description: 'Trainingsapp voor het schrijven van proces-verbaal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PV Trainer',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="font-sans antialiased bg-gray-50">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
