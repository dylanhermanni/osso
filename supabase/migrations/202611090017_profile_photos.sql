begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

create policy profile_photos_read on storage.objects
for select to authenticated using (
  bucket_id = 'profile-photos'
  and public.is_member(nullif(split_part(name, '/', 1), '')::uuid)
);

create policy profile_photos_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'profile-photos'
  and name = split_part(name, '/', 1) || '/' || auth.uid()::text
  and public.is_member(nullif(split_part(name, '/', 1), '')::uuid)
);

create policy profile_photos_update_own on storage.objects
for update to authenticated using (
  bucket_id = 'profile-photos'
  and name = split_part(name, '/', 1) || '/' || auth.uid()::text
  and public.is_member(nullif(split_part(name, '/', 1), '')::uuid)
) with check (
  bucket_id = 'profile-photos'
  and name = split_part(name, '/', 1) || '/' || auth.uid()::text
  and public.is_member(nullif(split_part(name, '/', 1), '')::uuid)
);

commit;
