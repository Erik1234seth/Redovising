'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TIME_SLOTS, isSlotBooked } from '@/lib/meetingSlots';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function TidPage() {
  const router = useRouter();
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 2);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch('/api/booked-slots').then(r => r.json()).then(d => setBookedSlots(d.slots ?? {}));
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = (() => { const d = new Date(viewYear, viewMonth, 1).getDay(); return (d + 6) % 7; })();

  function isSelectable(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    return d.getDay() !== 0 && d.getDay() !== 6 && d >= minDate;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function handleContinue() {
    if (!selectedDate || !selectedTime) return;
    sessionStorage.setItem('meetingDate', selectedDate);
    sessionStorage.setItem('meetingTime', selectedTime);
    router.push('/bestall/kontakt');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Progress — 4 steps for meeting flow */}
        <div className="flex items-center gap-2 mb-10 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: CORAL }}>✓</div>
            <span className="text-sm text-slate-400">Kontakt</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: NAV_BG }}>2</div>
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Välj tid</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-400 flex-shrink-0">3</div>
            <span className="text-sm text-slate-400 whitespace-nowrap">Dina uppgifter</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-400 flex-shrink-0">4</div>
            <span className="text-sm text-slate-400">Betalning</span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold mb-1 text-center" style={{ color: NAV_BG }}>Välj tid för möte</h1>
        <p className="text-slate-500 text-sm text-center mb-8">Vi ringer upp dig på vald tid — kostnadsfritt.</p>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid md:grid-cols-[1fr_auto] divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* Calendar */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-base font-bold" style={{ color: NAV_BG }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button
                  onClick={() => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>

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
                        ? <span style={{ textDecoration: 'underline', textDecorationColor: CORAL, textUnderlineOffset: '3px' }}>{day}</span>
                        : day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="p-6 sm:p-8 md:w-52">
              <p className="text-sm font-bold mb-4" style={{ color: NAV_BG }}>
                {selectedDate ? formatDate(selectedDate) : 'Välj ett datum'}
              </p>
              {!selectedDate && (
                <p className="text-xs text-slate-400">Välj ett datum till vänster för att se tillgängliga tider.</p>
              )}
              {selectedDate && (
                <div className="space-y-2">
                  {TIME_SLOTS.map(t => {
                    const booked = isSlotBooked(selectedDate, t, bookedSlots);
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

          {/* Continue */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4 border-t border-slate-100">
            <button
              disabled={!selectedDate || !selectedTime}
              onClick={handleContinue}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{ backgroundColor: NAV_BG }}
            >
              {selectedDate && selectedTime
                ? `Fortsätt — ${formatDate(selectedDate)} kl. ${selectedTime}`
                : 'Välj datum och tid för att fortsätta'}
            </button>
          </div>
        </div>

        <button onClick={() => router.back()} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center">
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
