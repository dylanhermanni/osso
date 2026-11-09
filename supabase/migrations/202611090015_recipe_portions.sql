begin;

alter table public.shopping_recipes
add column portions smallint not null default 2 check (portions between 1 and 100);

grant insert (portions), update (portions) on public.shopping_recipes to authenticated;

commit;
