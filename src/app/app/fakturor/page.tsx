export default function FakturorPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Fakturor</h1>
          <p className="text-sm text-slate-400 mt-0.5">Skapa och hantera dina kundfakturor</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Kunder
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundColor: '#E95C63' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Ny faktura
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div
            className="grid px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100"
            style={{ gridTemplateColumns: '100px 1fr 130px 120px 100px' }}
          >
            <span>Faktura nr</span>
            <span>Kund</span>
            <span className="text-right">Belopp</span>
            <span>Förfallodatum</span>
            <span>Status</span>
          </div>

          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Inga fakturor ännu</p>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-5">
              Skapa din första faktura eller lägg till kunder för snabbare fakturering
            </p>
            <button className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundColor: '#E95C63' }}>
              Skapa faktura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
