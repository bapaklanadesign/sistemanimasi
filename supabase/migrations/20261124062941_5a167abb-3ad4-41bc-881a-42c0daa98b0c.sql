REVOKE EXECUTE ON FUNCTION public.public_track_packing_list(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_track_packing_list(uuid) TO service_role;