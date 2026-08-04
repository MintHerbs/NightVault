import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import BackButton from '../../components/common/BackButton/BackButton';
import Footer from '../../components/layout/Footer';
import AsciiCard from '../../components/ui/AsciiCard';
import Loading from '../../components/ui/Loading';
import { listCourses, cachedCourses } from '../../lib/coursesApi';
import { fallbackCourseName } from '../../constants/courses';
import { toolsForCourse } from '../../constants/tools';
import { NOTES_COVER } from '../../constants/coverPresets';
import styles from './CourseLandingPage.module.css';

/**
 * A single course's landing page (T-077): Notes (scoped to this course) plus
 * that course's tool cards, all in the ASCII-cover design.
 *
 * The tool set is per course (see toolsForCourse in src/constants/tools.js).
 * B+ Tree, ERD, Code Complexity and Recurrence Relation are computer-science
 * artefacts, so only Computer Science shows them; every other course gets
 * Notes plus Grade Toolkit, the one tool that applies regardless of subject.
 *
 * ## Surviving an unreachable database
 *
 * Every tool card below comes from the static registry in constants/tools.js
 * and every tool it points at runs entirely in the browser. Supabase is needed
 * for exactly one thing on this page: confirming the course exists and reading
 * its name. So a failed read used to take the whole of Computer Science, eight
 * working tools, off the air over a title (owner report).
 *
 * "No such course" and "could not ask" are now separate outcomes. The first is
 * still a dead end. The second renders the page from the URL's own course id,
 * because that is all the tool cards ever needed.
 */
export default function CourseLandingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  // The course row could not be read at all, as opposed to read and found
  // absent. Drives the notice below, and nothing else; the page renders
  // either way.
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDegraded(false);
    listCourses()
      .then((rows) => {
        if (cancelled) return;
        const match = rows.find((c) => c.id === courseId && !c.hidden);
        setCourse(match ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setDegraded(true);

        // The last list this browser saw is better evidence than the URL: it
        // knows the real display name, and it knows which courses are hidden.
        // If it has an opinion about this id, that opinion is final: falling
        // through to the permissive branch below would turn an outage into a
        // way to open a course the owner has hidden.
        const cached = cachedCourses();
        if (cached) {
          setCourse(cached.find((c) => c.id === courseId && !c.hidden) ?? null);
          return;
        }

        // Nothing cached, and no way to check. Show the tools rather than
        // assert a course does not exist on the strength of a network error.
        setCourse({ id: courseId, slug: courseId, name: fallbackCourseName(courseId) });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (loading) {
    return (
      <PageShell variant="content">
        <div className={styles.emptyState}><Loading /></div>
      </PageShell>
    );
  }

  if (!course) {
    return (
      <PageShell variant="content">
        <BackButton onClick={() => navigate('/home')} />
        <div className={styles.emptyState}>This course doesn't exist.</div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="content">
      <BackButton onClick={() => navigate('/home')} />
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>{course.name}</h1>
        </section>

        {/* Said once, here, rather than on each card: the tools are unaffected,
            so warning on every one of them would overstate it. Notes is the
            only card that needs the database, and it opens to its own, more
            specific message. */}
        {degraded && (
          <p className={styles.notice} role="status">
            Notes can&apos;t be reached right now. Every tool below still works.
          </p>
        )}

        <div className={styles.grid}>
          <AsciiCard
            title="Notes"
            description="Browse every subject's notes, folder by folder."
            field={NOTES_COVER}
            to={`/notes-browser/${course.id}`}
            cta="Open"
          />
          {toolsForCourse(course.slug).map((tool) => (
            <AsciiCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              field={tool.field}
              to={tool.route}
              cta="Open"
            />
          ))}
        </div>
      </div>

      <Footer />
    </PageShell>
  );
}
