begin;
alter table public.expenses add column refund_of uuid;
alter table public.expenses add foreign key(refund_of,household_id) references public.expenses(id,household_id);
create function public.record_refund(h uuid,original uuid,entry jsonb,payments jsonb,shares jsonb,request_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare e uuid;parent expenses;total bigint;allocation record;remaining bigint;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 select id into e from expenses where idempotency_key=request_id and household_id=h;if found then return e;end if;
 select * into parent from expenses where id=original and household_id=h and reversed_at is null and refund_of is null;
 if parent.id is null then raise exception 'Ongeldige oorspronkelijke uitgave';end if;
 total=(entry->>'amount_cents')::bigint;
 remaining=parent.amount_cents-coalesce((select sum(amount_cents) from expenses where refund_of=original and reversed_at is null),0);
 if total is null or total<=0 or total>remaining then raise exception 'Terugbetaling hoger dan resterende uitgave';end if;
 if jsonb_array_length(payments)=0 or jsonb_array_length(shares)=0 or (select sum((x->>'amount_cents')::bigint) from jsonb_array_elements(payments) x)<>total or (select sum((x->>'amount_cents')::bigint) from jsonb_array_elements(shares) x)<>total then raise exception 'Betalingen en aandelen moeten exact overeenkomen';end if;
 for allocation in select (x->>'user_id')::uuid as u,(x->>'amount_cents')::bigint as amount from jsonb_array_elements(shares) x loop
  remaining=coalesce((select amount_cents from expense_shares where expense_id=original and user_id=allocation.u),0)-coalesce((select sum(s.amount_cents) from expense_shares s join expenses e on e.id=s.expense_id where e.refund_of=original and e.reversed_at is null and s.user_id=allocation.u),0);
  if allocation.amount>remaining then raise exception 'Terugbetaald aandeel hoger dan oorspronkelijk aandeel';end if;
 end loop;
 insert into expenses(household_id,title,description,amount_cents,expense_date,category,room_id,project_id,idempotency_key,refund_of) values(h,entry->>'title',coalesce(entry->>'description',''),total,(entry->>'expense_date')::date,parent.category,parent.room_id,parent.project_id,request_id,original) returning id into e;
 insert into expense_payments(household_id,expense_id,user_id,amount_cents) select h,e,(x->>'user_id')::uuid,(x->>'amount_cents')::bigint from jsonb_array_elements(payments) x;
 insert into expense_shares(household_id,expense_id,user_id,amount_cents) select h,e,(x->>'user_id')::uuid,(x->>'amount_cents')::bigint from jsonb_array_elements(shares) x;
 return e;end$$;
create or replace function public.member_balance(h uuid,u uuid) returns bigint language sql stable security definer set search_path=public as $$
 select case when is_member(h) then
 coalesce((select sum(p.amount_cents*case when e.refund_of is null then 1 else -1 end) from expense_payments p join expenses e on e.id=p.expense_id where e.household_id=h and e.reversed_at is null and p.user_id=u),0)
 -coalesce((select sum(s.amount_cents*case when e.refund_of is null then 1 else -1 end) from expense_shares s join expenses e on e.id=s.expense_id where e.household_id=h and e.reversed_at is null and s.user_id=u),0)
 +coalesce((select sum(amount_cents) from settlements where household_id=h and from_user=u and reversed_at is null),0)
 -coalesce((select sum(amount_cents) from settlements where household_id=h and to_user=u and reversed_at is null),0) else null end
$$;
create or replace function public.reverse_financial(h uuid,record_id uuid,kind text) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 if kind='expenses' then
 update expenses set reversed_at=now() where id=record_id and household_id=h and reversed_at is null;
 if not found then raise exception 'Uitgave al teruggedraaid';end if;
 update expenses set reversed_at=now() where refund_of=record_id and household_id=h and reversed_at is null;
 update wishlist_items set expense_id=null,status='Goedgekeurd' where expense_id=record_id and household_id=h;
 elsif kind='settlements' then
 update settlements set reversed_at=now() where id=record_id and household_id=h and reversed_at is null;
 if not found then raise exception 'Verrekening al teruggedraaid';end if;
 else raise exception 'Ongeldig type';end if;
 insert into activity_log(household_id,entity,entity_id,action,title) values(h,kind,record_id,'REVERSE','Financiële correctie');end$$;
revoke execute on function public.record_refund(uuid,uuid,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.record_refund(uuid,uuid,jsonb,jsonb,jsonb,uuid) to authenticated;
commit;
