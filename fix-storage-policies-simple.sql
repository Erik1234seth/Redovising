-- Simple fix for Storage upload timeout issue
-- Run this in Supabase SQL Editor

-- 1. Drop ALL existing policies on storage.objects for order-files bucket
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'objects'
        AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- 2. Create ONE simple policy that allows EVERYTHING for order-files bucket
CREATE POLICY "order_files_all_access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'order-files')
WITH CHECK (bucket_id = 'order-files');

-- 3. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 4. Verify setup
SELECT
    'Bucket configuration:' as info,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'order-files';

SELECT
    'Active policies:' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%order_files%';
