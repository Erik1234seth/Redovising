-- Fix Storage Upload Issue
-- Run this in Supabase SQL Editor

-- 1. Drop all existing policies on storage.objects
DROP POLICY IF EXISTS "Allow uploads to order-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read order-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete order-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow file uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow file reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow file deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- 2. Create simple, permissive policies for order-files bucket
-- Allow ANYONE (including anon users) to upload
CREATE POLICY "order_files_insert_policy"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'order-files');

-- Allow ANYONE to read files
CREATE POLICY "order_files_select_policy"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'order-files');

-- Allow ANYONE to update files
CREATE POLICY "order_files_update_policy"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'order-files');

-- Allow ANYONE to delete files
CREATE POLICY "order_files_delete_policy"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'order-files');

-- 3. Make sure bucket exists and is set to public for easier access
UPDATE storage.buckets
SET public = true
WHERE id = 'order-files';

-- 4. Verify setup
SELECT 'Bucket config:' as info;
SELECT id, name, public FROM storage.buckets WHERE id = 'order-files';

SELECT 'Storage policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE 'order_files%'
ORDER BY policyname;
