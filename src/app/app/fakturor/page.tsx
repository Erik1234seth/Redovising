'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { valutaEtikett } from '@/lib/valuta';

const NAV_BG = '#173b57';

interface Faktura {
  id: string;
  faktura_nr: string;
  kund_namn: string;
  belopp_inkl_moms: number;
  husavdrag: { typ: 'rot' | 'rut'; att_betala: number } | null;
  forfallo_datum: string;
  faktura_datum: string;
  status: string;
  dokumenttyp: 'faktura' | 'offert';
  valuta: string | null;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  obetald:  { label: 'Obetald',  bg: '#FEF9C3', color: '#A16207' },
  betald:   { label: 'Betald',   bg: '#DCFCE7', color: '#166534' },
  forsenad: { label: 'Försenad', bg: '#FEE2E2', color: '#991B1B' },
  offert:   { label: 'Offert',   bg: '#E0E7FF', color: '#3730A3' },
  delbetald: { label: 'Delbetald', bg: '#FFEDD5', color: '#9A3412' },
  mojlig:   { label: 'Möjligen betald', bg: '#E0F2FE', color: '#075985' },
};

/** En betalning banken visar för fakturan (betalningskopplingar). */
interface Betalning {
  faktura_id: string;
  bank_datum: string;
  belopp: number;
  del: 'betalning' | 'skatteverket';
  typ: 'hel' | 'delbetalning' | 'overbetalning' | 'samlad';
  sakerhet: 'saker' | 'trolig' | 'forslag';
  kommentar: string | null;
}

async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
}

const kr = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });

/**
 * Vad banken säger om fakturan: betald, delbetald eller möjligen betald
 * (ett förslag som ingen tittat på), med datum. Null när banken inte visar
 * någon betalning — då gäller fakturans egen status.
 */
function bankStatus(f: Faktura, betalningar: Betalning[]) {
  const egna = betalningar.filter((b) => b.del === 'betalning');
  const skv = betalningar.filter((b) => b.del === 'skatteverket');
  const skvText = skv.length ? `Skatteverket betalade ${kr(skv.reduce((s, b) => s + Number(b.belopp), 0))} kr ${skv[skv.length - 1].bank_datum}` : null;
  if (!egna.length) return skvText ? { nyckel: null, rad: skvText, titel: null } : null;

  const senast = egna[egna.length - 1].bank_datum;
  const titel = egna.map((b) => [`${b.bank_datum}: ${kr(Number(b.belopp))} kr`, b.kommentar].filter(Boolean).join(' — ')).join('\n');
  if (egna.every((b) => b.sakerhet === 'forslag')) {
    return { nyckel: 'mojlig', rad: [`Bankrad ${senast} kan vara betalningen`, skvText].filter(Boolean).join(' · '), titel };
  }
  const attBetala = Number(f.husavdrag?.att_betala ?? f.belopp_inkl_moms);
  const betalt = egna.reduce((s, b) => s + Number(b.belopp), 0);
  const sek = !f.valuta || f.valuta.toUpperCase() === 'SEK';
  const delvis = egna.some((b) => b.typ === 'delbetalning') && (!sek || betalt < attBetala - 5);
  if (delvis) {
    return { nyckel: 'delbetald', rad: [sek ? `${kr(betalt)} av ${kr(attBetala)} kr, senast ${senast}` : `Delbetalning ${senast}`, skvText].filter(Boolean).join(' · '), titel };
  }
  return { nyckel: 'betald', rad: [`Enligt banken ${senast}`, skvText].filter(Boolean).join(' · '), titel };
}

export default function FakturorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fakturor, setFakturor] = useState<Faktura[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [betalningar, setBetalningar] = useState<Betalning[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  // Matchar fakturorna mot bankraderna. Listan visas direkt; betalningarna fylls i när de kommer.
  useEffect(() => {
    if (!user) return;
    api('/api/fakturor/betalningar', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.kopplingar) setBetalningar(data.kopplingar); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('fakturor')
      .select('id,faktura_nr,kund_namn,belopp_inkl_moms,husavdrag,forfallo_datum,faktura_datum,status,dokumenttyp,valuta')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setFakturor(data);
        setFetching(false);
      });
  }, [user]);

  async function raderaFaktura(id: string) {
    const supabase = createClient();
    await supabase.from('fakturor').delete().eq('id', id);
    setFakturor(prev => prev.filter(f => f.id !== id));
    setDeleteConfirmId(null);
  }

  async function uppdateraStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from('fakturor').update({ status }).eq('id', id);
    setFakturor(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }

  if (loading || !user) return null;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Faktura & offert</h1>
          <p className="text-slate-400 text-sm mt-2">Skapa och hantera dina fakturor och offerter</p>
        </div>
        <Link
          href="/fakturor/ny"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl mt-1 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: NAV_BG }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Skapa ny
        </Link>
      </div>

      <div className="px-8 pb-12">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fakturor.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="font-bold text-slate-700 mb-1">Inga fakturor eller offerter ännu</p>
              <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
                Skapa din första faktura eller offert med knappen uppe till höger
              </p>
              <Link
                href="/fakturor/ny"
                className="px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: NAV_BG }}
              >
                Skapa faktura eller offert
              </Link>
            </div>
          ) : (
            <>
              <div
                className="grid px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100"
                style={{ gridTemplateColumns: '110px 1fr 170px 150px 210px 80px' }}
              >
                <span>Nummer</span>
                <span>Kund</span>
                <span className="text-right">Belopp inkl. moms</span>
                <span className="pl-4">Förfaller / giltig</span>
                <span className="pl-4">Status</span>
                <span />
              </div>

              {fakturor.map(f => {
                const bank = f.status === 'offert' ? null : bankStatus(f, betalningar.filter((b) => b.faktura_id === f.id));
                // Kundens egen markering gäller först; annars det banken visar
                const nyckel = f.status === 'betald' || f.status === 'offert' ? f.status : bank?.nyckel ?? f.status;
                const st = STATUS_LABEL[nyckel] ?? STATUS_LABEL.obetald;
                const forfallen = nyckel === 'obetald' && new Date(f.forfallo_datum) < new Date();
                const effectiveSt = forfallen ? STATUS_LABEL.forsenad : st;
                const betaldEnligtBanken = nyckel === 'betald';
                return (
                  <div
                    key={f.id}
                    className="grid px-6 py-4 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                    style={{ gridTemplateColumns: '110px 1fr 170px 150px 210px 80px' }}
                  >
                    <span className="text-sm font-semibold text-slate-700">{f.faktura_nr}</span>
                    <span className="text-sm text-slate-600 truncate">{f.kund_namn}</span>
                    <span className="text-sm font-semibold text-slate-700 text-right">
                      {f.husavdrag && <span className="mr-1.5 text-[10px] font-bold uppercase text-emerald-600">{f.husavdrag.typ}</span>}
                      {Number(f.husavdrag?.att_betala ?? f.belopp_inkl_moms).toLocaleString('sv-SE')} {valutaEtikett(f.valuta)}
                    </span>
                    <span className="text-sm text-slate-500 pl-4">
                      {new Date(f.forfallo_datum).toLocaleDateString('sv-SE')}
                    </span>
                    <div className="pl-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                        style={{ backgroundColor: effectiveSt.bg, color: effectiveSt.color }}
                        title={bank?.titel ?? undefined}
                      >
                        {forfallen ? 'Försenad' : effectiveSt.label}
                      </span>
                      {f.status === 'offert' ? null : f.status === 'betald' || betaldEnligtBanken ? (
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-green-600 border-2 border-green-400 bg-green-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <button
                          onClick={() => uppdateraStatus(f.id, 'betald')}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 border-2 border-slate-300 bg-white hover:text-green-600 hover:border-green-400 hover:bg-green-50 transition-all"
                          title="Markera som betald"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {bank?.rad && <p className="mt-1 text-[11px] text-slate-400 leading-snug" title={bank.titel ?? undefined}>{bank.rad}</p>}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDeleteConfirmId(f.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Radera"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <Link
                        href={`/fakturor/${f.id}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 bg-slate-200 hover:text-slate-800 hover:bg-slate-300 transition-all"
                        title="Öppna"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {deleteConfirmId && (() => {
        const f = fakturor.find(x => x.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800 text-center mb-1">{f?.dokumenttyp === 'offert' ? 'Radera offert?' : 'Radera faktura?'}</h2>
              <p className="text-sm text-slate-500 text-center mb-6">
                {f?.dokumenttyp === 'offert' ? 'Offert' : 'Faktura'} <span className="font-semibold text-slate-700">{f?.faktura_nr}</span> till <span className="font-semibold text-slate-700">{f?.kund_namn}</span> raderas permanent och kan inte återställas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => raderaFaktura(deleteConfirmId)}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
                >
                  Radera
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
