import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createUpcareClient, UpcareAuthError } from './server/upcareClient';

function createLocalUpcareProxy(env: Record<string, string>) {
  const client = createUpcareClient(env);
  return {
    name: 'upcare-server-side-proxy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const routePrefix = '/api/upcare-crm';
        if (url.pathname !== routePrefix && !url.pathname.startsWith(`${routePrefix}/`)) return next();
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        const pathAndQuery = `/api/employee/mkt${url.search}`;
        if (req.method !== 'GET' || ![routePrefix, `${routePrefix}/api/employee/mkt`].includes(url.pathname)) {
          res.statusCode = req.method !== 'GET' ? 405 : 404;
          res.end();
          return;
        }
        try {
          const response = await client.request(pathAndQuery);
          res.statusCode = response.status;
          res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          const authError = error instanceof UpcareAuthError;
          res.end(JSON.stringify({
            error: authError ? 'upcare_auth_failed' : 'upcare_proxy_failed',
            message: authError ? error.message : 'Upcare connection failed. Please try again.',
          }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), createLocalUpcareProxy(env)],
    cacheDir: path.resolve(__dirname, 'node_modules/.vite-3001'),
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['recharts'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
