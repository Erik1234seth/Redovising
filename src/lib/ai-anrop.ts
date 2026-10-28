/**
 * Två hjälpare för AI-stegen.
 *
 * `iKo` kör en lista med högst `antal` samtidigt, och nästa börjar så fort en
 * plats blir ledig. Omgångar om tre väntade på den långsammaste i varje
 * omgång innan nästa fick börja.
 *
 * `openaiFetch` är fetch mot OpenAI med nya försök när tjänsten säger åt oss
 * att vänta (429) eller är tillfälligt nere. När flera filer körs samtidigt
 * slår vi lättare i gränsen för anrop per minut, och då ska steget vänta och
 * försöka igen i stället för att misslyckas.
 */

export async function iKo<T, R>(lista: T[], antal: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const ut = new Array<R>(lista.length);
  let nasta = 0;
  await Promise.all(Array.from({ length: Math.min(antal, lista.length) }, async () => {
    while (nasta < lista.length) {
      const i = nasta++;
      ut[i] = await fn(lista[i], i);
    }
  }));
  return ut;
}

const FORSOK = 4;
const TILLFALLIGA = new Set([429, 500, 502, 503, 504]);

export async function openaiFetch(url: string, init: RequestInit): Promise<Response> {
  for (let forsok = 1; ; forsok++) {
    const res = await fetch(url, init);
    if (!TILLFALLIGA.has(res.status) || forsok === FORSOK) return res;
    // Tjänsten säger ofta hur länge; annars 5, 15 och 45 sekunder
    const sagt = Number(res.headers.get('retry-after'));
    const vanta = Number.isFinite(sagt) && sagt > 0 ? Math.min(sagt, 60) * 1000 : 5000 * 3 ** (forsok - 1);
    await res.body?.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, vanta));
  }
}
