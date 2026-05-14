export default function MomsPage() {
  const sections = [
    {
      title: 'Utgående moms (försäljning)',
      rows: [
        { label: 'Försäljning 25 %', value: '0 kr' },
        { label: 'Försäljning 12 %', value: '0 kr' },
        { label: 'Försäljning 6 %', value: '0 kr' },
        { label: 'Total utgående moms', value: '0 kr', bold: true },
      ],
    },
    {
      title: 'Ingående moms (inköp)',
      rows: [
        { label: 'Inköp med avdragsrätt', value: '0 kr' },
        { label: 'Total ingående moms', value: '0 kr', bold: true },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Momsrapport</h1>
          <p className="text-sm text-slate-400 mt-0.5">Uppdateras automatiskt · Räkenskapsår {new Date().getFullYear()}</p>
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
          {sections.map(section => (
            <div key={section.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section.title}</p>
              </div>
              {section.rows.map(row => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0 ${row.bold ? 'bg-slate-50' : ''}`}
                >
                  <span className={`text-sm ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{row.label}</span>
                  <span className={`text-sm font-mono ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <span className="font-bold text-slate-800">Moms att betala / få tillbaka</span>
              <span className="font-bold text-slate-800 font-mono">0 kr</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Värdena uppdateras automatiskt när du kontering transaktioner i Bokföring
          </p>
        </div>
      </div>
    </div>
  );
}
