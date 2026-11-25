-- Testflöde: egna tabeller för allt Flöde skriver, så att det går att testa
-- på riktiga kunders underlag utan att röra deras riktiga bokföring.
--
-- Varje test_-tabell har samma kolumner, standardvärden, index och kaskader
-- som originalet. Koden i Testflöde (@/lib/testflode) använder samma
-- tabellnamn som Flöde; testklienten byter dem mot test_-tabellerna.
-- Filerna i lagringen och allt som bara läses (profiler, mejl, bankrader,
-- kontoplan och regler) delas med det riktiga.

create table if not exists test_bokforing_underlag (like bokforing_underlag including all);
create table if not exists test_transaktioner (like transaktioner including all);
create table if not exists test_konteringar (like konteringar including all);
create table if not exists test_verifikationer (like verifikationer including all);
create table if not exists test_verifikation_rader (like verifikation_rader including all);
create table if not exists test_kontering_prov (like kontering_prov including all);
create table if not exists test_underlag_kopplingar (like underlag_kopplingar including all);
create table if not exists test_betalningskopplingar (like betalningskopplingar including all);
create table if not exists test_kundbilder (like kundbilder including all);
create table if not exists test_flodes_instruktioner (like flodes_instruktioner including all);

-- Samma kaskader som originalen, men mellan test_-tabellerna
alter table test_bokforing_underlag add foreign key (del_av) references test_bokforing_underlag(id) on delete set null;
alter table test_transaktioner add foreign key (underlag_id) references test_bokforing_underlag(id) on delete cascade;
alter table test_transaktioner add foreign key (dublett_av) references test_transaktioner(id) on delete set null;
alter table test_verifikationer add foreign key (transaktion_id) references test_transaktioner(id) on delete cascade;
alter table test_verifikationer add foreign key (underlag_id) references test_bokforing_underlag(id) on delete cascade;
alter table test_verifikation_rader add foreign key (verifikation_id) references test_verifikationer(id) on delete cascade;
alter table test_konteringar add foreign key (transaktion_id) references test_transaktioner(id) on delete cascade;
alter table test_underlag_kopplingar add foreign key (transaktion_id) references test_transaktioner(id) on delete cascade;
alter table test_underlag_kopplingar add foreign key (underlag_id) references test_bokforing_underlag(id) on delete cascade;
alter table test_underlag_kopplingar add foreign key (verifikation_id) references test_verifikationer(id) on delete cascade;
alter table test_betalningskopplingar add foreign key (transaktion_id) references test_transaktioner(id) on delete cascade;
alter table test_flodes_instruktioner add foreign key (transaktion_id) references test_transaktioner(id) on delete cascade;
alter table test_flodes_instruktioner add foreign key (underlag_id) references test_bokforing_underlag(id) on delete cascade;

-- Och samma nycklar mot det som delas med det riktiga
alter table test_betalningskopplingar add foreign key (faktura_id) references fakturor(id) on delete cascade;
alter table test_transaktioner add foreign key (user_id, bank_konto_hash, bank_transaktion_id) references bank_transaktioner(user_id, konto_hash, transaktion_id) on delete cascade;
alter table test_transaktioner add foreign key (fraga_utkast_id) references mejl_utkast(id) on delete set null;
alter table test_bokforing_underlag add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_transaktioner add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_verifikationer add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_konteringar add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_betalningskopplingar add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_kundbilder add foreign key (user_id) references auth.users(id) on delete cascade;
alter table test_kontering_prov add foreign key (user_id) references profiles(id) on delete cascade;
alter table test_flodes_instruktioner add foreign key (user_id) references profiles(id) on delete cascade;

-- Bara servern (service role) når tabellerna, som de andra
alter table test_bokforing_underlag enable row level security;
alter table test_transaktioner enable row level security;
alter table test_konteringar enable row level security;
alter table test_verifikationer enable row level security;
alter table test_verifikation_rader enable row level security;
alter table test_kontering_prov enable row level security;
alter table test_underlag_kopplingar enable row level security;
alter table test_betalningskopplingar enable row level security;
alter table test_kundbilder enable row level security;
alter table test_flodes_instruktioner enable row level security;

-- Kundens riktiga läge kopieras till testtabellerna. Det som fanns i testet
-- för kunden tas bort först.
create or replace function testflode_kopiera(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from test_kontering_prov where user_id = p_user;
  delete from test_kundbilder where user_id = p_user;
  delete from test_betalningskopplingar where user_id = p_user;
  delete from test_underlag_kopplingar where user_id = p_user;
  delete from test_flodes_instruktioner where user_id = p_user;
  -- Transaktioner, verifikationer, rader och konteringar följer med kaskaderna
  delete from test_verifikationer where user_id = p_user;
  delete from test_transaktioner where user_id = p_user;
  delete from test_bokforing_underlag where user_id = p_user;

  insert into test_bokforing_underlag select * from bokforing_underlag where user_id = p_user;
  insert into test_transaktioner select * from transaktioner where user_id = p_user;
  insert into test_verifikationer select * from verifikationer where user_id = p_user;
  insert into test_verifikation_rader select r.* from verifikation_rader r join verifikationer v on v.id = r.verifikation_id where v.user_id = p_user;
  insert into test_konteringar select * from konteringar where user_id = p_user;
  insert into test_underlag_kopplingar select * from underlag_kopplingar where user_id = p_user;
  insert into test_betalningskopplingar select * from betalningskopplingar where user_id = p_user;
  insert into test_flodes_instruktioner select * from flodes_instruktioner where user_id = p_user;
  insert into test_kundbilder select * from kundbilder where user_id = p_user;
  insert into test_kontering_prov select * from kontering_prov where user_id = p_user;
end $$;

revoke all on function testflode_kopiera(uuid) from public, anon, authenticated;
