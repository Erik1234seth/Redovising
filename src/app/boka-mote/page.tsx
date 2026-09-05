'use client';

import { useState, useEffect } from 'react';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

import { TIME_SLOTS, isSlotBooked, toDateStr, firstBookableDate, upcomingWeekdays } from '@/lib/meetingSlots';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'december'];

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
  // Min bookable date = today + 1
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1);

  const firstDate = firstBookableDate(minDate);

  const [viewYear, setViewYear] = useState(firstDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(firstDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    toDateStr(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'calendar' | 'form' | 'done'>('calendar');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  // På mobil visas som standard bara de närmaste dagarna, inte hela månaden.
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  useEffect(() => {
    fetch('/api/booked-slots').then(r => r.json()).then(d => setBookedSlots(d.slots ?? {}));
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const freeSlotsOn = (dateStr: string) =>
    TIME_SLOTS.filter(t => !isSlotBooked(dateStr, t, bookedSlots)).length;

  const freeCount = selectedDate ? freeSlotsOn(selectedDate) : 0;

  const upcoming = upcomingWeekdays(minDate, 10);

  function pickDate(dateStr: string, year: number, month: number) {
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setViewYear(year);
    setViewMonth(month);
  }

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


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    setError('');
    try {
      const sessionId = sessionStorage.getItem('analyticsSessionId') || null;
      const res = await fetch('/api/boka-mote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, date: selectedDate, time: selectedTime, sessionId }),
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
      <div className="py-10 sm:py-16 px-4" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kostnadsfritt</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Boka ett möte med oss</h1>
          <p className="text-white/65 text-sm sm:text-lg leading-relaxed">
            Är du osäker på vilket paket som passar, eller vill du bara ställa frågor innan du bestämmer dig? Vi ringer upp dig och hjälper dig att hitta rätt — utan press och utan kostnad.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {step === 'calendar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Kompakt datumrad — bara mobil */}
            <div className={`md:hidden px-4 pt-5 pb-4 border-b border-gray-100 ${showFullCalendar ? 'hidden' : ''}`}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Välj dag</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                {upcoming.map(d => {
                  const dateStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
                  const isSelected = selectedDate === dateStr;
                  const free = freeSlotsOn(dateStr);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => pickDate(dateStr, d.getFullYear(), d.getMonth())}
                      disabled={free === 0}
                      className="flex-shrink-0 w-[62px] py-2.5 rounded-xl text-center transition-all duration-150"
                      style={
                        isSelected
                          ? { backgroundColor: NAV_BG, color: 'white', border: `1.5px solid ${NAV_BG}` }
                          : free === 0
                          ? { backgroundColor: '#f8fafc', color: '#cbd5e1', border: '1.5px solid transparent' }
                          : { backgroundColor: 'white', color: NAV_BG, border: `1.5px solid ${NAV_BG}20` }
                      }
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {WEEKDAYS[(d.getDay() + 6) % 7]}
                      </span>
                      <span className="block text-lg font-extrabold leading-tight">{d.getDate()}</span>
                      <span className="block text-[10px] opacity-70">
                        {free === 0 ? 'fullt' : `${free} lediga`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowFullCalendar(true)}
                className="mt-3 text-xs font-semibold underline underline-offset-2"
                style={{ color: NAV_BG, opacity: 0.6 }}
              >
                Visa hela kalendern
              </button>
            </div>

            <div className="grid md:grid-cols-[1fr_340px] divide-y md:divide-y-0 md:divide-x divide-gray-100">

              {/* Calendar */}
              <div className={`p-6 sm:p-8 ${showFullCalendar ? '' : 'hidden md:block'}`}>
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
                        onClick={() => pickDate(dateStr, viewYear, viewMonth)}
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

                <button
                  onClick={() => setShowFullCalendar(false)}
                  className="md:hidden mt-4 text-xs font-semibold underline underline-offset-2"
                  style={{ color: NAV_BG, opacity: 0.6 }}
                >
                  Visa närmaste dagar
                </button>
              </div>

              {/* Time slots */}
              <div className="p-6 sm:p-8" style={{ backgroundColor: '#fbfcfe' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: CORAL }}>Välj en tid</p>
                <p className="text-lg font-extrabold mb-1 capitalize" style={{ color: NAV_BG }}>
                  {selectedDate ? formatSelectedDate(selectedDate) : 'Välj ett datum'}
                </p>
                {!selectedDate ? (
                  <p className="text-sm text-slate-400 mt-3">Välj ett datum i kalendern för att se lediga tider.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-5">
                      {freeCount === 0
                        ? 'Alla tider är bokade — välj ett annat datum'
                        : `${freeCount} av ${TIME_SLOTS.length} tider lediga`}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {TIME_SLOTS.map(t => {
                        const booked = isSlotBooked(selectedDate, t, bookedSlots);
                        const isSelected = selectedTime === t;
                        return (
                          <button
                            key={t}
                            disabled={booked}
                            onClick={() => setSelectedTime(t)}
                            className="w-full py-4 rounded-xl text-base font-bold transition-all duration-150"
                            style={
                              booked
                                ? { backgroundColor: '#f1f5f9', color: '#cbd5e1', cursor: 'default', textDecoration: 'line-through', border: '1.5px solid transparent' }
                                : isSelected
                                ? { backgroundColor: NAV_BG, color: 'white', border: `1.5px solid ${NAV_BG}`, boxShadow: `0 6px 16px ${NAV_BG}33` }
                                : { backgroundColor: 'white', color: NAV_BG, border: `1.5px solid ${NAV_BG}20`, cursor: 'pointer' }
                            }
                          >
                            <span className="inline-flex items-center justify-center gap-1.5">
                              {isSelected && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {t}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
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
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
