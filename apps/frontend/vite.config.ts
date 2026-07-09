import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Realtime (Epic E): proxy the Socket.io endpoint to the backend with
      // WebSocket upgrade so the browser connects same-origin (no CORS in dev).
      // NOTE for Ale: the prod reverse proxy must likewise forward /socket.io
      // with `Upgrade`/`Connection` headers for WebSockets to work.
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
