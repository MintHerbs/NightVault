// src/pages/admin/AdminAnalytics.jsx
//
// T-086: what the site is actually used for. Reached from the admin navbar.
//
// Every number comes from one analytics_dashboard() call (0052), which
// aggregates server-side because the underlying tables have no read grant for
// this session at all. Panels render empty rather than erroring when the
// migration has not been applied yet.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChartLineUp } from '@phosphor-icons/react'
import { useAdmin } from './useAdmin'
import Loading from '../../components/ui/Loading'
import { Panel, RankBars, StatTile, ToolTable, TrendChart } from '../../components/admin/analytics'
import { formatAgo, formatCount } from '../../components/admin/analytics/format'
import { DEFAULT_RANGE, EMPTY_DASHBOARD, RANGES, fetchDashboard } from '../../lib/analytics/adminApi'
import { routeLabel } from '../../lib/analytics/eventSchema'
import '../../styles/adminTokens.css'
import styles from './AdminAnalytics.module.css'

function StatRow({ totals }) {
  return (
    <div className={styles.tiles}>
      <StatTile
        label="Visitors"
        value={totals.visitors}
        hint="Distinct browsers, not headcount"
        emphasis
      />
      <StatTile label="New" value={totals.new_visitors} hint="First seen in this range" />
      <StatTile label="Page views" value={totals.pageviews} />
      <StatTile label="Notes read" value={totals.note_reads} />
      <StatTile label="Used a tool" value={totals.tool_users} hint="People, not actions" />
      <StatTile label="Tool actions" value={totals.tool_uses} />
    </div>
  )
}

function AdminAnalyticsContent() {
  const navigate = useNavigate()
  const { profile, loading: authLoading, isPrimaryOwner } = useAdmin()

  const [rangeKey, setRangeKey] = useState(DEFAULT_RANGE)
  const [data, setData] = useState(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Mirrors analytics_can_view() in 0052 and the isOwner || isAdmin gate on the
  // Manage users button. A client-side check is a UX short-circuit only — the
  // RPC refuses regardless, same pattern as PRIMARY_OWNER_EMAIL in
  // lib/adminSupabase.js.
  const canView = isPrimaryOwner || profile?.role === 'owner' || profile?.role === 'admin'

  const load = useCallback(async (days) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDashboard(days))
    } catch (err) {
      setError(err.message)
      setData(EMPTY_DASHBOARD)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !canView) return
    const range = RANGES.find(r => r.key === rangeKey) ?? RANGES[1]
    load(range.days)
  }, [authLoading, canView, rangeKey, load])

  if (authLoading) {
    return <div className={styles.fullLoading}><Loading color="var(--accent)" /></div>
  }

  if (!canView) {
    return (
      <div className={styles.app}>
        <header className={styles.topbar}>
          <button className={styles.backButton} onClick={() => navigate('/admin/editor')} title="Back to content">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <div className={styles.brand}>
            <ChartLineUp size={22} weight="fill" className={styles.brandIcon} />
            <span className={styles.brandName}>Analytics</span>
          </div>
        </header>
        <main className={styles.main}>
          <Panel title="Not available for your account" wide>
            <p className={styles.notice}>
              Site-wide analytics is limited to owners and admins. Your own
              contributions still show on your contributor card.
            </p>
          </Panel>
        </main>
      </div>
    )
  }

  const { totals, daily, top_pages, top_notes, tools, entry_points, flow, contributors, recent_notes } = data

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <button className={styles.backButton} onClick={() => navigate('/admin/editor')} title="Back to content">
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className={styles.brand}>
          <ChartLineUp size={22} weight="fill" className={styles.brandIcon} />
          <span className={styles.brandName}>Analytics</span>
        </div>

        <div className={styles.topRight}>
          <div className={styles.segmented} role="group" aria-label="Date range">
            {RANGES.map(range => (
              <button
                key={range.key}
                type="button"
                className={`${styles.segment} ${rangeKey === range.key ? styles.segmentActive : ''}`}
                onClick={() => setRangeKey(range.key)}
                aria-pressed={rangeKey === range.key}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {error && (
          <Panel title="Could not load analytics" wide>
            <p className={styles.notice}>{error}</p>
            <p className={styles.noticeHint}>
              If this says the function does not exist, migration 0052 has not been
              applied to this database yet.
            </p>
          </Panel>
        )}

        {loading ? (
          <div className={styles.panelLoading}><Loading color="var(--accent)" /></div>
        ) : (
          <>
            <StatRow totals={totals} />

            <Panel
              title="Visitors per day"
              subtitle={`Distinct sessions, ${data.range?.from ?? ''} to ${data.range?.to ?? ''}`}
              wide
            >
              <TrendChart daily={daily} />
            </Panel>

            <Panel
              title="Tools"
              subtitle="Which tools survive first contact, and which people lean on"
              wide
            >
              <ToolTable tools={tools} />
            </Panel>

            <Panel
              title="Most visited pages"
              subtitle="Ranked by people, not views — one person reloading a tool is not twenty readers"
            >
              <RankBars
                valueSuffix="people"
                emptyText="No page views recorded in this range yet."
                rows={(top_pages ?? []).map(page => ({
                  key: page.route_key,
                  label: routeLabel(page.route_key),
                  title: page.route_key,
                  value: page.sessions,
                  meta: `${formatCount(page.hits)} views · ${
                    page.onward ? `${formatCount(page.onward)} went on somewhere` : 'nobody went on from here'
                  }`,
                }))}
              />
            </Panel>

            <Panel
              title="Most read notes"
              subtitle="Read count against how long ago it was last edited"
            >
              <RankBars
                valueSuffix="readers"
                emptyText="No note reads recorded in this range yet."
                rows={(top_notes ?? []).map(note => ({
                  key: note.note_id,
                  label: note.title || note.path,
                  title: `${note.module_id}/${note.path}`,
                  value: note.sessions,
                  meta: `${formatCount(note.hits)} reads · edited ${formatAgo(note.updated_at)}`,
                }))}
              />
            </Panel>

            <Panel
              title="How people arrive"
              subtitle="First page of a visit"
            >
              <RankBars
                valueSuffix="arrivals"
                emptyText="No entries recorded in this range yet."
                rows={(entry_points ?? []).map(entry => ({
                  key: entry.route_key,
                  label: routeLabel(entry.route_key),
                  title: entry.route_key,
                  value: entry.count,
                }))}
              />
            </Panel>

            <Panel
              title="Where people go next"
              subtitle="Most travelled routes between pages"
            >
              <RankBars
                valueSuffix="moves"
                emptyText="No navigation recorded in this range yet."
                rows={(flow ?? []).map(edge => ({
                  key: `${edge.from_route}>${edge.to_route}`,
                  label: `${routeLabel(edge.from_route)} → ${routeLabel(edge.to_route)}`,
                  title: `${edge.from_route} → ${edge.to_route}`,
                  value: edge.count,
                }))}
              />
            </Panel>

            <Panel
              title="Contributors"
              subtitle="All time, from the note authorship ledger"
            >
              <RankBars
                valueSuffix="edits"
                emptyText="No note contributions recorded yet."
                rows={(contributors ?? []).map((person, index) => ({
                  key: `${person.display_name ?? 'unknown'}-${index}`,
                  label: person.display_name || 'Unknown',
                  value: person.contributions,
                  meta: `${formatCount(person.notes_touched)} notes · last ${formatAgo(person.last_at)}`,
                }))}
              />
            </Panel>

            <Panel title="Recently updated notes" subtitle="Newest edit first">
              {(recent_notes ?? []).length === 0 ? (
                <p className={styles.notice}>No notes yet.</p>
              ) : (
                <ul className={styles.noteList}>
                  {recent_notes.map(note => (
                    <li key={note.note_id} className={styles.noteRow}>
                      <span className={styles.noteTitle} title={`${note.module_id}/${note.path}`}>
                        {note.title || note.path}
                      </span>
                      <span className={styles.noteMeta}>{formatAgo(note.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </main>
    </div>
  )
}

export default function AdminAnalytics() {
  return <AdminAnalyticsContent />
}
