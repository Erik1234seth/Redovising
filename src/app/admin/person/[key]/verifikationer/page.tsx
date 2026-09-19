'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminVerifikation, Person } from '@/lib/admin-types';
import { formatPhone } from '@/lib/sms/phone';
import { VerifikationLista } from '../../../_verifikationer';

/**
 * Allt kunden har bokfört hos oss, som verifikationer.
 *
 * Just nu kommer de från SIE-filer, som tolkas med kod när de kommer in. När
 * AI-tolkningen av kvitton och fakturor är på plats hamnar de verifikationerna
 * här också — varje verifikation visar var den kom ifrån.
 */
export default function KundVerifikationerPage() {
  const params = useParams<{ key: string }>();
  const rawKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const key = rawKey ? decodeURIComponent(rawKey) : '';

  const [person, setPerson] = useState<Person | null>(null);
  const [verifikationer, setVerifikationer] = useState<AdminVerifikation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!key) return;
    fetch(`/api/admin/people?key=${encodeURIComponent(key)}&view=verifikationer`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setPerson(data.person);
          setVerifikationer(data.verifikationer ?? []);
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta verifikationerna'); setLoading(false); });
  }, [key]);

  const back = `/admin/person/${encodeURIComponent(key)}`;

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar verifikationer...</div>;

  if (error || !person) {
    return (
      <div className="space-y-4">
        <Link href={back} className="text-gold-500 hover:text-gold-400 text-sm transition">← Tillbaka</Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error || 'Hittade ingen sådan person'}
        </div>
      </div>
    );
  }

  const name = person.name || person.email || (person.phone ? formatPhone(person.phone) : '—');
  const files = new Set(verifikationer.map((v) => v.underlagId).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div>
        <Link href={back} className="text-gold-500 hover:text-gold-400 text-sm transition">← {name}</Link>
        <h1 className="text-2xl font-bold text-white mt-4">Verifikationer</h1>
        <p className="text-warm-400 text-sm mt-1.5">
          {[name, person.company].filter(Boolean).join(' · ')}
          {verifikationer.length > 0 && (
            <span className="text-warm-600"> · från {files} {files === 1 ? 'fil' : 'filer'}</span>
          )}
        </p>
      </div>

      {verifikationer.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-16">
          <p className="text-warm-300">Inga verifikationer än</p>
          <p className="text-warm-600 text-xs mt-1.5 max-w-md mx-auto">
            När kunden mejlar in eller du laddar upp en SIE-fil läggs verifikationerna in här automatiskt.
            Senare hamnar även AI-tolkade kvitton och fakturor här.
          </p>
        </div>
      ) : (
        <VerifikationLista verifikationer={verifikationer} showSource />
      )}
    </div>
  );
}
