'use client';

import { useMemo } from 'react';

/**
 * En fil som går att dra direkt från sidan — till Skatteverkets
 * uppladdningsruta i ett annat fönster, eller till skrivbordet. Klick laddar
 * ner den som vanligt.
 *
 * Dragningen bygger på Chromes `DownloadURL`, som bara finns i Chrome och
 * Edge. Filen ligger som data-URL och inte blob-URL: en blob-URL kan hinna
 * släppas innan släppet läser den, och då blir filen tom.
 */

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function DragFil({ namn, mime, bytes }: { namn: string; mime: string; bytes: Uint8Array }) {
  const url = useMemo(() => `data:${mime};base64,${base64(bytes)}`, [mime, bytes]);

  return (
    <a
      href={url}
      download={namn}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('DownloadURL', `${mime}:${namn}:${url}`);
      }}
      title="Dra till Skatteverkets fönster eller skrivbordet — eller klicka för att ladda ner"
      className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg cursor-grab active:cursor-grabbing select-none transition"
    >
      <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4z" />
      </svg>
      <span className="text-sm text-slate-800 font-medium">{namn}</span>
      <span className="text-[11px] text-slate-400">{bytes.length < 1024 ? `${bytes.length} B` : `${Math.round(bytes.length / 1024)} kB`}</span>
    </a>
  );
}
