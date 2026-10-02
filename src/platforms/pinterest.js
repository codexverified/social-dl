import { fetchWithRetry } from '../utils/fetcher.js';
import { resolveShortUrl } from '../utils/resolver.js';
import { saveResult, sortFormats } from '../utils/media.js';
import { extractJson } from '../utils/parser.js';
import { NotFoundError, UnsupportedError } from '../errors.js';
import { CREATOR } from '../constants.js';

/** Download metadata and direct Pinterest video/image formats. */
export async function pinterestDl(url) {
  const resolved = await resolveShortUrl(url);
  const id = resolved.match(/pin\/(\d+)/)?.[1];
  if (!id) throw new UnsupportedError('Invalid Pinterest URL.');
  const response = await fetchWithRetry(`https://www.pinterest.com/pin/${id}/`, { headers: { 'User-Agent': 'Mozilla/5.0 iPhone', 'X-Pinterest-PWS-Handler': 'www/[pin]' } });
  const html = await response.text();
  const json = extractJson(html, '__PWS_DATA__');
  const pin = json?.props?.initialReduxState?.pins?.[id];
  const list = pin?.videos?.video_list || {};
  const formats = sortFormats(Object.values(list).filter(v => v?.url && /\.mp4(?:[?&]|$)/i.test(v.url)).map(v => ({ tag: v.width ? `${v.width}p` : 'HD', quality: v.width ? `${v.width}p` : 'HD', type: 'mp4', url: v.url, height: v.height })));
  const image = pin?.images?.orig?.url;
  if (image) formats.push({ tag: 'IMG', quality: 'orig', type: 'jpg', url: image });
  if (!formats.length) {
    const video = html.match(/"video_url":"([^"]+)"/)?.[1];
    if (video) formats.push({ tag: 'HD', quality: '720p', type: 'mp4', url: JSON.parse(`"${video}"`) });
  }
  if (!formats.length) throw new NotFoundError();
  return { creator: CREATOR, platform: 'pinterest', id, title: pin?.grid_title || pin?.title, originalUrl: resolved, formats };
}

/** Save a Pinterest video or image to disk. */
export async function pinterestSave(url, dest = './video.mp4', quality = 'best') { return saveResult(await pinterestDl(url), dest, quality); }
