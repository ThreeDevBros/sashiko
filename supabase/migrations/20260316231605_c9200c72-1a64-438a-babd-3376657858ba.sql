
-- Drop trigger functions first (they reference the tables)
DROP FUNCTION IF EXISTS public.check_challenges_on_order() CASCADE;
DROP FUNCTION IF EXISTS public.check_weekly_challenges_on_order() CASCADE;
DROP FUNCTION IF EXISTS public.check_weekly_challenges_on_review() CASCADE;
DROP FUNCTION IF EXISTS public.award_review_xp() CASCADE;
DROP FUNCTION IF EXISTS public.award_referral_xp() CASCADE;
DROP FUNCTION IF EXISTS public.award_order_xp() CASCADE;

-- Drop higher-level functions
DROP FUNCTION IF EXISTS public.check_challenge_progress(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_weekly_challenge_progress(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_daily_challenges(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_weekly_challenges(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_referral_code(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_xp_and_check_rewards(uuid, integer, text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_level(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_week_start() CASCADE;

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS public.user_daily_challenges CASCADE;
DROP TABLE IF EXISTS public.user_weekly_challenges CASCADE;
DROP TABLE IF EXISTS public.daily_challenges CASCADE;
DROP TABLE IF EXISTS public.weekly_challenges CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.user_rewards CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.xp_config CASCADE;
DROP TABLE IF EXISTS public.food_pass_purchases CASCADE;
DROP TABLE IF EXISTS public.food_pass_config CASCADE;
