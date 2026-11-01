begin;
-- Supabase preinstalls pgcrypto in extensions; do not depend on public search_path.
create schema if not exists extensions;
do $$begin if (select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto')<>'extensions' then alter extension pgcrypto set schema extensions;end if;end$$;
create or replace function public.create_invitation(h uuid,invite_email text) returns text language plpgsql security definer set search_path=public as $$declare token text=encode(extensions.gen_random_bytes(32),'hex');begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 insert into household_invitations(household_id,email,token_hash) values(h,lower(trim(invite_email)),encode(extensions.digest(token,'sha256'),'hex'));return token;end$$;
create or replace function public.accept_invitation(token text,person_name text) returns uuid language plpgsql security definer set search_path=public as $$declare inv household_invitations;begin
 if auth.uid() is null then raise exception 'Log eerst in';end if;
 select * into inv from household_invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex') for update;
 if inv.id is null or inv.accepted_at is not null or inv.expires_at<now() or lower(inv.email)<>lower(auth.jwt()->>'email') then raise exception 'Uitnodiging ongeldig, verlopen of voor een ander e-mailadres';end if;
 insert into profiles(id,display_name) values(auth.uid(),person_name) on conflict(id) do nothing;
 insert into household_members values(inv.household_id,auth.uid()) on conflict do nothing;update household_invitations set accepted_at=now() where id=inv.id;return inv.household_id;end$$;
commit;
