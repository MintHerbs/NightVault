-- 0027_admin_write_scope_and_delete_lock.sql
-- T-053: every admin-panel account can create and edit content anywhere;
-- delete stays locked to the primary owner.
--
-- ─── Part A: write scope ────────────────────────────────────────────────────
-- Prod's admin_can_write_module is still the 0020 body ("role = 'owner' or
-- the module is in allowed_directories"). 0024 rewrote it to be course and
-- role aware, but 0024 was never applied to prod (db/migrations.yaml records
-- applied_envs: ["dev"]), so the database has never known the 'admin' role
-- tier exists and treats those accounts as contributors.
--
-- The owner's ask supersedes both versions: anyone with an admin_users row
-- can create folders and files in any Subject, and edit any note.
-- allowed_directories consequently stops constraining content writes. It is
-- left in place, still managed by the Team page, because it is the natural
-- hook if per-person scoping is ever wanted again.
--
-- Note that this widens UPDATE as well as INSERT, deliberately. A contributor
-- who can create a file in a Subject but cannot then save content into it has
-- nothing usable, so the two have to move together.
--
-- The p_module_id parameter is now unused but the signature is kept on
-- purpose: eight policies reference it (notes insert/update, note_folders
-- insert/update, both delete policies, and the note-images storage
-- insert/update policies), two of them on storage.objects. Replacing the body
-- updates all eight atomically with no policy drop/recreate, and leaves the
-- door open to reintroducing scoping without another policy rewrite.
create or replace function public.admin_can_write_module(p_module_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;

revoke execute on function public.admin_can_write_module(text) from public;
grant execute on function public.admin_can_write_module(text) to authenticated;

-- ─── Part B: delete ─────────────────────────────────────────────────────────
-- notes/note_folders/sidebar_modules delete already read
-- "... AND admin_is_delete_authorized()" (0022), which checks the verified JWT
-- email against the primary owner. Widening admin_can_write_module above
-- relaxes only the first conjunct, so those three stay locked with no change
-- needed here.
--
-- note-images is the exception: its delete policy is gated on
-- is_owner(auth.uid()), so all six owner-role accounts could delete images
-- while being unable to delete the notes those images belong to. Bring it in
-- line with every other delete path.
drop policy if exists "note-images owner delete" on storage.objects;
create policy "note-images primary owner delete"
  on storage.objects for delete
  using ( bucket_id = 'note-images' and public.is_primary_owner() );
