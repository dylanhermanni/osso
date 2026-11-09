begin;

alter table public.shopping_recipes
add column quantities text[] check (
  array_ndims(quantities) = 1
  and cardinality(quantities) = cardinality(ingredients)
  and array_position(quantities, null) is null
);

grant insert (quantities), update (title, ingredients, quantities), delete
on public.shopping_recipes to authenticated;

create policy shopping_recipes_edit on public.shopping_recipes
for update to authenticated using (public.is_member(household_id))
with check (public.is_member(household_id));

create policy shopping_recipes_remove on public.shopping_recipes
for delete to authenticated using (public.is_member(household_id));

commit;
