import { spawnSync } from 'node:child_process';
import { fetchWithRetry } from './utils/fetcher.js';
import { BotDetectedError } from './errors.js';
import { player } from './platforms/youtube.js';
import { execYtDlp } from './core/exec.js';
import { YTDLP_VERSION } from './core/binary.js';

const CHECKS = {
  facebook: 'https://www.facebook.com/',
  youtube: 'https://www.youtube.com/',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/',
  twitter: 'https://video.twimg.com/',
  pinterest: 'https://v.pinimg.com/',
  capcut: 'https://www.capcut.com/'
};

/** Check provider reachability and local runtime prerequisites. */
export async function doctor({ log = true } = {}) {
  const result = { node: { ok: Number(process.versions.node.split('.')[0]) >= 18, version: process.versions.node }, ffmpeg: { ok: spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0 }, ytdlp: { ok: false, expected: YTDLP_VERSION }, providers: {} };
  try {
    const version = await execYtDlp(['--version']);
    result.ytdlp = { ok: version.stdout.trim() === YTDLP_VERSION, expected: YTDLP_VERSION, version: version.stdout.trim() };
  } catch (error) {
    result.ytdlp = { ok: false, expected: YTDLP_VERSION, code: 'YTDLP_UNAVAILABLE', message: error.message };
  }
  for (const [name, url] of Object.entries(CHECKS)) {
    const started = Date.now();
    try {
      const response = await fetchWithRetry(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'text/html' } }, 0);
      result.providers[name] = { ok: response.ok || response.status < 500, status: response.status, ms: Date.now() - started };
      if (name === 'youtube') {
        try {
          await player('BJs3DBrMTSc');
        } catch (error) {
          if (error instanceof BotDetectedError) result.providers[name] = { ...result.providers[name], ok: false, code: error.code, warning: 'YouTube is blocking Innertube requests from this network.' };
        }
      }
    } catch (error) {
      result.providers[name] = { ok: false, code: error instanceof BotDetectedError ? error.code : 'FETCH_FAILED', message: error.message, ms: Date.now() - started, warning: name === 'youtube' && error instanceof BotDetectedError ? 'YouTube may be blocking this datacenter IP.' : undefined };
    }
  }
  if (log) {
    console.log(`Node ${result.node.ok ? '✓' : '✗'} ${result.node.version}`);
    console.log(`ffmpeg ${result.ffmpeg.ok ? '✓ available' : '✗ not found'}`);
    console.log(`yt-dlp ${result.ytdlp.ok ? '✓' : '✗'} ${result.ytdlp.version || result.ytdlp.expected}`);
    for (const [name, item] of Object.entries(result.providers)) console.log(`${name.padEnd(10)} ${item.ok ? '✓' : '✗'}${item.status ? ` HTTP ${item.status}` : ` ${item.code}`}${item.warning ? ` — ${item.warning}` : ''}`);
  }
  return result;
}
