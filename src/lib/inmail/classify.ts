import { callOpenAI, parseJSON } from './openai-client';

export type Intent =
  | 'NEW_TRANSACTION'    // skickar kvitto/faktura att bokföra
  | 'EDIT_TRANSACTION'   // vill ändra en befintlig transaktion
  | 'DELETE_TRANSACTION' // vill ta bort en transaktion
  | 'VIEW_TRANSACTIONS'  // vill se sina transaktioner
  | 'GENERAL_QUESTION'   // allmän fråga om bokföring/tjänsten
  | 'CONFIRM_ACTION'     // bekräftar en väntande åtgärd (t.ex. "ja", "stämmer")
  | 'CANCEL_ACTION'      // avbryter en väntande åtgärd (t.ex. "nej", "avbryt")
  | 'UNCLEAR';           // oklart — behöver förtydligande

export interface ClassifyResult {
  intent: Intent;
  confidence: number; // 0–1
  reasoning: string;
}

export async function classifyIntent(params: {
  subject: string;
  body: string;
  hasAttachments: boolean;
  pendingState?: string | null;
}): Promise<ClassifyResult> {
  const { subject, body, hasAttachments, pendingState } = params;

  const systemPrompt = `Du klassificerar avsikten (intent) i mejl skickade till en bokföringstjänst för enskilda firmor.

Möjliga intents:
- NEW_TRANSACTION: Skickar kvitto, faktura eller annat underlag att bokföra (ofta med bilaga)
- EDIT_TRANSACTION: Vill ändra/korrigera en befintlig bokförd transaktion
- DELETE_TRANSACTION: Vill ta bort/radera en transaktion
- VIEW_TRANSACTIONS: Vill se lista på sina bokförda transaktioner
- GENERAL_QUESTION: Allmän fråga om bokföring, moms, tjänsten, sitt konto, etc.
- CONFIRM_ACTION: Bekräftar något väntande (t.ex. "ja", "stämmer", "ta bort det", "ok")
- CANCEL_ACTION: Avbryter något väntande (t.ex. "nej", "avbryt", "behåll det", "glöm det")
- UNCLEAR: Oklart eller off-topic mejl

${pendingState ? `VIKTIGT: Det finns en väntande åtgärd: "${pendingState}". Avgör om mejlet bekräftar (CONFIRM_ACTION) eller avbryter (CANCEL_ACTION) denna.` : ''}

Returnera JSON med exakt dessa fält:
{
  "intent": "...",
  "confidence": 0.0,
  "reasoning": "kort förklaring på svenska"
}`;

  const userMsg = `Ämne: ${subject || '(inget ämne)'}
Bilagor: ${hasAttachments ? 'ja' : 'nej'}
Mejltext:
${body.slice(0, 1500)}`;

  try {
    const raw = await callOpenAI({
      model: 'o3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 500,
    });

    return parseJSON<ClassifyResult>(raw);
  } catch {
    // Fallback: om klassificering misslyckas, anta NEW_TRANSACTION om det finns bilaga
    return {
      intent: hasAttachments ? 'NEW_TRANSACTION' : 'UNCLEAR',
      confidence: 0.3,
      reasoning: 'Klassificering misslyckades — fallback-logik',
    };
  }
}
