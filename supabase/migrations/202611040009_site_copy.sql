begin;
create table public.site_content_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.site_content_admins enable row level security;
revoke all on public.site_content_admins from anon,authenticated;
-- This is the existing site owner's app account, not a new login or credential.
insert into public.site_content_admins(user_id) select id from auth.users where id='2cf7587f-a787-4517-acab-5106b7812768' on conflict do nothing;
create function public.is_content_admin() returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from site_content_admins where user_id=auth.uid())
$$;
revoke all on function public.is_content_admin() from public;
grant execute on function public.is_content_admin() to anon,authenticated;
create table public.site_copy(key text primary key check(key ~ '^copy_[a-f0-9]{8}$'),value text check(value is null or length(btrim(value)) between 1 and 5000),version integer not null default 1,updated_at timestamptz not null default now());
alter table public.site_copy enable row level security;
create policy copy_public_read on public.site_copy for select to anon,authenticated using(true);
grant select on public.site_copy to anon,authenticated;
revoke insert,update,delete on public.site_copy from anon,authenticated;
create table public.site_copy_history(id bigint generated always as identity primary key,key text not null,value text,created_by uuid references auth.users,created_at timestamptz not null default now());
create index site_copy_history_key_date on public.site_copy_history(key,created_at desc);
alter table public.site_copy_history enable row level security;
create policy copy_history_admin_read on public.site_copy_history for select to authenticated using(public.is_content_admin());
grant select on public.site_copy_history to authenticated;
revoke all on public.site_copy_history from anon;
revoke insert,update,delete on public.site_copy_history from authenticated;
create function public.save_site_copy(copy_key text,copy_value text,expected_version integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare current_row site_copy; result site_copy;
begin
 if not is_content_admin() then raise exception 'Geen toegang tot tekstbeheer';end if;
 -- Serialize writes to this key, including the first insert. Never overwrite silently.
 perform pg_advisory_xact_lock(hashtextextended(copy_key,0));
 select * into current_row from site_copy where key=copy_key for update;
 if coalesce(current_row.version,0)<>expected_version then raise exception 'COPY_CONFLICT';end if;
 insert into site_copy_history(key,value,created_by) values(copy_key,copy_value,auth.uid());
 insert into site_copy(key,value,version) values(copy_key,copy_value,1)
 on conflict(key) do update set value=excluded.value,version=site_copy.version+1,updated_at=now() returning * into result;
 return to_jsonb(result);
end$$;
revoke all on function public.save_site_copy(text,text,integer) from public,anon;
grant execute on function public.save_site_copy(text,text,integer) to authenticated;
commit;
