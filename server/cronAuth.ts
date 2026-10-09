import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function isCronAuthorized(req: IncomingMessage, secret = process.env.CRON_SECRET || ''): boolean {
  if (!secret) return false;
  const rawHeader = req.headers.authorization;
  const authorization = Array.isArray(rawHeader) ? rawHeader[0] || '' : rawHeader || '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authorization);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
