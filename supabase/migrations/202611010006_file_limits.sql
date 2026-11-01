begin;
-- Server Action uploads stay comfortably below Vercel's 4.5 MB request ceiling.
update storage.buckets set file_size_limit=3145728 where id='home-files';
commit;
