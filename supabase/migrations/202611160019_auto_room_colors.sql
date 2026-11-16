begin;

alter table public.rooms drop constraint rooms_color_check;
alter table public.rooms add constraint rooms_color_check
check (color in ('sage', 'blue', 'lilac', 'rose', 'peach', 'yellow', 'mint', 'aqua', 'lavender', 'coral', 'sand', 'olive', 'sky', 'mauve', 'apricot', 'pistachio', 'periwinkle', 'blush'));

create function public.assign_room_color() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.color is not null then
    return new;
  end if;

  -- Serialize automatic choices within the same household.
  perform 1 from public.households where id = new.household_id for update;

  select palette.color into new.color
  from unnest(array['sage', 'blue', 'lilac', 'rose', 'peach', 'yellow', 'mint', 'aqua', 'lavender', 'coral', 'sand', 'olive', 'sky', 'mauve', 'apricot', 'pistachio', 'periwinkle', 'blush']) with ordinality as palette(color, position)
  left join public.rooms as room
    on room.household_id = new.household_id and room.color = palette.color and room.id <> new.id
  group by palette.color, palette.position
  order by count(room.id), palette.position
  limit 1;

  return new;
end;
$$;

revoke all on function public.assign_room_color() from public, anon, authenticated;

create trigger assign_room_color
before insert or update of color on public.rooms
for each row execute function public.assign_room_color();

-- Process old rooms individually so that each choice sees the previous choices.
do $$
declare room_id uuid;
begin
  for room_id in select id from public.rooms where color is null order by household_id, created_at, id loop
    update public.rooms set color = null where id = room_id;
  end loop;
end;
$$;

alter table public.rooms alter column color set not null;

commit;
