/**
 * Teckenreglerna för allt AI:n skriver ut i ett mejlsvar.
 *
 * Svaren går som ren text genom Apps Script till Gmail. Modellen skriver annars
 * gärna tankstreck, typografiska citattecken och markdown, vilket dels ser
 * maskinskrivet ut, dels kan bli trasiga tecken på vägen. Reglerna låg tidigare
 * bara i general-question, så onboarding- och lead-svaren fick dem aldrig.
 *
 * Läggs sist i systemprompten, efter handlerns egna instruktioner.
 */
export const PLAIN_TEXT_RULES = `
Regler för tecken. Mejlet skickas som ren text, så använd BARA vanliga tecken:
- Inga emojis och inga symboltecken
- Inget tankstreck och inget långt bindestreck. Skriv om meningen eller använd komma, punkt eller vanligt bindestreck.
- Inga typografiska citattecken, bara vanliga raka
- Ingen markdown. Ingen fetstil med stjärnor, inga rubriker med brädgård.
- Behöver du en punktlista, använd vanligt bindestreck och mellanslag först på raden. Använd inga andra listtecken.`;
