// Vite configuration for React project
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  assetsInclude: ['**/*.json'],
  optimizeDeps: {
    // PGlite ships a WASM module plus a 6 MB filesystem image, and locates the
    // image by a URL relative to its own source. Pre-bundling rewrites that
    // module into .vite/deps and the relative URL then resolves to the wrong
    // place: the fetch returns the dev server's HTML fallback, and PGlite
    // rejects it with "Invalid FS bundle size: 2331 !== 6293225". Excluding it
    // leaves the package to be served as-is, with its asset URLs intact.
    exclude: ['@electric-sql/pglite'],
  },
  server: {
    watch: {
      // Agent worktrees live under .claude/worktrees and are full checkouts of
      // this repo, so the dev server was watching a second copy of every file
      // and full-reloading the page whenever one changed. That reload also
      // wipes in-memory state (unread counts, the island's entrance phase),
      // which makes anything stateful impossible to observe while a worktree
      // is active.
      ignored: ['**/.claude/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['motion/react', 'framer-motion'],
          // Feature chunks
          'tree-feature': [
            './src/pages/tree/TreePage.jsx',
            './src/features/tree/components/TreeCanvas/TreeCanvas.jsx',
            './src/features/tree/components/TreeNode/TreeNode.jsx',
            './src/features/tree/components/TreeEdge/TreeEdge.jsx',
            './src/lib/BPlusTree.js',
            './src/lib/treeLayout.js',
            './src/hooks/useBPlusTree.js'
          ],
          'erd-feature': [
            './src/pages/erd/ERDPage.jsx',
            './src/features/erd/components/ERDCanvas/ERDCanvas.jsx',
            './src/features/erd/components/ERDStep1/ERDStep1.jsx',
            './src/features/erd/components/ERDStep2/ERDStep2.jsx',
            './src/features/erd/components/ERDStep3/ERDStep3.jsx',
            './src/lib/erdLayout.js',
            './src/lib/erdParser.js',
            './src/lib/erdPromptBuilder.js'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
