import { execFile } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { getYtDlpPath } from './binary.js';
import { callCobalt, callPrexzy, callRapidApiYouTube, callSaveTube, callTikwm, callWorkerYouTube, downloadDirect, isValidOutput } from './fallback.js';

const execFileAsync = promisify(execFile);

/** Execute yt-dlp with the resolved binary and return captured stdout/stderr. */
export async function execDownload(url, destination, { platform = 'uni', proxy, cookiesPath, cookiesFromBrowser, audioOnly = false, quality, safeMode = false } = {}) {
  const extractorArgs = {
    yt: [
      'youtube:player_client=android,ios,web',
      'youtube:player_client=web_safari',
      'youtube:player_client=android_vr',
      'youtube:player_client=ios'
    ],
    x: ['twitter:api=syndication'],
    tt: ['tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com']
  };
  const failures = [];
  const clients = extractorArgs[platform] || [null];
  const effectiveCookiesPath = cookiesPath || (platform === 'yt' ? (process.env.SOCIAL_DL_YOUTUBE_COOKIES || process.env.SOCIAL_DL_COOKIES) : undefined);
  const effectiveCookiesBrowser = cookiesFromBrowser || (platform === 'yt' ? process.env.SOCIAL_DL_YOUTUBE_COOKIES_FROM_BROWSER : undefined);
  const effectiveProxy = process.env.SOCIAL_DL_PROXY || proxy;
  try {
    await unlink(destination);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (platform === 'yt') {
    try {
      const media = await callWorkerYouTube(url, audioOnly ? 'mp3' : 'mp4');
      await downloadDirect(media, destination, {}, audioOnly ? 'audio' : 'video');
      return destination;
    } catch (error) { failures.push(`YouTube worker failed: ${error.message}`); }
  }
  if (platform === 'tt') {
    try {
      const media = await callTikwm(url);
      await downloadDirect(media, destination, {}, 'video');
      return destination;
    } catch (error) { failures.push(`TikWM failed: ${error.message}`); }
  }
  for (const client of clients) {
    const ytdlpArgs = [
      '--no-playlist', '--no-part', '--no-warnings', '--newline', '--force-overwrites',
      '--retries', '2', '--fragment-retries', '2', '--extractor-retries', '2',
      '-o', destination
    ];
    if (client) ytdlpArgs.push('--extractor-args', client);
    if (platform === 'yt') {
      // Modern YouTube extraction may require yt-dlp's hosted EJS challenge solver.
      ytdlpArgs.push('--remote-components', 'ejs:github', '--js-runtimes', 'node');
    }
    if (!audioOnly && quality === '720p') ytdlpArgs.push('-f', 'bv*[height<=720]+ba/b[height<=720]/b');
    else if (!audioOnly && quality === '480p') ytdlpArgs.push('-f', 'bv*[height<=480]+ba/b[height<=480]/b');
    else if (!audioOnly && quality === 'best') ytdlpArgs.push('-f', 'bv*+ba/b');
    if (effectiveCookiesPath) ytdlpArgs.push('--cookies', effectiveCookiesPath);
    if (effectiveCookiesBrowser) ytdlpArgs.push('--cookies-from-browser', effectiveCookiesBrowser);
    if (effectiveProxy) ytdlpArgs.push('--proxy', effectiveProxy);
    if (safeMode) ytdlpArgs.push('--sleep-interval', '3', '--max-sleep-interval', '6', '--rate-limit', '5M');
    ytdlpArgs.push(url);
    try {
      await execYtDlp(ytdlpArgs);
      if (await isValidOutput(destination)) return destination;
      failures.push(`yt-dlp (${client || 'default'}) produced an invalid output file`);
    } catch (error) { failures.push(`yt-dlp (${client || 'default'}) failed: ${error.message}`); }
  }
  try {
    const media = await callCobalt(url);
    await downloadDirect(media, destination, {}, audioOnly ? 'audio' : 'video');
    return destination;
  } catch (error) { failures.push(`Cobalt failed: ${error.message}`); }
  if (platform === 'yt' && audioOnly && process.env.RAPIDAPI_KEY) {
    try {
      const media = await callRapidApiYouTube(url);
      await downloadDirect(media, destination, {
        Referer: 'https://youtube-mp36.p.rapidapi.com/'
      }, 'audio');
      return destination;
    } catch (error) { failures.push(`RapidAPI YouTube failed: ${error.message}`); }
  }
  if (platform === 'yt' && process.env.secretKey) {
    try {
      const media = await callSaveTube(url, audioOnly ? 'mp3' : 'mp4');
      await downloadDirect(media, destination, {
        Referer: 'https://yt.savetube.me/'
      }, audioOnly ? 'audio' : 'video');
      return destination;
    } catch (error) { failures.push(`SaveTube failed: ${error.message}`); }
  }
  try {
    const media = await callPrexzy(url, platform);
    await downloadDirect(media, destination, {}, audioOnly ? 'audio' : 'video');
    return destination;
  } catch (error) { failures.push(`Prexzy failed: ${error.message}`); }
  throw new Error(`all download stages failed (${failures.join('; ')})`);
}

export async function execYtDlp(args = [], opts = {}) {
  const binary = await getYtDlpPath();
  try {
    const result = await execFileAsync(binary, args, {
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env },
      ...opts
    });
    return {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || '')
    };
  } catch (error) {
    if (error && typeof error === 'object') {
      error.stdout = String(error.stdout || '');
      error.stderr = String(error.stderr || '');
    }
    throw error;
  }
}
