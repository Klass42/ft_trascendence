import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function parsePort(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function loadPrefixedEnv(envFile: string, prefixes: string[]): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .flatMap((line) => {
          const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (!match || !prefixes.some((prefix) => match[1].startsWith(prefix))) {
            return [];
          }

          return [[match[1], match[2]]];
        }),
    );
  } catch {
    return {};
  }
}

export default defineConfig(({ mode }) => {
  // Dev-server settings only (the deployed SPA is static and uses /api).
  // Read apps/frontend/.env.<mode> by hand: Vite's loadEnv would also pick up
  // unrelated variables such as NODE_ENV and warn about them.
  const envPrefixes = ['FRONTEND_', 'BACKEND_', 'VITE_'];
  const localEnv = loadPrefixedEnv(path.resolve(__dirname, `.env.${mode}`), envPrefixes);
  const env = { ...localEnv, ...process.env };

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
