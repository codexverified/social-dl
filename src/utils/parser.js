/** Decode a JSON-escaped string found inside HTML. */
export function unescapeJson(value) {
  if (value == null) return value;
  try { return JSON.parse(`"${value}"`); } catch { return value.replace(/\\u002F/g, '/').replace(/\\\\/g, '\\').replace(/\\"/g, '"'); }
}

/** Extract a JSON script element by id. */
export function extractJson(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<script[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)</script>`, 'i'));
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

/** Return a JSON object nested at a dotted path. */
export function getPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}
