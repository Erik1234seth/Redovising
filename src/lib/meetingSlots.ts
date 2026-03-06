export const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function isSlotFakeBooked(date: string, time: string): boolean {
  return Math.abs(simpleHash(date + time)) % 10 < 3;
}

export function isSlotBooked(
  date: string,
  time: string,
  bookedSlots: Record<string, string[]>
): boolean {
  return isSlotFakeBooked(date, time) || (bookedSlots[date]?.includes(time) ?? false);
}
