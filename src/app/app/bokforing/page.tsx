import { redirect } from 'next/navigation';

/**
 * Bokföring heter Underlag sedan 2026-11-21. Gamla länkar och tillbaka-knappar
 * i de manuella flödena (/bokforing/manuell m.fl.) hamnar där.
 */
export default function BokforingPage() {
  redirect('/underlag');
}
