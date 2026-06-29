'use client';

import { useState, useEffect } from 'react';

interface Thread {
  id: string;
  gmail_thread_id: string;
  user_id: string | null;
  state: string | null;
  transaction_ids: string[];
  created_at: string;
  updated_at: string;
  profiles: { email: string; full_name: string | null } | null;
}

interface Prospect {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export default function InmailPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/inmail')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setThreads(data.threads || []);
          setProspects(data.prospects || []);
        }
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const activeProspects = prospects.filter(p => !p.used_at && new Date(p.expires_at) > now);

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Inmail</h1>
        <p className="text-warm-400 mt-1 text-sm">{activeProspects.length} aktiva prospekts · {threads.length} e-posttrådar</p>
      </div>

      {/* Prospects */}
      <div>
        <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">
          Prospekts <span className="text-warm-600 font-normal normal-case tracking-normal">({activeProspects.length} aktiva)</span>
        </h2>
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
          {prospects.length === 0 ? (
            <div className="text-center py-12 text-warm-400">Inga prospekts ännu</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-600 text-warm-400 text-left">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Källa</th>
                    <th className="px-4 py-3 font-medium">Skapat</th>
                    <th className="px-4 py-3 font-medium">Utgår</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map(p => {
                    const expired = new Date(p.expires_at) < now;
                    return (
                      <tr key={p.id} className="border-b border-navy-600/50 hover:bg-navy-700/20 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{p.email}</td>
                        <td className="px-4 py-3 text-warm-400">{p.source || '—'}</td>
                        <td className="px-4 py-3 text-warm-400 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString('sv-SE')}</td>
                        <td className="px-4 py-3 text-warm-400 whitespace-nowrap">{new Date(p.expires_at).toLocaleDateString('sv-SE')}</td>
                        <td className="px-4 py-3">
                          {p.used_at ? (
                            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-500/20 text-green-400">Registrerad</span>
                          ) : expired ? (
                            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-400">Utgången</span>
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-400">Aktiv länk</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Email threads */}
      <div>
        <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">
          E-postkonversationer <span className="text-warm-600 font-normal normal-case tracking-normal">({threads.length} trådar)</span>
        </h2>
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
          {threads.length === 0 ? (
            <div className="text-center py-12 text-warm-400">Inga konversationer ännu</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-600 text-warm-400 text-left">
                    <th className="px-4 py-3 font-medium">Användare</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Transaktioner</th>
                    <th className="px-4 py-3 font-medium">Senast aktiv</th>
                  </tr>
                </thead>
                <tbody>
                  {threads.map(t => {
                    const isProspect = t.state?.startsWith('prospect:');
                    const isPendingDelete = t.state?.startsWith('pending_delete:');
                    return (
                      <tr key={t.id} className="border-b border-navy-600/50 hover:bg-navy-700/20 transition-colors">
                        <td className="px-4 py-3">
                          {t.profiles ? (
                            <>
                              <div className="text-white font-medium">{t.profiles.full_name || t.profiles.email}</div>
                              {t.profiles.full_name && <div className="text-xs text-warm-500">{t.profiles.email}</div>}
                            </>
                          ) : isProspect ? (
                            <div className="text-warm-400 italic">{t.state?.replace('prospect:', '')}</div>
                          ) : (
                            <div className="text-warm-500">—</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.state ? (
                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                              isProspect ? 'bg-purple-500/20 text-purple-400' :
                              isPendingDelete ? 'bg-red-500/20 text-red-400' :
                              'bg-navy-600 text-warm-300'
                            }`}>
                              {isProspect ? 'Prospekt' : isPendingDelete ? 'Väntar radering' : t.state}
                            </span>
                          ) : <span className="text-warm-500">—</span>}
                        </td>
                        <td className="px-4 py-3 text-warm-300">{t.transaction_ids?.length ?? 0} st</td>
                        <td className="px-4 py-3 text-warm-400 whitespace-nowrap">
                          {new Date(t.updated_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
