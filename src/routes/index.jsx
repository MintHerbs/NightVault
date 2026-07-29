import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import { routeComponents, NotesPage, NotesBrowserPage, CourseLandingPage, preloadAcademiaRoutes } from './academiaRoutes'
import { HomeFeedPage, GuidelinesPage, SocialChatRoute, preloadSocialRoutes } from './socialRoutes'

// Admin routes
const AdminLogin = lazy(() => import('../pages/admin/AdminLogin'))
const AdminBrowser = lazy(() => import('../pages/admin/AdminBrowser'))
const AdminEditor = lazy(() => import('../pages/admin/AdminEditor'))
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'))
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage'))

export function AppRoutes({ onAIStateChange, onChatOpen }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

      {Object.entries(routeComponents).map(([path, Component]) => (
        <Route
          key={path}
          path={path}
          element={<Component onAIStateChange={onAIStateChange} onChatOpen={onChatOpen} />}
        />
      ))}
      <Route path="/notes/:section/*" element={<NotesPage />} />

      {/* One course's own landing page — Notes + every tool (T-077) */}
      <Route path="/courses/:courseId" element={<CourseLandingPage />} />

      {/* Public read-only Drive-style browser (T-049), scoped to one course
          (T-077) — Subjects → folders → files, never mixed across courses.
          The bare path had no course to scope to, so it redirects home rather
          than listing every course's Subjects together. */}
      <Route path="/notes-browser" element={<Navigate to="/home" replace />} />
      <Route path="/notes-browser/:courseId" element={<NotesBrowserPage />} />
      <Route path="/notes-browser/:courseId/:moduleId" element={<NotesBrowserPage />} />
      <Route path="/notes-browser/:courseId/:moduleId/:subfolder" element={<NotesBrowserPage />} />

      <Route path="/social/feed" element={<HomeFeedPage onAIStateChange={onAIStateChange} onChatOpen={onChatOpen} />} />
      <Route path="/social/chat" element={<SocialChatRoute onChatOpen={onChatOpen} />} />
      <Route path="/social/guidelines" element={<GuidelinesPage />} />
      
      {/* Admin routes */}
      <Route path="/admin" element={<AdminLogin />} />
      {/* Drive-style browser: Subjects → module folders → files (T-045 phase A) */}
      <Route path="/admin/editor" element={<AdminBrowser />} />
      <Route path="/admin/editor/:moduleId" element={<AdminBrowser />} />
      <Route path="/admin/editor/:moduleId/:subfolder" element={<AdminBrowser />} />
      {/* Writing surface — reached only by opening or creating a file in the browser */}
      <Route path="/admin/editor/:moduleId/:subfolder/new" element={<AdminEditor />} />
      <Route path="/admin/editor/:moduleId/:subfolder/:slug" element={<AdminEditor />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
    </Routes>
  )
}

export function preloadRoutes() {
  preloadAcademiaRoutes()
  preloadSocialRoutes()
}
