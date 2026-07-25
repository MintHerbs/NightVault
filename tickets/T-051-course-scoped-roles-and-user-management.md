---
id: T-051
title: Course-scoped ownership hierarchy (owner/admin/contributor) and Material You user management
status: in-progress
severity: high
area: admin
epic: none
created: 2026-07-25
---

## Summary

The admin panel's user-management entry point disappeared after the T-045
Drive-navigation redesign, and the underlying role model (`owner` /
`contributor` only, single implicit tenant) can't express what's needed
now: a primary owner who creates per-course owners, course owners who
create admins/contributors scoped to their own course, and login routing
that lands each account in its own course. The user-management UI itself
also needs a Material You rebuild — today it's a slide-in drawer with a
raw HTML table and `window.confirm()`.

## Evidence

- [EditorNavbar.jsx:172-185](../src/components/admin/EditorNavbar.jsx#L172-L185)
  has the "Manage users" button, but it only renders inside
  [AdminEditor.jsx](../src/pages/admin/AdminEditor.jsx), reached only after
  opening a file. The new landing page,
  [AdminBrowser.jsx](../src/pages/admin/AdminBrowser.jsx) (topbar at
  [:462-498](../src/pages/admin/AdminBrowser.jsx#L462-L498)), has no
  entry point to it at all.
- [0016_init_admin_users.sql:8](../db/sql/0016_init_admin_users.sql#L8)
  constrains `role` to `('owner', 'contributor')` — no `admin` tier, no
  course/tenant column anywhere in the schema.
- [0022_admin_delete_lock_and_visibility.sql:24-31](../db/sql/0022_admin_delete_lock_and_visibility.sql#L24-L31)
  hardcodes delete authorization to one email (`moon@mooner.dev`) globally
  — conflicts with the new requirement that contributors/admins can delete
  content within their own scope; needs generalizing to course-aware
  authorization.
- The dead `subjects` table (T-030) was never wired up and shares a name
  with this codebase's unrelated existing "subject = module" concept.

## Impact

Owners currently have no way to reach `/admin/users` from the redesigned
admin panel without manually typing the URL or opening a file first. There
is no way to run more than one course/tenant under separate ownership, and
no way to add a middle "admin" permission tier between owner and
contributor.

## Suggested fix

Full design in
[docs/specs/course-roles-and-user-management.md](../docs/specs/course-roles-and-user-management.md):
add a `courses` table, course-scope `admin_users` (one course per
account), add the `admin` role, generalize the delete lockdown to
course-aware authorization, route login by course with a course switcher
for the primary owner, and rebuild `UsersDrawer`/`AdminUsers` in Material
You using the tokens and component patterns already shipped in
`AdminBrowser` (T-045).

## Acceptance criteria

- [ ] "Manage users" reachable from the Drive-style landing page without opening a file first
- [ ] `admin_users.role` accepts `admin`; existing rows unaffected by the migration
- [ ] Every existing module and `admin_users` row is assigned to the migrated first course
- [ ] Only the verified JWT email `moon@mooner.dev` can create a course or an `owner`-role account, enforced server-side
- [ ] A course owner can create admin/contributor accounts scoped to their own course only
- [ ] An admin can remove a contributor in their course; cannot create or remove other accounts
- [ ] A contributor can write/rename/delete content within their `allowed_directories`, same as today minus the global delete lock
- [ ] Logging in as any course's owner/admin/contributor lands on that course's content, never another course's
- [ ] The primary owner can see and switch between all courses
- [ ] UsersDrawer/AdminUsers rebuilt in Material You, sharing AdminBrowser's tokens and component patterns; `window.confirm()` replaced with the M3 confirm-dialog pattern

## References

- [docs/specs/course-roles-and-user-management.md](../docs/specs/course-roles-and-user-management.md) — full spec, including the role/permission matrix and 6 open questions
- [docs/specs/admin-drive-navigation.md](../docs/specs/admin-drive-navigation.md) — T-045, prior art for the M3 patterns and the delete-lock mechanism this ticket generalizes
- [T-030](T-030-subjects-table-dead-schema.md) — dead `subjects` table this ticket's `courses` table replaces (in local dev only — see below)

## Known issue: prod has a different, pre-existing `courses` table

Discovered 2026-07-25 while fixing a prod outage caused by shipping this
ticket's code without its migration: prod already has a `courses` table
(`id` text, `display_name`, `created_by`, `description`) and a populated
`admin_users.course_id`, created 2026-05-31 — over a month before this
ticket — with no migration file or application code ever referencing it
before now. It is **not** the `courses` table this ticket's migration
(`db/sql/0024_course_scoped_roles.sql`) creates (that one is `uuid`-based
and only exists in local dev).

`db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql` is a minimal,
additive prod hotfix (adds `sidebar_modules.course_id` as `text`,
referencing prod's existing table, backfilled to `'computer-science'`) —
enough to stop the outage, not a reconciliation. The full role/course
hierarchy this ticket built (the `admin` role, `is_primary_owner()`,
course-scoped RLS, the course switcher) has only ever been applied to
local dev. Reconciling the two `courses` tables — and figuring out what
prod's pre-existing one was originally for — is follow-up work, not done
here.
