/**
 * Brytare för AI:ns ärenden. Sätt `ARENDEN_AI=av` i Vercel (och deploya om)
 * för att stänga av att ärenden skapas och kollas automatiskt — då sköter
 * Claude dem i stället, direkt mot tabellen `arenden`.
 *
 * Påverkar bara `skapaArendenFranMeddelande` och `kollaArenden`. Mejlsynken,
 * mejl- och sms-svaren, underlagen och manuella ärenden på Ärenden-sidan
 * fungerar som vanligt. Utan variabeln är allt som förut.
 */
export function arendenAiAv(): boolean {
  return process.env.ARENDEN_AI?.trim().toLowerCase() === 'av';
}
