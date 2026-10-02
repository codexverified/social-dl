import{execFile}from'child_process'
import{promisify}from'util'
import{mkdir,readFile,unlink,writeFile}from'fs/promises'
import{join}from'path'
const execFileAsync=promisify(execFile)
export const TIKWM_API='https://www.tikwm.com/api/'
const API=TIKWM_API
const UA='Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
const run=async args=>{
 try{
  const{stdout,stderr}=await execFileAsync('ffmpeg',args,{maxBuffer:32*1024*1024})
  return{stdout:String(stdout||''),stderr:String(stderr||'')}
 }catch(e){
  throw new Error(String(e?.stderr||e?.stdout||e?.message||'FFmpeg falló').trim())
 }
}
const isUrl=x=>{
 try{
  const u=new URL(String(x||'').trim()),h=u.hostname.toLowerCase().replace(/^www\./,'')
  return(u.protocol==='http:'||u.protocol==='https:')&&(h==='tiktok.com'||h.endsWith('.tiktok.com'))
 }catch{return false}
}
const api=async url=>{
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':UA,Referer:'https://www.tikwm.com/'},body:new URLSearchParams({url,hd:'1'})})
 if(!r.ok)throw new Error(`TikWM respondió ${r.status}.`)
 const x=await r.json()
 if(x?.code!==0||!x?.data)throw new Error(x?.msg||'TikWM no pudo procesar el enlace.')
 return x.data
}
const get=async url=>{
 const r=await fetch(url,{headers:{'User-Agent':UA,Referer:'https://www.tikwm.com/'}})
 if(!r.ok)throw new Error(`No se pudo descargar el archivo (${r.status}).`)
 const b=Buffer.from(await r.arrayBuffer())
 if(b.length<=4096)throw new Error('El archivo descargado está vacío.')
 return b
}
export async function info(url){
 if(!isUrl(url))throw new Error('Enlace de TikTok inválido.')
 const x=await api(url)
 return{id:x.id||null,url:x.share_url||url,title:x.title||'Sin título',author:x.author?.unique_id||x.author?.nickname||'',nickname:x.author?.nickname||'',views:Number(x.play_count)||null,likes:Number(x.digg_count)||null,comments:Number(x.comment_count)||null,shares:Number(x.share_count)||null,duration:Number(x.duration)||null,thumbnail:x.origin_cover||x.cover||null,video:x.hdplay||x.play||null,music:x.music||null}
}
export async function download(url,format){
 if(!isUrl(url))throw new Error('Enlace de TikTok inválido.')
 format=String(format||'').toLowerCase().trim()
 if(!['mp3','mp4'].includes(format))throw new Error('Formato inválido.')
 const x=await api(url)
 if(format==='mp3'&&x.music){const buffer=await get(x.music);return{buffer,mimetype:'audio/mpeg',extension:'mp3'}}
 if(!x.play&&!x.hdplay)throw new Error('TikWM no proporcionó el vídeo.')
 const buffer=await get(x.hdplay||x.play)
 if(format==='mp4')return{buffer,mimetype:'video/mp4',extension:'mp4'}
 const dir=join(process.cwd(),'cache','temp');await mkdir(dir,{recursive:true})
 const base=`tt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;const input=join(dir,`${base}.mp4`);const output=join(dir,`${base}.mp3`)
 try{await writeFile(input,buffer);await run(['-y','-i',input,'-vn','-c:a','libmp3lame','-q:a','2',output]);const audio=await readFile(output);if(audio.length<=4096)throw new Error('No se pudo generar el audio.');return{buffer:audio,mimetype:'audio/mpeg',extension:'mp3'}}finally{await unlink(input).catch(()=>{});await unlink(output).catch(()=>{})}
}
export {isUrl}
export const isTikTokUrl = isUrl
export const isTiktokUrl = isUrl
export const validMediaBuffer = buffer => Buffer.isBuffer(buffer) && buffer.length > 4096
export const tiktokDl = info
export const tiktokSave = async (url, dest='./tt.mp4') => {
  const { buffer } = await download(url, 'mp4')
  const { writeFile } = await import('fs/promises')
  await writeFile(dest, buffer)
  return dest
}
