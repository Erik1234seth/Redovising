'use client';

/**
 * Visas medan transaktionerna hämtas från banken — efter en ny koppling eller
 * när kunden trycker Hämta nu. Första hämtningen efter en koppling går upp
 * till två år bakåt och kan ta en stund. Rutan tas bort när hämtningen är klar.
 */
export default function BankHamtar({ forsta = false }: { forsta?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
      <span className="w-5 h-5 border-2 border-sky-300 border-t-sky-700 rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-900">Vi hämtar transaktionerna från banken</p>
        <p className="text-xs text-sky-700 mt-0.5">
          {forsta
            ? 'Första gången hämtar vi upp till två år bakåt, så det kan ta någon minut. Du kan stanna kvar på sidan.'
            : 'Det kan ta någon minut. Du kan stanna kvar på sidan.'}
        </p>
      </div>
    </div>
  );
}
