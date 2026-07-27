
CREATE POLICY "wa_reports_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'whatsapp-reports');

CREATE POLICY "wa_reports_anon_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'whatsapp-reports');

CREATE POLICY "wa_reports_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-reports');

CREATE POLICY "wa_reports_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-reports');
