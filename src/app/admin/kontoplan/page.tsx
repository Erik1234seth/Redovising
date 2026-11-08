import { redirect } from 'next/navigation';

/** Kontoplanen är delad i Löpande bokföring och Bokslut. Den gamla adressen leder till den löpande. */
export default function Kontoplan() {
  redirect('/admin/kontoplan/lopande');
}
