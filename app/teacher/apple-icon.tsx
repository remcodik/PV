import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Docent-identiteit: ink navy + goud — "het bureau".
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#101d2e',
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
          background: '#98782f',
          borderRadius: '28px',
          width: 108,
          height: 108,
        }}
      >
        <span style={{ color: '#101d2e', fontSize: 58, fontWeight: 800 }}>D</span>
      </div>
    </div>,
    { ...size }
  )
}
