begin;

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  quantity text not null default '' check (length(quantity) <= 40),
  store text not null default '' check (length(store) <= 80),
  done boolean not null default false,
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index shopping_items_household_created on public.shopping_items (household_id, created_at desc, id);
alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from anon, authenticated;
grant select, delete on public.shopping_items to authenticated;
grant insert (household_id, title, quantity, store) on public.shopping_items to authenticated;
grant update (done) on public.shopping_items to authenticated;

create policy shopping_items_read on public.shopping_items
for select to authenticated using (public.is_member(household_id));
create policy shopping_items_add on public.shopping_items
for insert to authenticated with check (public.is_member(household_id) and created_by = auth.uid());
create policy shopping_items_check on public.shopping_items
for update to authenticated using (public.is_member(household_id))
with check (public.is_member(household_id));
create policy shopping_items_remove on public.shopping_items
for delete to authenticated using (public.is_member(household_id));

create trigger version_update before update on public.shopping_items
for each row execute function public.version_record();
create trigger audit_change after insert or update or delete on public.shopping_items
for each row execute function public.audit_record();
alter publication supabase_realtime add table public.shopping_items;

commit;
