import type { Metadata } from 'next'
import { Inter, Roboto_Slab, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

// Shared body font (login page, shared chrome) — neutral, not tied to
// either app's identity.
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
// Teacher identity: a slab serif, evoking an official record/ledger.
const robotoSlab = Roboto_Slab({ subsets: ['latin'], variable: '--font-teacher' })
// Student identity: a geometric, approachable sans — distinct from the
// teacher's slab and from the shared body font.
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-student' })
// Used for stats/numbers on the teacher side (dossier/ledger feel).
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono-data' })

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
    <html lang="nl" className={`${inter.variable} ${robotoSlab.variable} ${spaceGrotesk.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased bg-gray-50">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
