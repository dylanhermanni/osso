begin;
create function public.delete_document(h uuid,item uuid,expected_version integer) returns text language plpgsql security definer set search_path=public as $$declare path text;begin
 if not is_member(h) then raise exception 'Geen toegang';end if;
 select storage_path into path from documents where id=item and household_id=h and version=expected_version for update;
 if path is null then raise exception 'Document is gewijzigd';end if;
 delete from room_photos where household_id=h and storage_path=path;
 delete from idea_photos where household_id=h and storage_path=path;
 delete from project_photos where household_id=h and storage_path=path;
 delete from task_photos where household_id=h and storage_path=path;
 delete from documents where id=item and household_id=h;return path;end$$;
revoke execute on function public.delete_document(uuid,uuid,integer) from public,anon;
grant execute on function public.delete_document(uuid,uuid,integer) to authenticated;
commit;
