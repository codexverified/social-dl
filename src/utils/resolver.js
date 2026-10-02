import { fetchWithRetry } from './fetcher.js';

/** Resolve a short social URL and return its final URL. */
export async function resolveShortUrl(url) {
  const input = new URL(url);
  const host = input.hostname.toLowerCase();
  const shortHosts = ['vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com', 'pin.it', 't.co', 'fb.watch'];
  const isCapcutShort = host.endsWith('capcut.com') && input.pathname.startsWith('/t/');
  if (!shortHosts.includes(host) && !isCapcutShort) return url;
  const response = await fetchWithRetry(url, { method: 'GET', redirect: 'follow' });
  return response.url || url;
}
