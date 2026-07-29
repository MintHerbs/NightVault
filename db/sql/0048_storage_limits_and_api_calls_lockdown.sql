-- 0049_storage_limits_and_api_calls_lockdown.sql
-- T-078 (security hardening audit).
--
-- Two independent, low-risk tightenings bundled together since neither
-- needs any client code change:
--
--  1. note-images and avatars (0023, 0043) were created with no
--     file_size_limit/allowed_mime_types, so Supabase Storage enforced
--     neither. imageToWebp.js only shrinks/converts client-side, which a
--     direct API upload bypasses entirely. Caps both buckets at 8 MiB
--     (comfortably above a converted WebP note image or avatar, per the
--     resize targets in imageToWebp.js) and to image/* MIME types, closing
--     both the storage-cost-abuse and upload-an-SVG-with-a-script angles.
--
--  2. api_calls (0003) shipped with fully open insert/update RLS, and its
--     own header comment already flagged this as temporary pending
--     server-side quota enforcement that never happened. src/lib/
--     geminiService.js and src/hooks/useApiCalls.js are both dead code
--     (confirmed: neither is imported anywhere else in the app), so this
--     is currently unreachable rather than actively exploited, but the
--     policy is closed now rather than left open for whenever that
--     feature is revived. Anon/authenticated keep SELECT only; mutation
--     would need a SECURITY DEFINER RPC if the feature comes back.

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 8388608, -- 8 MiB
    allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif']
WHERE id IN ('note-images', 'avatars');

DROP POLICY IF EXISTS "Allow public insert access" ON public.api_calls;
DROP POLICY IF EXISTS "Allow public update access" ON public.api_calls;

COMMIT;
