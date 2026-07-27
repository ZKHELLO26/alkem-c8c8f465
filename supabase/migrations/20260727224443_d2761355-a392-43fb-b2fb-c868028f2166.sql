INSERT INTO public.report_queue (
  scan_id, org_code, name, country_code, mobile, report_payload,
  status, attempts, next_attempt_at, created_at, updated_at
)
SELECT
  s.id::text,
  s.org_code,
  s.user_name,
  s.user_country_code,
  s.user_mobile,
  jsonb_build_object(
    'details', jsonb_build_object(
      'name', s.user_name, 'email', s.user_email, 'countryCode', s.user_country_code,
      'mobile', s.user_mobile, 'heightCm', s.height_cm, 'weightKg', s.weight_kg,
      'waistIn', s.waist_in, 'age', s.age, 'sex', s.sex,
      'employeeCode', s.employee_code, 'employeeName', s.employee_name,
      'employeeHq', s.employee_hq, 'employeeRegion', s.employee_region,
      'managerCode', s.manager_code, 'managerName', s.manager_name,
      'managerDesignation', s.manager_designation, 'doctorCode', s.doctor_code,
      'doctorName', s.doctor_name, 'doctorSpeciality', s.doctor_speciality,
      'doctorCity', s.doctor_city, 'orgCode', s.org_code, 'scanType', s.scan_type
    ),
    'results', COALESCE(s.results, '{}'::jsonb),
    'answers', COALESCE(s.lifestyle, '{}'::jsonb)
  ),
  'pending', 0, now(), now(), now()
FROM public.scan_submissions s
WHERE s.id = '3a29eaca-e01d-4714-abbb-43249dc2ef80'::uuid
  AND s.user_mobile IS NOT NULL
ON CONFLICT (scan_id) DO NOTHING;