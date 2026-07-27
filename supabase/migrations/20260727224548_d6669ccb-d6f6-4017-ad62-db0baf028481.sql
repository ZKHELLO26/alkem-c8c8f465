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