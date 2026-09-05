import { formatMeetingDate, timeInSweden, todayInSweden } from '../meetingSlots';

// Cron-jobbet hämtar dem härifrån; de bor i meetingSlots eftersom även
// adminpanelen behöver samma svenska väggklocka.
export { timeInSweden, todayInSweden };

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

/** Bara för loggen: "måndag 7 september". */
export function describeMeetingDay(date: string): string {
  return formatMeetingDate(date);
}
