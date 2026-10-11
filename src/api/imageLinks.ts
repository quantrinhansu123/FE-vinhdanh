import { parseImageLink } from '../utils/imageLinks';

export async function resolveImageLink(value: string, signal?: AbortSignal): Promise<string> {
  const link = parseImageLink(value);
  if (!link.lightshot) return link.url;
  const response = await fetch(`/api/image-link?url=${encodeURIComponent(link.url)}`, { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.imageUrl !== 'string') {
    throw new Error(body?.message || 'Chưa tải được ảnh. Hãy thử lại hoặc dùng link ảnh trực tiếp.');
  }
  const resolved = parseImageLink(body.imageUrl);
  if (resolved.lightshot) throw new Error('Chưa lấy được link ảnh trực tiếp từ Lightshot.');
  return resolved.url;
}
