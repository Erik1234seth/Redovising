import { ImageResponse } from 'next/og';

/**
 * LinkedIn-kortet genereras här istället för att peka på en bildfil.
 *
 * Huvudsajten deklarerar /loggautantext.png som 1200x630 fast filen är
 * 256x256, vilket ger ett suddigt eller fyrkantigt kort. Eftersom den här
 * länken delas på LinkedIn — där kortet ofta är det enda folk ser — ritas
 * bilden i rätt format direkt.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Sethapp — building scalable accounting for small businesses';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#173b57',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: '#E95C63',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 26,
              color: '#9fb8cc',
              letterSpacing: 2,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Sethapp
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.1,
              color: '#ffffff',
              fontWeight: 700,
              letterSpacing: -1.5,
              display: 'flex',
              maxWidth: 940,
            }}
          >
            Building scalable accounting for small businesses
          </div>
          <div style={{ fontSize: 30, color: '#9fb8cc', display: 'flex' }}>
            company.enklabokslut.se
          </div>
        </div>
      </div>
    ),
    size,
  );
}
