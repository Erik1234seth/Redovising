'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { TIME_SLOTS, isSlotBooked } from '@/lib/meetingSlots';
import { packages } from '@/data/packages';

const MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];
const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMinDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}

export default function BookMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const packageType = params.package as string;

  const pkg = packages.find((p) => p.id === packageType);
  const today = new Date();
  const minDate = getMinDate();

  const [contactMethod, setContactMethod] = useState<'email' | 'meeting'>('email');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch('/api/booked-slots').then(r => r.json()).then(d => setBookedSlots(d.slots ?? {}));
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d.getDay() === 0 || d.getDay() === 6) return true;
    if (d < minDate) return true;
    return false;
  };

  const handleSelectDate = (day: number) => {
    if (isDisabled(day)) return;
    setSelectedDate(toDateStr(viewYear, viewMonth, day));
    setSelectedTime(null);
  };

  const formatDate = (ds: string) =>
    new Date(ds + 'T12:00:00').toLocaleDateString('sv-SE', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

  const handleContinue = () => {
    if (contactMethod === 'meeting') {
      if (!selectedDate || !selectedTime) return;
      sessionStorage.setItem('meetingDate', selectedDate);
      sessionStorage.setItem('meetingTime', selectedTime);
    } else {
      sessionStorage.removeItem('meetingDate');
      sessionStorage.removeItem('meetingTime');
    }
    sessionStorage.setItem('contactMethod', contactMethod);
    router.push(`/flow/${packageType}/method-selection`);
  };

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Package context chip */}
        {pkg && (
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold bg-[#E95C63]/15 text-[#E95C63] border border-[#E95C63]/25">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Beställning: {pkg.name} — {pkg.price.toLocaleString('sv')} kr
            </span>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Hur vill du bli kontaktad?</h1>
          <p className="text-warm-300 text-sm">Sista steget — välj hur vi ska skicka instruktioner till dig.</p>
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setContactMethod('email')}
            className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              contactMethod === 'email'
                ? 'border-[#E95C63] bg-[#E95C63]/10'
                : 'border-navy-600 bg-navy-700/50 hover:border-navy-500'
            }`}
          >
            <span className="absolute -top-2.5 left-3 bg-[#E95C63] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Rekommenderas
            </span>
            <svg className="w-5 h-5 text-[#E95C63] mb-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="font-semibold text-white text-sm">Få instruktioner via mail</p>
            <p className="text-warm-400 text-xs mt-1">Vi skickar allt du behöver för att skicka in ditt underlag</p>
          </button>

          <button
            onClick={() => setContactMethod('meeting')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              contactMethod === 'meeting'
                ? 'border-[#E95C63] bg-[#E95C63]/10'
                : 'border-navy-600 bg-navy-700/50 hover:border-navy-500'
            }`}
          >
            <svg className="w-5 h-5 text-warm-300 mb-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p className="font-semibold text-white text-sm">Boka ett samtal</p>
            <p className="text-warm-400 text-xs mt-1">Vi ringer upp och går igenom vad du ska skicka in</p>
          </button>
        </div>

        {/* Calendar */}
        {contactMethod === 'meeting' && <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-navy-600">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-600 text-warm-300 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-white capitalize">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-600 text-warm-300 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-navy-600">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-warm-500 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 p-2 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = toDateStr(viewYear, viewMonth, day);
              const disabled = isDisabled(day);
              const selected = selectedDate === ds;
              return (
                <button
                  key={i}
                  onClick={() => handleSelectDate(day)}
                  disabled={disabled}
                  className={`h-9 w-full rounded-lg text-sm font-medium transition-all duration-150 ${
                    selected
                      ? 'bg-[#E95C63] text-white font-bold'
                      : disabled
                      ? 'text-navy-600 cursor-not-allowed'
                      : 'text-warm-200 hover:bg-navy-600 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>}

        {/* Time slots */}
        {contactMethod === 'meeting' && selectedDate && (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5 mb-4">
            <p className="text-sm font-medium text-warm-300 mb-3">
              Välj tid — <span className="text-white capitalize">{formatDate(selectedDate)}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map(slot => {
                const booked = isSlotBooked(selectedDate, slot, bookedSlots);
                const chosen = selectedTime === slot;
                return (
                  <button
                    key={slot}
                    disabled={booked}
                    onClick={() => !booked && setSelectedTime(slot)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      booked
                        ? 'bg-navy-800/30 text-navy-600 cursor-not-allowed line-through'
                        : chosen
                        ? 'bg-[#E95C63] text-white'
                        : 'bg-navy-800 border border-navy-600 text-warm-200 hover:border-[#E95C63]/50 hover:text-white'
                    }`}
                  >
                    {booked ? 'Upptaget' : slot}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected summary */}
        {contactMethod === 'meeting' && selectedDate && selectedTime && (
          <div className="bg-[#E95C63]/10 border border-[#E95C63]/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-[#E95C63] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-warm-200">
              <span className="text-white font-semibold capitalize">{formatDate(selectedDate)}</span>
              {' '}kl. <span className="text-white font-semibold">{selectedTime}</span>
            </p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={contactMethod === 'meeting' && (!selectedDate || !selectedTime)}
          className="w-full py-3 bg-[#E95C63] hover:bg-[#d04e55] text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          Fortsätt →
        </button>

        <button
          onClick={() => router.back()}
          className="w-full text-center text-warm-400 hover:text-white font-semibold transition-colors text-sm"
        >
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
