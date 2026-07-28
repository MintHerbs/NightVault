#!/usr/bin/env node
// scripts/migrate-team-to-contributor-cards.mjs
//
// One-off migration (T-072): seeds public.contributor_cards for the 7 people
// already hardcoded in AboutPage.jsx before that file moved to querying the
// table, and uploads their existing src/img/team/*.png|jpeg files to the
// `avatars` Storage bucket to populate photo_url.
//
// Rheva, Maisara, Zakiyyah are deliberately NOT in TEAM below — they have
// admin accounts but no existing hardcoded card, and get no row here; per the
// ticket they create their own via Settings.
//
// Each entry's photoFocus/role/socials/section/sort_order is transcribed
// verbatim from AboutPage.jsx's old FOUNDERS/CONTRIBUTORS arrays (git history
// has the pre-migration version). The source photo is uploaded AS-IS (just
// re-encoded to WebP) rather than run through the new interactive cropper —
// photo_focus is exactly the CSS transform that already correctly frames
// each one, so there is nothing to (re-)crop.
//
// Idempotent: skips any username whose contributor_cards row already exists,
// unless --overwrite is passed.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-team-to-contributor-cards.mjs --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-team-to-contributor-cards.mjs
//   ...                                            node scripts/migrate-team-to-contributor-cards.mjs --overwrite

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEAM_PHOTOS_DIR = join(ROOT, 'src', 'img', 'team')
const BUCKET = 'avatars'

// Avatars render at 112px (AboutPage) or 84px (Settings) at most — no need
// for the 1440px reader-column width convert-images-to-webp.mjs uses.
const MAX_WIDTH = 512
const QUALITY = 82

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    overwrite: { type: 'boolean', default: false },
  },
})
const dryRun = flags['dry-run']

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('  local stack: `npx supabase status` prints the URL and the "Secret" key.')
  process.exit(1)
}

const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }

const TEAM = [
  {
    username: 'moon',
    photo: 'moon.jpeg',
    name: 'Munazir Ramjhun',
    photoFocus: 'translate(-12%, 20%) scale(1.35)',
    role: 'Founder & Developer',
    socials: {
      instagram: 'https://www.instagram.com/offrian',
      linkedin: 'https://www.linkedin.com/in/offrian/',
      github: 'https://github.com/MintHerbs',
    },
    section: 'founder',
    sortOrder: 0,
  },
  {
    username: 'tanoo',
    photo: 'tanoo.png',
    name: 'Tanoo Joyekurun',
    photoFocus: 'translate(21%, 27%) scale(1.6)',
    role: 'Co-Founder & Creator of Grade Toolkit',
    socials: {
      instagram: 'https://www.instagram.com/msieur_sunshine',
      linkedin: 'https://www.linkedin.com/in/tanoojoy/',
      github: 'https://github.com/tanoojoy',
    },
    section: 'founder',
    sortOrder: 1,
  },
  {
    username: 'atish',
    photo: 'atish.png',
    name: 'Atish Joottun',
    photoFocus: null,
    role: 'Co-Founder & Developer',
    socials: {
      linkedin: 'https://www.linkedin.com/in/atish-joottun-31a9aa321/',
      github: 'https://github.com/JoottunAtish/JoottunAtish',
    },
    section: 'founder',
    sortOrder: 2,
  },
  {
    // Capitalized in prod's admin_users (confirmed 2026-07-28) — the
    // ticket's evidence text had it lowercase, which silently skipped this
    // person on the first --dry-run against real data.
    username: 'Noorie',
    photo: 'noorie.png',
    name: 'Saihah Noorie Ossen',
    photoFocus: 'translate(2%, 34%) scale(1.75)',
    role: 'Wrote the database notes',
    socials: {
      instagram: 'https://instagram.com/_noorie.07._',
      linkedin: 'https://www.linkedin.com/in/noorie-ossen-7049b52b6',
    },
    section: 'contributor',
    sortOrder: 0,
  },
  {
    username: 'nusaibah',
    photo: 'nusaibah.png',
    name: 'Nusaibah Banu Khodabocus',
    photoFocus: null,
    role: 'Wrote the Maths semester 2 notes',
    socials: {
      instagram: 'https://www.instagram.com/nusaibah_2205',
    },
    section: 'contributor',
    sortOrder: 1,
  },
  {
    username: 'nahla',
    photo: 'nahla.png',
    name: 'Nahla Aalyah Dinmahamed',
    photoFocus: null,
    role: 'Lead Coordinator',
    socials: {
      instagram: 'https://www.instagram.com/nahla.dna',
      linkedin: 'https://www.linkedin.com/in/nahla-aalyah-dinmahamed-76712b319/',
    },
    section: 'contributor',
    sortOrder: 2,
  },
  {
    username: 'Ismail',
    photo: 'ismail.png',
    name: 'Mohammad Ismail Iftikhar Oozeerally',
    photoFocus: null,
    role: null,
    socials: {
      instagram: 'https://instagram.com/urhomeboyismail',
      linkedin: 'https://mu.linkedin.com/in/mohammad-ismail-oozeerally-31b8a334b',
    },
    section: 'contributor',
    sortOrder: 3,
  },
]

async function findAdminUserId(username) {
  const res = await fetch(`${supabaseUrl}/rest/v1/admin_users?username=eq.${encodeURIComponent(username)}&select=id`, { headers })
  if (!res.ok) throw new Error(`lookup ${username} failed: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  return rows[0]?.id ?? null
}

async function cardExists(adminUserId) {
  const res = await fetch(`${supabaseUrl}/rest/v1/contributor_cards?admin_user_id=eq.${adminUserId}&select=admin_user_id`, { headers })
  if (!res.ok) throw new Error(`check existing card failed: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  return rows.length > 0
}

async function uploadPhoto(adminUserId, filename) {
  const bytes = readFileSync(join(TEAM_PHOTOS_DIR, filename))
  const webp = await sharp(bytes)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer()

  const objectPath = `contributor-card/${adminUserId}/${randomUUID()}.webp`
  const up = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: webp,
  })
  if (!up.ok) throw new Error(`upload ${objectPath} failed: ${up.status} ${await up.text()}`)

  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`
}

async function insertCard(entry, adminUserId, photoUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/contributor_cards`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      admin_user_id: adminUserId,
      name: entry.name,
      role_text: entry.role,
      photo_url: photoUrl,
      photo_focus: entry.photoFocus,
      socials: entry.socials,
      section: entry.section,
      sort_order: entry.sortOrder,
    }),
  })
  if (!res.ok) throw new Error(`insert card for ${entry.username} failed: ${res.status} ${await res.text()}`)
}

let migrated = 0
let skipped = 0

for (const entry of TEAM) {
  const adminUserId = await findAdminUserId(entry.username)
  if (!adminUserId) {
    console.log(`  SKIP ${entry.username} — no admin_users row`)
    skipped++
    continue
  }

  if (!flags.overwrite && await cardExists(adminUserId)) {
    console.log(`  skip (already migrated) ${entry.username}`)
    skipped++
    continue
  }

  console.log(`  ${entry.username} → ${entry.name} (${entry.section})`)
  if (dryRun) { migrated++; continue }

  const photoUrl = await uploadPhoto(adminUserId, entry.photo)
  await insertCard(entry, adminUserId, photoUrl)
  migrated++
}

console.log(`\n${migrated} card(s) migrated, ${skipped} skipped.`)
if (dryRun) console.log('--dry-run set; nothing was uploaded or written.')
