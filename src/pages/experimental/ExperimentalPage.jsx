import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import BackButton from '../../components/common/BackButton/BackButton';
import Footer from '../../components/layout/Footer';
import AsciiCard from '../../components/ui/AsciiCard';
import { EXPERIMENTAL_TOOLS } from '../../constants/experimentalTools';
import styles from './ExperimentalPage.module.css';

/**
 * /experimental: an unlisted directory of the tools kept off the public site.
 *
 * The page is itself unlisted by the same rule it documents. It is absent from
 * TOOLS (home and course cards), from MODULE_TOOLS and STANDALONE_TOOLS (the
 * sidebar), and from preloadAcademiaRoutes, so the only way here is the URL.
 * Keep it that way: adding it to any of those registries publishes it.
 *
 * Nothing on this page mutates anything. It reads a static array, renders
 * links, and never touches Supabase, so browsing it cannot change what the
 * live site shows. The tools it links to are pure client-side engines
 * (runTableaux, runProof) with no network calls of their own.
 */
export default function ExperimentalPage() {
  const navigate = useNavigate();

  return (
    <PageShell variant="content">
      <BackButton onClick={() => navigate('/home')} />
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Experimental</h1>
          <p className={styles.heroSubtitle}>
            Tools that are built and routed but kept off the sidebar, the home page and
            every course page.
          </p>
        </section>

        <p className={styles.notice}>
          This page is a directory, not a switch. Opening a tool here runs it exactly as
          it would if you typed its URL: everything happens in your browser, nothing is
          written to the database, and the live site is unchanged either way. Publishing
          one of these for real means editing a registry in the source, which this page
          deliberately does not do.
        </p>

        <div className={styles.grid}>
          {EXPERIMENTAL_TOOLS.map((tool) => (
            <div className={styles.slot} key={tool.id}>
              <AsciiCard
                title={tool.title}
                description={tool.description}
                field={tool.field}
                to={tool.route}
                cta="Open"
              />
              <p className={styles.meta}>
                <code className={styles.route}>{tool.route}</code>
                <span className={styles.why}>{tool.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </PageShell>
  );
}
