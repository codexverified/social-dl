<div align="center">

# @codexverified/social-dl

### **Direct CDN social downloading for Codex Technology.**

<img src="https://readme-typing-svg.demolab.com?font=Space+Mono&size=22&pause=1200&color=00FFF0&center=true&vCenter=true&width=900&height=70&repeat=true&lines=DOWNLOAD+DIRECT+MEDIA.;NO+API+KEYS.;YOUTUBE+TO+MP3.;SOCIAL+PLATFORMS%2C+ONE+PACKAGE.;POWERED+BY+CODEX+TECHNOLOGY." alt="Codex Social animated tagline" />

<img src="https://i.imgur.com/dBaSKWF.gif" height="16" width="88%" alt="animated coloured divider" />

<img src="https://raw.githubusercontent.com/CEO-CODEX/CODEX-AI/main/assets/rolling-circle.svg" width="90" alt="Codex rolling circle" />

[![Version](https://img.shields.io/npm/v/@codexverified%2Fsocial-dl?style=for-the-badge&label=version&labelColor=07111F&color=00FFF0)](https://www.npmjs.com/package/@codexverified/social-dl)
[![Developer](https://img.shields.io/badge/Developer-CODEXVERIFIED-B88CFF?style=for-the-badge&logo=telegram&labelColor=07111F)](https://t.me/codexverified)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-7CFFB2?style=for-the-badge&logo=node.js&logoColor=white&labelColor=07111F)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Codex%20Technology-B88CFF?style=for-the-badge&labelColor=07111F)](./LICENSE)

</div>

[![NPM Package](https://img.shields.io/badge/NPM%20Package-Install-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@codexverified/social-dl)
[![Developer](https://img.shields.io/badge/Developer-Contact-B88CFF?style=for-the-badge&logo=telegram)](https://t.me/codexverified)
[![Codex Technology](https://img.shields.io/badge/CODEX%20TECHNOLOGY-Visit-00FFF0?style=for-the-badge&logo=github&logoColor=black)](https://github.com/CEO-CODEX/CODEX-AI)

## Contents

- [Why social-dl?](#why-social-dl)
- [Install](#install)
- [CLI](#cli)
- [Library](#library)
- [Platforms](#platforms)
- [API reference](#api-reference)
- [Support and community](#support-and-community)

## Direct CDN social downloader

Direct CDN social downloader for YouTube, TikTok, Facebook, Instagram, Twitter/X, Pinterest, and CapCut. **No API. No keys. No third-party downloader service.**


## Why social-dl?

| Capability | social-dl | Proxy downloader API |
|---|---:|---:|
| Direct CDN extraction | Yes | No |
| Depends on a third-party API staying online | No | Yes |
| API key required | No | Often |
| Open source | No — proprietary | Varies |

## Install

```bash
npm install @codexverified/social-dl
```

@codexverified/social-dl uses the verified yt-dlp executable bundled with the package, including on Android/Termux. If yt-dlp cannot retrieve a source, @codexverified/social-dl tries Cobalt-compatible and PrexzyAPIs fallbacks. Node.js 18 or newer is required. License and third-party notices for the bundled release are included under [`licenses/yt-dlp/`](./licenses/yt-dlp/).

## Pinned yt-dlp engine

yt-dlp is vendored, pinned, and verified: it ships inside the package instead of being resolved at runtime.

| Platform | Vendored binary | Integrity |
|---|---|---|
| Linux | [`bin/yt-dlp`](./bin/yt-dlp) | verified against `SHA2-256SUMS` |
| macOS | [`bin/yt-dlp_macos`](./bin/yt-dlp_macos) | verified against `SHA2-256SUMS` |
| Windows | [`bin/yt-dlp.exe`](./bin/yt-dlp.exe) | verified against `SHA2-256SUMS` |

The pinned release is recorded in `licenses/yt-dlp/VERSION`, in the official `licenses/yt-dlp/SHA2-256SUMS`, and in the `YTDLP_VERSION` / `YTDLP_SHA256` constants of [`src/core/binary.js`](./src/core/binary.js) — all three are kept in sync.

**The runtime never downloads or discovers yt-dlp.** It does not fetch from GitHub, search `PATH`, read `YTDLP_PATH`, use `yt-dlp-exec`, or install an external downloader. It resolves the executable vendored in this package and fails loudly if that file is missing.

### Keeping yt-dlp current

Updates are prepared automatically and reviewed by a human — never silently applied:

- [`.github/workflows/update-ytdlp.yml`](./.github/workflows/update-ytdlp.yml) runs on the first day of every month, and on demand through `workflow_dispatch`.
- It resolves the latest **stable** yt-dlp release, rejecting drafts, prereleases, and tags that are not in `YYYY.MM.DD` form.
- Every binary is verified against that release's official `SHA2-256SUMS` before anything is replaced, and the official `LICENSE` and `THIRD_PARTY_LICENSES.txt` are refreshed from the same tag.
- The verified result is pushed to an `automation/yt-dlp-<version>` branch and opened as a **reviewable pull request**. Nothing is committed to `main` automatically, and the pull request is never auto-merged.

Run the same update locally with:

```bash
node scripts/update-ytdlp.mjs
```

The updater uses only Node.js built-ins, writes every file atomically (temp file plus rename) so a failed run cannot leave a partial binary behind, preserves the executable bit on the Linux and macOS binaries, and is idempotent — re-running it against an already-pinned release leaves the working tree untouched.

## Termux setup

```bash
pkg update
pkg install nodejs ffmpeg python
npm install -g @codexverified/social-dl
npx social-dl doctor
```

If a platform blocks the network, retry with a permitted cookie export or proxy rather than repeatedly hammering the provider. Keep yt-dlp and FFmpeg current through the package release; @codexverified/social-dl pins its bundled yt-dlp engine for reproducible behavior.

## CLI

```bash
npx social-dl https://youtu.be/BJs3DBrMTSc
npx social-dl https://youtu.be/BJs3DBrMTSc --mp3 -o audio.m4a
npx social-dl https://facebook.com/share/r/xxx/ --json
npx social-dl https://www.tiktok.com/@user/video/123 --no-watermark
npx social-dl https://www.instagram.com/reel/CODE/ --cookies ~/cookies.txt -o instagram.mp4
npx social-dl https://www.tiktok.com/@user/video/123 --cookies-from-browser chrome -o tiktok.mp4
npx social-dl doctor
```

### Easy format and quality selection

Every supported platform uses the same command shape. `mp4` is the default video mode; `mp3` uses FFmpeg to extract audio when the source provides a compatible audio stream.

```bash
# Interactive Termux-friendly menu
npx social-dl

# Direct commands
npx social-dl "URL" --format mp4 --quality best -o video.mp4
npx social-dl "URL" --format mp4 --quality 720p -o video.mp4
npx social-dl "URL" --format mp3 -o audio.mp3
npx social-dl "URL" --format mp4 --quality 720p --safe -o video.mp4

# Equivalent shorthand for MP3
npx social-dl "URL" --mp3 -o audio.mp3
```

`--quality best|720p|480p` applies to video downloads when the provider exposes selectable formats. `--safe`/`--safe-mode` adds conservative yt-dlp pacing (`3–6` second sleeps and a `5M` rate limit); it reduces request pressure but is not an anti-bot bypass. Use cookies or a permitted proxy for content requiring authentication.

Run `npx social-dl doctor` to verify Node.js, FFmpeg, the pinned yt-dlp binary/version, and provider reachability before troubleshooting a download. Use `npx @codexverified/social-dl maintenance` for the interactive engine update and safe cache reset menu; reset never deletes downloaded media. `--format mp3` requires FFmpeg; if a platform only exposes a ready-made media file, social-dl keeps the provider’s native media instead of pretending it can convert it. `--json` shows normalized metadata and available formats before saving, while `--no-watermark` requests a no-watermark variant when the provider supports one.

For login-required Instagram or TikTok posts, pass an exported cookie file with `--cookies path/to/cookies.txt` or use `--cookies-from-browser chrome`, `firefox`, `edge`, or `brave`. YouTube may reject datacenter IPs; `doctor` reports this as `BOT_DETECTED`.

## Library

```js
import { universalDl, universalSave, universalStream } from '@codexverified/social-dl';

const data = await universalDl('https://youtu.be/BJs3DBrMTSc');
await universalSave('https://youtu.be/BJs3DBrMTSc', './video.mp4');
```

### Platform-specific library examples

Every platform also exposes its own `xxxDl()` and `xxxSave()` functions. Each `Dl()` call returns normalized metadata and direct CDN formats; each `Save()` call downloads the selected format.

#### Facebook

```js
import { facebookDl, facebookSave } from '@codexverified/social-dl/facebook';

const facebook = await facebookDl('https://www.facebook.com/reel/1234567890/');
await facebookSave('https://www.facebook.com/reel/1234567890/', './facebook.mp4', 'HD');
```

#### YouTube video

```js
import { youtubeDl, youtubeSave } from '@codexverified/social-dl/youtube';

const youtube = await youtubeDl('https://youtu.be/BJs3DBrMTSc');
await youtubeSave('https://youtu.be/BJs3DBrMTSc', './youtube.mp4', '720p');
```

#### YouTube audio

```js
import { youtubeMp3Dl, youtubeMp3Save } from '@codexverified/social-dl/ytmp3';

const audio = await youtubeMp3Dl('https://youtu.be/BJs3DBrMTSc');
await youtubeMp3Save('https://youtu.be/BJs3DBrMTSc', './audio.m4a');
```

#### Instagram

```js
import { instagramDl, instagramSave } from '@codexverified/social-dl/instagram';

const instagram = await instagramDl('https://www.instagram.com/reel/CODE/', { cookiesPath: './cookies.txt' });
await instagramSave('https://www.instagram.com/reel/CODE/', './instagram.mp4', 'best', { cookiesPath: './cookies.txt' });
```

#### TikTok

```js
import { tiktokDl, tiktokSave } from '@codexverified/social-dl/tiktok';

const tiktok = await tiktokDl('https://www.tiktok.com/@user/video/1234567890123456789', { cookiesFromBrowser: 'chrome' });
await tiktokSave('https://www.tiktok.com/@user/video/1234567890123456789', './tiktok.mp4', 'NOWM', { cookiesFromBrowser: 'chrome' });
```

#### Twitter/X

```js
import { twitterDl, twitterSave } from '@codexverified/social-dl/twitter';

const tweet = await twitterDl('https://x.com/user/status/1851234567890');
await twitterSave('https://x.com/user/status/1851234567890', './twitter.mp4');
```

#### Pinterest

```js
import { pinterestDl, pinterestSave } from '@codexverified/social-dl/pinterest';

const pin = await pinterestDl('https://www.pinterest.com/pin/1234567890/');
await pinterestSave('https://www.pinterest.com/pin/1234567890/', './pinterest.mp4');
```

#### CapCut

```js
import { capcutDl, capcutSave } from '@codexverified/social-dl/capcut';

const template = await capcutDl('https://www.capcut.com/template-detail/1234567890');
await capcutSave('https://www.capcut.com/template-detail/1234567890', './capcut.mp4');
```

### Express/Next.js streaming

```js
const { stream, contentType, filename } = await universalStream(url);
res.setHeader('Content-Type', contentType);
res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
Readable.fromWeb(stream).pipe(res);
```

## Platforms

| Platform | Example |
|---|---|
| Facebook | `https://www.facebook.com/reel/1234567890/` |
| YouTube | `https://youtu.be/BJs3DBrMTSc` |
| Instagram | `https://www.instagram.com/reel/CODE/` |
| TikTok | `https://www.tiktok.com/@user/video/123` |
| Twitter/X | `https://x.com/user/status/123` |
| Pinterest | `https://www.pinterest.com/pin/1234567890/` |
| CapCut | `https://www.capcut.com/template-detail/1234567890` |
| YouTube audio | Same YouTube URLs with `{ audioOnly: true }` or `--mp3` |

## API reference

- `universalDl(url, { audioOnly, quality, cookiesPath, cookiesFromBrowser })` — return normalized direct-CDN formats.
- `universalSave(url, destination, { audioOnly, quality, noWatermark, cookiesPath, cookiesFromBrowser, safeMode })` — save a selected format. `safeMode: true` enables conservative pacing for yt-dlp. `audioOnly: true` is the library equivalent of `--format mp3`.
- The shared CLI works across YouTube, TikTok, Facebook, Instagram, Twitter/X, Pinterest, and CapCut. Video quality and MP3 conversion depend on the formats and FFmpeg support available for each source.
- `universalStream(url, options)` — return a Web `ReadableStream` for piping.
- `doctor({ log })` — test provider reachability, Node, FFmpeg, and the bundled yt-dlp engine.
- `npx @codexverified/social-dl maintenance` — interactively update the yt-dlp engine or reset only generated cache/cookie state; downloaded media is preserved.
- Every platform exports `xxxDl()` and `xxxSave()`.

## Fallback Credits

@codexverified/social-dl uses multiple fallback services to improve download reliability:

- PrexzyAPIs.com
- Cobalt-compatible endpoints

Fallbacks are used when the primary yt-dlp path cannot retrieve media. Third-party services may be unavailable or change behavior.

Set `SOCIAL_DL_PROXY` to use a proxy for the primary yt-dlp request. The fallback services do not require this variable. For YouTube bot checks, provide an exported Netscape cookie file with `--cookies path/to/youtube-cookies.txt`, use `--cookies-from-browser chrome`, or set `SOCIAL_DL_YOUTUBE_COOKIES` / `SOCIAL_DL_YOUTUBE_COOKIES_FROM_BROWSER`. @codexverified/social-dl tries multiple yt-dlp YouTube clients before using Cobalt and Prexzy; third-party services can still be unavailable or block the source.

## Support and community

For package updates, documentation, and support, visit the [CodexVerified package page](https://www.npmjs.com/package/@codexverified/social-dl) or contact [@codexverified](https://t.me/codexverified).

## Error handling

Handle `BotDetectedError` for provider anti-automation blocks, `PrivateError` for login/private content, `NotFoundError` for missing media, and `UnsupportedError` for unsupported URLs.

## Demo

<!-- DEMO TODO FOR 1.0.0: After publishing 0.9.0, record terminal and replace with ![demo](./demo.gif) -->

Demo video coming in 1.0.0 — npx becomes available after this 0.9.0 pre-launch.

## Release checklist

Before publishing a new npm version:

```bash
npm test
npm pack --dry-run
npx social-dl doctor
```

The package requires Node.js 18 or newer. MP3 conversion requires FFmpeg. Provider availability can change independently of social-dl, so login-required or blocked sources should be tested with permitted cookies or a proxy.

## License

See [LICENSE](./LICENSE) for the package license.
<div align="center">

<sub>Thanks for using @codexverified/social-dl.</sub>

<img src="https://i.imgur.com/dBaSKWF.gif" height="16" width="88%" alt="animated coloured footer line" />

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=00FFF0&height=100&section=footer" alt="@codexverified/social-dl footer" />

</div>
