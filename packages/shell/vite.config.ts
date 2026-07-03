import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Serve/bundle the repo-root `public/` (holds the SwayTune logos) at the web root,
  // so `/SwayTuneDark.png` etc. resolve in both dev and the production build.
  publicDir: '../../public',

  // Vite options for Tauri development
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src/**/*', '**/example/**/*'],
    },
  },
})
