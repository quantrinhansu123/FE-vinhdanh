import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractLightshotImage, ImageLinkError, resolveImageLink } from './imageLink.ts';
import { parseImageLink } from '../src/utils/imageLinks.ts';

const IMAGE_URL = 'https://img.lightshot.app/WTD6Gvj8Tsu2w5tp50DNAg.png';

test('accepts a direct image URL without requesting the remote site', async () => {
  const url = 'https://example.com/avatar.jpg?signature=abc&size=150';
  assert.equal(await resolveImageLink(url, (() => { throw new Error('Unexpected fetch'); }) as typeof fetch), url);
});

test('resolves the supplied Lightshot link to a direct image URL', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(input, 'https://prnt.sc/PkF7pcHVxd1s');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return new Response(`<html><head><meta property="og:image" content="${IMAGE_URL}" /></head></html>`);
  };
  assert.equal(await resolveImageLink(' https://prnt.sc/PkF7pcHVxd1s ', fetcher), IMAGE_URL);
});

test('canonicalizes supported Lightshot hosts while preserving the screenshot ID', () => {
  assert.deepEqual(parseImageLink('http://www.prntscr.com/PkF7pcHVxd1s/?share=1'), {
    url: 'https://prnt.sc/PkF7pcHVxd1s', lightshot: true,
  });
});

test('rejects invalid protocols, credentials, and non-screenshot Lightshot paths', async () => {
  for (const link of ['javascript:alert(1)', 'data:image/png;base64,abc', 'https://user:pass@prnt.sc/abc', 'https://prnt.sc/', 'https://prnt.sc/abc/extra', 'not a url']) {
    await assert.rejects(resolveImageLink(link), (error: unknown) => error instanceof ImageLinkError && error.status === 400);
  }
});

test('extracts reordered and single-quoted image metadata with HTML entities', () => {
  const html = "<meta content='https://img.lightshot.app/photo.png?x=1&amp;y=2' property='og:image'>";
  assert.equal(extractLightshotImage(html), 'https://img.lightshot.app/photo.png?x=1&y=2');
});

test('supports legacy Lightshot image hosts', () => {
  assert.equal(extractLightshotImage('<meta name="twitter:image:src" content="https://i.imgur.com/avatar.png">'), 'https://i.imgur.com/avatar.png');
});

test('rejects missing screenshots and unexpected image hosts', () => {
  for (const html of ['<html>Image removed</html>', '<meta property="og:image" content="https://example.com/a.png">', '<meta property="og:image" content="http://127.0.0.1/a.png">']) {
    assert.throws(() => extractLightshotImage(html), (error: unknown) => error instanceof ImageLinkError && error.status === 422);
  }
});

test('reports Lightshot HTTP and network failures without saving its page URL', async () => {
  const failingFetchers: typeof fetch[] = [
    async () => new Response('', { status: 520 }),
    async () => { throw new Error('connection failed'); },
  ];
  for (const fetcher of failingFetchers) {
    await assert.rejects(resolveImageLink('https://prnt.sc/PkF7pcHVxd1s', fetcher), (error: unknown) => error instanceof ImageLinkError && error.status === 502);
  }
});
