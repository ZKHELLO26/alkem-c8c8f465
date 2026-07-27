DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'process-whatsapp-report-queue' AND active = true
  ) THEN
    RAISE EXCEPTION 'Automatic WhatsApp report retry job is not active';
  END IF;
END;
$$;