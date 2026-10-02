import { mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { UA } from './constants.js';
import { execYtDlp } from '../core/exec.js';
const BASE_ARGS = [
  '--no-playlist', '--no-warnings', '--newline', '--no-part', '--no-continue',
  '--retries', '3', '--fragment-retries', '3', '--file-access-retries', '3',
  '--extractor-retries', '3', '--remote-components', 'ejs:github', '--js-runtimes', 'node',
  '--user-agent', UA
];

/** Run a yt-dlp-compatible executable and return stdout/stderr. */
export async function runYtDlp(args) {
  return execYtDlp(args, { maxBuffer: 32 * 1024 * 1024 });
}

export function ytDlpUrl(id) { return `https://www.youtube.com/watch?v=${id}`; }
export function cookieArgs(options = {}) {
  const args = [];
  if (options.cookiesPath) args.push('--cookies', options.cookiesPath);
  if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser);
  return args;
}

/** Get yt-dlp JSON metadata for a video. */
export async function ytDlpInfo(id, options = {}) {
  return ytDlpInfoUrl(ytDlpUrl(id), options);
}
export async function ytDlpInfoUrl(url, options = {}) {
  const { stdout } = await runYtDlp(['--dump-json', '--no-download', '--no-playlist', '--skip-download', '--no-warnings', '--remote-components', 'ejs:github', '--js-runtimes', 'node', '--user-agent', UA, ...cookieArgs(options), url]);
  const line = stdout.trim().split(/\r?\n/).find(Boolean);
  if (!line) throw new Error('yt-dlp returned no video information.');
  return JSON.parse(line);
}

function valid(file) {
  return stat(file).then(info => info.isFile() && info.size > 4096).catch(() => false);
}
async function locate(base, dir) {
  for (const name of await readdir(dir).catch(() => [])) {
    if (name.startsWith(base) && await valid(join(dir, name))) return join(dir, name);
  }
  return null;
}
async function cleanup(base, dir) {
  await Promise.all((await readdir(dir).catch(() => [])).filter(name => name.startsWith(base)).map(name => unlink(join(dir, name)).catch(() => {})));
}

/** Download a YouTube video or audio fallback into memory, then clean temp files. */
export async function ytDlpDownload(id, format, options = {}) {
  return ytDlpDownloadUrl(ytDlpUrl(id), format, options);
}
export async function ytDlpDownloadUrl(url, format, options = {}) {
  if (!['mp3', 'mp4'].includes(format)) throw new Error('Invalid yt-dlp format.');
  const dir = join(process.cwd(), 'cache', 'temp');
  await mkdir(dir, { recursive: true });
  const base = `yt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const output = join(dir, `${base}.%(ext)s`);
  const args = format === 'mp3'
    ? [...BASE_ARGS, ...cookieArgs(options), '-f', 'bestaudio[ext=m4a]/bestaudio', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', output, url]
    : [...BASE_ARGS, ...cookieArgs(options), '-f', 'bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4]/best', '--merge-output-format', 'mp4', '--remux-video', 'mp4', '-o', output, url];
  let file;
  try {
    await runYtDlp(args);
    file = await locate(base, dir);
    if (!file) throw new Error(`yt-dlp did not produce a valid ${format.toUpperCase()} file.`);
    const buffer = await readFile(file);
    return format === 'mp3' ? { buffer, mimetype: 'audio/mpeg', extension: 'mp3' } : { buffer, mimetype: 'video/mp4', extension: 'mp4' };
  } finally {
    if (file) await unlink(file).catch(() => {});
    await cleanup(base, dir);
  }
}

export function fallbackInstallMessage() {
  return 'YouTube blocked the current network. The bundled yt-dlp engine and direct worker fallbacks could not extract this video. No extra npm downloader dependency is required.';
}

export { BASE_ARGS, UA as YTDLP_USER_AGENT };
