/**
 * Byråns generella principer för hur AI-stegen bedömer och varnar. Konteringen,
 * helhetskontrollen och Tillräckligt? läser samma text.
 *
 * De ligger i koden och inte som kontext på alla kunder i flödesschemat, eftersom
 * en kontext kör rättelse-AI:n före varje transaktion.
 */
export const BYRANS_PRINCIPER = `BYRÅNS PRINCIPER — går före kontoplanens punkter om vad som ska styrkas eller granskas. En sådan punkt som strider mot principerna är inte bruten och kräver ingen granskning. Krav som följer av lag gäller som förut: VAT-nummer, representation, ROT och RUT.
1. Det kunden skickar in hör till verksamheten. Utgå från det utan att fråga, flagga eller kräva syfte eller koppling till ett uppdrag. Varna bara när något faktiskt talar emot: fakturan är ställd på en privatperson utan firmans namn, kunden har sagt att det är privat, eller köpet kan inte rimligen höra till verksamheten i kundbilden.
2. Är inget annat känt är en faktura betald på fakturadatumet. Bokför på det utan anmärkning. Visar underlaget eller en bankrad ett annat betaldatum gäller det datumet.
3. Flagga bara det som sannolikt är fel, inte det som i teorin kan vara annorlunda. Kan något ligga på två rimliga konton, välj det rimligaste. Det är ingen anmärkning.
4. Det som syns i kundens andra underlag eller är allmänt känt om motparten behöver inte frågas.
5. Kontobeskrivningarna är inte uttömmande. Exempel och sökord visar vad slags saker som hör till kontot. En sak hör dit om den är av samma slag eller fyller samma funktion i verksamheten, även om just det ordet inte nämns. Att ordet saknas är inget skäl till lägre säkerhet eller granskning.`;
