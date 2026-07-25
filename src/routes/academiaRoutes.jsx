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
const AboutPage = lazy(() => import('../pages/about/AboutPage'))
const DisclaimerPage = lazy(() => import('../pages/disclaimer/DisclaimerPage'))
const LogicalEquivalencePage = lazy(() => import('../pages/logic/proof/LogicalEquivalencePage'))
const TableauxPage = lazy(() => import('../pages/logic/tableaux/TableauxPage'))
const GradeToolkitPage = lazy(() => import('../pages/tools/grade-toolkit/GradeToolkitPage'))
const HomePage = lazy(() => import('../pages/home/HomePage'))

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
  '/logic/proof': LogicalEquivalencePage,
  '/logic/tableaux': TableauxPage,
  '/logic/truth-tree': TableauxPage,
  '/logic/semantic-tableaux': TableauxPage,
  '/about': AboutPage,
  '/disclaimer': DisclaimerPage,
  '/tools/grade-toolkit': GradeToolkitPage,
  '/tools/lazy-grades': LazyGradesRedirect,
  '/tools/cpa-calculator': CpaCalculatorRedirect,
  '/home': HomePage,
}

export function preloadAcademiaRoutes() {
  import('../pages/tree/TreePage')
  import('../pages/erd/ERDPage')
  import('../pages/logic/proof/LogicalEquivalencePage')
  import('../pages/logic/tableaux/TableauxPage')
  import('../pages/algo/complexity/ComplexityPage')
  import('../pages/algo/recurrence/RecurrencePage')
  import('../pages/tools/grade-toolkit/GradeToolkitPage')
  import('../pages/home/HomePage')
  import('../pages/notes/NotesPage')
  import('../pages/notes-browser/NotesBrowserPage')
}
