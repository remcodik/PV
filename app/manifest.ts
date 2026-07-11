import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PV Trainer',
    short_name: 'PV Trainer',
    description: 'Trainingsapp voor het schrijven van proces-verbaal',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f4f0',
    theme_color: '#101d2e',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
