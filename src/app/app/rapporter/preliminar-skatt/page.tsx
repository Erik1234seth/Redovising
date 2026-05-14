export default function PreliminarSkattPage() {
  const rows = [
    { label: 'Beräknad nettoomsättning', value: '0 kr' },
    { label: 'Beräknade avdragsgilla kostnader', value: '0 kr' },
    { label: 'Beräknat överskott', value: '0 kr', bold: true },
    { label: 'Egenavgifter (ca 28,97 %)', value: '0 kr' },
    { label: 'Avdrag för egenavgifter', value: '0 kr' },
    { label: 'Beskattningsbar inkomst', value: '0 kr', bold: true },
    { label: 'Beräknad kommunalskatt', value: '0 kr' },
    { label: 'Beräknad statlig skatt', value: '0 kr' },
    { label: 'Total beräknad skatt', value: '0 kr', highlight: true },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Preliminär skatt</h1>
        <p className="text-sm text-slate-400 mt-0.5">Beräknas automatiskt · Räkenskapsår {new Date().getFullYear()}</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-700">
              Detta är en uppskattning baserad på dina konteringar. Den slutliga skatten beräknas av Skatteverket.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Skatteberäkning</p>
            </div>
            {rows.map(row => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0 ${
                  row.highlight ? 'bg-blue-50' : row.bold ? 'bg-slate-50' : ''
                }`}
              >
                <span className={`text-sm ${row.highlight || row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {row.label}
                </span>
                <span className={`text-sm font-mono ${row.highlight ? 'font-bold text-blue-700' : row.bold ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                  {row.value}
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
