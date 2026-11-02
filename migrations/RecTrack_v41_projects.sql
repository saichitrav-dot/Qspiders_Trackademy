-- ============================================================================
--  Trackademy v41 — Projects feature on Supabase (shared, cross-device)
--
--  Moves the Projects feature off browser-localStorage into shared tables so
--  trainers see the same data and STUDENTS can log in from their own devices.
--
--  Staff (any signed-in Trackademy user) manage everything via normal RLS.
--  Students are NOT auth users — they sign in with email + optional PIN through
--  SECURITY DEFINER functions that validate the credential and act only on the
--  student's own rows (anon can call only these functions, never the tables).
--
--  Idempotent / safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================================

create table if not exists pj_org        (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid, created_at timestamptz default now());
create table if not exists pj_subject    (id uuid primary key default gen_random_uuid(), org_id uuid references pj_org(id) on delete cascade, name text not null, descr text, created_at timestamptz default now());
create table if not exists pj_batch      (id uuid primary key default gen_random_uuid(), subject_id uuid references pj_subject(id) on delete cascade, name text not null, covers text);
create table if not exists pj_candidate  (id uuid primary key default gen_random_uuid(), subject_id uuid references pj_subject(id) on delete cascade, batch_id uuid references pj_batch(id) on delete set null, name text not null, email text, contact text, pin text);
create table if not exists pj_syllabus   (id uuid primary key default gen_random_uuid(), subject_id uuid references pj_subject(id) on delete cascade, subject text, chapter text, topic text, subtopic text);
create table if not exists pj_rating     (id uuid primary key default gen_random_uuid(), subject_id uuid, candidate_id uuid references pj_candidate(id) on delete cascade, node_id uuid, score numeric, remark text, rated_on date);
create table if not exists pj_attendance (id uuid primary key default gen_random_uuid(), subject_id uuid, candidate_id uuid references pj_candidate(id) on delete cascade, att_date date, status text);
create table if not exists pj_deployment (id uuid primary key default gen_random_uuid(), subject_id uuid, candidate_id uuid references pj_candidate(id) on delete cascade, company text, status text, remark text, dep_date date);
create table if not exists pj_progress   (id uuid primary key default gen_random_uuid(), subject_id uuid, candidate_id uuid references pj_candidate(id) on delete cascade, node_id uuid, activity text, status text);

create index if not exists ix_pj_subject_org   on pj_subject(org_id);
create index if not exists ix_pj_batch_subj     on pj_batch(subject_id);
create index if not exists ix_pj_cand_subj      on pj_candidate(subject_id);
create index if not exists ix_pj_cand_email     on pj_candidate(lower(email));
create index if not exists ix_pj_syl_subj       on pj_syllabus(subject_id);
create index if not exists ix_pj_rating_cand    on pj_rating(candidate_id);
create index if not exists ix_pj_att_cand       on pj_attendance(candidate_id);
create index if not exists ix_pj_dep_cand       on pj_deployment(candidate_id);
create index if not exists ix_pj_prog_cand      on pj_progress(candidate_id);

-- preserve the uploaded sheet's row order so the student tree appears exactly
-- as the Excel: Subject → Chapter → Topic → Sub-topic, in sheet order.
create sequence if not exists pj_syllabus_ord_seq;
alter table pj_syllabus add column if not exists ord bigint default nextval('pj_syllabus_ord_seq');
create index if not exists ix_pj_syl_ord on pj_syllabus(subject_id, ord);

-- trainers/mentors rate each sub-topic per activity (Presentation / Assignment /
-- Assessment / Mock Test); a rating row is keyed by (candidate, node, activity).
alter table pj_rating add column if not exists activity text;
create index if not exists ix_pj_rating_node on pj_rating(candidate_id, node_id, activity);

-- optional note against a day's attendance (e.g. reason for absence/leave).
alter table pj_attendance add column if not exists remark text;

-- ---------- RLS: signed-in staff manage everything; anon has NO direct table access ----------
do $$ declare t text; begin
  foreach t in array array['pj_org','pj_subject','pj_batch','pj_candidate','pj_syllabus','pj_rating','pj_attendance','pj_deployment','pj_progress'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists pj_staff on %I', t);
    execute format('create policy pj_staff on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- candidate self-service (email + optional PIN), via SECURITY DEFINER functions ----------
-- verify a candidate credential; returns the row or null
create or replace function pj_auth(p_cid uuid, p_email text, p_pin text) returns pj_candidate
language sql stable security definer set search_path = public as $$
  select * from pj_candidate
   where id = p_cid and lower(email) = lower(trim(p_email))
     and (pin is null or pin = '' or pin = trim(p_pin)) limit 1;
$$;

-- login by email + pin → { ok, id, name }. A student may have several records
-- (one per course/workspace); return a NON-deployed one so they can see their
-- active course(s). Blocked only when every matching record is deployed.
create or replace function pj_candidate_login(p_email text, p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cid uuid; cname text; any_exists boolean;
begin
  select x.id, x.name into cid, cname from pj_candidate x
   where lower(x.email) = lower(trim(p_email))
     and (x.pin is null or x.pin = '' or x.pin = trim(p_pin))
     and not exists (select 1 from pj_deployment d where d.candidate_id = x.id and d.status = 'Deployed')
   order by x.id limit 1;
  if cid is not null then return jsonb_build_object('ok', true, 'id', cid, 'name', cname); end if;
  select exists(select 1 from pj_candidate x where lower(x.email) = lower(trim(p_email)) and (x.pin is null or x.pin = '' or x.pin = trim(p_pin))) into any_exists;
  if any_exists then return jsonb_build_object('ok', false, 'error', 'deployed'); end if;
  return jsonb_build_object('ok', false, 'error', 'not_found');
end $$;

-- everything the student portal needs. Aggregates across ALL of the student's
-- non-deployed records (same email + pin) so a student assigned to several
-- courses — even in different workspaces — sees every one of them. `courses`
-- carries each record's workspace + covered subjects; `syllabus` is the union
-- of those workspaces (the frontend filters each to that record's covers).
create or replace function pj_candidate_bootstrap(p_cid uuid, p_email text, p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c pj_candidate; cids uuid[]; sids uuid[];
begin
  c := pj_auth(p_cid, p_email, p_pin);
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select array_agg(x.id), array_agg(distinct x.subject_id)
    into cids, sids
    from pj_candidate x
   where lower(x.email) = lower(trim(p_email))
     and (x.pin is null or x.pin = '' or x.pin = trim(p_pin))
     and not exists (select 1 from pj_deployment d where d.candidate_id = x.id and d.status = 'Deployed');
  if cids is null then return jsonb_build_object('ok', false, 'error', 'deployed'); end if;
  return jsonb_build_object('ok', true,
    'candidate', to_jsonb(c) - 'pin',
    'subjectName', (select name from pj_subject where id = c.subject_id),
    'batchName',   (select name from pj_batch   where id = c.batch_id),
    'covers',      (select covers from pj_batch where id = c.batch_id),
    'courses', coalesce((select jsonb_agg(jsonb_build_object(
          'subject_id', x.subject_id,
          'subjectName', (select name   from pj_subject s where s.id = x.subject_id),
          'batchName',   (select name   from pj_batch   b where b.id = x.batch_id),
          'covers',      (select covers from pj_batch   b where b.id = x.batch_id)))
        from pj_candidate x where x.id = any(cids)), '[]'::jsonb),
    'syllabus', coalesce((select jsonb_agg(to_jsonb(y) order by y.ord nulls last, y.id)
        from pj_syllabus y where y.subject_id = any(sids)), '[]'::jsonb),
    'ratings',  coalesce((select jsonb_agg(to_jsonb(y)) from pj_rating   y where y.candidate_id = any(cids)), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(to_jsonb(y)) from pj_progress y where y.candidate_id = any(cids)), '[]'::jsonb));
end $$;

-- student updates one activity's status on a syllabus node. Attribute it to the
-- student's record whose workspace owns that node, so cross-course progress is
-- stored under the right course (falls back to the logged-in record).
create or replace function pj_set_progress(p_cid uuid, p_email text, p_pin text, p_node uuid, p_activity text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c pj_candidate; t_cid uuid; t_sid uuid;
begin
  c := pj_auth(p_cid, p_email, p_pin);
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select x.id, x.subject_id into t_cid, t_sid
    from pj_candidate x join pj_syllabus s on s.id = p_node
   where lower(x.email) = lower(trim(p_email))
     and (x.pin is null or x.pin = '' or x.pin = trim(p_pin))
     and x.subject_id = s.subject_id
   order by x.id limit 1;
  if t_cid is null then t_cid := c.id; t_sid := c.subject_id; end if;
  update pj_progress set status = p_status where candidate_id = t_cid and node_id = p_node and activity = p_activity;
  if not found then insert into pj_progress(subject_id, candidate_id, node_id, activity, status) values (t_sid, t_cid, p_node, p_activity, p_status); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function pj_candidate_login(text, text)                          to anon, authenticated;
grant execute on function pj_candidate_bootstrap(uuid, text, text)                to anon, authenticated;
grant execute on function pj_set_progress(uuid, text, text, uuid, text, text)     to anon, authenticated;

notify pgrst, 'reload schema';
select 'Projects (pj_*) tables + candidate functions ready ✓' as ok;
