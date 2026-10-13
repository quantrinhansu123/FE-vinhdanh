import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createUpcareClient, UpcareAuthError } from './server/upcareClient';
import { createMetaHandler } from './server/metaHandler';
import { createMetaQcHandler } from './server/metaQcHandler';
import { createImageLinkHandler } from './server/imageLinkHandler';
import { loadMetaProjectQcRows, MetaProjectQcError } from './server/metaProjectQc';

function createLocalMetaApi(env: Record<string, string>) {
  const handler = createMetaHandler({ ...env, ...process.env });
  const qcHandler = createMetaQcHandler({ ...env, ...process.env });
  const imageLinkHandler = createImageLinkHandler();
  return {
    name: 'meta-server-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const route = new URL(req.url || '/', 'http://localhost').pathname;
        if (route === '/api/image-link') return void imageLinkHandler(req, res);
        if (route === '/api/meta-qc') return void qcHandler(req, res);
        if (route === '/api/meta-ads') return void handler(req, res);
        return next();
      });
    },
  };
}

function createLocalMetaProjectQcApi(env: Record<string, string>) {
  return {
    name: 'meta-project-qc-local-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/api/meta-project-qc') return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET, OPTIONS');
          res.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }
        try {
          const result = await loadMetaProjectQcRows(
            env,
            url.searchParams.get('from') || '',
            url.searchParams.get('to') || ''
          );
          res.statusCode = 200;
          res.end(JSON.stringify(result));
        } catch (error) {
          if (error instanceof MetaProjectQcError) {
            res.statusCode = error.statusCode;
            res.end(JSON.stringify({ error: error.errorCode, message: error.message }));
            return;
          }
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'meta_project_qc_failed', message: 'Không tải được dữ liệu từ Meta. Hãy thử lại sau.' }));
        }
      });
    },
  };
}

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
    plugins: [react(), tailwindcss(), createLocalUpcareProxy(env), createLocalMetaApi(env), createLocalMetaProjectQcApi(env)],
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
      watch: { ignored: ['**/build/**'] },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
