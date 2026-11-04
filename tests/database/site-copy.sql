-- Authorization, optimistic concurrency and reset checks. All data changes roll back.
begin;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 assert not public.is_content_admin(), 'Anonymous visitor became admin';
 assert not has_function_privilege('anon','public.save_site_copy(text,text,integer)','EXECUTE'), 'Anonymous save permission';
 assert not has_table_privilege('anon','public.site_copy','INSERT'), 'Anonymous insert permission';
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$declare denied boolean=false;begin
 assert not public.is_content_admin(), 'Unlisted user became admin';
 begin perform public.save_site_copy('copy_deadbeef','Unwanted change',0);exception when others then denied=true;end;
 assert denied, 'Non-admin save succeeded';
 assert not has_table_privilege('authenticated','public.site_copy','UPDATE'), 'Direct writes bypass RPC';
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"2cf7587f-a787-4517-acab-5106b7812768","role":"authenticated"}',true);
do $$declare result jsonb;conflict boolean=false;begin
 assert public.is_content_admin(), 'Owner is not admin';
 result=public.save_site_copy('copy_deadbeef','Integration test only',0);
 assert (result->>'version')::integer=1 and result->>'value'='Integration test only', 'First save failed';
 begin perform public.save_site_copy('copy_deadbeef','Stale change',0);exception when others then conflict=sqlerrm like '%COPY_CONFLICT%';end;
 assert conflict, 'Stale version overwritten';
 result=public.save_site_copy('copy_deadbeef',null,1);
 assert (result->>'version')::integer=2 and result->>'value' is null, 'Reset lost version';
 assert (select count(*) from public.site_copy_history where key='copy_deadbeef')=2, 'History missing';
end$$;
reset role;
select 'PASS: anonymous and non-admin blocked; owner save, conflict, reset and history verified; all changes rolled back' as result;
rollback;
