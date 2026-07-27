ALTER TABLE public.report_queue
  ADD COLUMN IF NOT EXISTS report_payload jsonb,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS report_queue_dispatch_idx
  ON public.report_queue (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'sending');

CREATE OR REPLACE FUNCTION public.enqueue_scan_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_mobile IS NULL OR NEW.user_country_code IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.report_queue (
    scan_id, org_code, name, country_code, mobile, report_payload,
    status, attempts, next_attempt_at, created_at, updated_at
  ) VALUES (
    NEW.id::text,
    NEW.org_code,
    NEW.user_name,
    NEW.user_country_code,
    NEW.user_mobile,
    jsonb_build_object(
      'details', jsonb_build_object(
        'name', NEW.user_name,
        'email', NEW.user_email,
        'countryCode', NEW.user_country_code,
        'mobile', NEW.user_mobile,
        'heightCm', NEW.height_cm,
        'weightKg', NEW.weight_kg,
        'waistIn', NEW.waist_in,
        'age', NEW.age,
        'sex', NEW.sex,
        'employeeCode', NEW.employee_code,
        'employeeName', NEW.employee_name,
        'employeeHq', NEW.employee_hq,
        'employeeRegion', NEW.employee_region,
        'managerCode', NEW.manager_code,
        'managerName', NEW.manager_name,
        'managerDesignation', NEW.manager_designation,
        'doctorCode', NEW.doctor_code,
        'doctorName', NEW.doctor_name,
        'doctorSpeciality', NEW.doctor_speciality,
        'doctorCity', NEW.doctor_city,
        'orgCode', NEW.org_code,
        'scanType', NEW.scan_type
      ),
      'results', COALESCE(NEW.results, '{}'::jsonb),
      'answers', COALESCE(NEW.lifestyle, '{}'::jsonb)
    ),
    'pending',
    0,
    now(),
    now(),
    now()
  )
  ON CONFLICT (scan_id) DO UPDATE SET
    org_code = EXCLUDED.org_code,
    name = EXCLUDED.name,
    country_code = EXCLUDED.country_code,
    mobile = EXCLUDED.mobile,
    report_payload = COALESCE(public.report_queue.report_payload, EXCLUDED.report_payload),
    next_attempt_at = LEAST(public.report_queue.next_attempt_at, now()),
    updated_at = now()
  WHERE public.report_queue.status <> 'sent';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_scan_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_scan_report() TO service_role;

DROP TRIGGER IF EXISTS enqueue_scan_report_after_insert ON public.scan_submissions;
CREATE TRIGGER enqueue_scan_report_after_insert
AFTER INSERT ON public.scan_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_scan_report();

CREATE OR REPLACE FUNCTION public.claim_report_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF public.report_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.report_queue q
    WHERE q.attempts < 8
      AND q.report_payload IS NOT NULL
      AND q.pdf_path IS NULL
      AND (
        (q.status IN ('pending', 'failed') AND q.next_attempt_at <= now())
        OR (q.status = 'sending' AND q.updated_at < now() - interval '5 minutes')
      )
    ORDER BY q.next_attempt_at, q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
  )
  UPDATE public.report_queue q
  SET status = 'sending',
      attempts = q.attempts + 1,
      updated_at = now(),
      last_error = NULL
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_report_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_jobs(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_report_job(
  p_id uuid,
  p_ok boolean,
  p_pdf_path text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.report_queue
  SET status = CASE WHEN p_ok THEN 'sent' ELSE 'failed' END,
      pdf_path = COALESCE(p_pdf_path, pdf_path),
      last_error = CASE WHEN p_ok THEN NULL ELSE left(COALESCE(p_error, 'unknown'), 1000) END,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      sent_at = CASE WHEN p_ok THEN COALESCE(sent_at, now()) ELSE sent_at END,
      next_attempt_at = CASE
        WHEN p_ok THEN next_attempt_at
        ELSE now() + make_interval(mins => LEAST(60, GREATEST(1, power(2, LEAST(attempts, 5))::integer)))
      END,
      updated_at = now()
  WHERE id = p_id AND status = 'sending';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_report_job(uuid, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_report_job(uuid, boolean, text, text, text) TO service_role;