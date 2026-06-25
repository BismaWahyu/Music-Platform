import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Vite options for Tauri development
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src/**/*', '**/example/**/*'],
    },
  },
})
