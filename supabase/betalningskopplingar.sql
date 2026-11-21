-- Kopplingar mellan en faktura och bankraden som betalade den.
-- Körs en gång i Supabase SQL Editor.
--
-- En bankrad kan betala flera fakturor (samlad betalning) och en faktura kan
-- betalas av flera bankrader (delbetalning, eller ROT/RUT där Skatteverket
-- betalar sin del för sig). Bankraden pekas ut med kontots hash och bankens
-- transaktions-id, så kopplingen står kvar även om raden raderas ur Flöde.
--
-- status: 'auto' räknas om varje gång matchningen körs. 'bekraftad' och
-- 'avvisad' är byråns beslut och rörs aldrig av matchningen.

create table if not exists betalningskopplingar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Egen faktura (scenario A) eller en inskickad faktura som transaktion (B/C)
  faktura_id uuid references fakturor(id) on delete cascade,
  transaktion_id uuid references transaktioner(id) on delete cascade,
  konto_hash text not null,
  bank_transaktion_id text not null,
  bank_datum date not null,
  -- Hela bankradens belopp i kronor, positivt in och negativt ut
  bank_belopp numeric not null,
  -- Den del av bankraden som gäller just den här fakturan, i kronor
  belopp numeric not null,
  -- 'betalning' från kunden eller leverantören, 'skatteverket' för ROT/RUT-delen
  del text not null default 'betalning' check (del in ('betalning', 'skatteverket')),
  typ text not null check (typ in ('hel', 'delbetalning', 'overbetalning', 'samlad')),
  -- Det som fick dem att matcha: 'fakturanummer', 'namn' eller 'belopp'
  grund text not null check (grund in ('fakturanummer', 'namn', 'belopp')),
  sakerhet text not null check (sakerhet in ('saker', 'trolig', 'forslag')),
  -- Bankens belopp minus det som väntades, i kronor (öresavrundning, kurs, avgift)
  avvikelse numeric not null default 0,
  kommentar text,
  status text not null default 'auto' check (status in ('auto', 'bekraftad', 'avvisad')),
  created_at timestamptz not null default now(),
  check (faktura_id is not null or transaktion_id is not null)
);

create unique index if not exists betalningskopplingar_faktura_bank
  on betalningskopplingar (faktura_id, konto_hash, bank_transaktion_id, del) where faktura_id is not null;
create unique index if not exists betalningskopplingar_transaktion_bank
  on betalningskopplingar (transaktion_id, konto_hash, bank_transaktion_id, del) where transaktion_id is not null;
create index if not exists betalningskopplingar_user on betalningskopplingar (user_id);
create index if not exists betalningskopplingar_bank on betalningskopplingar (user_id, konto_hash, bank_transaktion_id);

-- Kunden läser sina egna kopplingar (fakturalistan). Skrivningar görs av servern.
alter table betalningskopplingar enable row level security;
drop policy if exists "Egna betalningskopplingar" on betalningskopplingar;
create policy "Egna betalningskopplingar" on betalningskopplingar
  for select using (auth.uid() = user_id);
