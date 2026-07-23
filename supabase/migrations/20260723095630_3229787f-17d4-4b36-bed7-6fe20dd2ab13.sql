
-- 1) Drop overly-broad anon SELECT policies
DROP POLICY IF EXISTS public_read_doctors_lookup ON public.doctors_master;
DROP POLICY IF EXISTS public_read_employees_lookup ON public.employees_master;
DROP POLICY IF EXISTS "read field_definitions" ON public.field_definitions;
DROP POLICY IF EXISTS "read field_options" ON public.field_options;
DROP POLICY IF EXISTS pv_read ON public.parameter_visibility;
DROP POLICY IF EXISTS scan_links_public_read ON public.scan_links;
DROP POLICY IF EXISTS scan_links_public_bump ON public.scan_links;

-- 2) Drop GUC-based anon policies on scan_users/scan_submissions — the RPC will run as SECURITY DEFINER
DROP POLICY IF EXISTS public_scan_rpc_read_submissions ON public.scan_submissions;
DROP POLICY IF EXISTS public_scan_rpc_insert_submissions ON public.scan_submissions;
DROP POLICY IF EXISTS public_scan_rpc_read_users ON public.scan_users;
DROP POLICY IF EXISTS public_scan_rpc_insert_users ON public.scan_users;
DROP POLICY IF EXISTS public_scan_rpc_update_users ON public.scan_users;

-- 3) Convert record_public_scan to SECURITY DEFINER so it can write despite RLS
CREATE OR REPLACE FUNCTION public.record_public_scan(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scan_id uuid;
  v_requested_user_id uuid;
  v_user_id uuid;
  v_email text;
  v_email_norm text;
  v_country_code text;
  v_mobile text;
  v_mobile_norm text;
  v_name text;
  v_now timestamptz := now();
  v_ref_code text;
  v_inserted_count integer := 0;
  v_results jsonb;
  v_answers jsonb;
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

  v_name := NULLIF(left(COALESCE(p_payload #>> '{user,name}', ''), 200), '');
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
    v_user_id, v_name, v_email, v_country_code, v_mobile, v_email_norm, v_mobile_norm, v_now
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

  v_results := COALESCE(p_payload->'results', '{}'::jsonb);
  v_answers := COALESCE(p_payload->'lifestyle', '{}'::jsonb);

  INSERT INTO public.scan_submissions (
    id, ref_code, user_id, app_version, user_agent, ip_country,
    consent_version, consent_text_hash, consented, consented_comms, consented_at,
    age, sex, height_cm, weight_kg, waist_in,
    employee_code, employee_name, employee_hq, employee_region,
    doctor_code, doctor_name, doctor_speciality, doctor_city, org_code,
    scan_type, lifestyle, raw_inputs, results, expression,
    duration_s, fps, motion_score, lighting_score, confidence, source_mode,
    user_name, user_email, user_country_code, user_mobile,
    answer_exercise, answer_family_history, answer_fried_food, answer_sleep,
    wellness_score, heart_rate, respiration, hrv, stress,
    spo2_low, spo2_high, bp_sys_low, bp_sys_high, bp_dia_low, bp_dia_high,
    bmi, absi, ideal_weight, vo2_max, cardiac_workload, hrr,
    sdnn, rmssd, pnn50, cardiac_output, map_mmhg,
    hr_max, target_hr_low, target_hr_high, heart_utilized,
    blood_volume, total_body_water, body_water_pct, body_fat_pct,
    hypertension_risk, diabetes_risk, dyslipidemia_risk, obesity_risk, cardio_risk,
    skin_age, skin_age_confidence, bmr, tdee
  ) VALUES (
    v_scan_id,
    v_ref_code,
    v_user_id,
    NULLIF(left(COALESCE(p_payload->>'appVersion', ''), 32), ''),
    NULLIF(left(COALESCE(p_payload->>'userAgent', ''), 500), ''),
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
    v_answers,
    p_payload->'rawInputs',
    v_results,
    p_payload->'expression',
    NULLIF(p_payload #>> '{quality,durationS}', '')::numeric,
    NULLIF(p_payload #>> '{quality,fps}', '')::numeric,
    NULLIF(p_payload #>> '{quality,motionScore}', '')::numeric,
    NULLIF(p_payload #>> '{quality,lightingScore}', '')::numeric,
    NULLIF(left(COALESCE(p_payload #>> '{quality,confidence}', ''), 16), ''),
    NULLIF(left(COALESCE(p_payload #>> '{quality,sourceMode}', ''), 32), ''),
    v_name, v_email, v_country_code, v_mobile,
    NULLIF(v_answers->>'exercise', ''),
    NULLIF(v_answers->>'familyHistory', ''),
    NULLIF(v_answers->>'friedFood', ''),
    NULLIF(v_answers->>'sleep', ''),
    NULLIF(v_results->>'wellnessScore', '')::integer,
    NULLIF(v_results->>'heartRate', '')::integer,
    NULLIF(v_results->>'respiration', '')::numeric,
    NULLIF(v_results->>'hrv', '')::numeric,
    NULLIF(v_results->>'stress', '')::integer,
    NULLIF(v_results->>'spo2Low', '')::numeric,
    NULLIF(v_results->>'spo2High', '')::numeric,
    NULLIF(v_results->>'bpSysLow', '')::integer,
    NULLIF(v_results->>'bpSysHigh', '')::integer,
    NULLIF(v_results->>'bpDiaLow', '')::integer,
    NULLIF(v_results->>'bpDiaHigh', '')::integer,
    NULLIF(v_results->>'bmi', '')::numeric,
    NULLIF(v_results->>'absi', '')::numeric,
    NULLIF(v_results->>'idealWeight', '')::numeric,
    NULLIF(v_results->>'vo2Max', '')::numeric,
    NULLIF(v_results->>'cardiacWorkload', '')::numeric,
    NULLIF(v_results->>'hrr', '')::numeric,
    NULLIF(v_results->>'sdnn', '')::numeric,
    NULLIF(v_results->>'rmssd', '')::numeric,
    NULLIF(v_results->>'pnn50', '')::numeric,
    NULLIF(v_results->>'cardiacOutput', '')::numeric,
    NULLIF(v_results->>'map', '')::numeric,
    NULLIF(v_results->>'hrMax', '')::integer,
    NULLIF(v_results->>'targetHrLow', '')::integer,
    NULLIF(v_results->>'targetHrHigh', '')::integer,
    NULLIF(v_results->>'heartUtilized', '')::numeric,
    NULLIF(v_results->>'bloodVolume', '')::numeric,
    NULLIF(v_results->>'totalBodyWater', '')::numeric,
    NULLIF(v_results->>'bodyWaterPct', '')::numeric,
    NULLIF(v_results->>'bodyFatPct', '')::numeric,
    NULLIF(v_results->>'hypertensionRisk', ''),
    NULLIF(v_results->>'diabetesRisk', ''),
    NULLIF(v_results->>'dyslipidemiaRisk', ''),
    NULLIF(v_results->>'obesityRisk', ''),
    NULLIF(v_results->>'cardioRisk', ''),
    NULLIF(v_results->>'skinAge', '')::integer,
    NULLIF(v_results->>'skinAgeConfidence', ''),
    NULLIF(v_results->>'bmr', '')::integer,
    NULLIF(v_results->>'tdee', '')::integer
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count = 1 THEN
    UPDATE public.scan_users
    SET scans_count = COALESCE(scans_count, 0) + 1
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'refCode', v_ref_code, 'scanId', v_scan_id, 'userId', v_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_public_scan(jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_public_scan(jsonb) TO anon, service_role;

-- 4) Public lookup RPCs for employees/doctors
CREATE OR REPLACE FUNCTION public.lookup_employee_public(p_emp_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(regexp_replace(COALESCE(p_emp_code, ''), '\s', '', 'g'));
  v_row record;
BEGIN
  IF length(v_code) < 2 OR length(v_code) > 20 THEN
    RETURN NULL;
  END IF;
  SELECT emp_code, emp_name, designation, hq, region, org_code
    INTO v_row
  FROM public.employees_master
  WHERE emp_code = v_code
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'empCode', v_row.emp_code,
    'empName', v_row.emp_name,
    'designation', v_row.designation,
    'hq', v_row.hq,
    'region', v_row.region,
    'orgCode', v_row.org_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_employee_public(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_employee_public(text) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.search_doctors_public(p_emp_code text, p_query text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text := upper(regexp_replace(COALESCE(p_emp_code, ''), '\s', '', 'g'));
  v_q text := COALESCE(p_query, '');
  v_safe text;
  v_result jsonb;
BEGIN
  IF length(v_code) < 2 OR length(v_code) > 20 THEN
    RETURN '[]'::jsonb;
  END IF;
  IF length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;
  v_safe := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_result FROM (
    SELECT jsonb_build_object(
      'doctorCode', doctor_code,
      'doctorName', doctor_name,
      'speciality', speciality,
      'hq', hq,
      'subarea', subarea
    ) AS x
    FROM public.doctors_master
    WHERE emp_code = v_code
      AND (v_safe = '' OR doctor_name ILIKE '%' || v_safe || '%')
    ORDER BY doctor_name ASC
    LIMIT 15
  ) t;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_doctors_public(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.search_doctors_public(text, text) TO anon, service_role;
