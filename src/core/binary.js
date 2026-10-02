import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const YTDLP_VERSION = '2026.08.19';
export const YTDLP_SHA256 = Object.freeze({
  linux: '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6',
  win32: '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a',
  darwin: '0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202'
});

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binaryName = process.platform === 'win32'
  ? 'yt-dlp.exe'
  : process.platform === 'darwin'
    ? 'yt-dlp_macos'
    : 'yt-dlp';

/** Return the pinned yt-dlp executable shipped inside this package. */
const require = createRequire(import.meta.url);

export async function getYtDlpPath() {
  try {
    const executable = require('yt-dlp-exec').path;
    await access(executable, fsConstants.F_OK);
    return executable;
  } catch (error) {
    if (YTDLP_SHA256[process.platform]) {
      const bundled = join(packageRoot, 'bin', binaryName);
      try {
        await access(bundled, fsConstants.F_OK);
        return bundled;
      } catch {
        throw new Error(`yt-dlp executable is unavailable: ${error.message}`);
      }
    }
    throw new Error(`yt-dlp executable is unavailable on ${process.platform}: ${error.message}`);
  }
}

export { binaryName };
