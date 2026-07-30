import { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/layout/PageShell';
import Footer from '../../components/layout/Footer';
import AsciiCard from '../../components/ui/AsciiCard';
import Loading from '../../components/ui/Loading';
import { listCourses } from '../../lib/coursesApi';
import { resolveCoverField } from '../../constants/coverPresets';
import { TOOLS } from '../../constants/tools';
import { eye } from '../../lib/asciiArt/fields';
import styles from './home.module.css';

// Every non-hidden course gets its own animated card, routing into that
// course's own landing page (Notes + every tool). Grade Toolkit and
// Socials aren't tied to any one course, so they stay standalone
// top-level cards instead of moving inside a course page (T-077).
const GRADE_TOOLKIT = TOOLS.find((t) => t.id === 'grades');

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

  useEffect(() => {
    let cancelled = false;
    listCourses()
      .then((rows) => { if (!cancelled) setCourses(rows.filter((c) => !c.hidden)); })
      .catch((error) => {
        if (cancelled) return;
        console.error('[home] could not load courses:', error);
        setCourses([]);
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
    <PageShell variant="content" navbar={{ showAbout: true, showDisclaimer: true }}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Night Vault</h1>
        <p className={styles.heroTagline}>
          A study companion built by students, for students.
        </p>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionSubtitle}>
          {failed
            ? "Courses couldn't be loaded just now. The tools below still work."
            : 'Pick a course to get started. Everything runs in your browser.'}
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
