-- Explicit deny (via absence of any permissive policy) for anon/authenticated
-- on the whatsapp-reports private bucket. We add restrictive-style policies
-- that always evaluate FALSE for these roles, making the intent auditable.

DROP POLICY IF EXISTS "whatsapp_reports_no_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_reports_no_auth_delete" ON storage.objects;

CREATE POLICY "whatsapp_reports_no_anon_select" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO anon
  USING (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_anon_insert" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO anon
  WITH CHECK (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_anon_update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO anon
  USING (bucket_id <> 'whatsapp-reports')
  WITH CHECK (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_anon_delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO anon
  USING (bucket_id <> 'whatsapp-reports');

CREATE POLICY "whatsapp_reports_no_auth_select" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_auth_insert" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_auth_update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'whatsapp-reports')
  WITH CHECK (bucket_id <> 'whatsapp-reports');
CREATE POLICY "whatsapp_reports_no_auth_delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'whatsapp-reports');