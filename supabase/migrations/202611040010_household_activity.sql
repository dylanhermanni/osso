begin;

create or replace function public.audit_record()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  event_action text := tg_op;
  previous_row jsonb;
  current_row jsonb;
begin
  if tg_op = 'UPDATE' then
    previous_row := to_jsonb(old) - 'version' - 'updated_at';
    current_row := to_jsonb(new) - 'version' - 'updated_at';
    if current_row = previous_row then
      return null;
    end if;
    if (current_row->>'status' in ('Afgerond', 'Uitgevoerd', 'Behaald')
          and (previous_row->>'status') is distinct from (current_row->>'status'))
        or (current_row->>'done' = 'true' and previous_row->>'done' = 'false')
        or (tg_table_name = 'maintenance_items'
          and current_row->>'last_done' is not null
          and (current_row->>'last_done') is distinct from (previous_row->>'last_done')) then
      event_action := 'COMPLETE';
    elsif (previous_row->>'status' in ('Afgerond', 'Uitgevoerd', 'Behaald')
            and (current_row->>'status') is distinct from (previous_row->>'status'))
          or (previous_row->>'done' = 'true' and current_row->>'done' = 'false') then
      event_action := 'REOPEN';
    end if;
  end if;

  insert into activity_log (household_id, user_id, entity, entity_id, action, title)
  values (
    coalesce(new.household_id, old.household_id),
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    event_action,
    coalesce(new.title, old.title)
  );
  return null;
end;
$$;

create trigger audit_change after insert or update or delete on public.task_subtasks
for each row execute function public.audit_record();

create trigger audit_change after insert or update or delete on public.project_phases
for each row execute function public.audit_record();

commit;
