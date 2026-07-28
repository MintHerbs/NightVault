// About page — the team behind the project as Material You (M3) profile cards.
// Grouped into Founders and Contributors, sourced from contributor_cards
// (T-072) instead of a hardcoded array — admins self-serve their own card via
// /admin/settings rather than a developer editing this file. The global
// Starfield + sidebar live in App.jsx, so this page is a transparent M3
// surface like the Grade Toolkit.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, ArrowLeft } from 'lucide-react'
import { InstagramIcon, GithubIcon, LinkedinIcon } from './BrandIcons'
import { listContributorCards } from '../../lib/contributorCardsApi'
import styles from './AboutPage.module.css'

// contributor_cards row → the shape MemberCard/PhotoLightbox render. Kept as
// a mapping (rather than renaming MemberCard's props to match the DB
// columns) so this file's history of `photo`/`photoFocus`/`socials` naming —
// and the components below — didn't need to change at all.
function toMember(row) {
  return {
    // Carried purely as a React key. `name` used to be safe for that when
    // these were developer-authored literals, but a card's name is now typed
    // by its owner in Settings, so two people can collide on it.
    id: row.admin_user_id,
    name: row.name,
    photo: row.photo_url,
    photoFocus: row.photo_focus,
    role: row.role_text,
    socials: row.socials || {},
  }
}

// Ordered so the icon row stays consistent across cards.
const SOCIALS = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'github', label: 'GitHub', Icon: GithubIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedinIcon },
]

function MemberCard({ member, index, reduceMotion, onExpand }) {
  return (
    <motion.article
      className={styles.card}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : index * 0.08,
        ease: [0.2, 0, 0, 1],
      }}
    >
      {/* Disabled rather than just inert when there's no photo: a card whose
          owner hasn't uploaded one yet has nothing to expand, and a focusable
          control announcing "Expand photo of X" that does nothing is worse
          than no control. Photoless cards couldn't happen while this list was
          a hardcoded array; they can now that people self-serve. */}
      <button
        type="button"
        className={styles.avatarRing}
        onClick={() => onExpand(member)}
        disabled={!member.photo}
        aria-label={`Expand photo of ${member.name}`}
      >
        <div className={styles.avatarClip}>
          {member.photo ? (
            <img
              className={styles.avatar}
              src={member.photo}
              alt={member.name}
              loading="lazy"
              style={member.photoFocus ? { transform: member.photoFocus } : undefined}
            />
          ) : (
            <span className={styles.avatarFallback}>{member.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </button>

      <h3 className={styles.name}>{member.name}</h3>
      {member.role && <p className={styles.role}>{member.role}</p>}

      <div className={styles.socials}>
        {SOCIALS.filter(s => member.socials[s.key]).map(({ key, label, Icon }) => (
          <a
            key={key}
            className={styles.socialLink}
            href={member.socials[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on ${label}`}
          >
            <Icon className={styles.socialIcon} />
          </a>
        ))}
      </div>
    </motion.article>
  )
}

function Section({ heading, members, reduceMotion, onExpand }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>{heading}</h2>
      <div className={styles.grid}>
        {members.map((member, i) => (
          <MemberCard
            key={member.id ?? member.name}
            member={member}
            index={i}
            reduceMotion={reduceMotion}
            onExpand={onExpand}
          />
        ))}
      </div>
    </section>
  )
}

// Full-photo lightbox opened by clicking an avatar. Shows the whole (uncropped)
// image so the circular crop isn't the only view. Closes on scrim click, the
// close button, or Escape.
function PhotoLightbox({ member, onClose, reduceMotion }) {
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Lock background scroll while the overlay is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <motion.div
      className={styles.scrim}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${member.name}`}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <motion.figure
        className={styles.lightbox}
        onClick={e => e.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      >
        <button
          type="button"
          className={styles.lightboxClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <img className={styles.lightboxImage} src={member.photo} alt={member.name} />
        <figcaption className={styles.lightboxCaption}>
          <span className={styles.lightboxName}>{member.name}</span>
          {member.role && (
            <span className={styles.lightboxRole}>{member.role}</span>
          )}
        </figcaption>
      </motion.figure>
    </motion.div>
  )
}

function AboutPage() {
  const navigate = useNavigate()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [founders, setFounders] = useState([])
  const [contributors, setContributors] = useState([])
  const [loading, setLoading] = useState(true)

  // Go back to wherever the user came from; fall back to the tree if this page
  // was opened directly (no in-app history to pop).
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/tree')
  }

  // Same reduced-motion contract the Card primitive and Grade Toolkit follow.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(query.matches)
    const onChange = e => setReduceMotion(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // contributor_cards (T-072) replaces the old hardcoded FOUNDERS/CONTRIBUTORS
  // arrays — a contributor with no card yet (Rheva, Maisara, Zakiyyah until
  // they make one via Settings) simply isn't in either list.
  useEffect(() => {
    let cancelled = false
    Promise.all([listContributorCards('founder'), listContributorCards('contributor')])
      .then(([founderRows, contributorRows]) => {
        if (cancelled) return
        setFounders(founderRows.map(toMember))
        setContributors(contributorRows.map(toMember))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <motion.header
          className={styles.pageHeader}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        >
          <div className={styles.titleRow}>
            <button
              type="button"
              className={styles.backButton}
              onClick={goBack}
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.pageTitle}>Meet the Team</h1>
          </div>
          <p className={styles.pageSubtitle}>The people behind the project.</p>
        </motion.header>

        {!loading && founders.length > 0 && (
          <Section
            heading="Founders"
            members={founders}
            reduceMotion={reduceMotion}
            onExpand={setExpanded}
          />
        )}
        {!loading && contributors.length > 0 && (
          <Section
            heading="Contributors"
            members={contributors}
            reduceMotion={reduceMotion}
            onExpand={setExpanded}
          />
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <PhotoLightbox
            member={expanded}
            onClose={() => setExpanded(null)}
            reduceMotion={reduceMotion}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

export default AboutPage
