-- ============================================================
--  Trackademy v13 — "Team Lead" role
--   Run ONCE in Supabase → SQL Editor → New query → Run.
--   (Make sure v11 and v12 were already run.)
--
--   A Team Lead is assigned a Program/Subject (via the Assignments page) and then:
--    • sees ONLY their assigned slice (honors the "Sees all content" toggle, like a manager),
--    • can re-assign sub-topics to their team members,
--    • can add/edit team members (People page) and create their logins,
--    • can edit stage status for items they own — and only those.
--  Additive & safe to re-run.
-- ============================================================

-- 0) Add the new value to the person_role enum (safe to re-run).
--    Policies/functions below use ::text comparisons so they never reference the
--    new enum value directly — that keeps this whole script runnable in one go.
alter type person_role add value if not exists 'team_lead';

-- 1) Team Leads (and admins) may always assign/reassign; others still need the per-person flag.
create or replace function rt_can_assign() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role::text in ('admin','team_lead') or can_assign from person where auth_user_id = auth.uid()),
    false);
$$;
grant execute on function rt_can_assign() to authenticated;

-- 2) Owner-edit on stages: managers AND team leads may edit stage rows of items they own (nothing else).
--    (rt_owns_item comes from v12 — make sure v12 has been run.)
drop policy if exists rt_manager_stage on item_stage;
create policy rt_manager_stage on item_stage for update to authenticated
  using      (rt_role()::text in ('manager','team_lead') and rt_owns_item(content_item_id))
  with check (rt_role()::text in ('manager','team_lead') and rt_owns_item(content_item_id));

-- 3) Team Leads may add / edit teammates (managers already can via rt_manager_person from v11).
drop policy if exists rt_teamlead_person on person;
create policy rt_teamlead_person on person for all to authenticated
  using (rt_role()::text = 'team_lead') with check (rt_role()::text = 'team_lead');

-- 4) Team Leads may create logins for the people they add (extends v11's rt_provision_login).
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
  if rt_role()::text not in ('admin','manager','team_lead') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select id into v_existing from auth.users where lower(email) = v_email limit 1;

  if v_existing is not null then
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           encrypted_password = crypt('RecTrack-shared-2026!', gen_salt('bf')),
           updated_at         = now()
     where id = v_existing;
    v_uid := v_existing;
  else
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

  update public.person set auth_user_id = v_uid where lower(email) = v_email;
  return jsonb_build_object('ok', true, 'user_id', v_uid);
end $$;
grant execute on function public.rt_provision_login(text) to authenticated;

notify pgrst, 'reload schema';

select 'team_lead role wired up' as ok;
