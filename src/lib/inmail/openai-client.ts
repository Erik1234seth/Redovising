const OPENAI_API_KEY = () => process.env.OPENAI_API_KEY!;

export async function callOpenAI(options: {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  responseFormat?: { type: 'json_object' | 'text' };
  maxTokens?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    max_completion_tokens: options.maxTokens ?? 2000,
  };
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error('Kunde inte tolka AI-svaret som JSON');
  }
}

export function formatAmount(n: number): string {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}
