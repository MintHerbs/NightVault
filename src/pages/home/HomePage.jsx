import { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/layout/PageShell';
import Footer from '../../components/layout/Footer';
import AsciiCard from '../../components/ui/AsciiCard';
import Loading from '../../components/ui/Loading';
import { listCourses, cachedCourses } from '../../lib/coursesApi';
import { resolveCoverField } from '../../constants/coverPresets';
import { TOOLS } from '../../constants/tools';
import { eye } from '../../lib/asciiArt/fields';
import styles from './home.module.css';

// Every non-hidden course gets its own animated card, routing into that
// course's own landing page (Notes + every tool). Grade Toolkit and
// Socials aren't tied to any one course, so they stay standalone
// top-level cards instead of moving inside a course page (T-077).
const GRADE_TOOLKIT = TOOLS.find((t) => t.id === 'grades');
// Circuit Sandbox is a standalone workbench rather than a Computer Science
// artefact, so it sits here instead of on that course's landing page (owner
// decision) — `courses: []` in tools.js keeps it out of toolsForCourse().
const CIRCUIT_SANDBOX = TOOLS.find((t) => t.id === 'circuit-sandbox');

export default function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  // Distinguished from an empty list on purpose. This used to be a bare
  // `.catch(() => setCourses([]))`, which rendered a course-less home page that
  // looked deliberate — the grid still showed Grade Toolkit and Socials, so a
  // total failure to read `courses` was indistinguishable from "no courses
  // exist", with nothing in the console either. That silence is what made the
  // anon-can't-read-courses bug (migration 0049 unapplied, so RLS returned zero
  // rows to logged-out visitors while admins saw all of them) so hard to spot.
  const [failed, setFailed] = useState(false);
  // Whether the grid below is being painted from the cache rather than from a
  // live read. The banner has to say something different in each case, since
  // one of them still has every course card in it.
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCourses()
      .then((rows) => { if (!cancelled) setCourses(rows.filter((c) => !c.hidden)); })
      .catch((error) => {
        if (cancelled) return;
        console.error('[home] could not load courses:', error);
        // The last list this browser saw, rather than nothing. Losing the
        // course cards also loses the only route to their tool pages, and
        // those tools need no database at all; an unreachable `courses` row
        // took the B+ Tree visualiser down with it (owner report).
        //
        // `hidden` is honoured out of the cache exactly as it is out of a live
        // read, so this cannot surface a course the owner has withheld; see
        // cachedCourses() in src/lib/coursesApi.js.
        const cached = cachedCourses();
        setCourses(cached ? cached.filter((c) => !c.hidden) : []);
        setStale(Boolean(cached?.length));
        setFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Resolved once per course list, not per render: an uploaded cover makes
  // resolveCoverField build a fresh field function each call, and AsciiCanvas
  // keys its animation loop on that function's identity — recomputing inline
  // would restart every cover's animation on every parent render.
  const covers = useMemo(
    () => new Map(courses.map((c) => [c.id, resolveCoverField(c)])),
    [courses],
  );

  return (
    <PageShell variant="content" navbar={{ showAbout: true }}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Night Vault</h1>
        <p className={styles.heroTagline}>
          A study companion built by students, for students.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionSubtitle}>
          {!failed
            ? 'Pick a course to get started. Everything runs in your browser.'
            : stale
              ? "Notes can't be reached just now, so this list may be out of date. Every tool still works."
              : "Courses couldn't be loaded just now. The tools below still work."}
        </p>
        {loading ? (
          <Loading />
        ) : (
          <div className={styles.toolGrid}>
            {courses.map((course) => (
              <AsciiCard
                key={course.id}
                title={course.name}
                description="Notes, tools, and everything under this course."
                field={covers.get(course.id)}
                to={`/courses/${course.id}`}
                cta="Get started"
              />
            ))}
            <AsciiCard
              title={CIRCUIT_SANDBOX.title}
              description={CIRCUIT_SANDBOX.description}
              field={CIRCUIT_SANDBOX.field}
              to={CIRCUIT_SANDBOX.route}
              cta="Get started"
            />
            <AsciiCard
              title={GRADE_TOOLKIT.title}
              description={GRADE_TOOLKIT.description}
              field={GRADE_TOOLKIT.field}
              to={GRADE_TOOLKIT.route}
              cta="Get started"
            />
            <AsciiCard
              title="Socials"
              description="Post, read, and reply on the community feed."
              field={eye}
              to="/social/feed"
              cta="Get started"
            />
          </div>
        )}
      </section>

      <Footer />
    </PageShell>
  );
}
