import type { IncomingMessage, ServerResponse } from 'node:http';
import { ImageLinkError, resolveImageLink } from './imageLink.ts';

export function createImageLinkHandler() {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(405, { message: 'Phương thức không được hỗ trợ.' });
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const value = url.searchParams.get('url');
    if (!value || value.length > 4096) return json(400, { message: 'Nhập link ảnh hợp lệ.' });
    try {
      return json(200, { imageUrl: await resolveImageLink(value) });
    } catch (error) {
      return json(error instanceof ImageLinkError ? error.status : 502, {
        message: error instanceof ImageLinkError ? error.message : 'Chưa tải được ảnh. Hãy thử lại.',
      });
    }
  };
}
