// Rensar ett mejl från citerad historik, signaturer och annat brus, så att
// det som blir kvar är det avsändaren själv skrev. Används av mailbanken och
// av mejlarkivet (mail_messages).

// Markörer som klipps vid direkt, så fort raden dyker upp.
//
// Mobilsignaturerna och `--` står med av samma skäl som citathuvudena: allt
// efter dem är brus, och just "Skickat från min iPhone" hamnade förut mitt i
// embeddingen och gjorde att två helt orelaterade mejl liknade varandra till
// 86 procent — de hade boilerplaten gemensam, inte innehållet.
const LINE_MARKERS = [
  /^[ \t]*-{2,}[ \t]*Vidarebefordrat mejl[ \t]*-{2,}[ \t]*$/m,
  /^[ \t]*-{2,}[ \t]*Forwarded message[ \t]*-{2,}/m,
  /^[ \t]*_{5,}[ \t]*$/m,
  /^[ \t]*Från:[ \t].+$/m,
  /^[ \t]*From:[ \t].+$/m,
  /^--[ \t]*$/m, // standardavgränsaren före en signatur
  /^[ \t]*Skickat från min /mi,
  /^[ \t]*Sent from my /mi,
  /^[ \t]*(?:Skickat|Hämta|Skaffa) (?:från|för) Outlook /mi,
  /^[ \t]*Get Outlook for /mi,
  /^[ \t]*Detta mejl kan innehålla konfidentiell/mi,

  // Citathuvud från Gmail på ungerska. En av kunderna har sin Gmail inställd
  // så, och då hjälper varken det svenska eller det engelska mönstret. Raden
  // inleds med avsändarens namn i stället för ett datum, så här matchas hela
  // raden fram till frasen och klippet hamnar ändå vid radens början.
  /^[^\n]*\bezt írta \(időpont:/mi,

  // Avslutningsfraser. Allt efter dem är signatur, inte innehåll. Gäller både
  // kundens mejl (id=3 och id=4 slutade med avsändarens egen signatur) och
  // våra egna svar, där signaturen annars motsäger reply-rules.ts som
  // uttryckligen förbjuder modellen att skriva någon.
  /^[ \t]*Med[ \t]+vänlig(?:a|t)?[ \t]+hälsning(?:ar)?\b/mi,
  /^[ \t]*(?:Vänliga|Bästa|Varma)[ \t]+hälsningar\b/mi,
  /^[ \t]*Hälsningar\b/mi,
  /^[ \t]*Hälsar\b/mi,
  /^[ \t]*Mvh\b/mi,
  /^[ \t]*M\.[ \t]*v\.[ \t]*h\.?/mi,
  /^[ \t]*(?:Best|Kind)[ \t]+regards\b/mi,
  /^[ \t]*Sincerely\b/mi,

  // "Vänligen" bara när den står ensam på raden. Som inledning är den nästan
  // alltid en uppmaning ("Vänligen återkom med...") och inte en avslutning,
  // och då hade ett klipp tagit bort resten av mejlet.
  /^[ \t]*Vänligen[ \t]*[,!.]?[ \t]*$/mi,
];

// Citathuvuden ("Den mån 22 aug. 2026 kl. 11:31 skrev Erik <...>:").
//
// De gamla mönstren krävde att raden SLUTADE på "skrev ...:" respektive
// "wrote:". Det höll inte: Gmail radbryter vid 78 tecken, så huvudet delas ofta
// mitt itu och "wrote:" hamnar på egen rad. Då matchade ingenting, och hela den
// citerade historiken följde med in i embeddingen.
//
// Nu matchas bara BÖRJAN av huvudet — datumet — och nyckelordet ("skrev"/
// "wrote") krävs inom ett kort fönster efteråt. Radbrytning spelar därmed ingen
// roll, samtidigt som en rad som råkar inledas med ett datum inte klipper bort
// halva mejlet på egen hand.
//
// Täcker de varianter som faktiskt förekommer i vår Skickat-mapp:
//   Den lör 22 aug. 2026 04:38Erik på Enkla Bokslut <...> skrev:
//   lör 22 aug. 2026 kl. 11:31 skrev Erik på EnklaBokslut <...>
//   26 aug. 2026 kl. 10:03 skrev Erik på Enkla Bokslut <...>:   (iPhone)
//   On Sat, Aug 22, 2026 at 5:58 AM Thomas Hahn <...> wrote:
const QUOTE_STARTS: Array<[RegExp, RegExp]> = [
  [/^[ \t]*(?:Den[ \t]+)?(?:mån|tis|ons|tors|fre|lör|sön)[a-zåäö]*\.?[ \t]+\d{1,2}[ \t]/gim, /\bskrev\b/i],
  [/^[ \t]*(?:Den[ \t]+)?\d{1,2}[ \t]+[a-zåäö]{3,}\.?[ \t]+\d{4}[ \t]/gim, /\bskrev\b/i],
  [/^[ \t]*On[ \t]+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?[ \t]/gim, /\bwrote\b/i],
];

const QUOTE_WINDOW = 300;

// Var slutar det avsändaren själv skrev? Returnerar index för den tidigaste
// markören, eller textens längd om ingen hittas.
function findCutIndex(text: string): number {
  let cut = text.length;

  for (const marker of LINE_MARKERS) {
    const m = text.match(marker);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }

  for (const [start, keyword] of QUOTE_STARTS) {
    start.lastIndex = 0; // modulnivå-regex behåller lastIndex mellan anrop
    let m: RegExpExecArray | null;
    while ((m = start.exec(text)) !== null) {
      if (m.index >= cut) break;
      if (keyword.test(text.slice(m.index, m.index + QUOTE_WINDOW))) {
        cut = m.index;
        break;
      }
    }
  }

  return cut;
}

// Tar bort citerad historik, signaturer och annat brus så att embeddingen
// bygger på det kunden faktiskt skrev.
export function cleanBody(raw: string): string {
  const text = raw.replace(/\r/g, '');

  return text
    .slice(0, findCutIndex(text))
    .split('\n')
    .filter((line) => !/^\s*>/.test(line)) // citerade rader
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
