import { fetchWithRetry } from '../utils/fetcher.js';
import { resolveShortUrl } from '../utils/resolver.js';
import { saveResult, sortFormats } from '../utils/media.js';
import { unescapeJson } from '../utils/parser.js';
import { NotFoundError, UnsupportedError } from '../errors.js';
import { CREATOR } from '../constants.js';

const findUrls = value => { const urls = []; const walk = item => { if (!item) return; if (typeof item === 'string' && /\.(?:mp4)(?:[?&]|$)/i.test(item)) urls.push(item); else if (Array.isArray(item)) item.forEach(walk); else if (typeof item === 'object') Object.values(item).forEach(walk); }; walk(value); return urls; };

/** Download metadata and direct CapCut CDN formats. */
export async function capcutDl(url) {
  const resolved = await resolveShortUrl(url);
  const id = resolved.match(/template-detail\/(\d+)/)?.[1] || resolved.match(/\/(\d{10,19})(?:\D|$)/)?.[1];
  if (!id) throw new UnsupportedError('Invalid CapCut URL.');
  let urls = [];
  const api = await fetchWithRetry(`https://www.capcut.com/api/v1/query/template/detail?template_id=${id}&language=en&aid=0`, { headers: { Referer: 'https://www.capcut.com/' } });
  if (api.ok) { try { urls = findUrls(await api.json()); } catch {} }
  if (!urls.length) {
    const html = await (await fetchWithRetry(`https://www.capcut.com/template-detail/${id}`, { headers: { Referer: 'https://www.capcut.com/' } })).text();
    urls = ['video_url', 'download_url', 'play_url'].map(key => html.match(new RegExp(`"${key}":"([^"]+)"`))?.[1]).filter(Boolean).map(unescapeJson);
  }
  const formats = sortFormats([...new Set(urls)].map((item, index) => ({ tag: index ? 'SD' : 'HD', quality: index ? '720p' : '1080p', type: 'mp4', isNoWatermark: true, url: item })));
  if (!formats.length) throw new NotFoundError();
  return { creator: CREATOR, platform: 'capcut', id, title: `CapCut template ${id}`, originalUrl: resolved, formats };
}

/** Save a CapCut video to disk. */
export async function capcutSave(url, dest = './video.mp4', quality = 'best') { return saveResult(await capcutDl(url), dest, quality); }
