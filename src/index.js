import { UnsupportedError } from './errors.js';
import { facebookDl, facebookSave } from './platforms/facebook.js';
import { IOS_MEDIA_HEADERS, YOUTUBE_MEDIA_HEADERS, youtubeDl, youtubeSave } from './platforms/youtube.js';
import { youtubeMp3Dl, youtubeMp3Save } from './platforms/ytmp3.js';
import { instagramDl, instagramSave } from './platforms/instagram.js';
import { tiktokDl, tiktokSave } from './platforms/tiktok.js';
import { twitterDl, twitterSave } from './platforms/twitter.js';
import { pinterestDl, pinterestSave } from './platforms/pinterest.js';
import { capcutDl, capcutSave } from './platforms/capcut.js';
import { saveResult } from './utils/media.js';
import { execDownload } from './core/exec.js';

/** Identify the supported platform for a URL. */
export function detectPlatform(value) {
  const host = new URL(value).hostname.toLowerCase();
  if (host.includes('facebook.com') || host === 'fb.watch') return 'facebook';
  if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host === 'x.com' || host.endsWith('twitter.com') || host === 't.co') return 'twitter';
  if (host.includes('pinterest.com') || host === 'pin.it') return 'pinterest';
  if (host.includes('capcut.com')) return 'capcut';
  throw new UnsupportedError();
}

/** Download metadata using the correct platform extractor. */
export async function universalDl(url, opts = {}) {
  switch (detectPlatform(url)) {
    case 'facebook': return facebookDl(url, opts);
    case 'youtube': return opts.audioOnly ? youtubeMp3Dl(url, opts) : youtubeDl(url, opts);
    case 'instagram': return instagramDl(url, opts);
    case 'tiktok': return tiktokDl(url, opts);
    case 'twitter': return twitterDl(url);
    case 'pinterest': return pinterestDl(url);
    case 'capcut': return capcutDl(url);
    default: throw new UnsupportedError();
  }
}

/** Save a selected format from the correct platform. */
export async function universalSave(url, dest = './video.mp4', opts = {}) {
  const platformNames = { facebook: 'fb', instagram: 'ig', tiktok: 'tt', twitter: 'x', youtube: 'yt', pinterest: 'pin', capcut: 'capcut' };
  const platform = detectPlatform(url);
  return execDownload(url, dest, {
    platform: platformNames[platform] || 'uni',
    proxy: opts.proxy,
    cookiesPath: opts.cookiesPath,
    cookiesFromBrowser: opts.cookiesFromBrowser,
    audioOnly: opts.audioOnly,
    quality: opts.quality,
    safeMode: opts.safeMode
  });
}

export * from './errors.js';
export * from './constants.js';
export { universalStream } from './stream.js';
export { doctor } from './doctor.js';
export * from './platforms/facebook.js';
export * from './platforms/youtube.js';
export * from './platforms/ytmp3.js';
export * from './platforms/instagram.js';
export * from './platforms/tiktok.js';
export * from './platforms/twitter.js';
export * from './platforms/pinterest.js';
export * from './platforms/capcut.js';
