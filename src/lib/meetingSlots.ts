export const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];

// Hur ofta en tid ser upptagen ut (av 10 dagar). Tiderna folk helst vill ha
// lämnas nästan alltid lediga — det som blockas är tidigt på morgonen, direkt
// efter lunch och sent på eftermiddagen.
const SLOT_LOAD: Record<string, number> = {
  '09:00': 5,
  '10:00': 1,
  '11:00': 1,
  '13:00': 4,
  '14:00': 1,
  '15:00': 4,
};

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function isSlotFakeBooked(date: string, time: string): boolean {
  return Math.abs(simpleHash(date + time)) % 10 < (SLOT_LOAD[time] ?? 3);
}

export function isSlotBooked(
  date: string,
  time: string,
  bookedSlots: Record<string, string[]>
): boolean {
  return isSlotFakeBooked(date, time) || (bookedSlots[date]?.includes(time) ?? false);
}

export function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Första bokningsbara vardagen från och med `from`. */
export function firstBookableDate(from: Date) {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** De N närmaste bokningsbara vardagarna från och med `from`. */
export function upcomingWeekdays(from: Date, count: number) {
  const out: Date[] = [];
  const d = new Date(from);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Tidigast bokningsbara dag: i morgon, och aldrig en helg. */
export function minBookableDate(today = new Date()) {
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  return d;
}

export function formatMeetingDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
