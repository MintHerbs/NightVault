# Feature Spec: Course-scoped ownership hierarchy and Material You user management

**Status:** Proposed
**Created:** 2026-07-24
**Builds on:** T-045 (Drive-style admin navigation, already Material You-ish, already has a
single-hardcoded-email authorization pattern to generalize). Touches the role/permission surface
E-001 hardened and reopens one of its deliberate decisions (§7).

---

## 0. The problem, in the owner's words

> There is an admin panel which allows me to create new users, and even courses, but since I updated
> the UI for the admin panel the button to go there got omitted. I want it reintroduced, for owners
> only. Owners should be able to create admins and contributors; only moon@mooner.dev should be able to
> create new owners. I should also be able to create new courses, each with its own owner — when that
> owner logs in, they land in their course, not "Computer Science" (today's default). As primary owner
> I should still see all courses and switch between them. Once I grant ownership of a course, that
> owner can create their own admins and contributors, who log into that course. Separately, the user
> management UI/UX looks bad — rebuild it in Material You.

Two confirmed findings from reading the actual code before writing anything below:

- **The missing button is a real regression, not a permissions bug.** [EditorNavbar.jsx:172-185](../../src/components/admin/EditorNavbar.jsx#L172-L185)
  still has a "Manage users" button, gated on `isOwner` — but `EditorNavbar` only renders inside
  [AdminEditor.jsx](../../src/pages/admin/AdminEditor.jsx), which is only reached after opening a
  specific file. Since T-045 made [AdminBrowser.jsx](../../src/pages/admin/AdminBrowser.jsx) the
  landing page after login, its topbar ([AdminBrowser.jsx:462-498](../../src/pages/admin/AdminBrowser.jsx#L462-L498))
  only has search and a sign-out menu. There is currently no path to `/admin/users` that doesn't
  require opening a file first.
- **"Courses" don't exist as data today.** What's called "Computer Science" is the single hardcoded
  `MODULES` array in [modules.js](../../src/components/layout/Sidebar/modules.js) — the whole site is
  one implicit tenant. `admin_users.role` only allows `owner` / `contributor`
  ([0016_init_admin_users.sql:8](../../db/sql/0016_init_admin_users.sql#L8)) — there is no `admin` tier
  and no course/tenant column anywhere.

---

## 1. Terminology mapping

| Owner's term | This spec's model | Where it lives | Notes |
|---|---|---|---|
| **Primary owner** | The one account `moon@mooner.dev` | Not a stored role — a verified-JWT-email check, same pattern as `admin_is_delete_authorized()` ([0022](../../db/sql/0022_admin_delete_lock_and_visibility.sql#L24-L31)) | Layered *on top of* being a normal course owner, not a replacement for it (§6) |
| **Course** | New `courses` row | New `courses` table (§9) | Finally gives the dead `subjects` table's intended purpose (T-030) a real, correctly-named home — see §9 |
| **Subject** (existing term, unchanged) | `module` entry in `MODULES` | [modules.js](../../src/components/layout/Sidebar/modules.js), gains a `courseId` field | Still a static, GitHub-committed file — creating a course does **not** change how subjects inside it are created |
| **Owner** (per course) | `admin_users.role = 'owner'`, `course_id` set | `admin_users` | Today's `owner` role, narrowed from "sees everything" to "sees their course" |
| **Admin** (new tier) | `admin_users.role = 'admin'`, `course_id` set | `admin_users` | New enum value — doesn't exist today |
| **Contributor** | `admin_users.role = 'contributor'`, `course_id` set, `allowed_directories` unchanged | `admin_users` | Same module-level ACL mechanic as today, now nested inside a course |

---

## 2. Goals / Non-goals

**Goals:**

- Reintroduce a discoverable "Manage users" entry point from the Drive-style landing page (the
  regression in §0).
- Add a `courses` concept: the primary owner can create a course and assign it an owner.
- Add `admin` as a third role tier, between owner and contributor.
- Course-scope every `admin_users` row (one course per account, confirmed in your answer) and filter
  the admin panel — subjects list, user list — by course.
- Route each account to its own course on login; give the primary owner a course switcher.
- Enforce "only `moon@mooner.dev` creates owners / creates courses" **server-side**, against the
  verified JWT email — not the client, and not the editable `admin_users.email` column (the exact
  mistake T-045 §6 already warned against for delete).
- Redesign the user-management UI in Material You, consistent with the tokens and component patterns
  AdminBrowser already established in T-045, instead of inventing a second design language.

**Non-goals (per your answers):**

- **No public-facing multi-tenant site yet.** You confirmed this is admin-only for now — the public
  site keeps showing everything unified. The data model below (course-tagging `modules.js`, a real
  `courses` table) is shaped so that door opens later without a rework, but no public routing changes
  here.
- **No move off the static, GitHub-committed `modules.js`.** Creating a course only adds a lightweight
  DB row; creating a subject *inside* a course still goes through the existing `commitFile` /
  `admin-github-write` path, unchanged.
- **No broader RBAC re-audit** beyond the roles and actions enumerated in §3 — E-001 already covers
  hardening the pre-existing model.

---

## 3. Role & permission matrix

| Action | Primary owner | Owner (own course) | Admin (own course) | Contributor (own course) |
|---|:---:|:---:|:---:|:---:|
| Create a course | ✅ | ❌ | ❌ | ❌ |
| Create an owner | ✅ | ❌ | ❌ | ❌ |
| Create an admin / contributor | ✅ (any course) | ✅ (own course only) | ❌ | ❌ |
| Remove a contributor | ✅ | ✅ | ✅ | ❌ |
| Remove an admin | ✅ | ✅ | ❌ ¹ | ❌ |
| Write / rename content | ✅ (any course) | ✅ (own course) | ✅ (own course) | ✅ (own `allowed_directories` only, unchanged mechanic) |
| Delete content | ✅ | ✅ (own course) ² | ✅ (own course) ² | ✅ (own `allowed_directories`) ² |
| Hide content from live site | ✅ | ✅ | ✅ ³ | ❌ ³ |
| See / switch between all courses | ✅ | ❌ (own course only) | ❌ | ❌ |

¹ Your answer literally said admins can "remove contributors" — I've taken that at face value and
*not* extended it to removing other admins. Flagged again in §11 in case that was shorthand rather
than a deliberate boundary.
² This row directly conflicts with a security decision T-045 shipped days ago (global delete lockdown
to one email). See §7 — needs your explicit sign-off, not a silent reversal.
³ Hide is owner-only today ([0022](../../db/sql/0022_admin_delete_lock_and_visibility.sql#L68-L70)).
You didn't mention hide in your answer, so I extended it to admins (they "manage content") but kept
contributors out, matching today's owner-only default. Confirm in §11.

---

## 4. Login & routing behavior

- `useAdmin()` ([useAdmin.js](../../src/pages/admin/useAdmin.js)) resolves `course_id` alongside
  `profile` today already fetches. `course_id = null` is reserved for the primary owner's own row.
- `useAdminModulesRegistry` filters `modules` to those whose `courseId` matches the caller's
  `course_id`, exactly the way it already filters by `allowed_directories` for contributors
  ([AdminBrowser.jsx:228-230](../../src/pages/admin/AdminBrowser.jsx#L228-L230)) — same shape of
  change, one more predicate.
- Non-primary accounts have exactly one course (per your "locked to one course" answer), so no URL
  change is needed — `/admin/editor` keeps working as-is, scoped server-side by whichever course the
  session belongs to.
- The primary owner gets a course switcher (a dropdown, likely replacing the static "Content" label in
  [AdminBrowser.jsx:464-467](../../src/pages/admin/AdminBrowser.jsx#L464-L467)) that lists all
  `courses` rows and sets an "active course" for the session — the rest of AdminBrowser's filtering
  logic doesn't need to know it's talking to the primary owner vs. a course-locked owner, it just reads
  "active course."

---

## 5. Course creation & ownership granting

- **Create course** (primary-owner-gated, client *and* edge-function check against the verified JWT
  email — never `admin_users.email`): inserts a `courses` row, then immediately creates that course's
  first `owner` via the same flow as §6.
- **`admin-create-user`** ([index.ts](../../supabase/functions/admin-create-user/index.ts)) changes:
  - Role validation extends from `['owner', 'contributor']` to `['owner', 'admin', 'contributor']`
    ([index.ts:55](../../supabase/functions/admin-create-user/index.ts#L55)).
  - Creating `role: 'owner'` is rejected unless the caller's verified JWT email is
    `moon@mooner.dev` — today this endpoint only checks `profile.role !== 'owner'`
    ([index.ts:45](../../supabase/functions/admin-create-user/index.ts#L45)), which is exactly the
    class of check T-045 warned against reusing for identity (`admin_users.email` is editable, the JWT
    claim isn't).
  - An `owner` caller creating `admin`/`contributor` rows is forced to their own `course_id` — the
    request body's course, if any, is ignored in favor of the caller's.
- **`admin-delete-user`** ([index.ts](../../supabase/functions/admin-delete-user/index.ts)) changes:
  today it only checks `profile.role !== 'owner'` ([index.ts:45](../../supabase/functions/admin-delete-user/index.ts#L45)).
  Add: target must share the caller's `course_id` (unless caller is the primary owner), and enforce the
  admin-can't-remove-admin boundary from §3.

---

## 6. Interaction with the existing delete lockdown — a real conflict, not an oversight

[0022_admin_delete_lock_and_visibility.sql](../../db/sql/0022_admin_delete_lock_and_visibility.sql#L24-L31)
added `admin_is_delete_authorized()`, hardcoded to `moon@mooner.dev`, and stacked it as an **additional**
requirement on top of the existing role check for every delete (notes, note_folders). That was a
deliberate choice, described in detail in `docs/specs/admin-drive-navigation.md` §6, made a few days
before this conversation.

Your answer to the roles question was that **contributors can delete** ("write, delete, rename") and
**admins can manage content** — both broader than "only one hardcoded email, ever." Those two things
cannot both be true today: as shipped, nobody except `moon@mooner.dev` can delete *anything*, regardless
of role.

I'm not resolving this silently. My recommendation, if you confirm it in §11 Q1: generalize
`admin_is_delete_authorized()` from one hardcoded email to *"the caller is this course's owner, an
admin of this course, a contributor with write access to this module, or the primary owner"* —
i.e., let deletion follow the same `admin_can_write_module` scoping that write/rename already use, and
reserve the extra global lock for something narrower than everyday content (e.g. deleting a whole
course, or deleting another person's account) where you'd want the added friction. This keeps your new
answer intact without just deleting a security control someone deliberately asked for last week.

---

## 7. User management UI redesign — Material You (M3)

**Current state:** [UsersDrawer.jsx](../../src/components/admin/UsersDrawer.jsx) is a slide-in drawer
containing a raw HTML `<table>`, a native `<select>` for role, `window.confirm()` for delete
confirmation, and an inline expand/collapse "Add new user" form. None of it shares AdminBrowser's
already-shipped M3 patterns (Popover-based menus, breadcrumb, row lists, dialogs).

**Redesign direction — reuse T-045's system, don't invent a second one:**

- Same token set: [adminTokens.css](../../src/styles/adminTokens.css) already has the surface/border/
  accent opacity ramps and `--shadow-sm/-md/-lg` elevation steps M3 needs (see
  [design/colors.md](../design/colors.md#admin-panel-tokens-srcstylesadmintokenscss)) — no new hex
  values.
- Replace the drawer + `<table>` with a full-page row list styled like AdminBrowser's file table
  ([AdminBrowser.jsx:637-678](../../src/pages/admin/AdminBrowser.jsx#L637-L678)): sortable columns,
  search, and a role filter chip (matching the existing type-filter chip at
  [AdminBrowser.jsx:594-610](../../src/pages/admin/AdminBrowser.jsx#L594-L610)); the primary owner
  additionally gets a course column/filter.
- Role badges as M3 tonal chips using the existing accent/success/warning ramp — not new colors per
  role.
- Row actions move from a bare "Delete" `<button>` to the same `RowMenu` Popover pattern AdminBrowser
  already uses ([AdminBrowser.jsx:104-128](../../src/pages/admin/AdminBrowser.jsx#L104-L128)): Remove,
  Change role, Change directories.
- Replace the inline "Add new user" toggle-form with an M3 dialog, matching `DeleteConfirm`'s
  centered-Popover pattern ([AdminBrowser.jsx:144-171](../../src/pages/admin/AdminBrowser.jsx#L144-L171))
  — better suited to a form whose fields change with the selected role (directories for contributor,
  nothing extra for admin, course for the primary owner's cross-course flows).
- Replace `window.confirm()` for delete with that same confirm-dialog pattern, for visual consistency
  and because it's already built.

---

## 8. Data model changes

```sql
-- Resolves T-030: the dead `subjects` table shares a name with an unrelated concept
-- (subject == module/topic elsewhere in this codebase) and was never wired up. Drop
-- it rather than repurpose a same-named-but-different-shaped table for courses.
drop table if exists public.subjects;

create table public.courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);
-- write restricted to the primary owner; read open to authenticated admin accounts
-- (not public yet — no public multi-tenant site per §2 non-goals)

-- admin_users: course-scope every account, add the 'admin' tier
alter table public.admin_users
  add column course_id uuid references public.courses(id);

alter table public.admin_users
  drop constraint admin_users_role_check,
  add constraint admin_users_role_check check (role in ('owner', 'admin', 'contributor'));

-- module_visibility (0022) is the only DB-side row modules.js entries have —
-- extend it to carry the module→course mapping, since courseId lives in a
-- static JS file that RLS can't read. Every subject-create path must upsert
-- this alongside the modules.js commit.
alter table public.module_visibility add column course_id uuid references public.courses(id);

-- Mirrors admin_is_delete_authorized() (0022)
create function public.is_primary_owner() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'moon@mooner.dev';
$$;
```

RLS changes: `admin_can_write_module()` ([0020](../../db/sql/0020_init_notes.sql#L30-L42)) gains a
course match via the new `module_visibility.course_id`; `admin_is_delete_authorized()` gets generalized
per §6's resolution; `admin_users` SELECT policies become course-scoped (a row can see its own course's
accounts plus itself; the primary owner sees all).

---

## 9. File-by-file change map

| File | Change |
|---|---|
| `db/sql/0023_course_scoped_roles.sql` (new) | Everything in §8 |
| `db/migrations.yaml` | Register the new migration |
| [admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts) | `admin` role, primary-owner-only owner creation, course enforcement (§5) |
| [admin-delete-user/index.ts](../../supabase/functions/admin-delete-user/index.ts) | Course + role-boundary enforcement (§5) |
| [adminSupabase.js](../../src/lib/adminSupabase.js) | `getAdminProfile` returns `course_id` |
| [useAdmin.js](../../src/pages/admin/useAdmin.js) | Expose `course_id` / primary-owner flag |
| [useAdminModulesRegistry.js](../../src/hooks/useAdminModulesRegistry.js) | Filter by `course_id` |
| [modules.js](../../src/components/layout/Sidebar/modules.js) | Add `courseId` per entry |
| [AdminBrowser.jsx](../../src/pages/admin/AdminBrowser.jsx) | "Manage users" entry point (fixes §0); course switcher; generalize `DELETE_AUTHORIZED_EMAIL` per §6 |
| [AdminUsers.jsx](../../src/pages/admin/AdminUsers.jsx) / [UsersDrawer.jsx](../../src/components/admin/UsersDrawer.jsx) | M3 redesign (§7), role matrix (§3), course-aware filtering |
| `src/components/admin/CourseSwitcher.jsx` (new) | Primary-owner course switcher |

---

## 10. Open questions to confirm before implementation

1. **Delete-lock conflict (§6)** — generalize the global lock to course-owner/admin/contributor scoping
   (recommended), or keep it global-only and narrow what "contributors can delete" means instead? This
   reverses a deliberate security decision from a few days ago, so it needs your explicit call, not an
   assumption.
2. **Dropping the dead `subjects` table** (§8) in favor of a new `courses` table — confirm, given the
   name collision with this codebase's existing "subject = module" usage.
3. **Admin-removes-admin** (§3, footnote ¹) — your answer said admins remove contributors; confirmed
   they can't touch other admins/owners, or was that shorthand for "manage people" more broadly?
4. **Contributor hide permission** (§3, footnote ³) — not mentioned in your answer; assumed contributors
   stay excluded (matching today's owner-only default), admins gain it. Confirm.
5. **Course switcher UX** — a simple dropdown replacing "Content" in the topbar, defaulting to
   last-viewed course? Should the primary owner also get a combined "all courses" view, or strictly
   one-course-at-a-time like everyone else?
6. **First migrated course's name/slug** — literally "Computer Science", or a more generic default
   (e.g. "Main")?

---

## 11. Acceptance checklist

- [ ] "Manage users" reachable from the Drive-style landing page without opening a file first
- [ ] `admin_users.role` accepts `admin`; existing rows unaffected by the migration
- [ ] Every existing module and `admin_users` row is assigned to the migrated first course
- [ ] Only the verified JWT email `moon@mooner.dev` can create a course or an `owner`-role account,
      enforced server-side
- [ ] A course owner can create admin/contributor accounts scoped to their own course only
- [ ] An admin can remove a contributor in their course; cannot create or remove other accounts
- [ ] A contributor can write/rename/delete content within their `allowed_directories`, same as today
      minus the global delete lock, per §6's resolution
- [ ] Logging in as any course's owner/admin/contributor lands on that course's content, never another
      course's
- [ ] The primary owner can see and switch between all courses
- [ ] UsersDrawer/AdminUsers rebuilt in Material You, sharing AdminBrowser's tokens and component
      patterns; `window.confirm()` replaced with the M3 confirm-dialog pattern
