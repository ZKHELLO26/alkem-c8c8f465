
-- Convert dashboard helper functions from SECURITY DEFINER to SECURITY INVOKER.
-- They only read rows the caller can already see (dashboard_access rows are
-- exposed to the owner via the da_self_read policy), so DEFINER is unnecessary
-- and DEFINER + authenticated EXECUTE is flagged by the linter.
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
ALTER FUNCTION public.is_member_of(text) SECURITY INVOKER;
ALTER FUNCTION public.is_org_admin_of(text) SECURITY INVOKER;
ALTER FUNCTION public.current_role_name() SECURITY INVOKER;
ALTER FUNCTION public.current_org_code() SECURITY INVOKER;
