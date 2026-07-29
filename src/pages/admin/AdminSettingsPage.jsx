// src/pages/admin/AdminSettingsPage.jsx
//
// T-072: self-serve admin identity — profile photo, password, display name,
// and the public contributor card that used to be a hardcoded array in
// AboutPage.jsx. Reachable from both admin avatar dropdowns
// (AdminBrowser.jsx, EditorNavbar.jsx).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, GearSix } from '@phosphor-icons/react'
import { useAdmin } from './useAdmin'
import Card from '../../components/ui/Card'
import ChangePasswordModal from '../../components/admin/ChangePasswordModal'
import AvatarCropper from '../../components/admin/AvatarCropper/AvatarCropper'
import ToastNotification, { useToast } from '../../components/admin/ToastNotification'
import Loading from '../../components/ui/Loading'
import {
  getOwnContributorCard, updateOwnProfile, uploadAvatarPhoto, upsertContributorCard,
} from '../../lib/contributorCardsApi'
import '../../styles/adminTokens.css'
import styles from './AdminSettingsPage.module.css'

// Order matches AboutPage.jsx's existing SOCIALS row — no new platforms
// unless asked for.
const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
]

function AvatarPicker({ photoUrl, name, onPick }) {
  const fileInputRef = useRef(null)
  return (
    <div className={styles.avatarPicker}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => fileInputRef.current?.click()}
        title="Change photo"
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" className={styles.avatarImage} />
        ) : (
          <span className={styles.avatarFallback}>{(name || '?').charAt(0).toUpperCase()}</span>
        )}
        <span className={styles.avatarOverlay}><Camera size={18} weight="fill" /></span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function AdminSettingsContent() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAdmin()
  const { showToast } = useToast()

  // Two names, deliberately: `displayName` is the text field's editing buffer,
  // `savedDisplayName` is what's actually in the database. The photo flow
  // writes the SAVED one — admin_update_own_profile takes both columns at once
  // (it assigns rather than coalesces), so sending the live buffer would
  // silently commit a half-typed name, or an empty string if the field had
  // been cleared. An empty string is worse than null here: admin_profiles_public
  // does coalesce(display_name, username), which only falls back on NULL, so
  // '' would leave T-071's author avatars showing a blank name and a '?'
  // initial.
  const [displayName, setDisplayName] = useState('')
  const [savedDisplayName, setSavedDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileCropFile, setProfileCropFile] = useState(null)
  const [savingName, setSavingName] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const [card, setCard] = useState(null)
  const [cardLoading, setCardLoading] = useState(true)
  const [creatingCard, setCreatingCard] = useState(false)
  const [cardName, setCardName] = useState('')
  const [cardRole, setCardRole] = useState('')
  const [cardPhotoUrl, setCardPhotoUrl] = useState(null)
  const [cardPhotoChanged, setCardPhotoChanged] = useState(false)
  const [cardSocials, setCardSocials] = useState({ instagram: '', github: '', linkedin: '' })
  const [cardCropFile, setCardCropFile] = useState(null)
  const [savingCard, setSavingCard] = useState(false)

  useEffect(() => {
    if (!profile) return
    const initial = profile.display_name || profile.username || ''
    setDisplayName(initial)
    setSavedDisplayName(initial)
    setAvatarUrl(profile.avatar_url || null)
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    setCardLoading(true)
    getOwnContributorCard(profile.id)
      .then((row) => {
        setCard(row)
        setCardName(row?.name ?? profile.display_name ?? profile.username ?? '')
        setCardRole(row?.role_text ?? '')
        setCardPhotoUrl(row?.photo_url ?? null)
        setCardSocials({
          instagram: row?.socials?.instagram ?? '',
          github: row?.socials?.github ?? '',
          linkedin: row?.socials?.linkedin ?? '',
        })
      })
      .catch((err) => showToast(`Failed to load contributor card: ${err.message}`, 'error'))
      .finally(() => setCardLoading(false))
    // profile is a stable object per useAdmin() load; re-running on every
    // field change would refetch on our own optimistic updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const confirmProfilePhoto = async (blob) => {
    try {
      const url = await uploadAvatarPhoto(blob, profile.id, 'profile')
      await updateOwnProfile({ displayName: savedDisplayName, avatarUrl: url })
      setAvatarUrl(url)
      setProfileCropFile(null)
      showToast('Profile photo updated', 'success')
    } catch (err) {
      showToast(`Failed to update photo: ${err.message}`, 'error')
    }
  }

  const saveDisplayName = async () => {
    const trimmed = displayName.trim()
    if (!trimmed) { showToast('Display name cannot be empty', 'error'); return }
    setSavingName(true)
    try {
      await updateOwnProfile({ displayName: trimmed, avatarUrl })
      setDisplayName(trimmed)
      setSavedDisplayName(trimmed)
      showToast('Display name updated', 'success')
    } catch (err) {
      showToast(`Failed to update display name: ${err.message}`, 'error')
    } finally {
      setSavingName(false)
    }
  }

  const confirmCardPhoto = async (blob) => {
    try {
      const url = await uploadAvatarPhoto(blob, profile.id, 'contributor-card')
      setCardPhotoUrl(url)
      setCardPhotoChanged(true)
      setCardCropFile(null)
      showToast('Photo updated — save your card to publish it', 'success')
    } catch (err) {
      showToast(`Failed to update photo: ${err.message}`, 'error')
    }
  }

  const saveCard = async () => {
    const trimmed = cardName.trim()
    if (!trimmed) { showToast('Name is required', 'error'); return }
    setSavingCard(true)
    try {
      const socials = {}
      for (const { key } of SOCIAL_FIELDS) {
        const value = cardSocials[key]?.trim()
        if (value) socials[key] = value
      }
      const saved = await upsertContributorCard({
        admin_user_id: profile.id,
        name: trimmed,
        role_text: cardRole.trim() || null,
        photo_url: cardPhotoUrl,
        // A freshly-cropped photo is already correctly framed — carrying
        // over an older photo_focus (from a legacy migrated photo) would
        // double-apply a reframe on top of pixels that no longer need it.
        photo_focus: cardPhotoChanged ? null : (card?.photo_focus ?? null),
        socials,
        section: card?.section ?? 'contributor',
        sort_order: card?.sort_order ?? null,
      })
      setCard(saved)
      // contributor_cards_sync_avatar (0045) mirrors photo_url into
      // avatar_url in the database, but ONLY when photo_url actually changed
      // (or on the card's first insert) — an edit that leaves the photo
      // alone (e.g. just updating role_text) doesn't touch avatar_url there.
      // Gating on `cardPhotoChanged` here, read before it's reset below,
      // keeps this optimistic update honest: without it, re-saving an
      // unrelated field would overwrite a manually-set profile photo in the
      // UI with the card's (unchanged) photo, even though the database never
      // made that write — a divergence that would only reveal itself as a
      // flicker back on the next reload.
      if (cardPhotoChanged && saved.photo_url) setAvatarUrl(saved.photo_url)
      setCardPhotoChanged(false)
      showToast('Contributor card saved', 'success')
    } catch (err) {
      showToast(`Failed to save contributor card: ${err.message}`, 'error')
    } finally {
      setSavingCard(false)
    }
  }

  if (authLoading) {
    return <div className={styles.fullLoading}><Loading color="var(--accent)" /></div>
  }

  const showCardForm = Boolean(card) || creatingCard

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <button className={styles.backButton} onClick={() => navigate('/admin/editor')} title="Back to content">
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className={styles.brand}>
          <GearSix size={22} weight="fill" className={styles.brandIcon} />
          <span className={styles.brandName}>Settings</span>
        </div>
      </header>

      <main className={styles.main}>
        <Card title="Profile photo" className={styles.card}>
          <div className={styles.profileRow}>
            <AvatarPicker photoUrl={avatarUrl} name={displayName} onPick={setProfileCropFile} />
            <p className={styles.hint}>
              Shown next to your name wherever you've contributed a note.
            </p>
          </div>
        </Card>

        <Card title="Display name" className={styles.card}>
          <div className={styles.formRow}>
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
            <button className={styles.btnPrimary} onClick={saveDisplayName} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Card>

        <Card title="Password" className={styles.card}>
          <div className={styles.formRow}>
            <p className={styles.hint}>Change the password used to sign in to the admin panel.</p>
            <button className={styles.btnSecondary} onClick={() => setChangePasswordOpen(true)}>
              Change password
            </button>
          </div>
        </Card>

        <Card title="Contributor card" className={styles.card}>
          {cardLoading ? (
            <Loading color="var(--accent)" />
          ) : !showCardForm ? (
            <div className={styles.emptyState}>
              <p className={styles.hint}>
                You don't have a public "Meet the Team" card yet.
              </p>
              <button className={styles.btnPrimary} onClick={() => setCreatingCard(true)}>
                Create your card
              </button>
            </div>
          ) : (
            <div className={styles.cardForm}>
              <AvatarPicker photoUrl={cardPhotoUrl} name={cardName} onPick={setCardCropFile} />
              <p className={styles.hint}>This photo becomes your profile picture too.</p>

              <label className={styles.formGroup}>
                <span className={styles.label}>Name</span>
                <input
                  className={styles.input}
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
              </label>

              <label className={styles.formGroup}>
                <span className={styles.label}>Role</span>
                <input
                  className={styles.input}
                  type="text"
                  value={cardRole}
                  onChange={(e) => setCardRole(e.target.value)}
                  placeholder="e.g. Wrote the database notes"
                />
              </label>

              {SOCIAL_FIELDS.map(({ key, label }) => (
                <label key={key} className={styles.formGroup}>
                  <span className={styles.label}>{label}</span>
                  <input
                    className={styles.input}
                    type="url"
                    value={cardSocials[key]}
                    onChange={(e) => setCardSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="https://…"
                  />
                </label>
              ))}

              <button className={styles.btnPrimary} onClick={saveCard} disabled={savingCard}>
                {savingCard ? 'Saving…' : 'Save card'}
              </button>
            </div>
          )}
        </Card>
      </main>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        userEmail={user?.email}
      />

      {profileCropFile && (
        <AvatarCropper
          file={profileCropFile}
          onCancel={() => setProfileCropFile(null)}
          onConfirm={confirmProfilePhoto}
          onError={(message) => showToast(message, 'error')}
        />
      )}

      {cardCropFile && (
        <AvatarCropper
          file={cardCropFile}
          onCancel={() => setCardCropFile(null)}
          onConfirm={confirmCardPhoto}
          onError={(message) => showToast(message, 'error')}
        />
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  return (
    <ToastNotification>
      <AdminSettingsContent />
    </ToastNotification>
  )
}
