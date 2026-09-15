import './company.css';
import Sida from './Sida';
import { heroVideo, videokandidater, type Sprak, type Videonamn } from './content';

/**
 * Läser bara vilket språk sidan ska öppnas på. Själva sidan ligger i Sida.tsx.
 *
 * Engelska är förval; ?lang=sv öppnar den på svenska, så en länk kan delas
 * direkt på rätt språk. Byten efter det sker på plats i Sida.
 *
 * ?video=<namn> visar en filmkandidat i heron, ?video=kod det animerade
 * rutnätet (se content.ts). Tillfälligt, medan bakgrunden väljs.
 */
export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; video?: string }>;
}) {
  const { lang, video } = await searchParams;
  const sprak: Sprak = lang === 'sv' ? 'sv' : 'en';

  const val =
    video === 'kod' || (video && video in videokandidater)
      ? (video as Videonamn | 'kod')
      : heroVideo.standard;

  return <Sida startSprak={sprak} video={val === 'kod' ? null : videokandidater[val]} />;
}
