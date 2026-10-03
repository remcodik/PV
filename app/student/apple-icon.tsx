import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Student-identiteit: warme amber achtergrond — bewust het tegenovergestelde
// van de koele ink/goud-combinatie van docent/beheer, zodat het verschil
// ook op een klein startscherm-icoon meteen opvalt (kleur draagt verder
// dan een lettertype-detail op dat formaat).
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#c17a2e',
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
          background: '#0a1420',
          borderRadius: '28px',
          width: 108,
          height: 108,
        }}
      >
        <span style={{ color: 'white', fontSize: 58, fontWeight: 800 }}>S</span>
      </div>
    </div>,
    { ...size }
  )
}
