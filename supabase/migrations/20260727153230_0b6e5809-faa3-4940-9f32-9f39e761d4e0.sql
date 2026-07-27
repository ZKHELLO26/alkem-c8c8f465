
-- 1) Convert RLS helper functions to SECURITY INVOKER.
--    These only read dashboard_access rows the caller already owns via
--    access_read_own, so they don't need definer privilege.
ALTER FUNCTION public.can_view_org(text) SECURITY INVOKER;
ALTER FUNCTION public.current_org_code() SECURITY INVOKER;
ALTER FUNCTION public.current_role_name() SECURITY INVOKER;
ALTER FUNCTION public.has_dashboard_role(text) SECURITY INVOKER;
ALTER FUNCTION public.is_member_of(text) SECURITY INVOKER;
ALTER FUNCTION public.is_org_admin_of(text) SECURITY INVOKER;
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
ALTER FUNCTION public.my_org() SECURITY INVOKER;

-- 2) Revoke authenticated EXECUTE from anon-only public RPCs so signed-in
--    users can't invoke definer functions meant only for the public scan form.
REVOKE EXECUTE ON FUNCTION public.lookup_employee_public(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.search_doctors_public(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_public_scan(jsonb) FROM authenticated;

-- 3) Remove the redundant permissive read-all policy on parameter_visibility;
--    org-scoped policy (params_visibility_client_read) remains.
DROP POLICY IF EXISTS param_vis_read_all ON public.parameter_visibility;

-- 4) Restrict scan_parameters SELECT to dashboard staff only (any org).
DROP POLICY IF EXISTS read_scan_parameters ON public.scan_parameters;
CREATE POLICY dashboard_read_scan_parameters ON public.scan_parameters
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dashboard_access da WHERE da.user_id = auth.uid()));
