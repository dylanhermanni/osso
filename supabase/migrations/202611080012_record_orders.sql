begin;

create table public.record_orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  entity text not null check (entity in ('rooms', 'ideas', 'projects', 'wishlist_items')),
  record_ids uuid[] not null default '{}',
  version integer not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, entity)
);
alter table public.record_orders enable row level security;
revoke all on public.record_orders from anon, authenticated;
grant select on public.record_orders to authenticated;
create policy record_orders_read on public.record_orders
for select to authenticated using (public.is_member(household_id));

create function public.reorder_records(h uuid, kind text, ordered_ids uuid[], expected_version integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  current_version integer;
  known_count integer;
  remaining uuid[];
begin
  if not public.is_member(h) then
    raise exception 'Geen toegang tot dit huishouden.';
  end if;
  if kind not in ('rooms', 'ideas', 'projects', 'wishlist_items') or kind is null
    or ordered_ids is null or cardinality(ordered_ids) not between 1 and 10000
    or expected_version is null or expected_version < 0
    or (select count(distinct item) from unnest(ordered_ids) item) <> cardinality(ordered_ids) then
    raise exception 'Ongeldige volgorde.';
  end if;

  -- Serialize first saves too, without changing versions of the actual records.
  perform pg_advisory_xact_lock(hashtextextended(h::text || kind, 0));
  insert into record_orders(household_id, entity) values (h, kind)
  on conflict (household_id, entity) do nothing;
  select version into current_version from record_orders
  where household_id = h and entity = kind for update;
  if current_version <> expected_version then
    raise exception 'De volgorde is ondertussen gewijzigd. Vernieuw en probeer opnieuw.';
  end if;

  execute format('select count(*) from public.%I where household_id = $1 and id = any($2)', kind)
  into known_count using h, ordered_ids;
  if known_count <> cardinality(ordered_ids) then
    raise exception 'Een onderdeel is ondertussen verwijderd. Vernieuw en probeer opnieuw.';
  end if;
  -- Preserve records added by the other person while this page was open.
  execute format('select coalesce(array_agg(id order by created_at desc, id), ''{}''::uuid[]) from public.%I where household_id = $1 and not (id = any($2))', kind)
  into remaining using h, ordered_ids;

  update record_orders set record_ids = ordered_ids || remaining, version = version + 1
  where household_id = h and entity = kind;
  return current_version + 1;
end;
$$;
revoke all on function public.reorder_records(uuid, text, uuid[], integer) from public, anon;
grant execute on function public.reorder_records(uuid, text, uuid[], integer) to authenticated;
alter publication supabase_realtime add table public.record_orders;

commit;
