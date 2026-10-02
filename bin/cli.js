#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { universalDl, universalSave } from '../src/index.js';
import { doctor } from '../src/doctor.js';
import { randomUserAgent } from '../src/utils/fetcher.js';
import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execYtDlp } from '../src/core/exec.js';

const require = createRequire(import.meta.url);
const VERSION = require('../package.json').version;
const SUPPORT = `Codex Social Downloader support

Package: https://www.npmjs.com/package/@codexverified/social-dl
Developer: https://t.me/codexverified

For bugs and feature requests, use the package repository issue tracker.`
const HELP = `@codexverified/social-dl ${VERSION}\n\nUsage:\n  social-dl <url> [-o file] [--format mp4|mp3] [--quality best|720p|480p]\n  social-dl <url> --mp3 -o audio.mp3\n  social-dl <url> --json\n  social-dl <url> --no-watermark\n  social-dl doctor [--json]\n  social-dl support
  social-dl maintenance

Options: --format mp4|mp3  --quality best|720p|480p  --mp3  --safe  --json  --no-watermark  -o, --output <file>  --help`;
const color = (code, text) => process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;

function parse(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--mp3') opts.audioOnly = true;
    else if (arg === '--format') {
      const format = argv[++i];
      if (format === 'mp3') opts.audioOnly = true;
      else if (format === 'mp4') opts.audioOnly = false;
      else throw new Error('FORMAT_MUST_BE_MP4_OR_MP3');
    }
    else if (arg === '--json') opts.json = true;
    else if (arg === '--no-watermark') opts.noWatermark = true;
    else if (arg === '--safe' || arg === '--safe-mode') opts.safeMode = true;
    else if (arg === '--quality') opts.quality = argv[++i];
    else if (arg === '--cookies') opts.cookiesPath = argv[++i];
    else if (arg === '--cookies-from-browser') opts.cookiesFromBrowser = argv[++i];
    else if (arg === '-o' || arg === '--output') opts.output = argv[++i];
    else opts._.push(arg);
  }
  return opts;
}

async function streamSave(info, output, quality, noWatermark) {
  let formats = info.formats;
  if (noWatermark) formats = formats.filter(item => item.isNoWatermark !== false);
  const selected = quality ? formats.find(item => item.tag === quality || item.quality === quality) : formats[0];
  const format = selected || formats[0];
  if (!format) throw new Error('NO_FORMATS');
  const response = await fetch(format.url, { headers: { 'User-Agent': randomUserAgent(), Referer: info.originalUrl } });
  if (!response.ok || !response.body) throw new Error(`CDN_FETCH_FAILED_${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  const reader = response.body.getReader();
  const outputStream = createWriteStream(output);
  const readable = new ReadableStream({ async pull(controller) { const { done, value } = await reader.read(); if (done) return controller.close(); received += value.byteLength; controller.enqueue(value); if (!process.stdout.isTTY) return; const mb = (received / 1048576).toFixed(1); const suffix = total ? ` / ${(total / 1048576).toFixed(1)} MB` : ' MB'; process.stdout.write(`\r${color(36, `Downloading ${mb}${suffix}`)}`); }, cancel() { reader.cancel(); } });
  await pipeline(readable, outputStream);
  if (process.stdout.isTTY) process.stdout.write('\n');
  return output;
}

async function updateEngines() {
  try {
    const result = await execYtDlp(['--update-to', 'stable']);
    return result.stdout.trim() || 'yt-dlp update completed';
  } catch (error) {
    return `yt-dlp update unavailable: ${error.message}`;
  }
}

async function resetSystem() {
  await Promise.all([
    rm('cache/temp', { recursive: true, force: true }),
    rm('cache/cookies', { recursive: true, force: true }),
  ]);
  await mkdir('cache/cookies', { recursive: true });
  return 'Temporary files and cookie cache reset; downloaded media was preserved.';
}

async function maintenance() {
  const rl = createInterface({ input, output });
  const ask = async (question) => (await rl.question(question)).trim();
  try {
    while (true) {
      console.log(`\n${color(36, 'MAINTENANCE')}\nUpdate or Reset\n`);
      console.log('1. Update Engines\n2. Reset System\n3. Back');
      const choice = await ask('Select: ');
      if (choice === '1') console.log(await updateEngines());
      else if (choice === '2') console.log(await resetSystem());
      else break;
    }
  } finally { rl.close(); }
}

async function interactive() {
  const rl = createInterface({ input, output });
  const ask = async (question) => (await rl.question(question)).trim();
  const cyan = (text) => color(36, text);
  const green = (text) => color(32, text);
  const red = (text) => color(31, text);
  try {
    while (true) {
      console.log(`\n${cyan('CODEX SOCIAL')} ${VERSION}`);
      console.log(`${green('Engine')}  yt-dlp managed\n${green('Storage')} ${join(homedir(), 'Downloads', 'codex-social')}`);
      console.log('\n1. Download media\n2. Doctor\n0. Exit');
      const choice = await ask('Choice: ');
      if (choice === '0' || !choice) break;
      if (choice === '2') { await doctor(); continue; }
      if (choice !== '1') continue;
      const url = await ask('Enter link: ');
      if (!url) continue;
      const format = await ask('Format (1 video / 2 mp3): ');
      const quality = format === '1' ? await ask('Quality (best / 720p / 480p): ') : null;
      const audioOnly = format === '2';
      const outputDir = join(homedir(), 'Downloads', 'codex-social', audioOnly ? 'audio' : 'video');
      await mkdir(outputDir, { recursive: true });
      const extension = audioOnly ? 'mp3' : 'mp4';
      const outputPath = join(outputDir, `download-${Date.now()}.${extension}`);
      console.log(`\n${cyan('Starting download...')}`);
      await universalSave(url, outputPath, { audioOnly, quality });
      console.log(`\n${green('Saved')} ${outputPath}`);
    }
  } catch (error) {
    console.error(red(`${error.code || 'ERROR'}: ${error.message}`));
  } finally { rl.close(); }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--version') || argv.includes('-v')) return console.log(VERSION);
  await mkdir('cache/cookies', { recursive: true });
  const opts = parse(argv);
  if (opts.help) return console.log(HELP);
  if (opts._[0] === undefined && process.stdin.isTTY) return interactive();
  if (opts._[0] === undefined) return console.log(HELP);
  if (opts._[0] === 'doctor') return opts.json ? console.log(JSON.stringify(await doctor({ log: false }), null, 2)) : await doctor();
  if (opts._[0] === 'support' || opts._[0] === 'donate') return console.log(SUPPORT);
  if (opts._[0] === 'maintenance') return maintenance();
  const url = opts._[0];
  const info = opts.json || !opts.output ? await universalDl(url, opts) : null;
  if (opts.json) return console.log(JSON.stringify(info, null, 2));
  const output = opts.output || `${info.id}.${opts.audioOnly ? 'm4a' : (info.formats[0]?.type || 'mp4')}`;
  await universalSave(url, output, opts);
  console.log(`${color(32, 'Saved')} ${output}`);
}

main().catch(error => { console.error(color(31, `${error.code || error.name || 'ERROR'}: ${error.message}`)); process.exitCode = 1; });
