UPDATE public.report_queue
SET pdf_path = NULL,
    updated_at = now()
WHERE scan_id = '3a29eaca-e01d-4714-abbb-43249dc2ef80'
  AND status = 'sent';