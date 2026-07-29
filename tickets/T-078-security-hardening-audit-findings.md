---
id: T-078
title: Security hardening audit — anon-writable social RLS, session_id-as-credential, admin-github-write path traversal, unrestricted storage uploads
status: in-progress
severity: critical
area: security
epic: none
created: 2026-07-29
---

## Summary

A full-repo RLS/hardening audit (chat-driven, no code changes made) found three critical issues — session hijacking via a public "identity" token on the social feed, unthrottled direct-to-database writes that bypass every app-level rate/bot check, and a path-traversal bug that lets a scoped contributor account write arbitrary files anywhere in the GitHub-backed content repo — plus several high/medium hardening gaps and a few sequential-await performance issues. Filed as one ticket per explicit request; see "Suggested fix" for how the pieces likely split into follow-up work.

## Evidence

### CRITICAL

**1. `session_id` is a public value used as the sole ownership credential (social feed).**
- [src/hooks/usePosts.js:180](../src/hooks/usePosts.js#L180) does `.from('posts').select('*')`, returning every post's `session_id` to every visitor.
- `vote_post`, `flag_post`, `update_own_post`, `soft_delete_post`, `soft_delete_comment`, `vote_comment` in [db/sql/0041_social_write_rpcs.sql](../db/sql/0041_social_write_rpcs.sql) all trust a client-supplied `session_id` parameter as the identity check, with no secret backing it.
- Anyone who reads another visitor's `session_id` off the network response (trivial — it's returned in every feed fetch) can call these RPCs directly with that value to edit/delete the victim's posts/comments or flip their votes.

**2. Anonymous direct-to-PostgREST writes bypass all app-level rate limiting and bot blocking.**
- `insert_posts`, `insert_comments`, `insert_votes`, `insert_comment_votes`, `insert_poll_votes`, `insert_flags`, `insert_blacklist` ([db/sql/0036_social_rls.sql](../db/sql/0036_social_rls.sql)) and the `messages` insert policy ([db/sql/0001_init_messages.sql](../db/sql/0001_init_messages.sql)) are all `WITH CHECK (true)`.
- `check_and_increment_rate_limit()` and `check_bot_blacklist()` ([db/sql/0037_social_rpcs.sql](../db/sql/0037_social_rpcs.sql)) are calls the *client* chooses to make before inserting — nothing in the database enforces that a caller went through them.
- A scripted direct `POST /rest/v1/posts` (or comments/votes/flags/messages) skips both checks entirely.

**3. Path traversal in `admin-github-write` → arbitrary GitHub repo write.**
- [supabase/functions/admin-github-write/index.ts:19-22](../supabase/functions/admin-github-write/index.ts#L19-L22):
  ```ts
  function isPathAllowed(path: string, role: string, allowedDirectories: string[]): boolean {
    if (role === 'owner') return true
    return allowedDirectories.some(dir => path.startsWith(`src/content/notes/${dir}/`))
  }
  ```
  This is a literal string-prefix check on the raw `path`. The GitHub API URL is then built by unescaped string concatenation ([`contentsUrl`, lines 84-85](../supabase/functions/admin-github-write/index.ts#L84-L85)) and handed to `fetch()`, which normalizes `.`/`..` path segments per the URL spec before the request is sent.
- A `path` such as `src/content/notes/<allowed-dir>/../../../.github/workflows/deploy.yml` passes the prefix check as a string, then resolves outside the sandbox at the actual HTTP layer.

### HIGH

**4. Chat `attachment_url` is unvalidated and inherits the open-insert problem.**
- [src/features/chat/components/ChatBubble/ChatBubble.jsx:21-27](../src/features/chat/components/ChatBubble/ChatBubble.jsx#L21-L27) renders `message.attachment_url` directly into `<img src>` for every viewer.
- `messages` has no CHECK constraint on `attachment_url` and INSERT is `WITH CHECK (true)` ([db/sql/0044_chat_message_attachments.sql](../db/sql/0044_chat_message_attachments.sql)), so a direct insert can set any URL, not just ones from the KLIPY picker.

**5. Public storage buckets have no size or MIME-type limit set server-side.**
- `note-images` ([db/sql/0023_sidebar_modules_and_images.sql](../db/sql/0023_sidebar_modules_and_images.sql)) and `avatars` ([db/sql/0043_contributor_settings.sql](../db/sql/0043_contributor_settings.sql)) are both created with just `(id, name, public)` — `file_size_limit` and `allowed_mime_types` are left null.
- [src/lib/imageToWebp.js](../src/lib/imageToWebp.js) only converts/downsizes client-side; bypassable via a direct API upload.

### MEDIUM

**6. `api_calls` RLS is fully open.**
- [db/sql/0003_init_api_calls.sql](../db/sql/0003_init_api_calls.sql) has `WITH CHECK (true)` on both insert and update, so the client-side Gemini quota counter can be reset by direct REST call. Low real-world impact today since `src/lib/geminiService.js` is dead code (confirmed not imported anywhere in the app), but the gap — and shipping `VITE_GEMINI_API_KEY` to the browser at all — should be closed before that feature is revived.

**7. `db:migrate` runner is blocked, so prod can silently drift from the repo.**
- Pre-existing checksum drift on migration `0024` blocks the runner; `0043`/`0044`/`0045` were hand-applied via `docker exec psql` instead. `0025`'s own migration note records this has already caused one undocumented divergence between repo and prod.

**8. Wildcard CORS on privileged edge functions.**
- `admin-create-user`, `admin-delete-user`, and `admin-github-write` all set `Access-Control-Allow-Origin: '*'`. Lower severity since auth is Bearer-JWT (not cookie-based), but should be scoped to the app's own origin as defense-in-depth.

### Confirmed NOT an issue (recorded so it isn't re-investigated)

- RLS is enabled on all 19 tables. The admin/notes/courses schema (`admin_users`, `notes`, `note_folders`, `sidebar_modules`, `courses`, `contributor_cards`, `avatars` policies) is well-hardened: `authenticated`-only writes, `SECURITY DEFINER` helpers with pinned `search_path`, a previously-fixed self-promotion bug (0017/0018).
- `service_role` key never reaches the browser; only in Edge Function secrets and local one-off scripts. `.env`/`.env.local` are gitignored.
- `admin-create-user`/`admin-delete-user` verify the caller's JWT via `auth.getUser()` and re-derive role/course from the DB server-side, never trusting client-supplied claims.
- Note markdown pipeline deliberately excludes `rehype-raw` ([MarkdownRenderer.jsx:104-109](../src/components/markdown/MarkdownRenderer.jsx#L104-L109)) — raw HTML in note content renders as inert text, never reaches the DOM.
- Social post content and chat messages render as plain React `{content}` JSX (auto-escaped) — no stored-content XSS via posts/comments/chat.
- `FormulaModal.jsx`'s `dangerouslySetInnerHTML` (KaTeX admin preview) does not set `trust: true`, so KaTeX's own `\href`/`\includegraphics` injection vectors stay blocked by default.

### Performance (bundled into this ticket, lower priority)

- [src/hooks/useEditorImages.js:132-134](../src/hooks/useEditorImages.js#L132-L134) uploads each new pasted image in a note sequentially inside a `for...of` loop — hot path on every save with new images.
- [src/lib/notesApi.js:522](../src/lib/notesApi.js#L522) and [:557](../src/lib/notesApi.js#L557) sequentially `await` `moveNote`/`deleteNote` in bulk folder move/delete loops — admin-only, lower priority.
- [src/hooks/useImageCleanup.js:64](../src/hooks/useImageCleanup.js#L64) sequentially scans storage per module — background admin tool, lowest priority.
- Not an issue: `vite.config.js` manual chunking and `MarkdownRenderer`'s on-demand KaTeX lazy-load are already well-optimized.

## Impact

- **#1**: Any visitor can vandalize or delete any other visitor's social post/comment, or flip their vote, by reading a public `session_id` off the wire and replaying it against the write RPCs.
- **#2**: The social feed and chat have no real defense against scripted flooding, vote-stuffing, or flag-bombing a specific post to trigger silent auto-hide (censorship-by-report-flood), since the DB itself imposes no limits.
- **#3**: A `contributor`-role admin account, deliberately scoped to a handful of note folders, can escalate to writing arbitrary files anywhere in the GitHub repo — including CI workflow files — a potential supply-chain compromise depending on the `GITHUB_TOKEN`'s actual scope.
- **#4**: Arbitrary external image URLs can be planted into the public chat room by anyone, enabling content abuse and passive IP-logging/deanonymization of chat participants.
- **#5**: Storage-cost abuse (oversized uploads) or stored-script-on-storage-origin risk (SVG with embedded script) via any authenticated admin account, not just owners.
- **#6-8**: Lower-severity gaps that widen the blast radius of the above or make prod state harder to trust.

## Suggested fix

Not implementing yet (investigation-only per request) — likely split into separate PRs when work starts:
- #1/#2 need a real per-browser secret (e.g. Supabase anonymous auth issuing a real JWT with `auth.uid()`) to replace `session_id`-as-credential, plus moving rate-limit/bot-blacklist enforcement into the write path itself (e.g. route all social writes through `SECURITY DEFINER` RPCs that call `check_and_increment_rate_limit`/`check_bot_blacklist` internally, and revoke direct table INSERT from `anon`/`public`).
- #3: resolve `.`/`..` in `path` (or reject any path containing `..`) before the prefix check in `isPathAllowed`, and re-verify the resolved path against `allowedDirectories`.
- #4: add a CHECK constraint on `attachment_url` (e.g. require it match the KLIPY CDN host) or route attachment inserts through a `SECURITY DEFINER` RPC.
- #5: set `file_size_limit`/`allowed_mime_types` on both storage buckets.
- #6: tighten `api_calls` RLS to SELECT-only for `anon`/`authenticated`, mutations via RPC.
- #7: resolve the 0024 drift so `db:migrate` can run normally again.
- #8: scope CORS `Access-Control-Allow-Origin` to the app's deployed origin(s).
- Perf items: wrap the sequential upload/move/delete loops in `Promise.all`.

## Acceptance criteria

- [x] Social/chat writes can no longer be attributed to or reversed by an attacker who only knows a victim's `session_id` — closed for posts/comments/votes/flags via column-level `REVOKE`, verified PostgREST 401s both a direct `select=session_id` and a `.eq('session_id', ...)` filter once the grant is gone. Deliberately left open on `messages` (no edit/delete/vote surface exists there to replay a leaked value into; it doubles as ChatBubble's avatar seed). Residual: Realtime `postgres_changes` payloads still carry it to an actively-connected subscriber (documented in 0048's header, not silently closed).
- [x] Direct REST writes to social/chat tables are rate-limited and bot-blocked at the database layer, not just in the client — `create_post`/`create_comment`/`send_message`/`vote_post`/`vote_comment`/`vote_poll` all check server-side now; direct `INSERT` revoked from anon/authenticated on every affected table. Residual: still keyed on a client-generated `session_id`, so a sybil attacker minting a fresh UUID per request is slowed by `check_bot_blacklist`'s content heuristics, not stopped outright — needs real per-browser identity to fully close.
- [x] `admin-github-write` rejects any `path` that resolves outside the caller's allowed directories, including via `.`/`..` — `isPathAllowed` now normalizes and rejects any path that isn't already in normalized form.
- [x] Chat `attachment_url` is constrained to trusted sources or written only via a validating RPC — both: a `https://`-only CHECK constraint, and inserts only reachable via `send_message`, which also validates `attachment_type`. Not fully closed: KLIPY's actual CDN host isn't pinned anywhere in the codebase to check against, so any `https://` image host is still accepted.
- [x] `note-images` and `avatars` buckets enforce a file size limit and an image-only MIME allowlist — 8 MiB, `image/webp|png|jpeg|gif`.
- [x] `api_calls` can only be mutated via RPC, not direct insert/update — went further than originally worded: mutation is blocked outright (INSERT/UPDATE policies dropped) rather than routed through a new RPC, since the only two consumers (`geminiService.js`, `useApiCalls.js`) are both confirmed dead code with no current caller.
- [x] `db:migrate` runs cleanly against a fresh database (0024 drift resolved) — verified by actually rebuilding local dev's social tables from the tracked migrations and running the full 0025-0049 chain; see the two skip notes below.
- [ ] Privileged edge functions restrict CORS to known app origins — code reads `ALLOWED_ORIGIN` from the environment now instead of hardcoding `*`, but nothing sets that secret yet. **Still needs**: `supabase secrets set ALLOWED_ORIGIN=https://<production-domain>`.
- [x] Sequential upload/move/delete loops in useEditorImages.js / notesApi.js are parallelized — also fixed the same pattern in useImageCleanup.js's storage listing.

## Implementation notes (2026-07-29, branch `T-078`)

- Migrations: [0048_social_write_hardening.sql](../db/sql/0048_social_write_hardening.sql) (the session_id/rate-limit fix), [0049_storage_limits_and_api_calls_lockdown.sql](../db/sql/0049_storage_limits_and_api_calls_lockdown.sql) (storage + api_calls). Numbered after 0047 because of a concurrent T-077 migration landing on that slot mid-session.
- Verified end-to-end via REST against a locally-rebuilt dev schema (not mocked): direct `INSERT`/`select=session_id` 401, `create_post`/`create_comment`/`send_message`/`vote_post`/`vote_poll` all succeed and omit `session_id` from their responses, `get_my_*` RPCs correctly scope to the caller's own session.
- Rebuilding local dev to verify against required marking three migrations applied-without-running: `0025`-`0027` (documented `prod`-only hotfixes for a `courses` table shape dev never had) and `0042` (its backfill hardcodes specific prod `admin_users` UUIDs that don't exist in any other dataset — a pre-existing issue in that migration, out of scope here, not fixed).
- Self-review caught a regression the initial pass missed: `PostCard.jsx`/`CommentItem.jsx` also read `post.session_id`/`comment.session_id` directly, both for the "is this mine" edit/delete check and as the anonymous-avatar seed (the same pattern `messages` has, just not accounted for on these two tables). Locking the column broke `select=*` outright (PostgREST 401s the whole projection, not just the ungranted field) and would have silently broken every own-post/own-comment edit/delete control. Fixed with `get_my_post_ids`/`get_my_comment_ids` RPCs for ownership, and the avatar seed now falls back to the post/comment's own `id` — a disclosed trade-off (same author's avatar is no longer consistent across their posts) rather than reopening the column.

## References

- Investigation conducted in-chat 2026-07-29. Implementation and self-review in the same session, on branch `T-078`, uncommitted as of this update.
