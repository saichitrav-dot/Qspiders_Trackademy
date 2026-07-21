-- ============================================================
--  RecTrack — link Supabase logins to person rows (run once)
--  Run in SQL Editor AFTER the schema + import.
-- ============================================================

-- When a login is created, auto-attach it to the matching person (by email)
create or replace function rt_link_person() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update person set auth_user_id = new.id where lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists trg_link_person on auth.users;
create trigger trg_link_person after insert on auth.users
for each row execute function rt_link_person();

-- Link any logins that already exist
update person p set auth_user_id = u.id
from auth.users u
where lower(p.email) = lower(u.email) and p.auth_user_id is null;
