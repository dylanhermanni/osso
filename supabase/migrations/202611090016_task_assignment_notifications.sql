begin;

alter table public.notifications
  add column task_id uuid references public.tasks(id) on delete set null;

drop policy member_read on public.notifications;
drop policy member_insert on public.notifications;
drop policy member_update on public.notifications;
drop policy member_delete on public.notifications;
revoke all on public.notifications from anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;

create policy notifications_read_own on public.notifications
for select to authenticated
using (user_id = auth.uid() and public.is_member(household_id));

create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid() and public.is_member(household_id))
with check (user_id = auth.uid() and public.is_member(household_id));

create function public.notify_task_assignment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
begin
  if actor is null or new.assignee_id is null or new.assignee_id = actor then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select display_name into actor_name from public.profiles where id = actor;
  insert into public.notifications (household_id, user_id, task_id, title)
  values (
    new.household_id, new.assignee_id, new.id,
    coalesce(actor_name, 'Je huisgenoot') || ' wees je een taak toe: ' || new.title
  );
  return new;
end;
$$;

revoke all on function public.notify_task_assignment() from public, anon, authenticated;

create trigger notify_task_assignment
after insert or update of assignee_id on public.tasks
for each row execute function public.notify_task_assignment();

commit;
