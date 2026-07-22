CREATE OR REPLACE FUNCTION public.record_public_scan(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_id uuid;
  v_requested_user_id uuid;
  v_user_id uuid;
  v_email text;
  v_email_norm text;
  v_country_code text;
  v_mobile text;
  v_mobile_norm text;
  v_now timestamptz := now();
  v_ref_code text;
BEGIN
  IF p_payload IS NULL OR pg_column_size(p_payload) > 2000000 THEN
    RAISE EXCEPTION 'Invalid payload size';
  END IF;

  IF COALESCE((p_payload #>> '{consent,consented}')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Consent is required';
  END IF;

  BEGIN
    v_scan_id := (p_payload->>'scanId')::uuid;
    v_requested_user_id := (p_payload->>'userId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid identifier';
  END;

  v_email := NULLIF(left(trim(COALESCE(p_payload #>> '{user,email}', '')), 255), '');
  v_email_norm := CASE WHEN v_email IS NULL THEN NULL ELSE lower(v_email) END;
  v_country_code := NULLIF(left(COALESCE(p_payload #>> '{user,countryCode}', ''), 8), '');
  v_mobile := NULLIF(left(COALESCE(p_payload #>> '{user,mobile}', ''), 32), '');

  IF v_mobile IS NOT NULL THEN
    v_mobile_norm := '+' || regexp_replace(COALESCE(v_country_code, '') || v_mobile, '[^0-9]', '', 'g');
    IF v_mobile_norm = '+' THEN v_mobile_norm := NULL; END IF;
  END IF;

  SELECT id INTO v_user_id
  FROM public.scan_users
  WHERE (v_email_norm IS NOT NULL AND email_norm = v_email_norm)
     OR (v_mobile_norm IS NOT NULL AND mobile_norm = v_mobile_norm)
  ORDER BY CASE WHEN mobile_norm = v_mobile_norm THEN 0 ELSE 1 END
  LIMIT 1;

  v_user_id := COALESCE(v_user_id, v_requested_user_id);

  INSERT INTO public.scan_users (
    id, name, email, country_code, mobile, email_norm, mobile_norm, last_seen_at
  ) VALUES (
    v_user_id,
    NULLIF(left(COALESCE(p_payload #>> '{user,name}', ''), 200), ''),
    v_email,
    v_country_code,
    v_mobile,
    v_email_norm,
    v_mobile_norm,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    country_code = EXCLUDED.country_code,
    mobile = EXCLUDED.mobile,
    email_norm = EXCLUDED.email_norm,
    mobile_norm = EXCLUDED.mobile_norm,
    last_seen_at = EXCLUDED.last_seen_at;

  v_ref_code := 'WS-' || to_char(v_now, 'YYYY') || '-' || upper(left(replace(v_scan_id::text, '-', ''), 8));

  INSERT INTO public.scan_submissions (
    id, ref_code, user_id, app_version, user_agent, ip_country,
    consent_version, consent_text_hash, consented, consented_comms, consented_at,
    age, sex, height_cm, weight_kg, waist_in,
    employee_code, employee_name, employee_hq, employee_region,
    doctor_code, doctor_name, doctor_speciality, doctor_city, org_code,
    scan_type, lifestyle, raw_inputs, results, expression,
    duration_s, fps, motion_score, lighting_score, confidence, source_mode
  ) VALUES (
    v_scan_id,
    v_ref_code,
    v_user_id,
    left(COALESCE(p_payload->>'appVersion', ''), 32),
    left(COALESCE(p_payload->>'userAgent', ''), 500),
    NULLIF(left(COALESCE(p_payload->>'ipCountry', ''), 16), ''),
    left(COALESCE(p_payload #>> '{consent,consentVersion}', ''), 32),
    NULLIF(left(COALESCE(p_payload #>> '{consent,consentTextHash}', ''), 64), ''),
    true,
    COALESCE((p_payload #>> '{consent,communications}')::boolean, false),
    NULLIF(p_payload #>> '{consent,consentedAt}', '')::timestamptz,
    NULLIF(p_payload #>> '{profile,age}', '')::integer,
    NULLIF(left(COALESCE(p_payload #>> '{profile,sex}', ''), 1), ''),
    NULLIF(p_payload #>> '{profile,heightCm}', '')::integer,
    NULLIF(p_payload #>> '{profile,weightKg}', '')::numeric,
    NULLIF(p_payload #>> '{profile,waistIn}', '')::numeric,
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,employeeCode}', ''), 20), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,employeeName}', ''), 200), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,employeeHq}', ''), 120), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,employeeRegion}', ''), 120), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,doctorCode}', ''), 40), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,doctorName}', ''), 200), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,doctorSpeciality}', ''), 120), ''),
    NULLIF(left(COALESCE(p_payload #>> '{fieldForce,doctorCity}', ''), 120), ''),
    COALESCE(NULLIF(left(COALESCE(p_payload #>> '{fieldForce,orgCode}', ''), 40), ''), CASE WHEN p_payload ? 'fieldForce' THEN 'ALKEM' ELSE NULL END),
    'face',
    p_payload->'lifestyle',
    p_payload->'rawInputs',
    p_payload->'results',
    p_payload->'expression',
    NULLIF(p_payload #>> '{quality,durationS}', '')::numeric,
    NULLIF(p_payload #>> '{quality,fps}', '')::numeric,
    NULLIF(p_payload #>> '{quality,motionScore}', '')::numeric,
    NULLIF(p_payload #>> '{quality,lightingScore}', '')::numeric,
    NULLIF(left(COALESCE(p_payload #>> '{quality,confidence}', ''), 16), ''),
    NULLIF(left(COALESCE(p_payload #>> '{quality,sourceMode}', ''), 32), '')
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.scan_users
  SET scans_count = COALESCE(scans_count, 0) + 1
  WHERE id = v_user_id
    AND EXISTS (SELECT 1 FROM public.scan_submissions WHERE id = v_scan_id);

  RETURN jsonb_build_object('ok', true, 'refCode', v_ref_code, 'scanId', v_scan_id, 'userId', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_public_scan(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_public_scan(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_public_scan(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.record_public_scan(jsonb) TO service_role;