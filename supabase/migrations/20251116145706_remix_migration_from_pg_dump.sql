--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: api_key_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.api_key_type AS ENUM (
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'GOOGLE_MAPS_API_KEY',
    'SENDGRID_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'OPENAI_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'MAPBOX_PUBLIC_TOKEN'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'branch_manager',
    'staff',
    'user',
    'manager',
    'delivery'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'cancelled'
);


--
-- Name: order_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_type AS ENUM (
    'delivery',
    'pickup',
    'dine_in'
);


--
-- Name: add_xp_and_check_rewards(uuid, integer, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_xp_and_check_rewards(p_user_id uuid, p_amount integer, p_source text, p_source_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_total_xp INTEGER;
  v_new_rewards INTEGER := 0;
BEGIN
  -- Insert or get user XP record
  INSERT INTO public.user_xp (user_id, total_xp, current_level)
  VALUES (p_user_id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current level
  SELECT current_level, total_xp INTO v_old_level, v_total_xp
  FROM public.user_xp
  WHERE user_id = p_user_id;

  -- Add XP transaction
  INSERT INTO public.xp_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  -- Update total XP
  v_total_xp := v_total_xp + p_amount;
  v_new_level := calculate_level(v_total_xp);

  -- Update user XP
  UPDATE public.user_xp
  SET 
    total_xp = v_total_xp,
    current_level = v_new_level,
    xp_to_next_level = ((v_new_level) * 500) - v_total_xp,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If level increased, unlock free tier rewards
  IF v_new_level > v_old_level THEN
    -- Unlock all free tier rewards up to new level
    INSERT INTO public.user_rewards (user_id, reward_level, reward_type)
    SELECT 
      p_user_id,
      level,
      CASE 
        WHEN level = 1 THEN 'delivery'
        WHEN level = 2 THEN 'coupon'
        WHEN level = 3 THEN 'dessert'
        WHEN level = 5 THEN 'upgrade'
        WHEN level = 7 THEN 'coupon'
        WHEN level = 9 THEN 'dessert'
        ELSE 'bonus'
      END
    FROM generate_series(v_old_level + 1, v_new_level) AS level
    WHERE level IN (1, 2, 3, 5, 7, 9) -- Free tier levels
    ON CONFLICT (user_id, reward_level) DO NOTHING;

    GET DIAGNOSTICS v_new_rewards = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'old_level', v_old_level,
    'new_level', v_new_level,
    'total_xp', v_total_xp,
    'new_rewards_unlocked', v_new_rewards
  );
END;
$$;


--
-- Name: award_order_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_order_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only award XP when order status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL THEN
    v_result := add_xp_and_check_rewards(
      NEW.user_id,
      100, -- 100 XP per order
      'order',
      NEW.id,
      'Order completed: ' || NEW.order_number
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: award_referral_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_referral_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_referral RECORD;
  v_result JSONB;
BEGIN
  -- Check if this is the referred user's first delivered order
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL THEN
    -- Check if user was referred
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE referred_user_id = NEW.user_id
    AND status = 'pending';
    
    IF FOUND THEN
      -- Award XP to referrer
      v_result := add_xp_and_check_rewards(
        v_referral.referrer_user_id,
        200, -- 200 XP per successful referral
        'referral',
        v_referral.id,
        'Successful referral'
      );
      
      -- Update referral status
      UPDATE public.referrals
      SET 
        status = 'completed',
        xp_awarded = true,
        completed_at = now()
      WHERE id = v_referral.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: award_review_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_review_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Award XP for new review
  IF NOT NEW.xp_awarded THEN
    v_result := add_xp_and_check_rewards(
      NEW.user_id,
      50, -- 50 XP per review
      'review',
      NEW.id,
      'Review submitted'
    );
    
    -- Mark XP as awarded
    NEW.xp_awarded := true;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: calculate_level(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_level(total_xp integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Each level requires 500 XP (can be adjusted)
  RETURN GREATEST(1, (total_xp / 500) + 1);
END;
$$;


--
-- Name: check_challenge_progress(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_challenge_progress(p_user_id uuid, p_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order RECORD;
  v_challenge RECORD;
  v_daily_challenge RECORD;
  v_completed_challenges INTEGER := 0;
  v_total_xp INTEGER := 0;
  v_result JSONB;
  v_order_time TIME;
  v_category_id UUID;
BEGIN
  -- Get order details
  SELECT o.*, oi.menu_item_id INTO v_order
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.id = p_order_id AND o.user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  v_order_time := v_order.created_at::TIME;

  -- Get category from first order item
  SELECT mi.category_id INTO v_category_id
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = p_order_id
  LIMIT 1;

  -- Check all active challenges for today
  FOR v_daily_challenge IN
    SELECT udc.*, dc.challenge_type, dc.xp_reward, dc.requirement_data
    FROM public.user_daily_challenges udc
    JOIN public.daily_challenges dc ON dc.id = udc.challenge_id
    WHERE udc.user_id = p_user_id
      AND udc.challenge_date = CURRENT_DATE
      AND udc.completed = false
  LOOP
    -- Check challenge conditions
    IF v_daily_challenge.challenge_type = 'order_category' THEN
      -- Check if order is from specific category
      IF v_category_id::TEXT = v_daily_challenge.requirement_data->>'category_id' THEN
        -- Increment progress
        UPDATE public.user_daily_challenges
        SET progress = progress + 1
        WHERE id = v_daily_challenge.id;
      END IF;
      
    ELSIF v_daily_challenge.challenge_type = 'order_time' THEN
      -- Check if order is within time range
      IF v_order_time >= (v_daily_challenge.requirement_data->>'start_time')::TIME 
         AND v_order_time <= (v_daily_challenge.requirement_data->>'end_time')::TIME THEN
        UPDATE public.user_daily_challenges
        SET progress = progress + 1
        WHERE id = v_daily_challenge.id;
      END IF;
      
    ELSIF v_daily_challenge.challenge_type = 'order_amount' THEN
      -- Check if order total meets minimum
      IF v_order.total >= (v_daily_challenge.requirement_data->>'min_amount')::NUMERIC THEN
        UPDATE public.user_daily_challenges
        SET progress = progress + 1
        WHERE id = v_daily_challenge.id;
      END IF;
      
    ELSIF v_daily_challenge.challenge_type = 'multi_order' THEN
      -- Just increment for any order
      UPDATE public.user_daily_challenges
      SET progress = progress + 1
      WHERE id = v_daily_challenge.id;
    END IF;

    -- Check if challenge is now complete
    IF (SELECT progress >= target FROM public.user_daily_challenges WHERE id = v_daily_challenge.id) 
       AND NOT v_daily_challenge.xp_awarded THEN
      -- Mark as completed
      UPDATE public.user_daily_challenges
      SET 
        completed = true,
        completed_at = now(),
        xp_awarded = true
      WHERE id = v_daily_challenge.id;

      -- Award XP
      v_result := add_xp_and_check_rewards(
        p_user_id,
        v_daily_challenge.xp_reward,
        'daily_challenge',
        v_daily_challenge.id,
        'Daily challenge completed'
      );

      v_completed_challenges := v_completed_challenges + 1;
      v_total_xp := v_total_xp + v_daily_challenge.xp_reward;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'challenges_completed', v_completed_challenges,
    'total_xp_awarded', v_total_xp
  );
END;
$$;


--
-- Name: check_challenges_on_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_challenges_on_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only check challenges when order status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL THEN
    v_result := check_challenge_progress(NEW.user_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_table_availability(uuid, text, date, time without time zone, time without time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_table_availability(p_branch_id uuid, p_table_object_id text, p_reservation_date date, p_start_time time without time zone, p_end_time time without time zone, p_exclude_reservation_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.table_reservations
    WHERE branch_id = p_branch_id
      AND table_object_id = p_table_object_id
      AND reservation_date = p_reservation_date
      AND status NOT IN ('cancelled', 'no_show')
      AND (id != p_exclude_reservation_id OR p_exclude_reservation_id IS NULL)
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$;


--
-- Name: check_weekly_challenge_progress(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_weekly_challenge_progress(p_user_id uuid, p_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order RECORD;
  v_weekly_challenge RECORD;
  v_completed_challenges INTEGER := 0;
  v_total_xp INTEGER := 0;
  v_result JSONB;
  v_week_start DATE := get_week_start();
  v_category_ids TEXT[];
  v_week_spending NUMERIC;
  v_week_orders INTEGER;
  v_week_reviews INTEGER;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  -- Check all active weekly challenges
  FOR v_weekly_challenge IN
    SELECT uwc.*, wc.challenge_type, wc.xp_reward, wc.requirement_data
    FROM public.user_weekly_challenges uwc
    JOIN public.weekly_challenges wc ON wc.id = uwc.challenge_id
    WHERE uwc.user_id = p_user_id
      AND uwc.week_start_date = v_week_start
      AND uwc.completed = false
  LOOP
    -- Check challenge type and update progress
    IF v_weekly_challenge.challenge_type = 'total_spending' THEN
      -- Calculate total spending this week
      SELECT COALESCE(SUM(total), 0) INTO v_week_spending
      FROM public.orders
      WHERE user_id = p_user_id
        AND status = 'delivered'
        AND created_at >= v_week_start
        AND created_at < v_week_start + INTERVAL '7 days';

      UPDATE public.user_weekly_challenges
      SET current_value = v_week_spending
      WHERE id = v_weekly_challenge.id;

    ELSIF v_weekly_challenge.challenge_type = 'category_variety' THEN
      -- Get unique categories ordered this week
      SELECT ARRAY_AGG(DISTINCT mi.category_id::TEXT) INTO v_category_ids
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.user_id = p_user_id
        AND o.status = 'delivered'
        AND o.created_at >= v_week_start
        AND o.created_at < v_week_start + INTERVAL '7 days'
        AND mi.category_id IS NOT NULL;

      UPDATE public.user_weekly_challenges
      SET 
        current_value = COALESCE(ARRAY_LENGTH(v_category_ids, 1), 0),
        progress = jsonb_build_object('categories', COALESCE(v_category_ids, ARRAY[]::TEXT[]))
      WHERE id = v_weekly_challenge.id;

    ELSIF v_weekly_challenge.challenge_type = 'order_count' THEN
      -- Count delivered orders this week
      SELECT COUNT(*) INTO v_week_orders
      FROM public.orders
      WHERE user_id = p_user_id
        AND status = 'delivered'
        AND created_at >= v_week_start
        AND created_at < v_week_start + INTERVAL '7 days';

      UPDATE public.user_weekly_challenges
      SET current_value = v_week_orders
      WHERE id = v_weekly_challenge.id;

    ELSIF v_weekly_challenge.challenge_type = 'review_count' THEN
      -- Count reviews this week
      SELECT COUNT(*) INTO v_week_reviews
      FROM public.reviews
      WHERE user_id = p_user_id
        AND created_at >= v_week_start
        AND created_at < v_week_start + INTERVAL '7 days';

      UPDATE public.user_weekly_challenges
      SET current_value = v_week_reviews
      WHERE id = v_weekly_challenge.id;
    END IF;

    -- Check if challenge is now complete
    IF (SELECT current_value >= target_value FROM public.user_weekly_challenges WHERE id = v_weekly_challenge.id) 
       AND NOT v_weekly_challenge.xp_awarded THEN
      -- Mark as completed
      UPDATE public.user_weekly_challenges
      SET 
        completed = true,
        completed_at = now(),
        xp_awarded = true
      WHERE id = v_weekly_challenge.id;

      -- Award XP
      v_result := add_xp_and_check_rewards(
        p_user_id,
        v_weekly_challenge.xp_reward,
        'weekly_challenge',
        v_weekly_challenge.id,
        'Weekly mega-challenge completed'
      );

      v_completed_challenges := v_completed_challenges + 1;
      v_total_xp := v_total_xp + v_weekly_challenge.xp_reward;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'challenges_completed', v_completed_challenges,
    'total_xp_awarded', v_total_xp
  );
END;
$$;


--
-- Name: check_weekly_challenges_on_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_weekly_challenges_on_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL THEN
    v_result := check_weekly_challenge_progress(NEW.user_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_weekly_challenges_on_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_weekly_challenges_on_review() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
BEGIN
  -- Get a recent order ID to pass to the check function
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    v_result := check_weekly_challenge_progress(NEW.user_id, v_order_id);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: generate_daily_challenges(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_daily_challenges(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_challenge RECORD;
  v_challenges_created INTEGER := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Check if user already has challenges for today
  IF EXISTS (
    SELECT 1 FROM public.user_daily_challenges
    WHERE user_id = p_user_id AND challenge_date = v_today
  ) THEN
    RETURN jsonb_build_object('message', 'Challenges already generated for today', 'count', 0);
  END IF;

  -- Generate 3 random active challenges for the user
  FOR v_challenge IN 
    SELECT * FROM public.daily_challenges 
    WHERE is_active = true 
    ORDER BY RANDOM() 
    LIMIT 3
  LOOP
    INSERT INTO public.user_daily_challenges (
      user_id, 
      challenge_id, 
      challenge_date, 
      target,
      progress
    ) VALUES (
      p_user_id,
      v_challenge.id,
      v_today,
      COALESCE((v_challenge.requirement_data->>'target')::INTEGER, 1),
      0
    )
    ON CONFLICT (user_id, challenge_id, challenge_date) DO NOTHING;
    
    v_challenges_created := v_challenges_created + 1;
  END LOOP;

  RETURN jsonb_build_object('message', 'Challenges generated', 'count', v_challenges_created);
END;
$$;


--
-- Name: generate_referral_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code(p_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate a unique code based on user ID
  v_code := UPPER(SUBSTRING(MD5(p_user_id::TEXT) FROM 1 FOR 8));
  RETURN v_code;
END;
$$;


--
-- Name: generate_weekly_challenges(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_weekly_challenges(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_challenge RECORD;
  v_challenges_created INTEGER := 0;
  v_week_start DATE := get_week_start();
BEGIN
  -- Check if user already has challenges for this week
  IF EXISTS (
    SELECT 1 FROM public.user_weekly_challenges
    WHERE user_id = p_user_id AND week_start_date = v_week_start
  ) THEN
    RETURN jsonb_build_object('message', 'Challenges already generated for this week', 'count', 0);
  END IF;

  -- Generate 2 random active weekly challenges
  FOR v_challenge IN 
    SELECT * FROM public.weekly_challenges 
    WHERE is_active = true 
    ORDER BY RANDOM() 
    LIMIT 2
  LOOP
    INSERT INTO public.user_weekly_challenges (
      user_id, 
      challenge_id, 
      week_start_date, 
      target_value,
      current_value,
      progress
    ) VALUES (
      p_user_id,
      v_challenge.id,
      v_week_start,
      COALESCE((v_challenge.requirement_data->>'target')::NUMERIC, 1),
      0,
      '{}'::JSONB
    )
    ON CONFLICT (user_id, challenge_id, week_start_date) DO NOTHING;
    
    v_challenges_created := v_challenges_created + 1;
  END LOOP;

  RETURN jsonb_build_object('message', 'Weekly challenges generated', 'count', v_challenges_created);
END;
$$;


--
-- Name: get_api_key(public.api_key_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_api_key(p_key_type public.api_key_type) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_value text;
BEGIN
  -- Allow public access to publishable keys only
  IF p_key_type IN ('STRIPE_PUBLISHABLE_KEY', 'MAPBOX_PUBLIC_TOKEN') THEN
    SELECT key_value INTO v_value
    FROM public.api_keys
    WHERE key_type = p_key_type;
    
    RETURN v_value;
  END IF;
  
  -- Require admin role for all other keys (secret keys)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT key_value INTO v_value
  FROM public.api_keys
  WHERE key_type = p_key_type;

  RETURN v_value;
END;
$$;


--
-- Name: get_api_key_internal(public.api_key_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_api_key_internal(p_key_type public.api_key_type) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_value text;
BEGIN
  -- This function is meant to be called only by edge functions using service role
  -- No user role check needed as service role has full access
  
  SELECT key_value INTO v_value
  FROM public.api_keys
  WHERE key_type = p_key_type;

  RETURN v_value;
END;
$$;


--
-- Name: get_week_start(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_week_start() RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 6) % 7))::DATE;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: insert_api_key(public.api_key_type, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_api_key(p_key_type public.api_key_type, p_key_value text, p_description text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.api_keys (key_type, key_value, description)
  VALUES (p_key_type, p_key_value, p_description)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;


--
-- Name: update_api_key(public.api_key_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_api_key(p_key_type public.api_key_type, p_key_value text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.api_keys
  SET key_value = p_key_value
  WHERE key_type = p_key_type;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: allergens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allergens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_type public.api_key_type NOT NULL,
    key_value text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: branch_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    is_available boolean DEFAULT true,
    price_override numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    phone text NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_active boolean DEFAULT true,
    opens_at time without time zone,
    closes_at time without time zone,
    delivery_radius_km numeric(5,2) DEFAULT 5.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    layout_data jsonb DEFAULT '{"objects": []}'::jsonb
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_amount numeric DEFAULT 0,
    max_discount numeric,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    usage_limit integer,
    times_used integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'bogo'::text])))
);


--
-- Name: daily_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_type text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    xp_reward integer NOT NULL,
    icon text,
    requirement_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: food_pass_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_pass_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Food Pass'::text NOT NULL,
    price numeric DEFAULT 9.99 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    duration_days integer DEFAULT 30 NOT NULL,
    description text,
    benefits jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: food_pass_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_pass_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_session_id text NOT NULL,
    stripe_payment_intent_id text,
    amount_paid numeric NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: menu_item_allergens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_allergens (
    menu_item_id uuid NOT NULL,
    allergen_id uuid NOT NULL
);


--
-- Name: menu_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_modifiers (
    menu_item_id uuid NOT NULL,
    modifier_group_id uuid NOT NULL
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    is_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    preparation_time_mins integer DEFAULT 15,
    allergens text[],
    is_vegetarian boolean DEFAULT false,
    is_vegan boolean DEFAULT false,
    calories integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    disabled_until timestamp with time zone,
    disabled_permanently boolean DEFAULT false
);


--
-- Name: modifier_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modifier_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_required boolean DEFAULT false,
    max_selections integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    min_selections integer DEFAULT 0
);


--
-- Name: modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    name text NOT NULL,
    price_adjustment numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid,
    modifier_id uuid,
    price_adjustment numeric(10,2) DEFAULT 0
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    menu_item_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    special_instructions text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    branch_id uuid,
    order_number text NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status,
    order_type public.order_type NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    tip numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    delivery_address_id uuid,
    special_instructions text,
    estimated_delivery_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    guest_email text,
    guest_name text,
    guest_phone text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferred_payment_method text
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_user_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    referral_code text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    xp_awarded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    rating integer NOT NULL,
    comment text,
    xp_awarded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: table_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    table_object_id text NOT NULL,
    user_id uuid,
    guest_name text,
    guest_email text,
    guest_phone text,
    party_size integer NOT NULL,
    reservation_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    special_requests text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requires_table_combination boolean DEFAULT false,
    admin_notes text,
    combined_tables text[],
    CONSTRAINT table_reservations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text, 'awaiting_arrangement'::text]))),
    CONSTRAINT valid_party_size CHECK (((party_size > 0) AND (party_size <= 20))),
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text])))
);

ALTER TABLE ONLY public.table_reservations REPLICA IDENTITY FULL;


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_name text DEFAULT 'eFood'::text NOT NULL,
    logo_url text,
    primary_color text DEFAULT '#f97316'::text,
    secondary_color text DEFAULT '#fb923c'::text,
    accent_color text DEFAULT '#fdba74'::text,
    font_family text DEFAULT 'Inter'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    background_color text DEFAULT '#ffffff'::text,
    menu_display_style text DEFAULT 'grid'::text,
    font_size_base text DEFAULT '16px'::text,
    font_size_heading text DEFAULT '2.5rem'::text,
    gradient_primary text DEFAULT 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)'::text,
    gradient_secondary text DEFAULT 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)'::text,
    template_style text DEFAULT 'modern'::text,
    hero_title text DEFAULT 'Welcome to Our Restaurant'::text,
    hero_subtitle text DEFAULT 'Experience culinary excellence'::text,
    cta_button_text text DEFAULT 'Order Now'::text,
    footer_text text DEFAULT '© 2025 All rights reserved'::text,
    currency text DEFAULT 'USD'::text,
    loading_screen_image text,
    home_image_url text,
    vat_rate numeric DEFAULT 0,
    vat_number text,
    timezone text DEFAULT 'UTC'::text,
    language text DEFAULT 'en'::text
);


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    label text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    postal_code text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_daily_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_daily_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    challenge_date date DEFAULT CURRENT_DATE NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    target integer NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    xp_awarded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_level integer NOT NULL,
    reward_type text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed boolean DEFAULT false,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_weekly_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_weekly_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    week_start_date date NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    target_value numeric NOT NULL,
    current_value numeric DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    xp_awarded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_xp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_xp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    total_xp integer DEFAULT 0 NOT NULL,
    current_level integer DEFAULT 1 NOT NULL,
    xp_to_next_level integer DEFAULT 500 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weekly_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_type text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    xp_reward integer NOT NULL,
    icon text,
    requirement_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    season integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: xp_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    source text NOT NULL,
    source_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: allergens allergens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergens
    ADD CONSTRAINT allergens_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_type_key UNIQUE (key_type);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: branch_menu_items branch_menu_items_branch_id_menu_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_menu_items
    ADD CONSTRAINT branch_menu_items_branch_id_menu_item_id_key UNIQUE (branch_id, menu_item_id);


--
-- Name: branch_menu_items branch_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_menu_items
    ADD CONSTRAINT branch_menu_items_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: daily_challenges daily_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_challenges
    ADD CONSTRAINT daily_challenges_pkey PRIMARY KEY (id);


--
-- Name: food_pass_config food_pass_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_pass_config
    ADD CONSTRAINT food_pass_config_pkey PRIMARY KEY (id);


--
-- Name: food_pass_purchases food_pass_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_pass_purchases
    ADD CONSTRAINT food_pass_purchases_pkey PRIMARY KEY (id);


--
-- Name: food_pass_purchases food_pass_purchases_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_pass_purchases
    ADD CONSTRAINT food_pass_purchases_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_item_allergens menu_item_allergens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_allergens
    ADD CONSTRAINT menu_item_allergens_pkey PRIMARY KEY (menu_item_id, allergen_id);


--
-- Name: menu_item_modifiers menu_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_pkey PRIMARY KEY (menu_item_id, modifier_group_id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: modifier_groups modifier_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifier_groups
    ADD CONSTRAINT modifier_groups_pkey PRIMARY KEY (id);


--
-- Name: modifiers modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_pkey PRIMARY KEY (id);


--
-- Name: order_item_modifiers order_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_key UNIQUE (referred_user_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: table_reservations table_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_reservations
    ADD CONSTRAINT table_reservations_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_daily_challenges user_daily_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_challenges
    ADD CONSTRAINT user_daily_challenges_pkey PRIMARY KEY (id);


--
-- Name: user_daily_challenges user_daily_challenges_user_id_challenge_id_challenge_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_challenges
    ADD CONSTRAINT user_daily_challenges_user_id_challenge_id_challenge_date_key UNIQUE (user_id, challenge_id, challenge_date);


--
-- Name: user_rewards user_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_pkey PRIMARY KEY (id);


--
-- Name: user_rewards user_rewards_user_id_reward_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_user_id_reward_level_key UNIQUE (user_id, reward_level);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_weekly_challenges user_weekly_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_weekly_challenges
    ADD CONSTRAINT user_weekly_challenges_pkey PRIMARY KEY (id);


--
-- Name: user_weekly_challenges user_weekly_challenges_user_id_challenge_id_week_start_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_weekly_challenges
    ADD CONSTRAINT user_weekly_challenges_user_id_challenge_id_week_start_date_key UNIQUE (user_id, challenge_id, week_start_date);


--
-- Name: user_xp user_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_pkey PRIMARY KEY (id);


--
-- Name: user_xp user_xp_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_user_id_key UNIQUE (user_id);


--
-- Name: weekly_challenges weekly_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_challenges
    ADD CONSTRAINT weekly_challenges_pkey PRIMARY KEY (id);


--
-- Name: xp_config xp_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_config
    ADD CONSTRAINT xp_config_pkey PRIMARY KEY (id);


--
-- Name: xp_config xp_config_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_config
    ADD CONSTRAINT xp_config_setting_key_key UNIQUE (setting_key);


--
-- Name: xp_transactions xp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_branch_menu_items_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_menu_items_branch ON public.branch_menu_items USING btree (branch_id);


--
-- Name: idx_branch_menu_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_menu_items_item ON public.branch_menu_items USING btree (menu_item_id);


--
-- Name: idx_daily_challenges_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_challenges_active ON public.daily_challenges USING btree (is_active);


--
-- Name: idx_food_pass_purchases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_food_pass_purchases_status ON public.food_pass_purchases USING btree (status);


--
-- Name: idx_food_pass_purchases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_food_pass_purchases_user_id ON public.food_pass_purchases USING btree (user_id);


--
-- Name: idx_profiles_preferred_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_preferred_payment_method ON public.profiles USING btree (preferred_payment_method);


--
-- Name: idx_referrals_referred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred ON public.referrals USING btree (referred_user_id);


--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_user_id);


--
-- Name: idx_reservations_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_branch_date ON public.table_reservations USING btree (branch_id, reservation_date);


--
-- Name: idx_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_status ON public.table_reservations USING btree (status);


--
-- Name: idx_reservations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_user ON public.table_reservations USING btree (user_id);


--
-- Name: idx_reviews_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_order_id ON public.reviews USING btree (order_id);


--
-- Name: idx_reviews_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (user_id);


--
-- Name: idx_table_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_reservations_status ON public.table_reservations USING btree (status) WHERE (status = 'awaiting_arrangement'::text);


--
-- Name: idx_user_daily_challenges_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_daily_challenges_completed ON public.user_daily_challenges USING btree (user_id, completed);


--
-- Name: idx_user_daily_challenges_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_daily_challenges_user_date ON public.user_daily_challenges USING btree (user_id, challenge_date);


--
-- Name: idx_user_rewards_claimed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_rewards_claimed ON public.user_rewards USING btree (user_id, claimed);


--
-- Name: idx_user_rewards_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_rewards_user_id ON public.user_rewards USING btree (user_id);


--
-- Name: idx_user_weekly_challenges_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_weekly_challenges_completed ON public.user_weekly_challenges USING btree (user_id, completed);


--
-- Name: idx_user_weekly_challenges_user_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_weekly_challenges_user_week ON public.user_weekly_challenges USING btree (user_id, week_start_date);


--
-- Name: idx_user_xp_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_xp_user_id ON public.user_xp USING btree (user_id);


--
-- Name: idx_weekly_challenges_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_challenges_active ON public.weekly_challenges USING btree (is_active);


--
-- Name: idx_xp_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_transactions_user_id ON public.xp_transactions USING btree (user_id);


--
-- Name: orders challenge_check_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenge_check_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.check_challenges_on_order();


--
-- Name: orders order_xp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_xp_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_order_xp();


--
-- Name: orders referral_xp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER referral_xp_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_referral_xp();


--
-- Name: reviews review_xp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER review_xp_trigger BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.award_review_xp();


--
-- Name: api_keys update_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: branch_menu_items update_branch_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_branch_menu_items_updated_at BEFORE UPDATE ON public.branch_menu_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: branches update_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: food_pass_config update_food_pass_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_food_pass_config_updated_at BEFORE UPDATE ON public.food_pass_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: menu_categories update_menu_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: menu_items update_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: table_reservations update_table_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_table_reservations_updated_at BEFORE UPDATE ON public.table_reservations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: tenant_settings update_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: xp_config update_xp_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_xp_config_updated_at BEFORE UPDATE ON public.xp_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: orders weekly_challenge_check_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER weekly_challenge_check_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.check_weekly_challenges_on_order();


--
-- Name: reviews weekly_challenge_review_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER weekly_challenge_review_trigger AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.check_weekly_challenges_on_review();


--
-- Name: branch_menu_items branch_menu_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_menu_items
    ADD CONSTRAINT branch_menu_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: branch_menu_items branch_menu_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_menu_items
    ADD CONSTRAINT branch_menu_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: food_pass_purchases food_pass_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_pass_purchases
    ADD CONSTRAINT food_pass_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: menu_item_allergens menu_item_allergens_allergen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_allergens
    ADD CONSTRAINT menu_item_allergens_allergen_id_fkey FOREIGN KEY (allergen_id) REFERENCES public.allergens(id) ON DELETE CASCADE;


--
-- Name: menu_item_allergens menu_item_allergens_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_allergens
    ADD CONSTRAINT menu_item_allergens_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_modifier_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES public.modifier_groups(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: modifiers modifiers_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.modifier_groups(id) ON DELETE CASCADE;


--
-- Name: order_item_modifiers order_item_modifiers_modifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_modifier_id_fkey FOREIGN KEY (modifier_id) REFERENCES public.modifiers(id);


--
-- Name: order_item_modifiers order_item_modifiers_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: orders orders_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.user_addresses(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: table_reservations table_reservations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_reservations
    ADD CONSTRAINT table_reservations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: table_reservations table_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_reservations
    ADD CONSTRAINT table_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_daily_challenges user_daily_challenges_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_challenges
    ADD CONSTRAINT user_daily_challenges_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id) ON DELETE CASCADE;


--
-- Name: user_daily_challenges user_daily_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_challenges
    ADD CONSTRAINT user_daily_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_rewards user_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_weekly_challenges user_weekly_challenges_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_weekly_challenges
    ADD CONSTRAINT user_weekly_challenges_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.weekly_challenges(id) ON DELETE CASCADE;


--
-- Name: user_weekly_challenges user_weekly_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_weekly_challenges
    ADD CONSTRAINT user_weekly_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_xp user_xp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: xp_transactions xp_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items Admins and managers can manage order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage order items" ON public.order_items USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: api_keys Admins can delete API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete API keys" ON public.api_keys FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: api_keys Admins can insert API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert API keys" ON public.api_keys FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: xp_config Admins can manage XP config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage XP config" ON public.xp_config USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: table_reservations Admins can manage all reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all reservations" ON public.table_reservations USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: allergens Admins can manage allergens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage allergens" ON public.allergens USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: branch_menu_items Admins can manage branch menu items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage branch menu items" ON public.branch_menu_items USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: branches Admins can manage branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage branches" ON public.branches USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: daily_challenges Admins can manage challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage challenges" ON public.daily_challenges USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: coupons Admins can manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coupons" ON public.coupons USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: food_pass_config Admins can manage food pass config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage food pass config" ON public.food_pass_config USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_categories Admins can manage menu categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage menu categories" ON public.menu_categories USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_item_allergens Admins can manage menu item allergens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage menu item allergens" ON public.menu_item_allergens USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_item_modifiers Admins can manage menu item modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage menu item modifiers" ON public.menu_item_modifiers USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_items Admins can manage menu items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage menu items" ON public.menu_items USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: modifier_groups Admins can manage modifier groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage modifier groups" ON public.modifier_groups USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: modifiers Admins can manage modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage modifiers" ON public.modifiers USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_item_modifiers Admins can manage order item modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order item modifiers" ON public.order_item_modifiers USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reviews Admins can manage reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage reviews" ON public.reviews USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tenant_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.tenant_settings USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: weekly_challenges Admins can manage weekly challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage weekly challenges" ON public.weekly_challenges USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: api_keys Admins can update API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update API keys" ON public.api_keys FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: api_keys Admins can view API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view API keys" ON public.api_keys FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can view all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: allergens Allergens are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allergens are viewable by everyone" ON public.allergens FOR SELECT USING (true);


--
-- Name: order_items Anyone can create order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: orders Anyone can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO authenticated, anon WITH CHECK (((auth.uid() = user_id) OR ((user_id IS NULL) AND (guest_email IS NOT NULL))));


--
-- Name: order_items Anyone can view order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view order items" ON public.order_items FOR SELECT TO authenticated, anon USING (true);


--
-- Name: branch_menu_items Branch menu items are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branch menu items are viewable by everyone" ON public.branch_menu_items FOR SELECT USING (true);


--
-- Name: branches Branches are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branches are viewable by everyone" ON public.branches FOR SELECT USING (true);


--
-- Name: coupons Coupons are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coupons are viewable by everyone" ON public.coupons FOR SELECT USING (((is_active = true) AND ((valid_until IS NULL) OR (valid_until > now()))));


--
-- Name: xp_config Everyone can view XP config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view XP config" ON public.xp_config FOR SELECT USING (true);


--
-- Name: daily_challenges Everyone can view active challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active challenges" ON public.daily_challenges FOR SELECT USING ((is_active = true));


--
-- Name: food_pass_config Everyone can view active food pass config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active food pass config" ON public.food_pass_config FOR SELECT USING ((is_active = true));


--
-- Name: weekly_challenges Everyone can view active weekly challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active weekly challenges" ON public.weekly_challenges FOR SELECT USING ((is_active = true));


--
-- Name: reviews Everyone can view reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view reviews" ON public.reviews FOR SELECT USING (true);


--
-- Name: orders Guests can view their orders by email; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view their orders by email" ON public.orders FOR SELECT TO anon USING ((guest_email IS NOT NULL));


--
-- Name: menu_categories Menu categories are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Menu categories are viewable by everyone" ON public.menu_categories FOR SELECT USING (true);


--
-- Name: menu_item_allergens Menu item allergens are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Menu item allergens are viewable by everyone" ON public.menu_item_allergens FOR SELECT USING (true);


--
-- Name: menu_item_modifiers Menu item modifiers are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Menu item modifiers are viewable by everyone" ON public.menu_item_modifiers FOR SELECT USING (true);


--
-- Name: menu_items Menu items are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Menu items are viewable by everyone" ON public.menu_items FOR SELECT USING (true);


--
-- Name: modifier_groups Modifier groups are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modifier groups are viewable by everyone" ON public.modifier_groups FOR SELECT USING (true);


--
-- Name: modifiers Modifiers are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modifiers are viewable by everyone" ON public.modifiers FOR SELECT USING (true);


--
-- Name: api_keys Service role can read API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read API keys" ON public.api_keys FOR SELECT TO service_role USING (true);


--
-- Name: tenant_settings Settings are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Settings are viewable by everyone" ON public.tenant_settings FOR SELECT USING (true);


--
-- Name: referrals Users can create referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create referrals" ON public.referrals FOR INSERT WITH CHECK ((auth.uid() = referrer_user_id));


--
-- Name: table_reservations Users can create reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reservations" ON public.table_reservations FOR INSERT WITH CHECK (((auth.uid() = user_id) OR ((user_id IS NULL) AND (guest_email IS NOT NULL))));


--
-- Name: user_addresses Users can create their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own addresses" ON public.user_addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: orders Users can create their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: reviews Users can create their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own reviews" ON public.reviews FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_addresses Users can delete their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own addresses" ON public.user_addresses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: order_items Users can insert order items for their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert order items for their own orders" ON public.order_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: user_xp Users can insert their own XP record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own XP record" ON public.user_xp FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: xp_transactions Users can insert their own XP transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own XP transactions" ON public.xp_transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_daily_challenges Users can insert their own challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own challenges" ON public.user_daily_challenges FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: food_pass_purchases Users can insert their own food pass purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own food pass purchases" ON public.food_pass_purchases FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_rewards Users can insert their own rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own rewards" ON public.user_rewards FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_weekly_challenges Users can insert their own weekly challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own weekly challenges" ON public.user_weekly_challenges FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_xp Users can update their own XP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own XP" ON public.user_xp FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_addresses Users can update their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own addresses" ON public.user_addresses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_daily_challenges Users can update their own challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own challenges" ON public.user_daily_challenges FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: table_reservations Users can update their own pending reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own pending reservations" ON public.table_reservations FOR UPDATE USING ((((auth.uid() = user_id) OR (guest_email IS NOT NULL)) AND (status = 'pending'::text)));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: reviews Users can update their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_rewards Users can update their own rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own rewards" ON public.user_rewards FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_weekly_challenges Users can update their own weekly challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own weekly challenges" ON public.user_weekly_challenges FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: referrals Users can update their referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their referrals" ON public.referrals FOR UPDATE USING ((auth.uid() = referrer_user_id));


--
-- Name: order_item_modifiers Users can view their order item modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their order item modifiers" ON public.order_item_modifiers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_modifiers.order_item_id) AND (o.user_id = auth.uid())))));


--
-- Name: user_xp Users can view their own XP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own XP" ON public.user_xp FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: xp_transactions Users can view their own XP transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own XP transactions" ON public.xp_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_addresses Users can view their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own addresses" ON public.user_addresses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_daily_challenges Users can view their own challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own challenges" ON public.user_daily_challenges FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: food_pass_purchases Users can view their own food pass purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own food pass purchases" ON public.food_pass_purchases FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: table_reservations Users can view their own reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own reservations" ON public.table_reservations FOR SELECT USING (((auth.uid() = user_id) OR (guest_email IS NOT NULL)));


--
-- Name: user_rewards Users can view their own rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own rewards" ON public.user_rewards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_weekly_challenges Users can view their own weekly challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly challenges" ON public.user_weekly_challenges FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: referrals Users can view their referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their referrals" ON public.referrals FOR SELECT USING (((auth.uid() = referrer_user_id) OR (auth.uid() = referred_user_id)));


--
-- Name: order_items Users cannot delete order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users cannot delete order items" ON public.order_items FOR DELETE USING (false);


--
-- Name: order_items Users cannot update order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users cannot update order items" ON public.order_items FOR UPDATE USING (false);


--
-- Name: allergens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: food_pass_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_pass_config ENABLE ROW LEVEL SECURITY;

--
-- Name: food_pass_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_pass_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_item_allergens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_item_allergens ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_item_modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: modifier_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: table_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: user_daily_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_daily_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_weekly_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_weekly_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_xp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_config ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


