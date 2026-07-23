
-- 1. Add flat, human-readable columns to scan_submissions for easy CSV export
ALTER TABLE public.scan_submissions
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS user_country_code text,
  ADD COLUMN IF NOT EXISTS user_mobile text,
  ADD COLUMN IF NOT EXISTS answer_exercise text,
  ADD COLUMN IF NOT EXISTS answer_family_history text,
  ADD COLUMN IF NOT EXISTS answer_fried_food text,
  ADD COLUMN IF NOT EXISTS answer_sleep text,
  ADD COLUMN IF NOT EXISTS wellness_score integer,
  ADD COLUMN IF NOT EXISTS heart_rate integer,
  ADD COLUMN IF NOT EXISTS respiration numeric,
  ADD COLUMN IF NOT EXISTS hrv numeric,
  ADD COLUMN IF NOT EXISTS stress integer,
  ADD COLUMN IF NOT EXISTS spo2_low numeric,
  ADD COLUMN IF NOT EXISTS spo2_high numeric,
  ADD COLUMN IF NOT EXISTS bp_sys_low integer,
  ADD COLUMN IF NOT EXISTS bp_sys_high integer,
  ADD COLUMN IF NOT EXISTS bp_dia_low integer,
  ADD COLUMN IF NOT EXISTS bp_dia_high integer,
  ADD COLUMN IF NOT EXISTS bmi numeric,
  ADD COLUMN IF NOT EXISTS absi numeric,
  ADD COLUMN IF NOT EXISTS ideal_weight numeric,
  ADD COLUMN IF NOT EXISTS vo2_max numeric,
  ADD COLUMN IF NOT EXISTS cardiac_workload numeric,
  ADD COLUMN IF NOT EXISTS hrr numeric,
  ADD COLUMN IF NOT EXISTS sdnn numeric,
  ADD COLUMN IF NOT EXISTS rmssd numeric,
  ADD COLUMN IF NOT EXISTS pnn50 numeric,
  ADD COLUMN IF NOT EXISTS cardiac_output numeric,
  ADD COLUMN IF NOT EXISTS map_mmhg numeric,
  ADD COLUMN IF NOT EXISTS hr_max integer,
  ADD COLUMN IF NOT EXISTS target_hr_low integer,
  ADD COLUMN IF NOT EXISTS target_hr_high integer,
  ADD COLUMN IF NOT EXISTS heart_utilized numeric,
  ADD COLUMN IF NOT EXISTS blood_volume numeric,
  ADD COLUMN IF NOT EXISTS total_body_water numeric,
  ADD COLUMN IF NOT EXISTS body_water_pct numeric,
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric,
  ADD COLUMN IF NOT EXISTS hypertension_risk text,
  ADD COLUMN IF NOT EXISTS diabetes_risk text,
  ADD COLUMN IF NOT EXISTS dyslipidemia_risk text,
  ADD COLUMN IF NOT EXISTS obesity_risk text,
  ADD COLUMN IF NOT EXISTS cardio_risk text,
  ADD COLUMN IF NOT EXISTS skin_age integer,
  ADD COLUMN IF NOT EXISTS skin_age_confidence text,
  ADD COLUMN IF NOT EXISTS bmr integer,
  ADD COLUMN IF NOT EXISTS tdee integer;

-- 2. Rewrite record_public_scan to populate these flat columns
CREATE OR REPLACE FUNCTION public.record_public_scan(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
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
  PERFORM set_config('app.record_public_scan', 'on', true);

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
