// Dev-loop only. Not shipped, not used by any build.
//
// vite.config.js ignores '**/.claude/**' so the main tree's dev server does not
// watch agent worktrees as a second copy of the repo. This checkout IS one of
// those worktrees, so under the base config the watcher ignores every file in
// it: edits never invalidate, and the server keeps serving the module it
// transformed at boot. Anything verified against it is verifying stale code.
//
//   npx vite --config vite.worktree.config.js
import base from './vite.config.js'

export default {
  ...base,
  server: { ...(base.server ?? {}), watch: { ignored: [] } },
}
