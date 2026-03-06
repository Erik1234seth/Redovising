'use client';

import { useState } from 'react';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

// Deterministic "fake booked" — makes ~30% of slots appear booked
function isSlotFakeBooked(dateStr: string, time: string): boolean {
  let hash = 0;
  const s = dateStr + time;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return Math.abs(hash) % 10 < 3;
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun → convert to Mon=0
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

export default function BokaMote() {
  const today = new Date();
  // Min bookable date = today + 2
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 2);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'calendar' | 'form' | 'done'>('calendar');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function isSelectable(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false; // weekends
    return d >= minDate;
  }

  const availableSlots = selectedDate
    ? TIME_SLOTS.filter(t => !isSlotFakeBooked(selectedDate, t))
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/boka-mote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, date: selectedDate, time: selectedTime }),
      });
      if (!res.ok) throw new Error('Något gick fel');
      setStep('done');
    } catch {
      setError('Något gick fel. Försök igen eller maila oss direkt.');
    } finally {
      setLoading(false);
    }
  }

  function formatSelectedDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${CORAL}15` }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: NAV_BG }}>Möte bokat!</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            Vi ringer dig <strong className="text-slate-700">{formatSelectedDate(selectedDate!)} kl. {selectedTime}</strong>.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed">
            En bekräftelse har skickats till <strong className="text-slate-700">{form.email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div className="py-14 sm:py-16 px-4" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kostnadsfritt</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Boka ett möte med oss</h1>
          <p className="text-white/65 text-base sm:text-lg leading-relaxed mb-8">
            Är du osäker på vilket paket som passar, eller vill du bara ställa frågor innan du bestämmer dig? Vi ringer upp dig och hjälper dig att hitta rätt — utan press och utan kostnad.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
            {[
              { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', text: 'Vi hjälper dig välja rätt paket' },
              { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Kostnadsfritt, ingen bindning' },
              { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', text: 'Vi ringer upp dig på vald tid' },
            ].map(({ icon, text }) => (
              <div key={text} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg className="w-5 h-5 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
                </svg>
                <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step === 'calendar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="grid md:grid-cols-[1fr_auto] divide-y md:divide-y-0 md:divide-x divide-gray-100">

              {/* Calendar */}
              <div className="p-6 sm:p-8">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-6">
                  <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-base font-bold" style={{ color: NAV_BG }}>{MONTHS[viewMonth]} {viewYear}</span>
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = toDateStr(viewYear, viewMonth, day);
                    const selectable = isSelectable(day);
                    const isSelected = selectedDate === dateStr;
                    const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

                    return (
                      <button
                        key={day}
                        disabled={!selectable}
                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                        className="aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150"
                        style={
                          isSelected
                            ? { backgroundColor: NAV_BG, color: 'white', fontWeight: 700 }
                            : selectable
                            ? { color: '#1e293b', cursor: 'pointer' }
                            : { color: '#cbd5e1', cursor: 'default' }
                        }
                        onMouseEnter={e => { if (selectable && !isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = `${NAV_BG}12`; }}
                        onMouseLeave={e => { if (selectable && !isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {isToday && !isSelected
                          ? <span style={{ textDecoration: `underline`, textDecorationColor: CORAL, textUnderlineOffset: '3px' }}>{day}</span>
                          : day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div className="p-6 sm:p-8 md:w-52">
                <p className="text-sm font-bold mb-4" style={{ color: NAV_BG }}>
                  {selectedDate ? formatSelectedDate(selectedDate) : 'Välj ett datum'}
                </p>
                {!selectedDate && (
                  <p className="text-xs text-slate-400">Välj ett datum till vänster för att se tillgängliga tider.</p>
                )}
                {selectedDate && (
                  <div className="space-y-2">
                    {TIME_SLOTS.map(t => {
                      const booked = isSlotFakeBooked(selectedDate, t);
                      const isSelected = selectedTime === t;
                      return (
                        <button
                          key={t}
                          disabled={booked}
                          onClick={() => setSelectedTime(t)}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                          style={
                            booked
                              ? { backgroundColor: '#f1f5f9', color: '#cbd5e1', cursor: 'default', textDecoration: 'line-through' }
                              : isSelected
                              ? { backgroundColor: CORAL, color: 'white', boxShadow: `0 4px 12px ${CORAL}40` }
                              : { backgroundColor: `${NAV_BG}08`, color: NAV_BG }
                          }
                        >
                          {booked ? `${t} — Bokad` : t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Continue button */}
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4 border-t border-gray-100">
              <button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep('form')}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: NAV_BG, color: 'white' }}
              >
                {selectedDate && selectedTime
                  ? `Fortsätt — ${formatSelectedDate(selectedDate)} kl. ${selectedTime}`
                  : 'Välj datum och tid för att fortsätta'}
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Selected time summary */}
            <div className="px-6 sm:px-8 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Valt möte</p>
                <p className="text-sm font-bold" style={{ color: NAV_BG }}>
                  {formatSelectedDate(selectedDate!)} kl. {selectedTime}
                </p>
              </div>
              <button onClick={() => setStep('calendar')} className="text-xs font-semibold hover:underline" style={{ color: CORAL }}>
                Ändra
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Namn *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="För- och efternamn"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': `${NAV_BG}40` } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">E-post *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="din@email.se"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Telefon</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="070-000 00 00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Meddelande <span className="font-normal">(valfritt)</span></label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Har du frågor eller något du vill att vi förbereder?"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.01] disabled:opacity-60"
                style={{ backgroundColor: CORAL, boxShadow: `0 8px 24px ${CORAL}40` }}
              >
                {loading ? 'Bokar...' : 'Bekräfta bokning →'}
              </button>
              <p className="text-xs text-slate-400 text-center">Vi ringer upp dig på utsatt tid.</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
