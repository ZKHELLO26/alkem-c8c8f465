
-- 0029: revoke EXECUTE from authenticated on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.can_view_org(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_org() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_scan_limits() FROM authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.consume_scan_link(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_scan_link(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_employee_public(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_public_scan(jsonb) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_doctors_public(text, text) FROM authenticated, PUBLIC;

-- Keep anon access for the browser-facing RPCs
GRANT EXECUTE ON FUNCTION public.consume_scan_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_scan_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_employee_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_public_scan(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.search_doctors_public(text, text) TO anon;

-- 0011: set fixed search_path on the only function missing one
ALTER FUNCTION public.get_kpi_counts(text) SET search_path = public;
