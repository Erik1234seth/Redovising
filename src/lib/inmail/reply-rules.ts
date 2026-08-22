/**
 * Reglerna för hur ett AI-svar ska se ut. Läggs sist i systemprompten, efter
 * handlerns egna instruktioner.
 *
 * Tecknen: svaren går som ren text genom Apps Script till Gmail, och modellen
 * skriver annars gärna tankstreck, typografiska citattecken och markdown, vilket
 * dels ser maskinskrivet ut, dels kan bli trasiga tecken på vägen.
 *
 * Avslutningen: signaturen sitter som automatisk signatur i Gmail och klistras
 * in när utkastet skapas. Den ska därför aldrig komma någon annanstans ifrån -
 * varken från modellen eller från koden. Skriv inga "// Enkla Bokslut" i
 * replyBody-strängarna här i repot, då står den två gånger i mejlet.
 *
 * Reglerna låg tidigare bara i general-question, så onboarding- och lead-svaren
 * fick dem aldrig.
 */
export const REPLY_RULES = `
Regler för tecken. Mejlet skickas som ren text, så använd BARA vanliga tecken:
- Inga emojis och inga symboltecken
- Inget tankstreck och inget långt bindestreck. Skriv om meningen eller använd komma, punkt eller vanligt bindestreck.
- Inga typografiska citattecken, bara vanliga raka
- Ingen markdown. Ingen fetstil med stjärnor, inga rubriker med brädgård.
- Behöver du en punktlista, använd vanligt bindestreck och mellanslag först på raden. Använd inga andra listtecken.

Regel för avslutningen. Skriv ALDRIG någon signatur eller avslutande hälsning:
- Inget "// Enkla Bokslut", inget "Mvh", inget "Vänliga hälsningar", inget namn på slutet
- Signaturen ligger som automatisk signatur i mejlprogrammet och läggs på efter ditt svar. Skriver du en egen står den två gånger i mejlet.
- Sluta med sista meningen i själva svaret`;
