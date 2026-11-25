-- Täpper till Supabase säkerhetsvarningar (RLS m.m.).
-- Appen når alla tabeller nedan via service-nyckeln, som går förbi RLS,
-- så inget i appen påverkas. anon/authenticated (webbläsaren) stängs ute.

-- 1. Tabeller utan RLS: slå på RLS utan policies = ingen åtkomst för anon/authenticated.
alter table public.pending_registrations enable row level security;
alter table public.meetings             enable row level security;
alter table public.contact_files        enable row level security;
alter table public.webhook_logs         enable row level security;

-- 2. Vyer som körde som skaparen (security definer) och läckte auth.users.
alter view public.order_files_view         set (security_invoker = true);
alter view public.transaction_summary_view set (security_invoker = true);
revoke all on public.order_files_view         from anon, authenticated;
revoke all on public.transaction_summary_view from anon, authenticated;

-- 3. Security definer-funktioner som gick att anropa via /rest/v1/rpc.
revoke execute on function public.handle_new_user()             from public, anon, authenticated;
revoke execute on function public.increment_order_count(uuid)    from public, anon, authenticated;

-- 4. Fast search_path på funktioner.
alter function public.handle_new_user()                        set search_path = public;
alter function public.increment_order_count(uuid)              set search_path = public;
alter function public.update_parsed_transactions_updated_at()  set search_path = public;
