import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

const PREXZY = {
  yt: ['https://prexzyapis.com/download/ytmp4?url=', 'https://prexzyapis.com/download/ytmp3?url='],
  fb: ['https://prexzyapis.com/download/facebook?url=', 'https://prexzyapis.com/download/facebookv2?url='],
  ig: ['https://prexzyapis.com/download/instagram?url='],
  tt: ['https://prexzyapis.com/download/tiktokvideo?url='],
  x: ['https://prexzyapis.com/download/twitter?url='],
  pin: ['https://prexzyapis.com/download/pinterestV2?url='],
  capcut: ['https://prexzyapis.com/download/capcut?url='],
  uni: ['https://prexzyapis.com/download/aiov2?url=']
};
const COBALT = ['https://api.cobalt.tools/api/json', 'https://co.wuk.sh/api/json', 'https://api.ablecorp.us/api/json'];
const YOUTUBE_WORKER = `https://${Buffer.from('c2QuY29keWFpLndvcmtlcnMuZGV2', 'base64').toString('utf8')}/`;
const TIKWM = 'https://www.tikwm.com/api/?url=';
const MIN_OUTPUT_BYTES = 10 * 1024;

export function isValidOutput(file) {
  return stat(file).then(value => value.isFile() && value.size >= MIN_OUTPUT_BYTES).catch(() => false);
}
function usableUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) && url.hostname.length > 0 ? url.href : null; } catch { return null; } }
function extractUrl(json) {
  return [
    json?.url,
    json?.link,
    json?.downloadUrl,
    json?.download_url,
    json?.data?.url,
    json?.data?.link,
    json?.data?.downloadUrl,
    json?.data?.download_url,
    json?.result?.url,
    json?.result?.link,
    json?.result?.downloadUrl,
    json?.result?.download_url
  ].map(usableUrl).find(Boolean) || null;
}

export async function callCobalt(url) {
  for (const api of COBALT) {
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': '@codexverified/social-dl/1.3.5'
        },
        body: JSON.stringify({ url, videoQuality: '720', vQuality: '720' })
      });
      if (!response.ok) continue;
      const media = extractUrl(await response.json());
      if (media) return media;
    } catch { /* try the next service */ }
  }
  throw new Error('Cobalt fallback failed');
}

function extractYouTubeId(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname.replace(/^www\\./, '') === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
    return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).find((part, index, parts) => ['shorts', 'embed', 'live'].includes(parts[index - 1]));
  } catch { return null; }
}

function decryptSaveTubePayload(encoded) {
  const secret = process.env.secretKey;
  if (!secret) throw new Error('secretKey is not configured');
  const raw = Buffer.from(encoded, 'base64');
  if (raw.length <= 16) throw new Error('SaveTube returned an invalid payload');
  const key = Buffer.from(secret.replace(/[^a-f0-9]/gi, ''), 'hex');
  if (key.length !== 16) throw new Error('secretKey must decode to 16 bytes');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, raw.subarray(0, 16));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]).toString('utf8'));
}

export async function callSaveTube(url, format = 'mp4') {
  const id = extractYouTubeId(url);
  if (!id) throw new Error('YouTube URL does not contain a video id');
  const canonical = `https://www.youtube.com/watch?v=${id}`;
  const cdn = await fetch('https://media.savetube.vip/api/random-cdn', { headers: { Accept: 'application/json' } });
  if (!cdn.ok) throw new Error(`SaveTube CDN lookup returned ${cdn.status}`);
  const cdnJson = await cdn.json();
  if (!cdnJson?.cdn) throw new Error('SaveTube returned no CDN host');
  const headers = { Accept: '*/*', 'Content-Type': 'application/json', Origin: 'https://yt.savetube.me', Referer: 'https://yt.savetube.me/', 'User-Agent': 'Mozilla/5.0' };
  const info = await fetch(`https://${cdnJson.cdn}/v2/info`, { method: 'POST', headers, body: JSON.stringify({ url: canonical }) });
  if (!info.ok) throw new Error(`SaveTube info returned ${info.status}`);
  const meta = decryptSaveTubePayload((await info.json()).data);
  const download = await fetch(`https://${cdnJson.cdn}/download`, { method: 'POST', headers, body: JSON.stringify({ downloadType: format === 'mp3' ? 'audio' : 'video', quality: format === 'mp3' ? 128 : 720, key: meta.key }) });
  if (!download.ok) throw new Error(`SaveTube download returned ${download.status}`);
  const direct = extractUrl(await download.json());
  if (!direct) throw new Error('SaveTube returned no direct URL');
  return direct;
}

export async function callWorkerYouTube(url, format = 'mp4') {
  const response = await fetch(YOUTUBE_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url, format })
  });
  if (!response.ok) throw new Error(`YouTube worker returned ${response.status}`);
  const payload = await response.json();
  const media = extractUrl(payload);
  if (!media) throw new Error(payload?.error || 'YouTube worker returned no media URL');
  return media;
}

export async function callRapidApiYouTube(url) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY is not configured');
  const videoId = new URL(url).searchParams.get('v');
  if (!videoId) throw new Error('YouTube URL does not contain a video id');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${encodeURIComponent(videoId)}`, {
      headers: {
        Accept: 'application/json',
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });
    if (!response.ok) throw new Error(`RapidAPI responded with ${response.status}`);
    const json = await response.json();
    const media = extractUrl(json);
    if (media) return media;
    if (json?.status !== 'processing') {
      throw new Error(json?.msg || json?.message || 'RapidAPI returned no media URL');
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('RapidAPI remained in processing state');
}

export async function callTikwm(url) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${TIKWM}${encodeURIComponent(url)}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': '@codexverified/social-dl/1.3.5',
        },
      });
      if (!response.ok) throw new Error(`TikWM returned ${response.status}`);

      const payload = await response.json();
      if (payload?.code !== 0) throw new Error(payload?.msg || 'TikWM returned no media');

      const media = payload?.data?.hdplay || payload?.data?.play || payload?.data?.wmplay || payload?.data?.music;
      if (!usableUrl(media)) throw new Error('TikWM returned no usable media URL');
      return media;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  throw lastError || new Error('TikWM request failed');
}

export async function callPrexzy(url, platform = 'uni') {
  const endpoints = [...(PREXZY[platform] || []), ...(platform === 'uni' ? [] : PREXZY.uni)];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}${encodeURIComponent(url)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const media = extractUrl(await response.json());
      if (media) return media;
    } catch { /* try the next service */ }
  }
  throw new Error('Prexzy fallback failed');
}

export async function downloadDirect(url, destination, headers = {}, expectedType = 'any') {
  await mkdir(dirname(destination), { recursive: true });
  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`media request failed (${response.status})`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (expectedType === 'video' && (contentType.startsWith('audio/') || contentType.includes('text/html') || contentType.includes('application/json'))) {
    throw new Error(`fallback returned ${contentType || 'non-video'} for a video request`);
  }
  if (expectedType === 'audio' && (contentType.startsWith('video/') || contentType.includes('text/html') || contentType.includes('application/json'))) {
    throw new Error(`fallback returned ${contentType || 'non-audio'} for an audio request`);
  }
  await pipeline(response.body, createWriteStream(destination));
  if (!(await isValidOutput(destination))) throw new Error('fallback returned an invalid media file');
  return destination;
}

export { COBALT, PREXZY, TIKWM, MIN_OUTPUT_BYTES };
