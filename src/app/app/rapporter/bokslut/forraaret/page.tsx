'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';

const CORAL = '#E95C63';
const BLUE = '#2563EB';

type UploadedFile = { name: string; file: File };

export default function ForraAaretPage() {
  const [neBilaga, setNeBilaga] = useState<UploadedFile | null>(null);
  const [resultatBalans, setResultatBalans] = useState<UploadedFile | null>(null);
  const [neSparad, setNeSparad] = useState(false);
  const [rbSparad, setRbSparad] = useState(false);
  const [neDragging, setNeDragging] = useState(false);
  const [rbDragging, setRbDragging] = useState(false);

  const neInputRef = useRef<HTMLInputElement>(null);
  const rbInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = '.pdf,.xlsx,.xls,.jpg,.jpeg,.png';

  const handleNeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setNeDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setNeBilaga({ name: f.name, file: f });
  };

  const handleRbDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setRbDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setResultatBalans({ name: f.name, file: f });
  };

  const bothSaved = neSparad && rbSparad;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start gap-3 flex-shrink-0">
        <Link
          href="/rapporter?v=bokslut"
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0 mt-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Förra årets underlag</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vi behöver detta för att göra ett korrekt bokslut</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">

          {/* Intro */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              När det inte är ditt första bokslut behöver vi förra årets siffror som ingångsvärden. Det säkerställer att årets bokslut stämmer och att ingående balanser är rätt.
            </p>
          </div>

          {/* Steg 1 — NE-bilaga */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-blue-600">Steg 1</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Hitta din NE-bilaga</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  NE-bilagan är den bilaga du lämnade in med din deklaration förra året. Du hittar den hos Skatteverket, din tidigare revisor eller i din e-post.
                </p>

                {neSparad ? (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 truncate">{neBilaga?.name}</p>
                      <button onClick={() => { setNeSparad(false); setNeBilaga(null); }} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5">Ta bort</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => neInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setNeDragging(true); }}
                    onDragLeave={() => setNeDragging(false)}
                    onDrop={handleNeDrop}
                    className={`border-2 border-dashed rounded-xl px-5 py-6 text-center cursor-pointer transition-colors ${neDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <svg className="w-7 h-7 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {neBilaga ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-1 truncate">{neBilaga.name}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setNeSparad(true); }}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
                          style={{ backgroundColor: BLUE }}
                        >
                          Spara
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-500">Dra hit din NE-bilaga eller klicka för att välja</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, Excel, bild</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={neInputRef}
                  type="file"
                  accept={acceptedTypes}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setNeBilaga({ name: f.name, file: f }); }}
                />
              </div>
            </div>
          </div>

          {/* Steg 2 — Resultat- och balansrapport */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-emerald-600">Steg 2</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Hitta resultat- och balansrapporten</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Resultat- och balansrapporten visar vad företaget tjänade och ägde vid förra årets slut. Du fick den av oss eller din tidigare bokförare.
                </p>

                {rbSparad ? (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 truncate">{resultatBalans?.name}</p>
                      <button onClick={() => { setRbSparad(false); setResultatBalans(null); }} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5">Ta bort</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => rbInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setRbDragging(true); }}
                    onDragLeave={() => setRbDragging(false)}
                    onDrop={handleRbDrop}
                    className={`border-2 border-dashed rounded-xl px-5 py-6 text-center cursor-pointer transition-colors ${rbDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <svg className="w-7 h-7 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {resultatBalans ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-1 truncate">{resultatBalans.name}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setRbSparad(true); }}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
                          style={{ backgroundColor: BLUE }}
                        >
                          Spara
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-500">Dra hit rapporten eller klicka för att välja</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, Excel, bild</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={rbInputRef}
                  type="file"
                  accept={acceptedTypes}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setResultatBalans({ name: f.name, file: f }); }}
                />
              </div>
            </div>
          </div>

          {/* Steg 3 — Skicka in */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-orange-500">Steg 3</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Skicka in till oss</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Hittar du inte dokumenten ovan? Skicka dem till oss via mail så hjälper vi dig.
                </p>

                {bothSaved ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">Klart! Vi har fått båda dokumenten.</p>
                  </div>
                ) : (
                  <a
                    href="mailto:erik@enklabokslut.se"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: CORAL, color: 'white' }}
                  >
                    Skicka via mail
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm font-bold text-slate-700 mb-3">Bra att tänka på</p>
            <div className="space-y-2">
              {[
                'NE-bilagan hittar du på Skatteverkets hemsida under "Mina sidor"',
                'Har du haft en annan bokförare kan de skicka rapporterna direkt till oss',
                'Saknar du dokumenten helt? Hör av dig så löser vi det tillsammans',
                'Ingående balanser är viktiga — utan dem kan vi inte bokföra det nya året rätt',
              ].map(tip => (
                <div key={tip} className="flex items-start gap-2 text-sm text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  {tip}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
