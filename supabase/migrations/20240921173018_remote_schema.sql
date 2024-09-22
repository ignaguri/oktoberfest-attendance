create policy "Allow authenticated users to upload"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (((bucket_id = 'beer_pictures'::text) AND (auth.role() = 'authenticated'::text)));


create policy "Allow public read access"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'beer_pictures'::text));



