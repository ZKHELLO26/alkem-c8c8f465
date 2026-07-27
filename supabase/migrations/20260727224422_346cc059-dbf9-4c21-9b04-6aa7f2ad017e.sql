CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'process-whatsapp-report-queue' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'process-whatsapp-report-queue',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://facescan.ap.zeikonglobal.com/api/public/report-queue',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZ3JjeXV4b25kbHp5anRhdHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzkxMTUsImV4cCI6MjEwMDMxNTExNX0.6me6JsYdwTbWstw8CwzOtiCb0C2E6nuSSi-NOegcLFc"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $job$
);