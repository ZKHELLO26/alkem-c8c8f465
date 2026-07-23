-- Remove default PUBLIC execute (which includes authenticated), then re-grant anon only where required.
REVOKE EXECUTE ON FUNCTION public.record_public_scan(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_employee_public(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_doctors_public(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_scan_link(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_scan_link(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_dashboard_role(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_org() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_org(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_scan_limits() FROM PUBLIC;

-- Public RPCs the browser calls anonymously must remain accessible to anon.
GRANT EXECUTE ON FUNCTION public.record_public_scan(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_employee_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_doctors_public(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_scan_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.consume_scan_link(text) TO anon;