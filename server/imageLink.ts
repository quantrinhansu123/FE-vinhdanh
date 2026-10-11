import { parseImageLink } from '../src/utils/imageLinks.ts';

export class ImageLinkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ImageLinkError';
  }
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? match[1] ?? match[2] : null;
}

export function extractLightshotImage(html: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = attribute(tag, 'property') || attribute(tag, 'name');
    if (!['og:image', 'twitter:image:src', 'twitter:image'].includes(property?.toLowerCase() || '')) continue;
    const content = attribute(tag, 'content');
    if (!content) continue;
    try {
      const url = new URL(content.replace(/&amp;/g, '&'), 'https://prnt.sc');
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      if (!['img.lightshot.app', 'i.imgur.com', 'img.prntscr.com', 'image.prntscr.com'].includes(url.hostname.toLowerCase())) continue;
      return url.href;
    } catch {
      continue;
    }
  }
  throw new ImageLinkError(422, 'Không tìm thấy ảnh trong link Lightshot. Hãy kiểm tra link hoặc dùng link ảnh trực tiếp.');
}

export async function resolveImageLink(value: string, fetcher: typeof fetch = fetch): Promise<string> {
  let link: ReturnType<typeof parseImageLink>;
  try {
    link = parseImageLink(value);
  } catch (error) {
    throw new ImageLinkError(400, error instanceof Error ? error.message : 'Link ảnh không hợp lệ.');
  }
  if (!link.lightshot) return link.url;
  let response: Response;
  try {
    response = await fetcher(link.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', Accept: 'text/html' },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ImageLinkError(502, 'Chưa tải được ảnh Lightshot. Hãy thử lại hoặc nhập link ảnh trực tiếp.');
  }
  if (!response.ok) throw new ImageLinkError(502, 'Lightshot chưa trả về ảnh. Hãy thử lại hoặc nhập link ảnh trực tiếp.');
  return extractLightshotImage(await response.text());
}
