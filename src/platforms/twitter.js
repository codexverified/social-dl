import { fetchWithRetry } from '../utils/fetcher.js';
import { saveResult, sortFormats } from '../utils/media.js';
import { unescapeJson } from '../utils/parser.js';
import { NotFoundError, UnsupportedError } from '../errors.js';
import { CREATOR } from '../constants.js';

const idOf = url => new URL(url).pathname.match(/status\/(\d+)/)?.[1];
async function fxtwitter(id, originalUrl) {
  const response = await fetchWithRetry(`https://api.fxtwitter.com/status/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!response.ok) throw new Error(`FXTWITTER_HTTP_${response.status}`);
  const json = await response.json();
  const tweet = json.tweet || json;
  const formats = sortFormats((tweet.media?.all || []).flatMap(item => item.videos || []).map(video => ({ tag: `${video.bitrate || 0}kbps`, quality: `${video.height || 720}p`, type: 'mp4', url: video.url, bitrate: video.bitrate })));
  if (!formats.length) throw new NotFoundError('NO_X_VIDEO');
  return { creator: CREATOR, platform: 'twitter', id, author: tweet.author?.screen_name ? `@${tweet.author.screen_name}` : undefined, title: tweet.text, originalUrl, formats, fallback: true };
}

/** Download metadata and direct MP4 variants for an X/Twitter post. */
export async function twitterDl(url) {
  const id = idOf(url);
  if (!id) throw new UnsupportedError('Invalid Twitter URL.');
  let response;
  try { response = await fetchWithRetry(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&features=tfw_timeline_list%3D%7B%7D`, { headers: { 'User-Agent': 'Mozilla/5.0' } }); }
  catch { return fxtwitter(id, url); }
  const json = response.ok ? await response.json() : {};
  const media = json.mediaDetails?.flatMap(item => item.video_info?.variants || []) || [];
  let formats = sortFormats(media.filter(v => v.content_type === 'video/mp4' && v.url).map(v => ({ tag: `${Math.round((v.bitrate || 0) / 1000) || 0}kbps`, quality: `${Math.round((v.bitrate || 0) / 1000) || 0}kbps`, type: 'mp4', url: v.url, bitrate: v.bitrate })));
  if (!formats.length) {
    const html = await (await fetchWithRetry(`https://x.com/i/status/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const urls = [...html.matchAll(/https:[^" ]*video\.twimg\.com[^" ]+\.mp4[^" ]*/g)].map(m => unescapeJson(m[0]));
    formats = urls.map((item, index) => ({ tag: index ? '480p' : '720p', quality: index ? '480p' : '720p', type: 'mp4', url: item }));
  }
  if (!formats.length) {
    try { return await fxtwitter(id, url); } catch { throw new NotFoundError(); }
  }
  return { creator: CREATOR, platform: 'twitter', id, author: json.user?.screen_name ? `@${json.user.screen_name}` : undefined, title: json.text, originalUrl: url, formats };
}

/** Save a Twitter/X video to disk. */
export async function twitterSave(url, dest = './video.mp4', quality = 'best') { return saveResult(await twitterDl(url), dest, quality); }
