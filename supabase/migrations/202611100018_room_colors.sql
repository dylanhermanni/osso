alter table public.rooms
add column color text check (color in ('sage', 'blue', 'lilac', 'rose', 'peach', 'yellow'));
