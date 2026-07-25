import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import { routeComponents, NotesPage, NotesBrowserPage, preloadAcademiaRoutes } from './academiaRoutes'
import { HomeFeedPage, GuidelinesPage, SocialChatRoute, preloadSocialRoutes } from './socialRoutes'

// Admin routes
const AdminLogin = lazy(() => import('../pages/admin/AdminLogin'))
const AdminBrowser = lazy(() => import('../pages/admin/AdminBrowser'))
const AdminEditor = lazy(() => import('../pages/admin/AdminEditor'))
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'))

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

      {/* Public read-only Drive-style browser (T-049) — Subjects → folders → files */}
      <Route path="/notes-browser" element={<NotesBrowserPage />} />
      <Route path="/notes-browser/:moduleId" element={<NotesBrowserPage />} />
      <Route path="/notes-browser/:moduleId/:subfolder" element={<NotesBrowserPage />} />

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
    </Routes>
  )
}

export function preloadRoutes() {
  preloadAcademiaRoutes()
  preloadSocialRoutes()
}
