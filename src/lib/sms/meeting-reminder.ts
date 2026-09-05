import { formatMeetingDate } from '../meetingSlots';

/**
 * Påminnelsen som går ut på mötesdagens morgon till den som bokat tid.
 *
 * Numret i texten är det Erik ringer från, inte numret SMS:et kommer från
 * (Twilio-numret är ett annat). Hela poängen med påminnelsen är att kunden ska
 * känna igen det som ringer och svara — därför står det i klartext.
 */

/** Numret kunden ser när vi ringer. */
export const CALLING_NUMBER = '072-519 16 16';

/** Markerar raden i sms_messages, så tidslinjen kan namnge utskicket. */
export const REMINDER_KIND = 'meeting_reminder';

export function meetingReminderSms(date: string, time: string): string {
  return (
    `Hej! Påminnelse från EnklaBokslut: vi ringer upp dig i dag kl. ${time} ` +
    `från ${CALLING_NUMBER}. Passar det inte, svara på det här SMS:et så bokar vi om.\n\n` +
    'Hälsningar\nErik på EnklaBokslut'
  );
}

/** Dagens datum i svensk tid — servern går på UTC, mötena på väggklockan. */
export function todayInSweden(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

/** Klockslaget nu i svensk tid, som "HH:MM". */
export function timeInSweden(now = new Date()): string {
  return now.toLocaleTimeString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Bara för loggen: "måndag 7 september". */
export function describeMeetingDay(date: string): string {
  return formatMeetingDate(date);
}
