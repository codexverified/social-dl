import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { execYtDlp } from '../core/exec.js'
const execFileAsync = promisify(execFile)
export const UA = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
export const TMP_DIR = 'cache/temp'
const IG_APP_ID = '936619743392459'
const IG_HEADERS = { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', Referer: 'https://www.instagram.com/', Origin: 'https://www.instagram.com/' }

const codeOf = url => new URL(url).pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i)?.[1]

export const isUrl = (value) => {
  try {
    const parsed = new URL(String(value).trim())
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && host.endsWith('instagram.com') && /\/(?:reel|reels|p|tv)\//i.test(parsed.pathname)
  } catch { return false }
}

export function cleanIgUrl(value){
  try{
    const u = new URL(String(value).trim())
    for(const k of [...u.searchParams.keys()]){
      if(k.startsWith('utm_') || k==='igsh' || k==='igshid' || k.toLowerCase().includes('stkn') || k==='fbclid') u.searchParams.delete(k)
    }
    return `${u.origin}${u.pathname.endsWith('/')? u.pathname : `${u.pathname}/`}`
  }catch{ return String(value).split('?')[0] }
}
export const cleanInstagramUrl = cleanIgUrl

async function validFile(file){
  try{ const s = await stat(file); return s.isFile() && s.size > 4096 }catch{ return false }
}

async function runInstagramYtDlp(url){
  const dir = join(process.cwd(), TMP_DIR); await mkdir(dir, {recursive:true})
  const tmp = join(dir, `ig-${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`)
  const baseArgs = ['--remote-components','ejs:github','--js-runtimes','node','--no-playlist','-o',tmp, url]
  const fallbackArgs = ['--remote-components','ejs:github','--js-runtimes','node','--no-playlist','-f','bv*+ba/best','--merge-output-format','mp4','-o',tmp, url]
  try{
    for(const args of [baseArgs, fallbackArgs]){
      try{ await execYtDlp(args, {maxBuffer:64*1024*1024}) }catch(e){ console.error('yt-dlp failed:', e?.stderr || e?.message) }
      if(await validFile(tmp)) return await readFile(tmp)
      await unlink(tmp).catch(()=>{})
    }
    return null
  }finally{ await unlink(tmp).catch(()=>{}) }
}

async function getDirect(id){
  for(const pageUrl of [`https://www.instagram.com/reel/${id}/`, `https://www.instagram.com/p/${id}/`, `https://www.instagram.com/tv/${id}/`]){
    try{
      const res = await fetch(pageUrl, { headers: IG_HEADERS, redirect:'follow' })
      if(!res.ok) continue
      const html = await res.text()
      const m = html.match(/"video_url"\s*:\s*"(https:[^"]+)"/) || html.match(/"video_versions"\s*:\s*\[.*?\{"url"\s*:\s*"(https:[^"]+)"/s)
      if(!m) continue
      let mediaUrl = m[1].replace(/\\u0026/g,'&').replace(/\\/g,'').replace(/\u0026/g,'&')
      try{ mediaUrl = JSON.parse(`"${mediaUrl}"`) }catch{}
      const media = await fetch(mediaUrl, { headers:{'User-Agent':UA, Referer:'https://www.instagram.com/'}, redirect:'follow' })
      if(!media.ok) continue
      const buf = Buffer.from(await media.arrayBuffer())
      if(buf.length > 4096) return buf
    }catch{}
  }
  return null
}

export async function info(url){
  if(!isUrl(url)) throw new Error('Invalid Instagram URL')
  const clean = cleanIgUrl(url)
  const id = codeOf(clean)
  return { id, url: clean, title: 'IG Reel', originalUrl: clean, thumbnail: null, platform: 'instagram' }
}

export async function download(url, format='mp4'){
  if(!isUrl(url)) throw new Error('Invalid Instagram URL')
  const clean = cleanIgUrl(url)
  const id = codeOf(clean)
  let buffer = await runInstagramYtDlp(clean)
  if(!buffer) buffer = await getDirect(id)
  if(!buffer || buffer.length <= 4096) throw new Error('NOT_FOUND: Instagram empty media - IG blocks datacenter. Test in Termux or another supported environment.')
  format = String(format||'mp4').toLowerCase()
  if(format === 'mp4') return { buffer, mimetype:'video/mp4', extension:'mp4' }
  const dir = join(process.cwd(), TMP_DIR); await mkdir(dir,{recursive:true})
  const base = `ig-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
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

export const isInstagramUrl = isUrl
export const instagramDl = info
export const instagramSave = async (url, dest='./ig.mp4', quality='best') => {
  const { buffer } = await download(url, 'mp4')
  await writeFile(dest, buffer)
  return dest
}
