/**
 * Byråns generella principer för hur AI-stegen bedömer och varnar. Konteringen,
 * helhetskontrollen och Tillräckligt? läser samma text.
 *
 * De ligger i koden och inte som kontext på alla kunder i flödesschemat, eftersom
 * en kontext kör rättelse-AI:n före varje transaktion. De är inte kundregler:
 * de gäller alltid och väljs inte per transaktion (se @/lib/transaktioner/kundregler).
 * Fliken Regler under Löpande bokföring och Bokslut visar och ändrar dem.
 */
export const PRINCIPER_INLEDNING = 'Går före kontoplanens punkter om vad som ska styrkas eller granskas. En sådan punkt som strider mot principerna är inte bruten och kräver ingen granskning. Krav som följer av lag gäller som förut: VAT-nummer, representation, ROT och RUT.';

export const PRINCIPER: string[] = [
  'Det kunden skickar in hör till verksamheten. Utgå från det utan att fråga, flagga eller kräva syfte eller koppling till ett uppdrag. Varna bara när något faktiskt talar emot: fakturan är ställd på en privatperson utan firmans namn, kunden har sagt att det är privat, eller köpet kan inte rimligen höra till verksamheten i kundbilden.',
  'Är inget annat känt är en faktura betald på fakturadatumet. Bokför på det utan anmärkning. Visar underlaget eller en bankrad ett annat betaldatum gäller det datumet.',
  'Flagga bara det som sannolikt är fel, inte det som i teorin kan vara annorlunda. Kan något ligga på två rimliga konton, välj det rimligaste. Det är ingen anmärkning.',
  'Det som syns i kundens andra underlag eller är allmänt känt om motparten behöver inte frågas.',
  'Kontobeskrivningarna är inte uttömmande. Exempel och sökord visar vad slags saker som hör till kontot. En sak hör dit om den är av samma slag eller fyller samma funktion i verksamheten, även om just det ordet inte nämns. Att ordet saknas är inget skäl till lägre säkerhet eller granskning.',
  'Inskickade underlag förutsätts avse verksamheten om inget konkret talar emot det. AI:n ska inte efterfråga privat fördelning enbart för att en vara eller tjänst även kan användas privat. Fördelning ska bara aktualiseras när det finns en konkret indikation på faktisk blandad användning, en tidigare dokumenterad fördelning eller ett särskilt lagkrav. Befintliga fördelningsbeslut i kundkontexten ska återanvändas. Om en ny fördelning verkligen behövs ska kunden tillfrågas en gång och svaret sparas för motsvarande framtida underlag.',
];

/**
 * Principerna konteringen använder. Byrån ändrar dem under Löpande bokföring →
 * Regler (tabellen kontoplan_principer), och laddaK1Andringar läser in dem när
 * en kontering börjar. Listan ovan gäller tills dess — den var utgångsläget.
 */
let aktuella: string[] = PRINCIPER;

export function anvandPrinciper(lista: string[]): void {
  aktuella = lista;
}

/** Principerna som ett textblock till AI-stegens instruktioner. */
export function byransPrinciper(): string {
  return `BYRÅNS PRINCIPER — ${PRINCIPER_INLEDNING.charAt(0).toLowerCase()}${PRINCIPER_INLEDNING.slice(1)}
${aktuella.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}
