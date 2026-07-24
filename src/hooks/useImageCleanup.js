// src/hooks/useImageCleanup.js
//
// Finds images in the `note-images` Supabase Storage bucket that no note
// references, so they can be deleted. The set of "referenced images" is
// derived from note CONTENT in Supabase (notes.content_md) — the source of
// truth since E-005/T-043. Previously this scanned committed .md in GitHub
// and keyed on file SHA; once content moved to the DB that scan saw nothing
// and flagged every live image as orphaned (T-002). Reading content_md fixes
// that.
//
// Images themselves moved from GitHub to Storage 2026-07-24 — listing and
// deleting them now goes through the Storage API directly (RLS-gated, same
// owner-only rule this hook already enforced client-side).

import { supabase } from '../lib/supabaseClient'
import { NOTE_IMAGES_BUCKET, noteImageFallbackSrc } from '../lib/noteImageSrc'

// Extract all image paths from a markdown string
function extractImages(markdown) {
  return [...String(markdown || '').matchAll(/!\[.*?\]\((\/notes\/img\/.*?)\)/g)]
    .map(m => m[1])
}

export function useImageCleanup({ modules, isOwner }) {

  // ── SCAN ──────────────────────────────────────────────────────────────────
  // For the given module (or all), collect every image referenced by any of
  // that module's notes (from the DB), list the images actually stored in the
  // module's img folder (from GitHub), and return the stored ones nothing
  // references.
  async function runScan(moduleId, onProgress) {
    if (!isOwner) throw new Error('Owners only')

    const modulesToScan = moduleId
      ? modules.filter(m => m.id === moduleId)
      : modules
    const moduleIds = modulesToScan.map(m => m.id)
    if (moduleIds.length === 0) {
      return { orphans: [], scannedCount: 0, skippedCount: 0, totalFiles: 0 }
    }

    // 1. Referenced images, straight from note content in Supabase.
    const { data: rows, error } = await supabase
      .from('notes')
      .select('module_id, path, content_md')
      .in('module_id', moduleIds)
    if (error) throw new Error(error.message)

    const allReferencedImages = new Set()
    let scannedCount = 0
    const notes = rows ?? []
    for (const row of notes) {
      onProgress?.(scannedCount + 1, notes.length, 0)
      extractImages(row.content_md).forEach(img => allReferencedImages.add(img))
      scannedCount++
    }

    // 2. Images actually stored per module (Storage), served live.
    const allStoredImages = []
    for (const mod of modulesToScan) {
      const { data: files, error: listError } = await supabase.storage
        .from(NOTE_IMAGES_BUCKET)
        .list(mod.id)
      if (listError || !files) continue // no images for this module yet
      files.forEach(f => {
        const path = `/notes/img/${mod.id}/${f.name}`
        allStoredImages.push({
          path,
          storagePath: `${mod.id}/${f.name}`,
          previewUrl: noteImageFallbackSrc(path),
        })
      })
    }

    // 3. Orphans = stored images no note references.
    const orphans = allStoredImages.filter(
      img => !allReferencedImages.has(img.path)
    )

    return { orphans, scannedCount, skippedCount: 0, totalFiles: notes.length }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  // Deletes confirmed orphan images from Storage. Each item needs { storagePath }.
  async function deleteOrphans(confirmedOrphans, onProgress) {
    if (!isOwner) throw new Error('Owners only')
    let deleted = 0
    let failed  = 0

    for (let i = 0; i < confirmedOrphans.length; i++) {
      const img = confirmedOrphans[i]
      onProgress?.(i + 1, confirmedOrphans.length)
      const { error } = await supabase.storage.from(NOTE_IMAGES_BUCKET).remove([img.storagePath])
      if (error) {
        failed++  // log but don't abort — delete as many as possible
      } else {
        deleted++
      }
    }

    return { deleted, failed }
  }

  return { runScan, deleteOrphans }
}
