-- Byråns egen anteckning på en transaktion: bara för byrån, AI:n läser den inte.
-- Skrivs i Flöde under Redigera. När en fil körs om i Flöde flyttas den över
-- till den nya transaktionen för samma affär (se flyttaAnteckningar i
-- @/lib/kontering/omgang/skriv).

alter table transaktioner add column if not exists byrans_anteckning text;
alter table test_transaktioner add column if not exists byrans_anteckning text;
