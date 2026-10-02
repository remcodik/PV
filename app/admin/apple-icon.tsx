import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Beheer-identiteit: bewust monochroom (geen goud, geen amber) — het enige
// icoon zonder warme accentkleur, zodat het duidelijk afwijkt van zowel
// docent als student en meteen leest als "dit is de gevoelige/admin-kant".
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0a1420',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '4px solid rgba(255,255,255,0.9)',
          borderRadius: '28px',
          width: 108,
          height: 108,
        }}
      >
        <span style={{ color: 'white', fontSize: 58, fontWeight: 800 }}>B</span>
      </div>
    </div>,
    { ...size }
  )
}
