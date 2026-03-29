-- Add length constraint to reviews comment
ALTER TABLE public.reviews ADD CONSTRAINT reviews_comment_length CHECK (length(comment) <= 1000);

-- Set search_path on all functions for security
ALTER FUNCTION public.has_permission(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.get_week_start() SET search_path = 'public';
ALTER FUNCTION public.handle_updated_at() SET search_path = 'public';
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.insert_api_key(api_key_type, text, text) SET search_path = 'public';
ALTER FUNCTION public.update_api_key(api_key_type, text) SET search_path = 'public';
ALTER FUNCTION public.add_xp_and_check_rewards(uuid, integer, text, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.award_order_xp() SET search_path = 'public';
ALTER FUNCTION public.award_referral_xp() SET search_path = 'public';
ALTER FUNCTION public.award_review_xp() SET search_path = 'public';
ALTER FUNCTION public.calculate_level(integer) SET search_path = 'public';
ALTER FUNCTION public.check_challenge_progress(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.check_challenges_on_order() SET search_path = 'public';
ALTER FUNCTION public.check_table_availability(uuid, text, date, time, time, uuid) SET search_path = 'public';
ALTER FUNCTION public.check_weekly_challenge_progress(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.check_weekly_challenges_on_order() SET search_path = 'public';
ALTER FUNCTION public.check_weekly_challenges_on_review() SET search_path = 'public';
ALTER FUNCTION public.generate_daily_challenges(uuid) SET search_path = 'public';
ALTER FUNCTION public.generate_referral_code(uuid) SET search_path = 'public';
ALTER FUNCTION public.generate_weekly_challenges(uuid) SET search_path = 'public';
ALTER FUNCTION public.get_api_key(api_key_type) SET search_path = 'public';
ALTER FUNCTION public.get_api_key_internal(api_key_type) SET search_path = 'public';