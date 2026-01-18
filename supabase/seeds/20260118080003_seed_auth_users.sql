-- =============================================
-- Seed Test Auth Users
-- Creates auth.users entries for E2E testing
-- =============================================

DO $$
DECLARE
  v_password_hash TEXT;
  v_user_id UUID;
  v_user RECORD;
BEGIN
  -- Generate bcrypt hash for password 'test123456'
  v_password_hash := crypt('test123456', gen_salt('bf'));

  -- Loop through test users
  FOR v_user IN (
    SELECT * FROM (VALUES
      ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'admin2@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000003'::uuid, 'assigner@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000004'::uuid, 'tech1@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000005'::uuid, 'tech2@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000006'::uuid, 'tech3@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000007'::uuid, 'sales1@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000008'::uuid, 'pm1@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000009'::uuid, 'rma1@pdeservice.com'),
      ('00000000-0000-0000-0000-000000000010'::uuid, 'stock@pdeservice.com')
    ) AS t(employee_id, email)
  )
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_user.email) THEN
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        aud, role, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
        email_change, reauthentication_token, phone_change, phone_change_token
      )
      VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000', v_user.email, v_password_hash, NOW(), NOW(), NOW(),
        'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{}', false, false,
        '', '', '', '', '', '', '', ''
      );

      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
      VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_user.email),
        'email', v_user_id::text, NOW(), NOW()
      );

      UPDATE main_employees SET auth_user_id = v_user_id WHERE id = v_user.employee_id;
      RAISE NOTICE 'Created %', v_user.email;
    ELSE
      SELECT id INTO v_user_id FROM auth.users WHERE email = v_user.email;
      UPDATE main_employees SET auth_user_id = v_user_id WHERE id = v_user.employee_id;
      RAISE NOTICE 'Linked existing %', v_user.email;
    END IF;
  END LOOP;

  RAISE NOTICE 'Test auth users created and linked to employees';
END $$;
