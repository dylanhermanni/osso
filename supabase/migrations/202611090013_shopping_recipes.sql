begin;

create table public.shopping_recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  ingredients text[] not null check (
    array_ndims(ingredients) = 1
    and cardinality(ingredients) between 1 and 50
    and array_position(ingredients, null) is null
    and not jsonb_path_exists(to_jsonb(ingredients), '$[*] ? (!(@ like_regex "[^[:space:]]") || @ like_regex "^.{121}")')
  ),
  created_at timestamptz not null default now()
);

create index shopping_recipes_household_created
on public.shopping_recipes (household_id, created_at desc, id);

alter table public.shopping_recipes enable row level security;
revoke all on public.shopping_recipes from anon, authenticated;
grant select on public.shopping_recipes to authenticated;
grant insert (household_id, title, ingredients) on public.shopping_recipes to authenticated;

create policy shopping_recipes_read on public.shopping_recipes
for select to authenticated using (public.is_member(household_id));
create policy shopping_recipes_add on public.shopping_recipes
for insert to authenticated with check (public.is_member(household_id));

alter publication supabase_realtime add table public.shopping_recipes;

commit;
