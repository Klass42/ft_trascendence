import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function parsePort(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default defineConfig(({ mode }) => {
  const dockerEnv = loadEnv(mode, path.resolve(__dirname, '../../infra/docker'), '');
  const localEnv = loadEnv(mode, __dirname, '');
  const env = { ...dockerEnv, ...localEnv, ...process.env };

  const port = parsePort(env.FRONTEND_PORT || env.FRONTEND_DEV_PORT, 5173);
  const backendHost =
    !env.BACKEND_HOST || env.BACKEND_HOST === 'backend' ? 'localhost' : env.BACKEND_HOST;
  const backendTarget = `http://${backendHost}:${env.BACKEND_PORT || '3000'}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        // Realtime (Epic E): proxy Socket.io to the backend with WS upgrade.
        // Prod Caddy must likewise forward /socket.io with Upgrade/Connection.
        '/socket.io': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
    },
  };
});
