/**
 * SMS:et som följer med påminnelsemejlet till leads som aldrig svarade.
 *
 * Till skillnad från välkomst-SMS:et, som bara pekar på mejlet, bär det här
 * hela ärendet självt. Den som inte öppnade det första mejlet öppnar knappast
 * det andra heller, och då är SMS:et det enda som når fram.
 *
 * "Är det inte aktuellt är det bara att säga till" står där av samma skäl som i
 * mejlet: ett andra utskick till någon som varit tyst måste ha en väg ut som är
 * lika enkel som ett ja. Twilio hanterar dessutom STOP av sig självt, och det
 * svaret hamnar i sms_optouts.
 *
 * Å, Ä och Ö är gratis i GSM-7. Texten går på två segment, precis som
 * välkomst-SMS:et — emoji eller tankstreck hade tvingat fram UCS-2 och tre.
 */

/** Märkningen i sms_messages, som också är spärren mot ett andra utskick. */
export const REMINDER_SMS_KIND = 'lead_paminnelse';

/**
 * Hur länge vi väntar på ett svar innan påminnelsen går. Två veckor är Eriks
 * val: kort nog att leadet minns formuläret, långt nog att semester eller en
 * stressig vecka hinner passera.
 */
export const REMINDER_AFTER_DAYS = 14;

export const LEAD_REMINDER_SMS =
  'Hej! Erik på EnklaBokslut här igen. Jag mejlade dig för ett par veckor ' +
  'sedan om bokföring för enskild firma. Är det fortfarande aktuellt? Svara ' +
  'på mejlet eller på det här SMS:et så hör jag av mig. Är det inte aktuellt ' +
  'är det bara att säga till.\n\n' +
  'Hälsningar\nErik på EnklaBokslut';
