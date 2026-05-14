export default function LagerPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lager & Tillgångar</h1>
          <p className="text-sm text-slate-400 mt-0.5">Inventarier, maskiner och lagervärde</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundColor: '#E95C63' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Lägg till
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div
            className="grid px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100"
            style={{ gridTemplateColumns: '1fr 120px 120px 120px 100px' }}
          >
            <span>Benämning</span>
            <span>Anskaffningsdatum</span>
            <span className="text-right">Anskaffningsvärde</span>
            <span className="text-right">Bokfört värde</span>
            <span>Typ</span>
          </div>

          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Inga tillgångar registrerade</p>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              Lägg till inventarier, maskiner och andra anläggningstillgångar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
