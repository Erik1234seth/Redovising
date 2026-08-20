-- OBS för vektorindex i andra tabeller: skapa aldrig ett ivfflat-index innan
-- raderna finns. Centroiderna tränas vid CREATE INDEX, och ett index byggt på
-- en tom tabell ger tysta bortfall i sökningen.
--
-- Arkiv för SIE4-filer uppladdade i AI-testmiljön (/ai-test).
-- Redan körd mot databasen via migrationen create_sie_files_table.
-- Ligger här för att matcha övriga create-*.sql i repot.
create table if not exists public.sie_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  filnamn text not null,
  storlek_bytes integer,
  checksum text,
  teckenkodning text,

  foretag text,
  orgnr text,
  program text,
  sietyp text,
  rakenskapsar_start date,
  rakenskapsar_slut date,

  antal_verifikationer integer not null default 0,
  antal_transaktioner integer not null default 0,
  summa_debet numeric(14,2) not null default 0,
  summa_kredit numeric(14,2) not null default 0,
  differens numeric(14,2) not null default 0,

  -- hela parserresultatet, inklusive verifikationer och transaktioner
  tolkning jsonb not null,
  -- råfilen i klartext, så den kan tolkas om när parsern förbättras
  innehall text,
  anteckning text,

  -- Intern koppling till kund. Syns aldrig för kunden: tabellen har RLS utan
  -- policies, och inget härifrån skrivs till bokforing_transaktioner.
  kund_id uuid references public.profiles (id) on delete set null
);

create index if not exists sie_files_kund_id_idx on public.sie_files (kund_id);

comment on table public.sie_files is 'SIE4-filer sparade från AI-testmiljön på /ai-test';

create index if not exists sie_files_created_at_idx on public.sie_files (created_at desc);
create index if not exists sie_files_checksum_idx on public.sie_files (checksum);

-- RLS på utan policies: varken anon eller authenticated kommer åt tabellen.
-- Endast service role (som går förbi RLS) läser och skriver, från dev-rutten.
alter table public.sie_files enable row level security;
