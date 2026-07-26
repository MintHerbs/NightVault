import {
  Calculator,
  ChartLineUp,
  Files,
  Function as FunctionIcon,
  Globe,
  Graph,
  TreeStructure,
} from '@phosphor-icons/react';
import PageShell from '../../components/layout/PageShell';
import Footer from '../../components/layout/Footer';
import Card from '../../components/ui/Card';
import styles from './home.module.css';

// Icons come from @phosphor-icons/react — the same set the sidebar uses
// (see src/components/layout/Sidebar/modules.js). Calculator and Globe are
// deliberately the sidebar's own icons for these destinations.
const TOOLS = [
  {
    id: 'notes',
    title: 'Notes',
    description: 'Browse every subject\'s notes, folder by folder.',
    Icon: Files,
    route: '/notes-browser',
  },
  {
    id: 'cpa',
    title: 'CPA Calculator',
    description: 'Work out your CPA and see what each module does to it.',
    Icon: Calculator,
    route: '/tools/grade-toolkit',
  },
  {
    id: 'btree',
    title: 'B+ Tree Visualizer',
    description: 'Insert, delete, and search keys with every step animated.',
    Icon: TreeStructure,
    route: '/tree',
  },
  {
    id: 'erd',
    title: 'ERD Visualizer',
    description: 'Turn a schema description into an entity relationship diagram.',
    Icon: Graph,
    route: '/erd',
  },
  {
    id: 'complexity',
    title: 'Code Complexity',
    description: 'Paste code and get its Big-O complexity line by line.',
    Icon: ChartLineUp,
    route: '/algo/code-complexity',
  },
  {
    id: 'recurrence',
    title: 'Recurrence Relation',
    description: 'Solve recurrences and follow the substitution steps.',
    Icon: FunctionIcon,
    route: '/algo/recurrence-relation',
  },
  {
    id: 'socials',
    title: 'Socials',
    description: 'Post, read, and reply on the community feed.',
    Icon: Globe,
    route: '/social/feed',
  },
];

export default function HomePage() {
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
          Pick a tool to get started. Everything runs in your browser.
        </p>
        <div className={styles.toolGrid}>
          {TOOLS.map(({ id, title, description, Icon, route }) => (
            <Card
              key={id}
              title={title}
              description={description}
              icon={<Icon size={22} weight="regular" />}
              to={route}
            />
          ))}
        </div>
      </section>

      <Footer />
    </PageShell>
  );
}
