import { IOS_MEDIA_HEADERS, player, videoId, YOUTUBE_MEDIA_HEADERS } from './youtube.js';
import { saveResult, sortFormats } from '../utils/media.js';
import { NotFoundError, UnsupportedError } from '../errors.js';
import { CREATOR } from '../constants.js';
import { fallbackInstallMessage, ytDlpDownload, ytDlpInfo } from '../utils/ytdlp.js';

/** Download audio-only metadata from YouTube (m4a/opus, not transcoded MP3). */
export async function youtubeMp3Dl(url, options = {}) {
  const id = videoId(url);
  if (!id) throw new UnsupportedError('Invalid YouTube URL.');
  let data;
  try { data = await player(id); }
  catch (error) {
    if (!error?.code && !/403|automated|unusual traffic|UNAVAILABLE/i.test(error?.message || '')) throw error;
    try {
      const fallback = await ytDlpInfo(id);
      return { creator: CREATOR, platform: 'youtube', id, client: 'YT-DLP', title: fallback.title, author: fallback.uploader || fallback.channel, thumbnail: fallback.thumbnail, isAudioOnly: true, originalUrl: url, formats: [], fallback: true };
    } catch (fallbackError) {
      throw new Error(`${fallbackInstallMessage()} (${fallbackError.message})`);
    }
  }
  const source = data.streamingData?.adaptiveFormats || [];
  const formats = sortFormats(source.filter(item => item.url && item.mimeType?.startsWith('audio/')).map(item => {
    const type = item.mimeType.includes('webm') ? 'opus' : 'm4a';
    const kbps = Math.round((item.bitrate || 0) / 1000);
    return { tag: type === 'opus' ? `OPUS_${kbps}` : `MP3_${kbps}`, quality: `${kbps}kbps`, type, hasAudio: true, isAudioOnly: true, url: item.url, bitrate: item.bitrate };
  }));
  if (!formats.length) throw new NotFoundError('PRIVATE_OR_AGE_RESTRICTED');
  if (!formats.length) {
    try {
      const fallback = await ytDlpInfo(id);
      return { creator: CREATOR, platform: 'youtube', id, client: 'YT-DLP', title: fallback.title, author: fallback.uploader || fallback.channel, thumbnail: fallback.thumbnail, isAudioOnly: true, originalUrl: url, formats: [], fallback: true };
    } catch (fallbackError) {
      throw new Error(`${fallbackInstallMessage()} (${fallbackError.message})`);
    }
  }
  return { creator: CREATOR, platform: 'youtube', id, client: data.__socialDlClient, title: data.videoDetails?.title, thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, isAudioOnly: true, originalUrl: url, formats };
}

/** Save the best YouTube audio stream to disk. */
export async function youtubeMp3Save(url, dest = './audio.m4a', quality = 'best', options = {}) {
  const result = await youtubeMp3Dl(url, options);
  if (result.fallback) {
    const { writeFile } = await import('node:fs/promises');
    const output = await ytDlpDownload(result.id, 'mp3', options);
    await writeFile(dest, output.buffer);
    return dest;
  }
  return saveResult(result, dest, quality, { ...YOUTUBE_MEDIA_HEADERS, fallbackHeaders: IOS_MEDIA_HEADERS });
}
