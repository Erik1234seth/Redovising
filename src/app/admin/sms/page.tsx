'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatPhone } from '@/lib/sms/phone';

interface Message {
  id: string;
  phone: string;
  direction: 'in' | 'out';
  body: string;
  status: string | null;
  error: string | null;
  user_id: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

interface Optout {
  phone: string;
  created_at: string;
}

interface Conversation {
  phone: string;
  messages: Message[];
  last: Message;
  name: string | null;
  isCustomer: boolean;
}

export default function SmsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [optouts, setOptouts] = useState<Optout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/sms')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setMessages(data.messages || []);
          setOptouts(data.optouts || []);
        }
        setLoading(false);
      });
  }, []);

  const conversations = useMemo<Conversation[]>(() => {
    const byPhone = new Map<string, Message[]>();
    // API:t levererar nyast först — vänd så varje konversation läses uppifrån och ned
    for (const m of [...messages].reverse()) {
      const list = byPhone.get(m.phone) ?? [];
      list.push(m);
      byPhone.set(m.phone, list);
    }
    return [...byPhone.entries()]
      .map(([phone, msgs]) => {
        const withProfile = msgs.find((m) => m.profiles);
        return {
          phone,
          messages: msgs,
          last: msgs[msgs.length - 1],
          name: withProfile?.profiles?.full_name ?? null,
          isCustomer: msgs.some((m) => m.user_id),
        };
      })
      .sort((a, b) => +new Date(b.last.created_at) - +new Date(a.last.created_at));
  }, [messages]);

  const optoutSet = useMemo(() => new Set(optouts.map((o) => o.phone)), [optouts]);
  const active = conversations.find((c) => c.phone === selected) ?? conversations[0] ?? null;

  const failed = messages.filter((m) => m.status === 'failed' || m.status === 'rate_limited').length;

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">SMS</h1>
        <p className="text-warm-400 mt-1 text-sm">
          {conversations.length} konversationer · {messages.length} meddelanden
          {optouts.length > 0 && <> · {optouts.length} avregistrerade</>}
          {failed > 0 && <span className="text-red-400"> · {failed} misslyckade</span>}
        </p>
        <p className="text-warm-500 mt-2 text-xs">
          AI:n svarar automatiskt. Det du ser här har redan skickats.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-16 text-warm-400">
          Inga SMS ännu
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,20rem)_1fr] gap-4 items-start">
          {/* Konversationslista */}
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
            {conversations.map((c) => {
              const isActive = active?.phone === c.phone;
              return (
                <button
                  key={c.phone}
                  onClick={() => setSelected(c.phone)}
                  className={`w-full text-left px-4 py-3 border-b border-navy-600/50 transition-colors ${
                    isActive ? 'bg-navy-600/60' : 'hover:bg-navy-700/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-sm truncate">
                      {c.name || formatPhone(c.phone)}
                    </span>
                    <span className="text-warm-500 text-[11px] shrink-0">
                      {new Date(c.last.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {c.isCustomer ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400">Kund</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400">Prospekt</span>
                    )}
                    {optoutSet.has(c.phone) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400">Avreg</span>
                    )}
                  </div>
                  <p className="text-warm-400 text-xs mt-1.5 line-clamp-2">{c.last.body}</p>
                </button>
              );
            })}
          </div>

          {/* Vald konversation */}
          {active && (
            <div className="bg-navy-700/50 border border-navy-600 rounded-xl flex flex-col max-h-[70vh]">
              <div className="px-5 py-3 border-b border-navy-600 shrink-0">
                <div className="text-white font-medium">{active.name || formatPhone(active.phone)}</div>
                <div className="text-warm-500 text-xs">
                  {formatPhone(active.phone)}
                  {active.messages.find((m) => m.profiles)?.profiles?.email && (
                    <> · {active.messages.find((m) => m.profiles)?.profiles?.email}</>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                {active.messages.map((m) => {
                  const out = m.direction === 'out';
                  const broken = m.status === 'failed' || m.status === 'rate_limited';
                  return (
                    <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${out ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                            broken
                              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                              : out
                                ? 'bg-gold-500 text-navy-900 rounded-br-sm'
                                : 'bg-navy-600 text-warm-100 rounded-bl-sm'
                          }`}
                        >
                          {m.body}
                          {m.error && <div className="mt-1.5 text-xs opacity-80">{m.error}</div>}
                        </div>
                        <span className="text-warm-600 text-[11px] px-1">
                          {new Date(m.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                          {m.status === 'rate_limited' && ' · stoppad av spärren'}
                          {out && m.body.length > 160 && ` · ${Math.ceil(m.body.length / 153)} segment`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
