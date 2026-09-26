import { isValidShop } from '@/lib/shopify/auth';

/**
 * Appsidan som Shopify visar inne i butikens admin (appens "App URL").
 *
 * Egen HTML i stället för en Next-sida: rotlayouten laddar Google Analytics
 * och Meta-pixeln, och sådant hör inte hemma inne i Shopify-admin. Sidan
 * pratar med /api/shopify/session och legitimerar sig med App Bridges
 * session token — inga cookies, eftersom de blockeras i Shopifys iframe.
 */

export const dynamic = 'force-dynamic';

const PAGE = (apiKey: string) => `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="shopify-api-key" content="${apiKey}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<title>Enkla Bokslut</title>
<style>
  :root { --navy: #173b57; --coral: #E95C63; --text: #1e293b; --muted: #64748b; --line: #e2e8f0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 8px; }
  p { margin: 0 0 12px; color: var(--muted); }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; }
  .badge.off { background: #fef3c7; color: #b45309; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0 0; }
  dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  dd { margin: 2px 0 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  button { border: 0; border-radius: 8px; padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer; color: #fff; background: var(--navy); }
  button.primary { background: var(--coral); }
  button.plain { background: #f1f5f9; color: var(--muted); }
  button:disabled { opacity: .6; cursor: default; }
  .msg { border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; font-weight: 500; }
  .msg.ok { background: #ecfdf5; color: #047857; }
  .msg.fel { background: #fff1f2; color: #be123c; }
  ul { margin: 0; padding-left: 18px; color: var(--muted); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <div class="card">
    <h1>Enkla Bokslut</h1>
    <p>Butikens försäljning, returer, avgifter och utbetalningar bokförs automatiskt som en dagskassa per dag i din bokföring hos Enkla Bokslut.</p>
  </div>

  <div id="msg" class="msg" hidden></div>

  <div id="laddar" class="card"><p>Laddar…</p></div>

  <div id="ej-kopplad" class="card" hidden>
    <h2>Koppla butiken till ditt konto <span class="badge off">Ej kopplad</span></h2>
    <p>Logga in på ditt konto hos Enkla Bokslut i en ny flik så kopplas butiken dit. Har du inget konto skapar du ett där.</p>
    <div class="actions">
      <button id="koppla" class="primary">Koppla till Enkla Bokslut</button>
    </div>
  </div>

  <div id="kopplad" class="card" hidden>
    <h2>Kopplad till Enkla Bokslut <span class="badge">Aktiv</span></h2>
    <p>Vi hämtar butikens nya ordrar varje morgon.</p>
    <dl>
      <div><dt>Konto</dt><dd id="email">–</dd></div>
      <div><dt>Senast hämtad</dt><dd id="synkad">–</dd></div>
    </dl>
    <p id="fel" style="color:#be123c;margin-top:12px" hidden></p>
    <div class="actions">
      <button id="synka">Hämta nu</button>
      <button id="koppla-bort" class="plain">Koppla bort från kontot</button>
    </div>
  </div>

  <div class="card">
    <h2>Det här hämtar appen</h2>
    <ul>
      <li>Ordrar: belopp, moms per momssats, frakt, presentkort och betalsätt</li>
      <li>Returer och återbetalningar</li>
      <li>Shopify Payments avgifter och utbetalningar</li>
    </ul>
    <p style="margin-top:12px">Appen läser aldrig dina kunders namn, e-post eller adresser.</p>
  </div>
</main>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var busy = false;

  function tid(iso) {
    return iso ? new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
  }
  function meddela(text, ok) {
    var el = $('msg');
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'fel');
    el.hidden = !text;
  }
  async function api(method, body) {
    var token = await shopify.idToken();
    var res = await fetch('/api/shopify/session', {
      method: method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Något gick fel');
    return data;
  }

  var vantar = null;
  async function ladda() {
    var s = await api('GET');
    $('laddar').hidden = true;
    $('ej-kopplad').hidden = s.kopplad;
    $('kopplad').hidden = !s.kopplad;
    $('email').textContent = s.email || '–';
    $('synkad').textContent = tid(s.senast_synkad_at);
    $('fel').textContent = s.senaste_fel || '';
    $('fel').hidden = !s.senaste_fel;
    if (s.kopplad && vantar) {
      clearInterval(vantar);
      vantar = null;
      meddela('Butiken är kopplad! Vi hämtar försäljningen nu.', true);
      synka();
    }
    return s;
  }

  async function synka() {
    if (busy) return;
    busy = true;
    $('synka').disabled = true;
    $('synka').textContent = 'Hämtar…';
    try {
      var r = await api('POST', { action: 'synka' });
      meddela(r.klar
        ? 'Klart! ' + r.ordrar + ' ordrar hämtade och ' + r.dagar + ' dagar bokförda.'
        : r.ordrar + ' ordrar hämtade. Det finns fler — tryck Hämta nu igen för att fortsätta.', true);
    } catch (e) {
      meddela(e.message, false);
    }
    busy = false;
    $('synka').disabled = false;
    $('synka').textContent = 'Hämta nu';
    ladda().catch(function () {});
  }

  $('koppla').onclick = async function () {
    try {
      var r = await api('POST', { action: 'kod' });
      window.open(r.url, '_blank');
      meddela('Logga in i fliken som öppnades. Den här sidan uppdateras när butiken är kopplad.', true);
      if (!vantar) vantar = setInterval(function () { ladda().catch(function () {}); }, 4000);
    } catch (e) {
      meddela(e.message, false);
    }
  };
  $('synka').onclick = synka;
  $('koppla-bort').onclick = async function () {
    if (busy) return;
    try {
      await api('POST', { action: 'koppla-bort' });
      meddela('Butiken är bortkopplad. Det som redan är bokfört ligger kvar.', true);
      await ladda();
    } catch (e) {
      meddela(e.message, false);
    }
  };

  if (window.top === window.self) {
    $('laddar').innerHTML = '<p>Öppna appen från Appar i din Shopify-admin.</p>';
    return;
  }
  ladda().catch(function (e) {
    $('laddar').hidden = true;
    meddela(e.message, false);
  });
})();
</script>
</body>
</html>`;

export function GET(request: Request) {
  const shop = new URL(request.url).searchParams.get('shop');
  // Sidan får bara bäddas in i den egna butikens admin
  const ancestors = isValidShop(shop)
    ? `https://${shop} https://admin.shopify.com`
    : 'https://*.myshopify.com https://admin.shopify.com';

  return new Response(PAGE(process.env.SHOPIFY_CLIENT_ID ?? ''), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `frame-ancestors ${ancestors};`,
      'Cache-Control': 'no-store',
    },
  });
}
