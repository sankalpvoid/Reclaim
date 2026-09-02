-- Revoke direct Data API execution of the SECURITY DEFINER auth trigger function.
-- The auth.users trigger can still invoke it internally.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
