// About page — the team behind the project as Material You (M3) profile cards.
// Grouped into Founders and Contributors. The global Starfield + sidebar live in
// App.jsx, so this page is a transparent M3 surface like the Grade Toolkit.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, ArrowLeft } from 'lucide-react'
import { InstagramIcon, GithubIcon, LinkedinIcon } from './BrandIcons'
import moonPhoto from '../../img/team/moon.jpeg'
import tanooPhoto from '../../img/team/tanoo.png'
import atishPhoto from '../../img/team/atish.png'
import nooriePhoto from '../../img/team/noorie.png'
import nusaibahPhoto from '../../img/team/nusaibah.png'
import nahlaPhoto from '../../img/team/nahla.png'
import ismailPhoto from '../../img/team/ismail.png'
import styles from './AboutPage.module.css'

// `photoFocus` re-frames a photo onto the face inside the circular crop:
// translate brings the face to the centre, scale zooms in. Omit for photos
// that already frame well centred (e.g. Atish).
const FOUNDERS = [
  {
    name: 'Munazir Ramjhun',
    photo: moonPhoto,
    photoFocus: 'translate(-12%, 20%) scale(1.35)',
    role: 'Founder & Developer',
    socials: {
      instagram: 'https://www.instagram.com/offrian',
      linkedin: 'https://www.linkedin.com/in/offrian/',
      github: 'https://github.com/MintHerbs',
    },
  },
  {
    name: 'Tanoo Joyekurun',
    photo: tanooPhoto,
    photoFocus: 'translate(21%, 27%) scale(1.6)',
    role: 'Co-Founder & Creator of Grade Toolkit',
    socials: {
      instagram: 'https://www.instagram.com/msieur_sunshine',
      linkedin: 'https://www.linkedin.com/in/tanoojoy/',
      github: 'https://github.com/tanoojoy',
    },
  },
  {
    name: 'Atish Joottun',
    photo: atishPhoto,
    role: 'Co-Founder & Developer',
    socials: {
      linkedin: 'https://www.linkedin.com/in/atish-joottun-31a9aa321/',
      github: 'https://github.com/JoottunAtish/JoottunAtish',
    },
  },
]

const CONTRIBUTORS = [
  {
    name: 'Saihah Noorie Ossen',
    photo: nooriePhoto,
    photoFocus: 'translate(2%, 34%) scale(1.75)',
    role: 'Wrote the database notes',
    socials: {
      instagram: 'https://instagram.com/_noorie.07._',
      linkedin: 'https://www.linkedin.com/in/noorie-ossen-7049b52b6',
    },
  },
  {
    name: 'Nusaibah Banu Khodabocus',
    photo: nusaibahPhoto,
    role: 'Wrote the Maths semester 2 notes',
    socials: {
      instagram: 'https://www.instagram.com/nusaibah_2205',
    },
  },
  {
    name: 'Nahla Aalyah Dinmahamed',
    photo: nahlaPhoto,
    role: 'Lead Coordinator',
    socials: {
      instagram: 'https://www.instagram.com/nahla.dna',
      linkedin: 'https://www.linkedin.com/in/nahla-aalyah-dinmahamed-76712b319/',
    },
  },
  {
    name: 'Mohammad Ismail Iftikhar Oozeerally',
    photo: ismailPhoto,
    socials: {
      instagram: 'https://instagram.com/urhomeboyismail',
      linkedin: 'https://mu.linkedin.com/in/mohammad-ismail-oozeerally-31b8a334b',
    },
  },
]

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
      <button
        type="button"
        className={styles.avatarRing}
        onClick={() => onExpand(member)}
        aria-label={`Expand photo of ${member.name}`}
      >
        <div className={styles.avatarClip}>
          <img
            className={styles.avatar}
            src={member.photo}
            alt={member.name}
            loading="lazy"
            style={member.photoFocus ? { transform: member.photoFocus } : undefined}
          />
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
            key={member.name}
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

        <Section
          heading="Founders"
          members={FOUNDERS}
          reduceMotion={reduceMotion}
          onExpand={setExpanded}
        />
        <Section
          heading="Contributors"
          members={CONTRIBUTORS}
          reduceMotion={reduceMotion}
          onExpand={setExpanded}
        />
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
