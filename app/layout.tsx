import type { Metadata } from 'next'
import { Public_Sans, Roboto_Slab, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

// Shared institutional foundation — a government-grade humanist sans for
// body/UI text everywhere (login, both apps).
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-body' })
// Monospace for case numbers, stats and other "dossier" data.
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono-data' })
// Teacher identity: a slab serif for headings — "het bureau" (records desk).
const robotoSlab = Roboto_Slab({ subsets: ['latin'], variable: '--font-teacher' })
// Student identity: a geometric sans for headings — "het interview" (field case).
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-student' })

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
    <html lang="nl" className={`${publicSans.variable} ${plexMono.variable} ${robotoSlab.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-paper text-ink-950">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
