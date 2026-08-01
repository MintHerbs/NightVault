import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import BackButton from '../../components/common/BackButton/BackButton';
import Footer from '../../components/layout/Footer';
import AsciiCard from '../../components/ui/AsciiCard';
import Loading from '../../components/ui/Loading';
import { listCourses } from '../../lib/coursesApi';
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
 */
export default function CourseLandingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listCourses()
      .then((rows) => {
        if (cancelled) return;
        const match = rows.find((c) => c.id === courseId && !c.hidden);
        setCourse(match ?? null);
      })
      .catch(() => { if (!cancelled) setCourse(null); })
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
