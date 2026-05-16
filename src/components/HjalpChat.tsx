'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import MarkdownMessage from './MarkdownMessage';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'Vad är en NE-bilaga?',
  'Hur bokför jag ett köp?',
  'Hur skapar jag en faktura?',
  'Vad ska jag redovisa för moms?',
];

const PAGE_LABELS: Record<string, string> = {
  '/': 'Startsidan',
  '/bokforing': 'Bokföring',
  '/fakturor': 'Fakturor',
  '/rapporter/ne-bilaga': 'NE-bilaga',
  '/rapporter/moms': 'Momsrapport',
  '/lager': 'Lager & Tillgångar',
  '/konto': 'Mitt konto',
  '/hjalp': 'Hjälp',
};

export default function HjalpChat() {
  const pathname = usePathname();
  const onHjalpPage = pathname === '/hjalp';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const page = PAGE_LABELS[pathname] ?? pathname;

  async function send(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/hjalp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, page }),
      });

      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Något gick fel. Försök igen.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  const panel = (
    <div
      className="flex flex-col overflow-hidden border border-slate-200 shadow-2xl"
      style={{
        width: onHjalpPage ? '100%' : '380px',
        height: onHjalpPage ? '100%' : '520px',
        borderRadius: onHjalpPage ? '16px' : '16px',
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ backgroundColor: NAV_BG }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CORAL }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm leading-tight">Enkla Bokslut</p>
          <p className="text-white/50 text-xs">Hjälpassistent · {page}</p>
        </div>
        {!onHjalpPage && (
          <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Meddelanden */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-slate-400 text-center">Hej! Vad kan jag hjälpa dig med?</p>
            <div className="space-y-2">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-600"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={
                    m.role === 'user'
                      ? { backgroundColor: NAV_BG, color: 'white', borderBottomRightRadius: 4 }
                      : { backgroundColor: '#F1F5F9', color: '#334155', borderBottomLeftRadius: 4 }
                  }
                >
                  {m.content === '' && streaming && m.role === 'assistant' ? (
                    <span className="inline-flex gap-1 py-1">
                      {[0, 150, 300].map(d => (
                        <span
                          key={d}
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  ) : m.role === 'assistant' ? (
                    <MarkdownMessage content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder="Skriv din fråga..."
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
            style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Flytande knapp */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: open ? '#475569' : NAV_BG }}
        aria-label="Öppna hjälp"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Chat-panel (dropdown) */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50">
          {panel}
        </div>
      )}
    </>
  );
}
