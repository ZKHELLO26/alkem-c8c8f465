-- Revoke EXECUTE on SECURITY DEFINER functions from authenticated role
-- Anon retains access for public RPCs called by the browser (unauthenticated flow).
REVOKE EXECUTE ON FUNCTION public.record_public_scan(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_employee_public(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.search_doctors_public(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_scan_link(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_scan_link(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_dashboard_role(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.my_org() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_org(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_scan_limits() FROM authenticated;