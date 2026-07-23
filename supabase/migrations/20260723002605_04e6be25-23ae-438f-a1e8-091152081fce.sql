CREATE OR REPLACE FUNCTION public.flag_scan_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_used int;
  v_limit int;
  v_valid_from date;
  v_valid_to date;
BEGIN
  SELECT monthly_limit, valid_from, valid_to
    INTO v_limit, v_valid_from, v_valid_to
  FROM public.org_products
  WHERE org_code = NEW.org_code AND product_code = NEW.scan_type;

  IF v_valid_to IS NOT NULL AND NEW.created_at::date > v_valid_to THEN
    NEW.over_expiry := true;
  END IF;
  IF v_valid_from IS NOT NULL AND NEW.created_at::date < v_valid_from THEN
    NEW.over_expiry := true;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used
    FROM public.scan_submissions
    WHERE org_code = NEW.org_code
      AND scan_type = NEW.scan_type
      AND (v_valid_from IS NULL OR created_at::date >= v_valid_from)
      AND (v_valid_to   IS NULL OR created_at::date <= v_valid_to);
    IF v_used >= v_limit THEN
      NEW.over_limit := true;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.flag_scan_limits() FROM PUBLIC, anon, authenticated;