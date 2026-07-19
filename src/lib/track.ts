'use client';

// Anonym besöksmätning mot funnel_events. Inga personuppgifter — bara ett
// slumpat id som lever i sessionStorage, så att händelser från samma besök
// går att läsa i ordning.

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analyticsSessionId');
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('analyticsSessionId', sessionId);
  }
  return sessionId;
}

interface TrackExtra {
  packageType?: string;
  bank?: string;
  userId?: string;
}

/** Fire-and-forget — får aldrig blockera eller krascha för besökaren. */
export function trackEvent(step: string, extra: TrackExtra = {}) {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, sessionId: getSessionId(), ...extra }),
      // Ett menyklick leder ofta till en navigering — utan keepalive hinner
      // requesten dö med sidan innan den skickats.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sessionStorage kan kasta i privat läge/blockerade cookies.
  }
}

/** Gör en etikett till något som går att gruppera på i statistiken. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
