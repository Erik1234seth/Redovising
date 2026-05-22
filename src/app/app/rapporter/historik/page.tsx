'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';
const currentYear = new Date().getFullYear();
const histYears = [currentYear - 1, currentYear - 2, currentYear - 3];

type DocType = 'ne-bilaga' | 'resultat' | 'balans' | 'huvudbok';
type StoredDoc = { id: string; file_name: string; file_path: string };

const docTypes: { type: DocType; label: string }[] = [
  { type: 'ne-bilaga', label: 'NE-bilaga' },
  { type: 'resultat',  label: 'Resultaträkning' },
  { type: 'balans',    label: 'Balansräkning' },
  { type: 'huvudbok',  label: 'Huvudbok' },
];

function docKey(year: number, type: DocType) {
  return `${year}-${type}`;
}

function DocIcon({ type }: { type: DocType }) {
  if (type === 'ne-bilaga') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  if (type === 'resultat') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
  if (type === 'balans') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5" />
    </svg>
  );
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

export default function HistorikPage() {
  const [docs, setDocs] = useState<Record<string, StoredDoc>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(currentYear - 1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ year: number; type: DocType } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_accounting_documents')
        .select('id, file_name, file_url, file_type, year')
        .eq('user_id', user.id)
        .in('year', histYears);

      const map: Record<string, StoredDoc> = {};
      for (const d of (data ?? [])) {
        const k = docKey(d.year, d.file_type as DocType);
        map[k] = { id: d.id, file_name: d.file_name, file_path: d.file_url };
      }
      setDocs(map);
      setLoading(false);
    });
  }, []);

  function triggerUpload(year: number, type: DocType) {
    pendingRef.current = { year, type };
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const pending = pendingRef.current;
    if (!file || !pending) return;
    e.target.value = '';

    const { year, type } = pending;
    const key = docKey(year, type);
    setUploading(key);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(null); return; }

    const filePath = `${user.id}/${year}/${type}/${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('historik-dokument')
      .upload(filePath, file, { upsert: true });

    if (storageError) { setUploading(null); return; }

    // Remove old record if any
    const existing = docs[key];
    if (existing) {
      await supabase.from('user_accounting_documents').delete().eq('id', existing.id);
    }

    const label = docTypes.find(d => d.type === type)?.label ?? type;
    const { data: newDoc } = await supabase
      .from('user_accounting_documents')
      .insert({ user_id: user.id, title: `${label} ${year}`, file_url: filePath, file_name: file.name, file_type: type, year })
      .select('id, file_name, file_url')
      .single();

    if (newDoc) {
      setDocs(prev => ({ ...prev, [key]: { id: newDoc.id, file_name: newDoc.file_name, file_path: newDoc.file_url } }));
    }
    setUploading(null);
  }

  async function handleDelete(year: number, type: DocType) {
    const key = docKey(year, type);
    const doc = docs[key];
    if (!doc) return;
    setDeleting(key);

    const supabase = createClient();
    await supabase.storage.from('historik-dokument').remove([doc.file_path]);
    await supabase.from('user_accounting_documents').delete().eq('id', doc.id);

    setDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
    setDeleting(null);
  }

  async function handleDownload(year: number, type: DocType) {
    const key = docKey(year, type);
    const doc = docs[key];
    if (!doc) return;

    const supabase = createClient();
    const { data } = await supabase.storage
      .from('historik-dokument')
      .createSignedUrl(doc.file_path, 3600);

    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Historik</h1>
        <p className="text-sm text-slate-400 mt-0.5">Tidigare räkenskapsår · NE-bilagor, RR, BR och huvudbok</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              Ladda upp dokument från tidigare räkenskapsår för att ha allt samlat. Föregående NE-bilaga
              används också för att beräkna ingående värden i innevarande år.
            </p>
          </div>

          {/* Pågående år */}
          <div
            className="rounded-xl px-5 py-4 flex items-center justify-between"
            style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1e4d6b 100%)` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Räkenskapsår {currentYear}</p>
                <p className="text-xs text-white/60 mt-0.5">Pågående · Uppdateras i realtid</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
              Aktiv
            </span>
          </div>

          {/* Tidigare år */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">Laddar...</span>
            </div>
          ) : histYears.map(y => {
            const uploadedCount = docTypes.filter(d => docs[docKey(y, d.type)]).length;
            const status = uploadedCount === 0 ? 'empty' : uploadedCount === docTypes.length ? 'complete' : 'partial';

            return (
              <div key={y} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === y ? null : y)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      status === 'complete' ? 'bg-green-100' : status === 'partial' ? 'bg-amber-100' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        status === 'complete' ? 'text-green-600' : status === 'partial' ? 'text-amber-500' : 'text-slate-400'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {status === 'complete'
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                        }
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">Räkenskapsår {y}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{uploadedCount}/{docTypes.length} dokument uppladdade</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status === 'complete' && <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Komplett</span>}
                    {status === 'partial' && <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">Delvis</span>}
                    {status === 'empty' && <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Tomt</span>}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded === y ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expanded === y && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {docTypes.map(dt => {
                      const key = docKey(y, dt.type);
                      const stored = docs[key];
                      const isUploading = uploading === key;
                      const isDeleting = deleting === key;

                      return (
                        <div key={dt.type} className={`flex items-center justify-between px-5 py-3.5 ${stored ? 'bg-green-50/30' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stored ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                              <DocIcon type={dt.type} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${stored ? 'text-slate-700' : 'text-slate-500'}`}>
                                {dt.label} {y}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {stored ? stored.file_name : 'Inte uppladdad'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {stored && (
                              <button
                                onClick={() => handleDownload(y, dt.type)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Ladda ned
                              </button>
                            )}
                            <button
                              disabled={isUploading || isDeleting}
                              onClick={() => stored ? handleDelete(y, dt.type) : triggerUpload(y, dt.type)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 ${
                                stored
                                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                  : 'text-white hover:opacity-90'
                              }`}
                              style={stored ? {} : { backgroundColor: NAV_BG }}
                            >
                              {isUploading ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                  Laddar upp...
                                </>
                              ) : isDeleting ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                  Tar bort...
                                </>
                              ) : stored ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Ta bort
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  Ladda upp
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-slate-400 text-center pb-4">
            Dokument sparas säkert och är tillgängliga när som helst
          </p>
        </div>
      </div>
    </div>
  );
}
