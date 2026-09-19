'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { SieResultat } from '@/lib/sie/parse';
import { fullDate } from '../../_pipeline';
import { VerifikationLista } from '../../_verifikationer';

/**
 * Verifikationerna i en inskickad SIE-fil, så som de står i filen.
 *
 * Tolkningen görs med kod på servern (src/lib/sie/parse.ts), ingen AI. Samma
 * verifikationer läggs också in hos kunden — rutan överst säger hur det gick.
 */

interface Underlag {
  id: string;
  fileName: string;
  source: string;
  status: string;
  at: string;
  personKey: string | null;
  personEmail: string | null;
  import: { at: string; inlagda: number; dubbletter: number; fel: string | null } | null;
}

export default function SieFilPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [underlag, setUnderlag] = useState<Underlag | null>(null);
  const [sie, setSie] = useState<SieResultat | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/underlag/${id}/sie`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setUnderlag(data.underlag);
          setSie(data.sie);
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta filen'); setLoading(false); });
  }, [id]);

  if (loading) return <div className="text-center py-20 text-warm-400">Tolkar SIE-filen...</div>;

  if (error || !sie || !underlag) {
    return (
      <div className="space-y-4">
        <Link href="/admin/underlag" className="text-gold-500 hover:text-gold-400 text-sm transition">← Underlag</Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error || 'Hittade inget sådant underlag'}
        </div>
      </div>
    );
  }

  const { header } = sie;
  const current = header.rakenskapsar.find((r) => r.id === '0') ?? header.rakenskapsar[0];
  const imp = underlag.import;
  const personHref = underlag.personKey ? `/admin/person/${encodeURIComponent(underlag.personKey)}` : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/underlag" className="text-gold-500 hover:text-gold-400 text-sm transition">← Underlag</Link>
        <h1 className="text-2xl font-bold text-white mt-4 break-words">
          {header.foretag || underlag.fileName}
        </h1>
        <p className="text-warm-400 text-sm mt-1.5">
          {[
            header.orgnr && `Org.nr ${header.orgnr}`,
            current && `Räkenskapsår ${current.start} – ${current.slut}`,
            header.program && `Exporterad från ${header.program}`,
          ].filter(Boolean).join(' · ') || 'Inga företagsuppgifter i filen'}
        </p>
        <p className="text-warm-600 text-xs mt-1">
          {underlag.fileName} · inkom {fullDate(underlag.at)}
          {header.genererad && ` · filen skapad ${header.genererad}`}
          {` · ${sie.teckenkodning}`}
          {personHref && (
            <>
              {' · '}
              <Link href={personHref} className="text-gold-500 hover:text-gold-400 transition">{underlag.personEmail}</Link>
            </>
          )}
        </p>
      </div>

      {/* Vad filen gav hos kunden */}
      {imp && (
        <div className={`rounded-xl border p-4 text-sm flex items-center justify-between gap-3 flex-wrap ${
          imp.fel ? 'bg-red-500/10 border-red-500/40' : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <p className={imp.fel ? 'text-red-300' : 'text-emerald-300'}>
            {imp.fel
              ? `Verifikationerna kunde inte läggas in: ${imp.fel}`
              : `✓ ${imp.inlagda} ${imp.inlagda === 1 ? 'verifikation inlagd' : 'verifikationer inlagda'} hos kunden`}
            {imp.dubbletter > 0 && (
              <span className="text-warm-400"> · {imp.dubbletter} fanns redan från en tidigare fil</span>
            )}
          </p>
          {personHref && !imp.fel && (
            <Link href={`${personHref}/verifikationer`} className="text-gold-500 hover:text-gold-400 text-xs transition">
              Kundens verifikationer →
            </Link>
          )}
        </div>
      )}

      {sie.varningar.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-sm space-y-1">
          {sie.varningar.map((w, i) => <p key={i} className="text-red-300">{w}</p>)}
        </div>
      )}

      <VerifikationLista verifikationer={sie.verifikationer} />
    </div>
  );
}
