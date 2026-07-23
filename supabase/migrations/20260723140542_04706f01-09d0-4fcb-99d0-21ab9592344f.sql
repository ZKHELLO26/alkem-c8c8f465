REVOKE EXECUTE ON FUNCTION public.is_org_admin_of(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_role_name() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_org_code() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated, PUBLIC;