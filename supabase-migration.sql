-- ============================================================
-- Chaopelosemail - Supabase Migration (Auth0 version)
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- 1. user_trials: one row per Auth0 user, tracks the 72h free trial
CREATE TABLE IF NOT EXISTS user_trials (
  auth0_user_id    TEXT         PRIMARY KEY,
  email            TEXT,
  trial_started_at TIMESTAMPTZ  DEFAULT NOW(),
  is_active        BOOLEAN      DEFAULT TRUE
);

-- 2. login_sessions: tracks every login (who + when)
CREATE TABLE IF NOT EXISTS login_sessions (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  auth0_user_id TEXT         NOT NULL,
  email         TEXT,
  logged_in_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE user_trials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RPC: check_or_start_trial
--    Called after a successful Auth0 login.
--    - Creates a trial record on first access (trial_started_at = NOW())
--    - Logs the login session
--    - Returns trial_started_at and is_active so the client can enforce the 72h limit
CREATE OR REPLACE FUNCTION check_or_start_trial(p_auth0_user_id TEXT, p_email TEXT)
RETURNS TABLE(trial_started_at TIMESTAMPTZ, is_active BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial  TIMESTAMPTZ;
  v_active BOOLEAN;
BEGIN
  -- Upsert: insert on first login, do nothing on subsequent logins
  INSERT INTO user_trials (auth0_user_id, email)
  VALUES (p_auth0_user_id, p_email)
  ON CONFLICT (auth0_user_id) DO NOTHING;

  -- Fetch current trial data
  SELECT ut.trial_started_at, ut.is_active
  INTO   v_trial, v_active
  FROM   user_trials ut
  WHERE  ut.auth0_user_id = p_auth0_user_id;

  -- Log this login
  INSERT INTO login_sessions (auth0_user_id, email)
  VALUES (p_auth0_user_id, p_email);

  RETURN QUERY SELECT v_trial, v_active;
END;
$$;

-- 5. Allow the anon role to call the RPC
GRANT EXECUTE ON FUNCTION check_or_start_trial(TEXT, TEXT) TO anon;


-- ============================================================
-- TO DEACTIVATE A USER (block access after trial ends)
--   UPDATE user_trials SET is_active = FALSE
--   WHERE auth0_user_id = '<auth0|xxxxx>';
--
-- TO VIEW ALL LOGINS:
--   SELECT * FROM login_sessions ORDER BY logged_in_at DESC;
--
-- TO VIEW TRIAL STATUS:
--   SELECT auth0_user_id, email, trial_started_at,
--          NOW() - trial_started_at AS elapsed,
--          is_active
--   FROM user_trials ORDER BY trial_started_at DESC;
-- ============================================================
