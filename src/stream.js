import { randomUserAgent } from './utils/fetcher.js';
import { universalDl } from './index.js';

/** Resolve a direct CDN stream and its normalized metadata. */
export async function universalStream(url, opts = {}) {
  const info = await universalDl(url, opts);
  const best = opts.quality ? info.formats.find(item => item.tag === opts.quality || item.quality === opts.quality) || info.formats[0] : info.formats[0];
  if (!best) throw new Error('NO_FORMATS');
  const response = await fetch(best.url, { headers: { 'User-Agent': randomUserAgent(), Referer: info.originalUrl } });
  if (!response.ok || !response.body) throw new Error('CDN_FETCH_FAILED');
  const filename = `${info.id}.${best.type}`.replace(/[^a-z0-9._-]/gi, '_');
  return { stream: response.body, filename, info, contentType: best.type === 'mp4' ? 'video/mp4' : best.type === 'jpg' ? 'image/jpeg' : 'audio/mp4', contentLength: response.headers.get('content-length') };
}
