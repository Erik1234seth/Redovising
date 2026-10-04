import Anthropic from '@anthropic-ai/sdk';

/**
 * De två modellerna som konterar, bakom samma anrop.
 *
 * Båda kör båda passen med samma prompter, så att svaren går att jämföra rad
 * för rad. Svaret tvingas till ett JSON-schema hos båda leverantörerna — då
 * behöver vi aldrig gissa oss fram i fritext.
 *
 * Båda tänker på nivån high. Med max tog en transaktion upp till 4,5
 * minuter, och den måste hinna klart inom Vercels fem minuter.
 */

export const MODELLER = ['gpt-5.5', 'claude-opus-5-5'] as const;
export type Modell = (typeof MODELLER)[number];

export interface Svar<T> {
  data: T;
  /** Modellen som faktiskt svarade — kan skilja sig om Claude lämnade över vid en vägran. */
  modell: string;
}

let anthropic: Anthropic | null = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY saknas');
  anthropic ??= new Anthropic();
  return anthropic;
}

/**
 * Systemprompten i två delar: den fasta (instruktion och kontoplan) först och
 * det som skiljer mellan kunder sist, så att den fasta delen kan cachas och
 * inte läses om för varje rad.
 */
export interface System {
  fast: string;
  kund: string;
}

async function fragaGpt<T>(system: System, user: string, namn: string, schema: object): Promise<Svar<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-5.5',
      reasoning_effort: 'high',
      response_format: { type: 'json_schema', json_schema: { name: namn, strict: true, schema } },
      messages: [
        { role: 'system', content: [system.fast, system.kund].filter(Boolean).join('\n\n') },
        { role: 'user', content: user },
      ],
      max_completion_tokens: 32000,
    }),
  });
  if (!res.ok) throw new Error(`gpt-5.5 svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  const choice = json.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`gpt-5.5 vägrade: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') throw new Error('gpt-5.5 hann inte svara klart');
  return { data: JSON.parse(choice?.message?.content ?? '') as T, modell: json.model ?? 'gpt-5.5' };
}

async function fragaClaude<T>(system: System, user: string, schema: object): Promise<Svar<T>> {
  // Strömmat, eftersom tänkandet kan ta längre tid än ett
  // vanligt anrop hinner vänta. Vid en vägran tar en annan modell över i
  // samma anrop (fallbacks), och vilken som svarade sparas.
  const stream = claude().beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: [
      { type: 'text', text: system.fast, cache_control: { type: 'ephemeral', ttl: '1h' } },
      ...(system.kund ? [{ type: 'text' as const, text: system.kund }] : []),
    ],
    messages: [{ role: 'user', content: user }],
  } as Anthropic.Beta.Messages.MessageCreateParamsStreaming);
  const msg = await stream.finalMessage();

  if (msg.stop_reason === 'refusal') throw new Error('claude-opus-5-5 vägrade svara');
  if (msg.stop_reason === 'max_tokens') throw new Error('claude-opus-5-5 hann inte svara klart');
  const text = msg.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('claude-opus-5-5 gav inget svar');
  return { data: JSON.parse(text.text) as T, modell: msg.model };
}

export function fraga<T>(modell: Modell, o: { system: System; user: string; namn: string; schema: object }): Promise<Svar<T>> {
  return modell === 'gpt-5.5'
    ? fragaGpt<T>(o.system, o.user, o.namn, o.schema)
    : fragaClaude<T>(o.system, o.user, o.schema);
}
