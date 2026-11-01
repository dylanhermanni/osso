begin;
alter table public.expenses add column reversed_at timestamptz;
create function public.record_expense(h uuid, entry jsonb,payments jsonb,shares jsonb,request_id uuid,product_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare e uuid; total bigint;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 select id into e from expenses where idempotency_key=request_id and household_id=h;if found then return e;end if;
 total=(entry->>'amount_cents')::bigint;
 if total is null or total<=0 or total>100000000 then raise exception 'Ongeldig bedrag';end if;
 if jsonb_array_length(payments)=0 or jsonb_array_length(shares)=0 or (select sum((x->>'amount_cents')::bigint) from jsonb_array_elements(payments) x)<>total or (select sum((x->>'amount_cents')::bigint) from jsonb_array_elements(shares) x)<>total then raise exception 'Betalingen en aandelen moeten exact overeenkomen';end if;
 if product_id is not null then
  perform 1 from wishlist_items where id=product_id and household_id=h and expense_id is null for update;
  if not found then raise exception 'Product is al gekocht of niet toegankelijk';end if;
 end if;
 insert into expenses(household_id,title,description,amount_cents,expense_date,category,room_id,project_id,idempotency_key) values(h,entry->>'title',coalesce(entry->>'description',''),total,(entry->>'expense_date')::date,entry->>'category',nullif(entry->>'room_id','')::uuid,nullif(entry->>'project_id','')::uuid,request_id) returning id into e;
 insert into expense_payments(household_id,expense_id,user_id,amount_cents) select h,e,(x->>'user_id')::uuid,(x->>'amount_cents')::bigint from jsonb_array_elements(payments) x;
 insert into expense_shares(household_id,expense_id,user_id,amount_cents) select h,e,(x->>'user_id')::uuid,(x->>'amount_cents')::bigint from jsonb_array_elements(shares) x;
 if product_id is not null then update wishlist_items set expense_id=e,status='Gekocht' where id=product_id;end if;return e;
end$$;
create function public.member_balance(h uuid,u uuid) returns bigint language sql stable security definer set search_path=public as $$
 select case when is_member(h) then
 coalesce((select sum(p.amount_cents) from expense_payments p join expenses e on e.id=p.expense_id where e.household_id=h and e.reversed_at is null and p.user_id=u),0)
 -coalesce((select sum(s.amount_cents) from expense_shares s join expenses e on e.id=s.expense_id where e.household_id=h and e.reversed_at is null and s.user_id=u),0)
 +coalesce((select sum(amount_cents) from settlements where household_id=h and from_user=u and reversed_at is null),0)
 -coalesce((select sum(amount_cents) from settlements where household_id=h and to_user=u and reversed_at is null),0) else null end
$$;
create function public.record_settlement(h uuid,payer uuid,recipient uuid,cents bigint,request_id uuid) returns uuid language plpgsql security definer set search_path=public as $$declare s uuid;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 select id into s from settlements where idempotency_key=request_id and household_id=h;if found then return s;end if;
 if cents<=0 or cents> -member_balance(h,payer) or cents>member_balance(h,recipient) then raise exception 'Saldo gewijzigd: vernieuw het verrekenvoorstel';end if;
 insert into settlements(household_id,from_user,to_user,amount_cents,idempotency_key) values(h,payer,recipient,cents,request_id) returning id into s;
 insert into activity_log(household_id,entity,entity_id,action,title) values(h,'settlements',s,'INSERT','Verrekening uitgevoerd');return s;end$$;
create function public.reverse_financial(h uuid,record_id uuid,kind text) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 perform 1 from households where id=h for update;
 if kind='expenses' then
 update expenses set reversed_at=now() where id=record_id and household_id=h and reversed_at is null;
 if not found then raise exception 'Uitgave al teruggedraaid';end if;
 update wishlist_items set expense_id=null,status='Goedgekeurd' where expense_id=record_id and household_id=h;
 elsif kind='settlements' then
 update settlements set reversed_at=now() where id=record_id and household_id=h and reversed_at is null;
 if not found then raise exception 'Verrekening al teruggedraaid';end if;
 else raise exception 'Ongeldig type';end if;
 insert into activity_log(household_id,entity,entity_id,action,title) values(h,kind,record_id,'REVERSE','Financiële correctie');end$$;
create function public.complete_maintenance(h uuid,item uuid,expected_version integer,performed date,actual_cents bigint) returns void language plpgsql security definer set search_path=public as $$declare m maintenance_items;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 select * into m from maintenance_items where id=item and household_id=h for update;
 if m.id is null or m.version<>expected_version then raise exception 'Dit onderhoud is ondertussen gewijzigd';end if;
 if performed>current_date or actual_cents<0 then raise exception 'Ongeldige uitvoering';end if;
 insert into maintenance_history(household_id,maintenance_id,performed_on,cost_cents) values(h,item,performed,actual_cents);
 update maintenance_items set last_done=performed,due_date=(performed+make_interval(months=>m.frequency_months))::date where id=item;end$$;
create function public.convert_idea(h uuid,item uuid,target text,expected_version integer) returns uuid language plpgsql security definer set search_path=public as $$declare i ideas; n uuid;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 select * into i from ideas where id=item and household_id=h for update;
 if i.id is null or i.version<>expected_version or i.status='Uitgevoerd' then raise exception 'Idee is gewijzigd of al omgezet';end if;
 if target='projects' then insert into projects(household_id,title,description,room_id,image_url,budget_cents) values(h,i.title,i.description,i.room_id,i.image_url,i.cost_cents) returning id into n;
 elsif target='tasks' then insert into tasks(household_id,title,description,room_id,project_id) values(h,i.title,i.description,i.room_id,i.project_id) returning id into n;
 else raise exception 'Ongeldig doel';end if;
 update ideas set status='Uitgevoerd',project_id=case when target='projects' then n else project_id end where id=item;return n;end$$;
-- Prevent client writes around purchase/financial invariants.
create function public.protect_purchase() returns trigger language plpgsql set search_path=public as $$begin
 if current_user in ('authenticated','anon') and (new.expense_id is distinct from old.expense_id or (new.status='Gekocht' and old.status<>'Gekocht')) then raise exception 'Gebruik de aankooptransactie';end if;return new;end$$;
create trigger protect_purchase before update on public.wishlist_items for each row execute function public.protect_purchase();
-- Definer RPCs only, authenticated callers; trigger functions are not public APIs.
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_member(uuid),public.create_household(text,text),public.create_invitation(uuid,text),public.accept_invitation(text,text),public.record_expense(uuid,jsonb,jsonb,jsonb,uuid,uuid),public.member_balance(uuid,uuid),public.record_settlement(uuid,uuid,uuid,bigint,uuid),public.reverse_financial(uuid,uuid,text),public.complete_maintenance(uuid,uuid,integer,date,bigint),public.convert_idea(uuid,uuid,text,integer) to authenticated;
commit;
