-- ============================================================
--  Trackademy v11 — UI-driven login provisioning
--   Run this ONCE in Supabase → SQL Editor → New query → Run.
--   After this, adding a teammate on the People page automatically
--   creates their login (shared password, email pre-confirmed) — no
--   Dashboard or SQL needed ever again.
--
--   Installs:
--    1) rt_provision_login(email)  — app calls this to create/repair a login
--    2) rt_manager_person policy   — lets managers add/edit teammates
--  Additive & safe to re-run.
-- ============================================================

-- 1) Provisioning function (runs with elevated rights; only admin/manager may call it)
create or replace function public.rt_provision_login(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid      uuid;
  v_existing uuid;
  v_email    text := lower(trim(p_email));
begin
  -- only the Program Head (admin) or a manager may create logins
  if rt_role() not in ('admin','manager') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  -- already have an auth account for this email?
  select id into v_existing from auth.users where lower(email) = v_email limit 1;

  if v_existing is not null then
    -- repair it: ensure confirmed + correct shared password
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           encrypted_password = crypt('RecTrack-shared-2026!', gen_salt('bf')),
           updated_at         = now()
     where id = v_existing;
    v_uid := v_existing;
  else
    -- create a fresh, pre-confirmed account
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', v_email,
      crypt('RecTrack-shared-2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      created_at, updated_at, last_sign_in_at
    ) values (
      v_email, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email),
      'email', now(), now(), now()
    );
  end if;

  -- link the auth account to the person row
  update public.person set auth_user_id = v_uid where lower(email) = v_email;

  return jsonb_build_object('ok', true, 'user_id', v_uid);
end $$;

grant execute on function public.rt_provision_login(text) to authenticated;

-- 2) Let managers add / edit teammates (admins already can via rt_admin_all)
drop policy if exists rt_manager_person on person;
create policy rt_manager_person on person for all to authenticated
  using (rt_role() = 'manager') with check (rt_role() = 'manager');

notify pgrst, 'reload schema';

-- quick check: should return your function + the new policy
select 'function installed' as ok
  where exists (select 1 from pg_proc where proname = 'rt_provision_login');
