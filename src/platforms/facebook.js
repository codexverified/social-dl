import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { execYtDlp } from '../core/exec.js'
const execFileAsync = promisify(execFile)
export const TMP_DIR = 'cache/temp'
export const UA = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
const FB_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.facebook.com/',
  'Sec-Fetch-Mode': 'navigate'
}

export const isUrl = (value) => {
  try {
    const u = new URL(String(value).trim())
    const h = u.hostname.toLowerCase().replace(/^www\./,'')
    return (h==='facebook.com' || h.endsWith('.facebook.com') || h==='fb.watch' || h==='fb.com') && /reel|watch|video|share|story/i.test(u.pathname + u.search)
  } catch { return false }
}

export function cleanFbUrl(value){
  try{
    const u = new URL(String(value).trim())
    for(const k of [...u.searchParams.keys()]){
      if(k.startsWith('utm_') || k==='fbclid' || k==='mibextid') u.searchParams.delete(k)
    }
    return u.toString()
  }catch{ return String(value).split('?')[0] }
}

async function validFile(file){
  try{ const s = await stat(file); return s.isFile() && s.size > 4096 }catch{ return false }
}

async function runFbYtDlp(url){
  const dir = join(process.cwd(), TMP_DIR); await mkdir(dir, {recursive:true})
  const tmp = join(dir, `fb-${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`)
  const attempts = [
    ['--remote-components','ejs:github','--js-runtimes','node','--no-playlist','--no-warnings','-o',tmp, url],
    ['--remote-components','ejs:github','--js-runtimes','node','--no-playlist','-f','bv*+ba/best','--merge-output-format','mp4','-o',tmp, url],
    ['--remote-components','ejs:github','--js-runtimes','node','--no-playlist','--user-agent',UA,'-o',tmp, url]
  ]
  try{
    for(const args of attempts){
      try{ await execYtDlp(args, {maxBuffer:64*1024*1024}) }catch(e){}
      if(await validFile(tmp)) return await readFile(tmp)
      await unlink(tmp).catch(()=>{})
    }
    return null
  }finally{ await unlink(tmp).catch(()=>{}) }
}

function extractFbVideoUrl(html){
  // Facebook stores urls escaped
  const patterns = [
    /"browser_native_hd_url":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /"playable_url_low":"([^"]+)"/,
    /hd_src":"([^"]+)"/,
    /sd_src":"([^"]+)"/
  ]
  for(const re of patterns){
    const m = html.match(re)
    if(m){
      let url = m[1]
        .replace(/\\u0025/g,'%').replace(/\\u0026/g,'&').replace(/\\\//g,'/').replace(/\\/g,'')
      try{ url = JSON.parse(`"${url}"`) }catch{}
      try{ url = decodeURIComponent(url) }catch{}
      if(url.startsWith('https://') && url.includes('.mp4')) return url
    }
  }
  return null
}

async function getDirectFb(url){
  // Try mobile and desktop UAs
  const urlsToTry = [url, url.replace('www.facebook.com','m.facebook.com')]
  for(const tryUrl of urlsToTry){
    try{
      const res = await fetch(tryUrl, { headers: FB_HEADERS, redirect:'follow' })
      if(!res.ok) continue
      const html = await res.text()
      const videoUrl = extractFbVideoUrl(html)
      if(!videoUrl) continue
      const vRes = await fetch(videoUrl, { headers: { 'User-Agent': UA, 'Referer':'https://www.facebook.com/' }, redirect:'follow' })
      if(!vRes.ok) continue
      const buf = Buffer.from(await vRes.arrayBuffer())
      if(buf.length > 4096) return buf
    }catch{}
  }
  return null
}

export async function info(url){
  if(!isUrl(url)) throw new Error('Invalid Facebook URL')
  const clean = cleanFbUrl(url)
  return { url: clean, title: 'Facebook video', platform: 'facebook', originalUrl: clean }
}

export async function download(url, format='mp4'){
  if(!isUrl(url)) throw new Error('Invalid Facebook URL')
  const clean = cleanFbUrl(url)
  // Tier1 yt-dlp (currently broken upstream but keep)
  let buffer = await runFbYtDlp(clean)
  // Tier2 direct scrape fallback - works even when yt-dlp parser broken
  if(!buffer) buffer = await getDirectFb(clean)
  if(!buffer || buffer.length <= 4096) throw new Error('NOT_FOUND: Facebook empty media - FB changed html. This is upstream yt-dlp bug, try different public reel or wait for yt-dlp update.')
  format = String(format||'mp4').toLowerCase()
  if(format === 'mp4') return { buffer, mimetype:'video/mp4', extension:'mp4' }
  const dir = join(process.cwd(), TMP_DIR); await mkdir(dir,{recursive:true})
  const base = `fb-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  const input = join(dir, `${base}.mp4`); const output = join(dir, `${base}.mp3`)
  try{
    await writeFile(input, buffer)
    await execFileAsync('ffmpeg',['-y','-i',input,'-vn','-c:a','libmp3lame','-q:a','2',output])
    const audio = await readFile(output)
    if(!audio || audio.length <= 4096) throw new Error('EMPTY_AUDIO')
    return { buffer: audio, mimetype:'audio/mpeg', extension:'mp3' }
  }finally{
    await unlink(input).catch(()=>{})
    await unlink(output).catch(()=>{})
  }
}

export const isFacebookUrl = isUrl
export const facebookDl = info
export const facebookSave = async (url, dest='./fb.mp4') => {
  const { buffer } = await download(url, 'mp4')
  await writeFile(dest, buffer)
  return dest
}
