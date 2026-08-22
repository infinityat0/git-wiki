import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the SPA runs on :5173 and proxies API calls to the Express server on
// :3000. In production the server serves this build from the same origin
// (see ADR-0001), so no proxy is needed there.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
