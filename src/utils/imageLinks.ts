const LIGHTSHOT_HOSTS = new Set(['prnt.sc', 'www.prnt.sc', 'prntscr.com', 'www.prntscr.com']);

export function parseImageLink(value: string): { url: string; lightshot: boolean } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Nhập link ảnh hợp lệ, bắt đầu bằng https:// hoặc http://.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Link ảnh phải bắt đầu bằng https:// hoặc http://.');
  }
  const lightshot = LIGHTSHOT_HOSTS.has(url.hostname.toLowerCase());
  if (lightshot) {
    const id = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('Link Lightshot phải trỏ đến một ảnh cụ thể.');
    return { url: `https://prnt.sc/${id}`, lightshot: true };
  }
  return { url: url.href, lightshot: false };
}
