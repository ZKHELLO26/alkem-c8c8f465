
REVOKE EXECUTE ON FUNCTION public.current_role_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin_of(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_member_of(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_dashboard_role(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_scan_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_org_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_member_of(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_dashboard_role(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_scan_limits() TO service_role;
