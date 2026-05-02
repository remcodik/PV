import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#059669',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '20px',
          width: 90,
          height: 90,
        }}
      >
        <span style={{ color: 'white', fontSize: 42, fontWeight: 800, letterSpacing: '-1px' }}>PV</span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontWeight: 600, letterSpacing: '1px' }}>
        DOCENT
      </span>
    </div>,
    { ...size }
  )
}
