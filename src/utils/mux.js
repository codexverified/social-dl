import { spawnSync, execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { downloadTo } from './fetcher.js';

/** Return whether ffmpeg is available on PATH. */
export function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => execFile('ffmpeg', args, { windowsHide: true }, (error, _stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve()));
}

/** Download separate audio/video streams and mux them into one MP4 when possible. */
export async function saveMuxed(result, dest, headers = {}) {
  if (!result.needsMux || !result.videoUrl || !result.audioUrl) return null;
  if (!hasFfmpeg()) return false;
  const base = join(tmpdir(), `social-dl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const videoPath = `${base}.video.mp4`;
  const audioPath = `${base}.audio.m4a`;
  try {
    await downloadTo(result.videoUrl, videoPath, { headers });
    await downloadTo(result.audioUrl, audioPath, { headers });
    await runFfmpeg(['-y', '-i', videoPath, '-i', audioPath, '-c', 'copy', dest]);
    return dest;
  } finally {
    await Promise.allSettled([unlink(videoPath), unlink(audioPath)]);
  }
}
