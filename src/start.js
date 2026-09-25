import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, createWriteStream } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const jar=path.join(root,'Lavalink.jar');
const jarUrl='https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar';
const password=process.env.LAVALINK_PASSWORD || 'change-me';

function run(cmd,args,opts={}){
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{stdio:opts.stdio||'inherit',cwd:root,shell:false,...opts});
  p.once('error',reject); p.once('exit',c=>c===0?resolve():reject(new Error(`${cmd} exited with ${c}`)));
 });
}
async function checkJava(){
 try{ await run('java',['-version'],{stdio:'ignore'}); }
 catch{ console.error('❌ Javaが見つかりません。Java 17以上をインストールしてください。'); process.exit(1); }
}
function download(url,dest,redirects=0){
 return new Promise((resolve,reject)=>{
  const lib=url.startsWith('https:')?https:http;
  const req=lib.get(url,{headers:{'User-Agent':'Discord-MusicBot-Installer'}},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){
    res.resume(); if(redirects>8)return reject(new Error('redirect too many'));
    return download(new URL(res.headers.location,url).toString(),dest,redirects+1).then(resolve,reject);
   }
   if(res.statusCode!==200){res.resume();return reject(new Error(`HTTP ${res.statusCode}`));}
   const f=createWriteStream(dest); res.pipe(f); f.on('finish',()=>f.close(resolve)); f.on('error',reject);
  }); req.on('error',reject);
 });
}
async function waitLavalink(ms=90000){
 const end=Date.now()+ms;
 while(Date.now()<end){
  const ok=await new Promise(resolve=>{
   const req=http.get({host:'127.0.0.1',port:2333,path:'/version',headers:{Authorization:password},timeout:1000},res=>{res.resume();resolve(res.statusCode===200);});
   req.on('error',()=>resolve(false));req.on('timeout',()=>{req.destroy();resolve(false);});
  });
  if(ok)return true; await new Promise(r=>setTimeout(r,1000));
 }
 return false;
}

await checkJava();
try{ await access(jar,constants.R_OK); }
catch{
 console.log('⬇ Lavalink.jar をダウンロードしています...');
 try{await download(jarUrl,jar);console.log('✅ Lavalink.jar ダウンロード完了');}
 catch(e){console.error('❌ Lavalink.jarの取得に失敗:',e.message);process.exit(1);}
}
console.log('🎵 Lavalinkを起動しています...');
const lava=spawn('java',['-Dspring.cloud.config.enabled=false','-Dspring.cloud.config.import-check.enabled=false','-jar',jar,'--spring.config.location='+path.join(root,'application.yml')],{cwd:root,stdio:'inherit',env:{...process.env,LAVALINK_PASSWORD:password}});
lava.on('error',e=>{console.error('❌ Lavalink起動失敗:',e);process.exit(1);});
console.log('⏳ Lavalink :2333 を待っています...');
let lavaExited=false;
let lavaExitCode=null;
lava.once('exit',code=>{ lavaExited=true; lavaExitCode=code; });
const waitResult=await Promise.race([
 waitLavalink().then(ok=>ok?'ready':'timeout'),
 new Promise(resolve=>{
  const timer=setInterval(()=>{
   if(lavaExited){ clearInterval(timer); resolve('exited'); }
  },100);
 })
]);
if(waitResult!=='ready'){
 if(waitResult==='exited') console.error(`❌ Lavalinkが起動途中で終了しました。code=${lavaExitCode}`);
 else console.error('❌ Lavalinkが90秒以内に起動しませんでした。上のLavalinkログを確認してください。');
 try{lava.kill();}catch{} process.exit(1);
}
console.log('✅ Lavalink起動完了');
console.log('🤖 Discord BOTを起動します...');
const bot=spawn(process.execPath,[path.join(root,'src','index.js')],{cwd:root,stdio:'inherit',env:{...process.env,LAVALINK_HOST:'127.0.0.1',LAVALINK_PORT:'2333',LAVALINK_SECURE:'false',LAVALINK_PASSWORD:password}});
const stop=()=>{try{bot.kill();}catch{} try{lava.kill();}catch{}};
process.on('SIGINT',()=>{stop();process.exit(0)});process.on('SIGTERM',()=>{stop();process.exit(0)});
bot.on('exit',code=>{try{lava.kill();}catch{} process.exit(code??0);});
lava.on('exit',code=>{if(code!==null&&code!==0){console.error(`❌ Lavalinkが終了しました code=${code}`);try{bot.kill();}catch{} process.exit(code);}});
