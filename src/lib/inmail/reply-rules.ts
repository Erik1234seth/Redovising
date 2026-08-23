/**
 * Reglerna för hur ett AI-svar ska se ut. Läggs sist i systemprompten, efter
 * handlerns egna instruktioner.
 *
 * Tecknen: modellen skriver ren text, och Apps Script escapar den innan den går
 * in i utkastets HTML-version. Markdown renderas alltså inte, den syns som
 * stjärnor och brädgårdar. Modellen skriver annars gärna tankstreck och
 * typografiska citattecken också, vilket dels ser maskinskrivet ut, dels kan bli
 * trasiga tecken på vägen.
 *
 * Avslutningen: signaturen hängs på av Apps Script (SIGNATURE_TEXT och
 * SIGNATURE_HTML i apps-script/check-inbox.gs) precis innan utkastet skapas. Gmails egen
 * automatiska signatur kommer aldrig med, den läggs bara in av webbklientens
 * compose-vy och inte av createDraftReply. Signaturen ska därför inte komma
 * någon annanstans ifrån - varken från modellen eller härifrån. Skriv ingen
 * signatur i replyBody-strängarna i repot, då står den två gånger i mejlet.
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
