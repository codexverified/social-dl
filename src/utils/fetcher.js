import { BotDetectedError } from '../errors.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
];

/** Pick a browser-like user agent. */
export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Fetch a URL with redirect following and one retry for transient failures. */
export async function fetchWithRetry(input, options = {}, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = { 'User-Agent': randomUserAgent(), Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(options.headers || {}) };
      const response = await fetch(input, { ...options, headers, redirect: options.redirect || 'follow' });
      if (response.status === 403) {
        const body = await response.clone().text();
        if (/automated|unusual traffic|sorry/i.test(body)) {
          throw new BotDetectedError('The provider rejected this request as automated traffic.');
        }
      }
      if (!response.ok && attempt < retries && (response.status >= 500 || response.status === 429)) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

/** Read YouTube's visitor-data token for Innertube requests. */
export async function getVisitorData() {
  try {
    const response = await fetch('https://www.youtube.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    return html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1]
      || html.match(/ytcfg\.set.*?"VISITOR_DATA":"([^"]+)"/)?.[1]
      || null;
  } catch {
    return null;
  }
}

/** Fetch and return text, rejecting non-success responses. */
export async function fetchText(input, options = {}) {
  const response = await fetchWithRetry(input, options);
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
}

/** Fetch a direct media URL and write it to disk. */
export async function downloadTo(url, dest, options = {}) {
  const { fallbackHeaders, ...requestOptions } = options;
  const attempts = [requestOptions.headers, fallbackHeaders].filter(Boolean);
  let response;
  let lastError;
  for (let index = 0; index < Math.max(1, attempts.length); index += 1) {
    try {
      response = await fetchWithRetry(url, { ...requestOptions, headers: attempts[index] }, 0);
      if (response.ok || response.status !== 403 || index === attempts.length - 1) break;
    } catch (error) {
      lastError = error;
      if (index === attempts.length - 1) throw error;
    }
  }
  if (lastError && !response) throw lastError;
  if (!response?.ok) throw new Error(`DOWNLOAD_HTTP_${response?.status || 'FAILED'}`);
  const { writeFile } = await import('node:fs/promises');
  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, data);
  return dest;
}
