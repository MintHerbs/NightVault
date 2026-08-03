import { lazy } from 'react'
import { Navigate } from 'react-router-dom'

const TreePage = lazy(() => import('../pages/tree/TreePage'))
const ERDPage = lazy(() => import('../pages/erd/ERDPage'))
const ComplexityPage = lazy(() =>
  new Promise(resolve =>
    setTimeout(() => resolve(import('../pages/algo/complexity/ComplexityPage')), 300)
  )
)
const RecurrencePage = lazy(() =>
  new Promise(resolve =>
    setTimeout(() => resolve(import('../pages/algo/recurrence/RecurrencePage')), 300)
  )
)
const SortingPage = lazy(() =>
  new Promise(resolve =>
    setTimeout(() => resolve(import('../pages/algo/sorting/SortingPage')), 300)
  )
)
const AboutPage = lazy(() => import('../pages/about/AboutPage'))
const DisclaimerPage = lazy(() => import('../pages/disclaimer/DisclaimerPage'))
const TermsPage = lazy(() => import('../pages/legal/TermsPage'))
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage'))
const LogicalEquivalencePage = lazy(() => import('../pages/logic/proof/LogicalEquivalencePage'))
const TableauxPage = lazy(() => import('../pages/logic/tableaux/TableauxPage'))
const DigitalLogicPage = lazy(() => import('../pages/arch/digital-logic/DigitalLogicPage'))
const GradeToolkitPage = lazy(() => import('../pages/tools/grade-toolkit/GradeToolkitPage'))
const HomePage = lazy(() => import('../pages/home/HomePage'))
// Unlisted directory of the tools kept off the sidebar and the home page.
// Left out of preloadAcademiaRoutes below on purpose: nothing links here, so
// prefetching it would only cost every visitor a chunk they never open.
const ExperimentalPage = lazy(() => import('../pages/experimental/ExperimentalPage'))
export const CourseLandingPage = lazy(() => import('../pages/course/CourseLandingPage'))

// The CPA calculator and "Min effort, max result" tools were fused into the
// Grade Toolkit. Keep the old paths alive as redirects that deep-link into the
// matching mode so existing links/bookmarks don't break.
const CpaCalculatorRedirect = () => <Navigate to="/tools/grade-toolkit" replace />
const LazyGradesRedirect = () => (
  <Navigate to="/tools/grade-toolkit?mode=minmax" replace />
)

export const NotesPage = lazy(() => import('../pages/notes/NotesPage'))
export const NotesBrowserPage = lazy(() => import('../pages/notes-browser/NotesBrowserPage'))

export const routeComponents = {
  '/tree': TreePage,
  '/erd': ERDPage,
  '/algo/complexity': ComplexityPage,
  '/algo/code-complexity': ComplexityPage,
  '/algo/recurrence': RecurrencePage,
  '/algo/recurrence-relation': RecurrencePage,
  '/algo/sorting': SortingPage,
  '/algo/sorting-algorithms': SortingPage,
  '/logic/proof': LogicalEquivalencePage,
  '/logic/tableaux': TableauxPage,
  '/logic/truth-tree': TableauxPage,
  '/logic/semantic-tableaux': TableauxPage,
  '/arch/digital-logic': DigitalLogicPage,
  '/about': AboutPage,
  '/disclaimer': DisclaimerPage,
  '/terms': TermsPage,
  '/privacy': PrivacyPage,
  '/tools/grade-toolkit': GradeToolkitPage,
  '/tools/lazy-grades': LazyGradesRedirect,
  '/tools/cpa-calculator': CpaCalculatorRedirect,
  '/home': HomePage,
  '/experimental': ExperimentalPage,
}

export function preloadAcademiaRoutes() {
  import('../pages/tree/TreePage')
  import('../pages/erd/ERDPage')
  import('../pages/logic/proof/LogicalEquivalencePage')
  import('../pages/logic/tableaux/TableauxPage')
  import('../pages/arch/digital-logic/DigitalLogicPage')
  import('../pages/algo/complexity/ComplexityPage')
  import('../pages/algo/recurrence/RecurrencePage')
  import('../pages/algo/sorting/SortingPage')
  import('../pages/tools/grade-toolkit/GradeToolkitPage')
  import('../pages/home/HomePage')
  import('../pages/course/CourseLandingPage')
  import('../pages/notes/NotesPage')
  import('../pages/notes-browser/NotesBrowserPage')
}
