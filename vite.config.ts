import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { timingSafeEqual } from 'node:crypto';
import { syncMetaAds } from './server/metaAdsSync';
import { MetaAdsConfigError } from './server/metaAdsClient';
import { SupabaseServerConfigError } from './server/supabaseAdmin';
import { handleEmployeeAuthAccount } from './api/employee-auth-account';
import {
  defaultMetaLeaderboardRange,
  isMetaLeaderboardConfigError,
  readMetaLeaderboardForUser,
  SupabaseAuthenticationError,
} from './server/metaAdsLeaderboard';
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

function createLocalMetaAdsSync(env: Record<string, string>) {
  return {
    name: 'meta-ads-local-sync',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/api/meta-ads-sync') return next();

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (req.method !== 'GET' && req.method !== 'POST') {
          res.setHeader('Allow', 'GET, POST');
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }

        const secret = env.CRON_SECRET?.trim() || '';
        const authorization = Array.isArray(req.headers.authorization)
          ? req.headers.authorization[0] || ''
          : req.headers.authorization || '';
        const expected = Buffer.from(`Bearer ${secret}`);
        const provided = Buffer.from(authorization);
        const authorized = Boolean(secret)
          && provided.length === expected.length
          && timingSafeEqual(provided, expected);
        if (!authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }

        const dateFrom = url.searchParams.get('date_from');
        const dateTo = url.searchParams.get('date_to');
        if (Boolean(dateFrom) !== Boolean(dateTo)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'date_range_requires_both_dates' }));
          return;
        }

        try {
          const result = await syncMetaAds(env, { dateFrom, dateTo });
          res.statusCode = result.ok ? 200 : 502;
          res.end(JSON.stringify(result));
        } catch (error) {
          if (error instanceof MetaAdsConfigError || error instanceof SupabaseServerConfigError) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'configuration_error', message: error.message }));
            return;
          }
          console.error('[meta-ads-local-sync] Sync failed:', error instanceof Error ? error.message : 'unknown error');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'meta_ads_sync_failed', message: 'Facebook Ads sync failed. Check the local server log.' }));
        }
      });
    },
  };
}

function createLocalMetaAdsLeaderboard(env: Record<string, string>) {
  return {
    name: 'meta-ads-local-leaderboard',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/api/meta-ads-leaderboard') return next();

        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }

        const rawAuthorization = req.headers.authorization;
        const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] || '' : rawAuthorization || '';
        const match = authorization.match(/^Bearer\s+(.+)$/i);
        if (!match) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'authentication_required' }));
          return;
        }

        const defaults = defaultMetaLeaderboardRange(env);
        const dateFrom = url.searchParams.get('date_from') || defaults.dateFrom;
        const dateTo = url.searchParams.get('date_to') || defaults.dateTo;
        try {
          const result = await readMetaLeaderboardForUser(env, match[1], dateFrom, dateTo);
          res.statusCode = 200;
          res.end(JSON.stringify({ ...result, dateFrom, dateTo }));
        } catch (error) {
          if (error instanceof SupabaseAuthenticationError) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'authentication_required', message: error.message }));
            return;
          }
          if (error instanceof MetaAdsConfigError) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_date_range', message: error.message }));
            return;
          }
          if (isMetaLeaderboardConfigError(error)) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'configuration_error', message: (error as Error).message }));
            return;
          }
          console.error('[meta-ads-local-leaderboard] Read failed:', error instanceof Error ? error.message : 'unknown error');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'meta_leaderboard_unavailable', message: 'Không đọc được bảng Meta từ Supabase.' }));
        }
      });
    },
  };
}

function createLocalEmployeeAuthAccount(env: Record<string, string>) {
  return {
    name: 'employee-auth-local-account-sync',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/api/employee-auth-account') return next();
        await handleEmployeeAuthAccount(req, res, env);
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), createLocalUpcareProxy(env), createLocalMetaAdsSync(env), createLocalMetaAdsLeaderboard(env), createLocalEmployeeAuthAccount(env)],
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
