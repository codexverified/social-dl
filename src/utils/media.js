import { downloadTo } from './fetcher.js';
import { saveMuxed } from './mux.js';

/** Sort formats by resolution, bitrate, then audio preference. */
export function sortFormats(formats) {
  return formats.filter(format => format?.url).sort((a, b) => {
    const score = item => (parseInt(item.quality, 10) || 0) * 100000 + (item.bitrate || 0) + (item.hasAudio ? 100 : 0);
    return score(b) - score(a);
  });
}

/** Select a format by requested quality and save it. */
export async function saveResult(result, dest, quality = 'best', headers = {}, noWatermark = false) {
  if (result.needsMux && quality === 'best') {
    const muxed = await saveMuxed(result, dest, headers);
    if (muxed) return muxed;
    console.warn('Install ffmpeg to auto-mux 1080p; saving the best direct video stream instead.');
  }
  let formats = result.formats || [];
  if (noWatermark) formats = formats.filter(item => item.isNoWatermark !== false);
  const wanted = quality === 'best' ? formats[0] : formats.find(item => item.tag === quality || item.quality === quality) || formats[0];
  if (!wanted) throw new Error('NO_FORMATS');
  return downloadTo(wanted.url, dest, { headers });
}

/** Parse a quality label from a media object. */
export function qualityOf(item, fallback = 'unknown') {
  return item.qualityLabel || (item.height ? `${item.height}p` : fallback);
}
