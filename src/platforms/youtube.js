import { fetchWithRetry, getVisitorData } from '../utils/fetcher.js';
import { saveResult, sortFormats, qualityOf } from '../utils/media.js';
import { BotDetectedError, NotFoundError, UnsupportedError } from '../errors.js';
import { CREATOR } from '../constants.js';
import { fallbackInstallMessage, ytDlpDownload, ytDlpInfo } from '../utils/ytdlp.js';

const KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
export const UA = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
export const INNERTUBE_CONTEXT = { client: { clientName: 'WEB', clientVersion: '2.20260813.01.00', hl: 'es', gl: 'DO' } };
export const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false';
const ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${KEY}`;
const CLIENTS = [
  { name: 'WEB', version: '2.20260813.01.00', ua: UA },
  { name: 'IOS', version: '19.09.3', deviceModel: 'iPhone16,2', ua: 'com.google.ios.youtube/19.09.3 (iPhone16,2; U; iOS 17.2; en_US)' }
];
export const YOUTUBE_MEDIA_HEADERS = {
  'User-Agent': UA,
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.youtube.com/',
  Origin: 'https://www.youtube.com'
};
export const IOS_MEDIA_HEADERS = {
  ...YOUTUBE_MEDIA_HEADERS,
  'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone16,2; U17D201)'
};
function fallbackAllowed(error) { return error?.code === 'BOT_DETECTED' || /YOUTUBE_HTTP_4\d\d|403|automated|unusual traffic|NO_PLAYABLE|UNAVAILABLE/i.test(error?.message || ''); }
function fromYtDlp(data, url, id) {
  const streams = data.requested_formats || [];
  const video = streams.find(item => item.vcodec && item.vcodec !== 'none' && item.url) || (data.vcodec && data.url ? data : null);
  const audio = streams.find(item => item.acodec && item.acodec !== 'none' && item.url) || (data.acodec && data.url ? data : null);
  const direct = video?.url || data.url;
  const format = direct ? [{ tag: data.height ? `${data.height}p` : 'best', quality: data.height ? `${data.height}p` : 'best', type: 'mp4', hasAudio: Boolean(video?.acodec && video.acodec !== 'none') || Boolean(data.acodec && data.acodec !== 'none'), url: direct, height: data.height, bitrate: data.tbr }] : [];
  return { creator: CREATOR, platform: 'youtube', id, client: 'YT-DLP', title: data.title, author: data.uploader || data.channel, thumbnail: data.thumbnail, originalUrl: url, formats: format, ...(video?.url && audio?.url && video.url !== audio.url ? { needsMux: true, videoUrl: video.url, audioUrl: audio.url } : {}), fallback: true };
}
async function ytDlpFallback(url, id, cause, options = {}) {
  try { return fromYtDlp(await ytDlpInfo(id, options), url, id); }
  catch (error) { throw new Error(`${fallbackInstallMessage()} (${cause?.message || error.message})`); }
}

/** Extract an 11-character YouTube video id. */
export function videoId(url) { return new URL(url).toString().match(/(?:youtu\.be\/|[?&]v=|shorts\/)([A-Za-z0-9_-]{11})/)?.[1]; }

/** Send one direct Innertube player request for a specific client profile. */
export async function innertubeRequest(id, client, visitorData) {
  const context = { ...INNERTUBE_CONTEXT, client: { ...INNERTUBE_CONTEXT.client, clientName: client.name, clientVersion: client.version, ...(client.deviceModel ? { deviceModel: client.deviceModel } : {}) }, ...(visitorData ? { visitorData } : {}) };
  const response = await fetchWithRetry(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': client.ua, ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}), Origin: 'https://www.youtube.com', Referer: 'https://www.youtube.com/' }, body: JSON.stringify({ context, videoId: id, contentCheckOk: true, racyCheckOk: true }) });
  if (!response.ok) throw new Error(`YOUTUBE_HTTP_${response.status}`);
  return response.json();
}

/** Try each supported YouTube client until streaming data is returned. */
export async function player(id) {
  const visitorData = await getVisitorData();
  let data = null;
  let lastError;
  for (const client of CLIENTS) {
    try {
      data = await innertubeRequest(id, client, visitorData);
      if (data?.streamingData?.formats || data?.streamingData?.adaptiveFormats) {
        data.__socialDlClient = client.name;
        return data;
      }
      if (data?.playabilityStatus?.status === 'ERROR' && JSON.stringify(data).includes('403')) continue;
      lastError = new Error(data?.playabilityStatus?.reason || 'UNAVAILABLE');
    } catch (error) {
      lastError = error;
    }
  }
  if (!data?.streamingData) {
    if (lastError?.code === 'BOT_DETECTED' || /403|automated|unusual traffic/i.test(lastError?.message || '')) throw new BotDetectedError();
    throw lastError || new Error(data?.playabilityStatus?.reason || 'UNAVAILABLE');
  }
  return data;
}

/** Download metadata and direct formats for a YouTube video. */
export async function youtubeDl(url, options = {}) {
  const id = videoId(url);
  if (!id) throw new UnsupportedError('Invalid YouTube URL.');
  let data;
  try { data = await player(id); }
  catch (error) {
    if (!fallbackAllowed(error)) throw error;
    return ytDlpFallback(url, id, error, options);
  }
  if (!data.streamingData) return ytDlpFallback(url, id, new NotFoundError('PRIVATE_OR_AGE_RESTRICTED'), options);
  const all = [...(data.streamingData.formats || []), ...(data.streamingData.adaptiveFormats || [])];
  const formats = sortFormats(all.filter(item => item.url && /^video\/mp4/.test(item.mimeType || '')).map(item => ({ tag: qualityOf(item, 'video'), quality: qualityOf(item, 'video'), type: 'mp4', hasAudio: !item.mimeType?.includes('video-only'), url: item.url, bitrate: item.bitrate, height: item.height }))).sort((a, b) => Number(b.hasAudio) - Number(a.hasAudio));
  if (!formats.length) throw new NotFoundError('NO_PLAYABLE_MP4');
  const best = formats[0];
  const audio = all.find(item => item.url && String(item.itag) === '140' && item.mimeType?.startsWith('audio/')) || all.find(item => item.url && item.mimeType?.startsWith('audio/'));
  const mux = best.height >= 1080 && best.hasAudio === false && audio;
  return { creator: CREATOR, platform: 'youtube', id, client: data.__socialDlClient, title: data.videoDetails?.title, thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, originalUrl: url, formats, ...(mux ? { needsMux: true, videoUrl: best.url, audioUrl: audio.url } : {}) };
}

/** Save a YouTube video to disk. */
export async function youtubeSave(url, dest = './yt.mp4', quality = 'best', options = {}) {
  const result = await youtubeDl(url, options);
  if (result.fallback) {
    const { writeFile } = await import('node:fs/promises');
    const output = await ytDlpDownload(result.id, 'mp4', options);
    await writeFile(dest, output.buffer);
    return dest;
  }
  return saveResult(result, dest, quality, { ...YOUTUBE_MEDIA_HEADERS, fallbackHeaders: IOS_MEDIA_HEADERS });
}

export { CLIENTS };
