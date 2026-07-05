// Testskript för inmail-API:et — kör med: node test-inmail.js
// Kräver att dev-servern körs på localhost:3000

const BASE_URL = 'http://localhost:3000';
const SECRET = process.env.INMAIL_SECRET || 'your-secret-here';
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || ''; // deploy-URL från GAS

async function callApi(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-inmail-secret': SECRET,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(`\n[${path}] Status: ${res.status}`);
  console.log('Response:', JSON.stringify(data, null, 2));
  if (data.replyBody) {
    console.log('\n--- MEJLSVAR ---');
    console.log(data.replyBody);
    console.log('--- SLUT ---');
  }
  return data;
}

// ─── Testfall ────────────────────────────────────────────────────────────────

const TESTS = {
  // Okänd användare frågar om pris
  unknown_price_question: () => callApi('/api/inmail', {
    senderEmail: 'okand@exempel.se',
    gmailThreadId: 'test-thread-001',
    messageId: 'test-msg-001',
    subject: 'Fråga om pris',
    emailBody: 'Hej vad kostar paketet?',
    attachments: [],
  }),

  // Känd användare visar transaktioner (byt till din riktiga e-post)
  view_transactions: () => callApi('/api/inmail', {
    senderEmail: 'erijoh05@gmail.com',
    gmailThreadId: 'test-thread-002',
    messageId: 'test-msg-002',
    subject: '',
    emailBody: 'visa mina transaktioner',
    attachments: [],
  }),

  // Känd användare ställer allmän fråga
  general_question: () => callApi('/api/inmail', {
    senderEmail: 'erijoh05@gmail.com',
    gmailThreadId: 'test-thread-003',
    messageId: 'test-msg-003',
    subject: 'Fråga om moms',
    emailBody: 'Hur funkar momsen om jag köpt något i Tyskland?',
    attachments: [],
  }),

  // Känd användare ställer en K1-fråga → ska trigga RAG-sökning i K1-vägledningen
  k1_question: () => callApi('/api/inmail', {
    senderEmail: 'erijoh05@gmail.com',
    gmailThreadId: 'test-thread-004',
    messageId: 'test-msg-004',
    subject: 'Avskrivning',
    emailBody: 'Hur ska jag hantera avskrivning på inventarier i mitt förenklade årsbokslut? Finns det något gränsvärde för direktavdrag?',
    attachments: [],
  }),
};

// Triggar GAS checkInbox — kör detta efter att du skickat ett riktigt mejl
async function triggerGAS() {
  if (!GAS_WEBHOOK_URL) {
    console.log('GAS_WEBHOOK_URL inte satt — sätt $env:GAS_WEBHOOK_URL="https://script.google.com/..."');
    return;
  }
  const url = `${GAS_WEBHOOK_URL}?secret=${encodeURIComponent(SECRET)}`;
  const res = await fetch(url);
  const text = await res.text();
  console.log('GAS trigger:', text);
}

// ─── Kör ─────────────────────────────────────────────────────────────────────

const test = process.argv[2];

if (!test || !TESTS[test]) {
  console.log('Tillgängliga test:');
  Object.keys(TESTS).forEach(k => console.log(`  node test-inmail.js ${k}`));
  console.log('\nKör alla:          node test-inmail.js all');
  console.log('Trigga GAS inbox:  node test-inmail.js trigger');
} else if (test === 'trigger') {
  triggerGAS();
} else if (test === 'all') {
  (async () => {
    for (const [name, fn] of Object.entries(TESTS)) {
      console.log(`\n════ ${name} ════`);
      await fn();
    }
  })();
} else {
  TESTS[test]();
}
