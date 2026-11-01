begin;
alter table public.expense_payments add column created_at timestamptz not null default now();
alter table public.expense_shares add column created_at timestamptz not null default now();
create function public.link_purchase(h uuid,product uuid,expense uuid,expected_version integer) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 if not exists(select 1 from expenses where id=expense and household_id=h and reversed_at is null) then raise exception 'Ongeldige uitgave';end if;
 update wishlist_items set expense_id=expense,status='Gekocht' where id=product and household_id=h and expense_id is null and version=expected_version;
 if not found then raise exception 'Product is gewijzigd of al gekoppeld';end if;end$$;
revoke execute on function public.link_purchase(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.link_purchase(uuid,uuid,uuid,integer) to authenticated;
create or replace function public.protect_purchase() returns trigger language plpgsql set search_path=public as $$begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.expense_id is not null or new.status='Gekocht' then raise exception 'Gebruik de aankooptransactie';end if;
  elsif new.expense_id is distinct from old.expense_id or (new.status='Gekocht' and old.status<>'Gekocht') then raise exception 'Gebruik de aankooptransactie';end if;
 end if;return new;end$$;
drop trigger protect_purchase on public.wishlist_items;
create trigger protect_purchase before insert or update on public.wishlist_items for each row execute function public.protect_purchase();
-- Authenticated users cannot forge the attribution or change creator on new records.
create function public.set_creator() returns trigger language plpgsql set search_path=public as $$begin new.created_by=auth.uid();return new;end$$;
do $$declare t text;begin for t in select table_name from information_schema.columns where table_schema='public' and column_name='created_by' loop
 execute format('create trigger assign_creator before insert on public.%I for each row execute function public.set_creator()',t);
 end loop;end$$;
-- Metadata must only refer to private objects in the same household folder.
alter table public.documents add constraint document_folder check(split_part(storage_path,'/',1)=household_id::text);
alter table public.room_photos add constraint room_photo_folder check(split_part(storage_path,'/',1)=household_id::text);
alter table public.idea_photos add constraint idea_photo_folder check(split_part(storage_path,'/',1)=household_id::text);
-- Finance child tables are RPC-only even when default API grants exist.
revoke insert,update,delete on public.expenses,public.expense_payments,public.expense_shares,public.settlements,public.settlement_allocations,public.activity_log,public.maintenance_history,public.household_members,public.household_invitations,public.households from authenticated,anon;
revoke execute on function public.set_creator() from public,anon,authenticated;
commit;
