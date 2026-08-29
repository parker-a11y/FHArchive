REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved_guest(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_archive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_guest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_archive(uuid) TO authenticated;