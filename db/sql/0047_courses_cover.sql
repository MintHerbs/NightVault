-- 0047_courses_cover.sql
-- T-077 follow-on: lets the primary owner choose a course card's ASCII cover
-- animation from the admin panel — either a named preset or an image uploaded
-- and converted to character art in the browser.
--
-- Why the art is text in a column and not a file in Storage: the converter
-- (src/lib/asciiArt/imageToAscii.js) reduces the image to a ~72-column
-- character grid, about 3 KB of ASCII. Storing that costs one column and no
-- second network round trip when a card paints, against a bucket policy, a
-- public-URL path convention and CORS handling for the image-file equivalent.
-- The source image is deliberately NOT retained — the grid is the artifact,
-- and keeping the original would mean a storage lifecycle (orphan cleanup on
-- course delete, the same problem T-002 covers for note images) for no
-- rendering benefit. Re-uploading is the way to change a cover.
--
-- Additive only, and schema-agnostic about `courses.id`'s type: dev's courses
-- table (0024) uses `id uuid`, prod's pre-existing one (see 0025's header)
-- uses `id text`. New independent columns are safe either way. Do NOT use this
-- migration to reconcile that drift — see 0046's header.
--
-- No new RLS policy: 0046 already grants public SELECT on this table (covers
-- must be readable by anonymous visitors to render), and writes stay gated by
-- the existing "courses primary owner update" policy from 0026 — a cover is
-- just another column on a row only the primary owner may update.

alter table public.courses
  add column if not exists cover_preset text,
  add column if not exists cover_ascii  text,
  add column if not exists cover_anim   text;

-- Guard the animation name at the DB level so a bad value can't reach the
-- renderer, which would silently fall back and look like the save was lost.
-- Keep in step with BITMAP_ANIMATIONS in src/lib/asciiArt/bitmapField.js.
alter table public.courses
  drop constraint if exists courses_cover_anim_check;
alter table public.courses
  add constraint courses_cover_anim_check
  check ( cover_anim is null or cover_anim in ('scanline','swirl','dissolve','flicker','breathe') );

-- A cover grid is ~3 KB; anything far past that is a malformed upload rather
-- than art, and the column is public-read so it's worth bounding.
alter table public.courses
  drop constraint if exists courses_cover_ascii_size;
alter table public.courses
  add constraint courses_cover_ascii_size
  check ( cover_ascii is null or length(cover_ascii) <= 20000 );
