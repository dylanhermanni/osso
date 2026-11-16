begin;

alter table public.project_phases add column task_id uuid;
alter table public.project_phases add constraint project_phases_task_unique unique (task_id);
alter table public.project_phases add constraint project_phases_task_fk
foreign key (task_id, household_id) references public.tasks(id, household_id) on delete cascade;

-- Each existing phase receives its own task, including completed phases.
do $$
declare phase public.project_phases; linked_task uuid;
begin
  for phase in select * from public.project_phases order by created_at, id loop
    insert into public.tasks (household_id, project_id, room_id, title, status)
    select phase.household_id, project.id, project.room_id, phase.title,
      case when phase.done then 'Afgerond' else 'Te doen' end
    from public.projects project
    where project.id = phase.project_id and project.household_id = phase.household_id
    returning id into linked_task;

    update public.project_phases set task_id = linked_task where id = phase.id;
  end loop;
end;
$$;

alter table public.project_phases alter column task_id set not null;

create function public.sync_phase_task() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tasks (household_id, project_id, room_id, title, status)
    select new.household_id, project.id, project.room_id, new.title,
      case when new.done then 'Afgerond' else 'Te doen' end
    from public.projects project
    where project.id = new.project_id and project.household_id = new.household_id
    returning id into new.task_id;
    return new;
  end if;

  if new.task_id is distinct from old.task_id
    or new.household_id is distinct from old.household_id
    or new.project_id is distinct from old.project_id then
    raise exception 'De projectkoppeling van deze fase kan niet worden gewijzigd.';
  end if;

  if new.title is distinct from old.title or new.done is distinct from old.done then
    update public.tasks set
      title = new.title,
      status = case
        when new.done then 'Afgerond'
        when old.done then 'Te doen'
        else status
      end
    where id = new.task_id and household_id = new.household_id
      and (title is distinct from new.title or (status = 'Afgerond') is distinct from new.done);
  end if;
  return new;
end;
$$;

create trigger sync_phase_task before insert or update on public.project_phases
for each row execute function public.sync_phase_task();

create function public.sync_task_phase() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.project_id is distinct from old.project_id
    and exists (select 1 from public.project_phases where task_id = new.id) then
    raise exception 'Deze taak hoort bij een projectfase. De projectkoppeling staat vast.';
  end if;

  update public.project_phases
  set title = new.title, done = (new.status = 'Afgerond')
  where task_id = new.id and household_id = new.household_id
    and (title is distinct from new.title or done is distinct from (new.status = 'Afgerond'));
  return new;
end;
$$;

create trigger sync_task_phase after update of title, status, project_id on public.tasks
for each row execute function public.sync_task_phase();

create function public.remove_phase_task() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.tasks where id = old.task_id and household_id = old.household_id;
  return old;
end;
$$;

create trigger remove_phase_task after delete on public.project_phases
for each row execute function public.remove_phase_task();

create function public.sync_project_phase_rooms() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.room_id is distinct from old.room_id then
    update public.tasks set room_id = new.room_id
    where project_id = new.id and household_id = new.household_id
      and id in (select task_id from public.project_phases where project_id = new.id)
      and room_id is distinct from new.room_id;
  end if;
  return new;
end;
$$;

create trigger sync_project_phase_rooms after update of room_id on public.projects
for each row execute function public.sync_project_phase_rooms();

revoke all on function public.sync_phase_task() from public, anon, authenticated;
revoke all on function public.sync_task_phase() from public, anon, authenticated;
revoke all on function public.remove_phase_task() from public, anon, authenticated;
revoke all on function public.sync_project_phase_rooms() from public, anon, authenticated;

commit;
