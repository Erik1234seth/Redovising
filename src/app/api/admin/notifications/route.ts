import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AdminNotice } from '@/lib/admin-types';
import { normalizePhone } from '@/lib/sms/phone';

/**
 * Flödet bakom notisklockan: det som hänt den senaste veckan, nyast först.
 *
 * Skilt från `/api/admin/status` med flit. Statusen svarar på "fungerar det?",
 * klockan på "vad har hänt?". Att slå ihop dem hade gjort båda sämre: statusen
 * bryr sig bara om det senaste försöket per flöde, klockan om varje enskild
 * händelse.
 *
 * Personnycklarna byggs likadant som i `/api/admin/people` (`e:` för adress,
 * `p:` för nummer), så en notis kan länka rakt in i rätt tidslinje.
 */

export const dynamic = 'force-dynamic';

/** Så långt tillbaka klockan tittar. Äldre än så är historik, inte en notis. */
const WINDOW_DAYS = 7;

/** Tak per källa, så en enstaka skur inte trycker undan allt annat. */
const PER_SOURCE = 25;

/** Tak i svaret. Fler än så läser ingen ändå. */
const TOTAL = 40;

const emailKey = (raw: string | null | undefined): string | null => {
  const clean = raw?.trim().toLowerCase();
  return clean && clean.includes('@') ? `e:${clean}` : null;
};

const phoneKey = (raw: string | null | undefined): string | null => {
  const normalized = normalizePhone(raw);
  return normalized ? `p:${normalized}` : null;
};

/**
 * `orders.created_at` är `timestamp without time zone`, precis som i
 * `/api/admin/people`. Utan ett efterhängt Z tolkar webbläsaren tiden som lokal
 * och en order ser ut att ha kommit två timmar fel.
 */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return /[Z+]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
}

function short(text: string | null | undefined, max = 90): string | undefined {
  const clean = text?.replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [emails, sms, leads, orders] = await Promise.all([
    supabase.from('email_log').select('id, created_at, to_email, subject, kind, status, error')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabase.from('sms_messages').select('id, created_at, phone, direction, body, status, error, kind')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabase.from('contact_requests').select('id, created_at, name, email, phone, ref')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabase.from('orders').select('id, created_at, guest_email, guest_name, guest_phone, package_type, status')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(PER_SOURCE),
  ]);

  const firstError = emails.error || sms.error || leads.error || orders.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const notices: AdminNotice[] = [];

  for (const r of emails.data ?? []) {
    const failed = r.status === 'failed';
    notices.push({
      id: `mejl-${r.id}`,
      at: r.created_at,
      level: failed ? 'fail' : 'ok',
      title: failed ? `Mejlet till ${r.to_email} gick inte fram` : `Mejl skickat till ${r.to_email}`,
      detail: short(failed ? r.error : r.subject),
      personKey: emailKey(r.to_email),
    });
  }

  for (const r of sms.data ?? []) {
    if (r.direction === 'in') {
      notices.push({
        id: `sms-${r.id}`,
        at: r.created_at,
        level: 'info',
        title: `SMS-svar från ${r.phone}`,
        detail: short(r.body),
        personKey: phoneKey(r.phone),
      });
      continue;
    }

    const failed = r.status === 'failed';
    const queued = r.status === 'queued';
    notices.push({
      id: `sms-${r.id}`,
      at: r.created_at,
      level: failed ? 'fail' : queued ? 'info' : 'ok',
      title: failed
        ? `SMS:et till ${r.phone} gick inte fram`
        : queued
          ? `SMS till ${r.phone} ligger i kön`
          : `SMS skickat till ${r.phone}`,
      detail: short(failed ? r.error : r.body),
      personKey: phoneKey(r.phone),
    });
  }

  for (const r of leads.data ?? []) {
    notices.push({
      id: `lead-${r.id}`,
      at: r.created_at,
      level: 'info',
      title: `Nytt lead: ${r.name || r.email || r.phone || 'okänd'}`,
      detail: short(r.ref ? `via ${r.ref}` : undefined),
      personKey: emailKey(r.email) ?? phoneKey(r.phone),
    });
  }

  for (const r of orders.data ?? []) {
    const at = toIso(r.created_at);
    if (!at) continue;
    notices.push({
      id: `order-${r.id}`,
      at,
      level: 'ok',
      title: `Ny order: ${r.guest_name || r.guest_email || 'okänd'}`,
      detail: short([r.package_type, r.status].filter(Boolean).join(' · ')),
      personKey: emailKey(r.guest_email) ?? phoneKey(r.guest_phone),
    });
  }

  // Jämför tidpunkter, inte strängar: orderraderna får sitt Z påhängt medan
  // resten kommer med +00:00, och de två formaten sorterar fel som text.
  notices.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({ notices: notices.slice(0, TOTAL) });
}
