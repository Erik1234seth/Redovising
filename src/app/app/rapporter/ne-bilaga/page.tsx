'use client';

import { useState } from 'react';

const year = new Date().getFullYear();
const yearEnded = new Date() >= new Date(`${year}-12-31`);

const rows = [
  { kod: 'R1', label: 'Nettoomsättning', value: null },
  { kod: 'R2', label: 'Förändring av lager', value: null },
  { kod: 'R3', label: 'Övriga rörelseintäkter', value: null },
  { kod: 'R4', label: 'Råvaror och förnödenheter', value: null },
  { kod: 'R5', label: 'Handelsvaror', value: null },
  { kod: 'R6', label: 'Övriga externa kostnader', value: null },
  { kod: 'R7', label: 'Personalkostnader', value: null },
  { kod: 'R8', label: 'Av- och nedskrivningar', value: null },
  { kod: 'R9', label: 'Övriga rörelsekostnader', value: null },
  { kod: 'R10', label: 'Rörelseresultat', value: null, bold: true },
  { kod: 'R11', label: 'Finansiella intäkter', value: null },
  { kod: 'R12', label: 'Finansiella kostnader', value: null },
  { kod: 'R13', label: 'Resultat efter finansiella poster', value: null, bold: true },
];

export default function NEBilagaPage() {
  const [firstYear, setFirstYear] = useState(false);
  const [previousUploaded, setPreviousUploaded] = useState(false);

  const showPreviousWarning = !firstYear && !previousUploaded;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">NE-bilaga</h1>
          <p className="text-sm text-slate-400 mt-0.5">Uppdateras automatiskt · Räkenskapsår {year}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportera PDF
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Varning: året är inte avslutat */}
          {!yearEnded && (
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Ej slutgiltig NE-bilaga</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Räkenskapsåret {year} är inte avslutat. Värdena nedan är preliminära och uppdateras löpande när du lägger till transaktioner.
                </p>
              </div>
            </div>
          )}

          {/* Föregående NE-bilaga */}
          {!firstYear && (
            <div className={`rounded-xl border px-5 py-4 ${previousUploaded ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 items-start">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${previousUploaded ? 'bg-green-100' : 'bg-slate-100'}`}>
                    <svg className={`w-4 h-4 ${previousUploaded ? 'text-green-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {previousUploaded
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      }
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${previousUploaded ? 'text-green-800' : 'text-slate-800'}`}>
                      {previousUploaded ? `NE-bilaga ${year - 1} uppladdad` : `Ladda upp föregående NE-bilaga (${year - 1})`}
                    </p>
                    <p className={`text-sm mt-0.5 ${previousUploaded ? 'text-green-600' : 'text-slate-500'}`}>
                      {previousUploaded
                        ? 'Ingående värden är hämtade från föregående års bokslut.'
                        : `Behövs för att beräkna ingående värden och säkerställa att ${year} års NE-bilaga stämmer.`
                      }
                    </p>
                  </div>
                </div>
                {!previousUploaded && (
                  <button
                    onClick={() => setPreviousUploaded(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg flex-shrink-0 hover:opacity-90 transition-colors"
                    style={{ backgroundColor: '#3a5870' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Ladda upp
                  </button>
                )}
              </div>

              {/* Varning om ej uppladdad */}
              {showPreviousWarning && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <p className="text-xs text-amber-700">
                    NE-bilagan kan vara ofullständig utan föregående års ingående värden.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Första år-toggle */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-700">Det här är mitt första år som enskild firma</p>
              <p className="text-xs text-slate-400 mt-0.5">Ingen tidigare NE-bilaga behövs</p>
            </div>
            <button
              onClick={() => setFirstYear(f => !f)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${firstYear ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${firstYear ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Tabellen */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resultaträkning</p>
            </div>
            {rows.map(row => (
              <div
                key={row.kod}
                className={`flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0 ${row.bold ? 'bg-slate-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 w-8 font-mono">{row.kod}</span>
                  <span className={`text-sm ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{row.label}</span>
                </div>
                <span className={`text-sm font-mono ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                  {row.value ?? '0 kr'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            Värdena uppdateras automatiskt när du kontering transaktioner i Bokföring
          </p>
        </div>
      </div>
    </div>
  );
}
