-- Högst ett mejlutkast per kund. Körs en gång i Supabase SQL Editor.
--
-- Skickar kunden flera mejl i rad får varje mejl ett AI-utkast. Bara svaret
-- på det senaste mejlet ska ligga kvar, så när ett nytt utkast sparas slängs
-- de andra som väntar till samma adress (status 'discarded', de går att ta
-- fram igen).
--
-- Det som avgör är när mejlet som utkastet svarar på kom in, inte när utkastet
-- skrevs. Underlagsflödet kan ta minuter, så svaret på ett äldre mejl kan bli
-- klart efter svaret på ett nyare. Då är det det äldre som slängs, direkt när
-- det sparas. Ett utkast som inte svarar på något mejl räknas som nytt.
--
-- Gäller alla utkast: AI-svar, Skriv om, frågemejl och ärendemejl. Inte mejl
-- vi skriver själva i inkorgen (kalla 'egen'): de skickas direkt och ska inte
-- ta bort AI:ns utkast.

alter table mejl_utkast drop constraint if exists mejl_utkast_kalla_check;
alter table mejl_utkast add constraint mejl_utkast_kalla_check check (kalla in ('ai', 'manuell', 'arende', 'egen'));

create or replace function mejl_utkast_ett_per_konversation() returns trigger
language plpgsql set search_path = public as $$
declare
  ny_tid timestamptz;
begin
  if new.status is distinct from 'draft' or new.kalla = 'egen' or new.till_email is null then
    return new;
  end if;

  -- Två utkast till samma adress samtidigt ska inte missa varandra
  perform pg_advisory_xact_lock(hashtext('mejl_utkast:' || lower(new.till_email)));

  select m.sent_at into ny_tid from mail_messages m where m.gmail_message_id = new.svar_pa_message_id;
  ny_tid := coalesce(ny_tid, now());

  -- Ett utkast väntar redan på ett nyare mejl: det här kom för sent
  if exists (
    select 1 from mejl_utkast u
    left join mail_messages m on m.gmail_message_id = u.svar_pa_message_id
    where u.status = 'draft' and u.kalla <> 'egen' and lower(u.till_email) = lower(new.till_email)
      and coalesce(m.sent_at, u.created_at) > ny_tid
  ) then
    new.status := 'discarded';
    new.updated_at := now();
    return new;
  end if;

  update mejl_utkast set status = 'discarded', updated_at = now()
  where status = 'draft' and kalla <> 'egen' and lower(till_email) = lower(new.till_email);
  return new;
end $$;

drop trigger if exists mejl_utkast_ett_per_konversation on mejl_utkast;
create trigger mejl_utkast_ett_per_konversation before insert on mejl_utkast
  for each row execute function mejl_utkast_ett_per_konversation();

-- Utkasten som redan väntar städas efter samma regel: per adress blir svaret
-- på det senaste mejlet kvar.
with rangordnade as (
  select u.id, row_number() over (
    partition by lower(u.till_email)
    order by coalesce(m.sent_at, u.created_at) desc, u.created_at desc
  ) as plats
  from mejl_utkast u
  left join mail_messages m on m.gmail_message_id = u.svar_pa_message_id
  where u.status = 'draft' and u.kalla <> 'egen' and u.till_email is not null
)
update mejl_utkast set status = 'discarded', updated_at = now()
where id in (select id from rangordnade where plats > 1);
