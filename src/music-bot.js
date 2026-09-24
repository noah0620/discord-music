import {
 Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags
} from 'discord.js';
import {
 joinVoiceChannel,createAudioPlayer,createAudioResource,AudioPlayerStatus,StreamType,
 VoiceConnectionStatus,entersState
} from '@discordjs/voice';
import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import youtubedl from 'youtube-dl-exec';

export function startMusicBot(token,label){
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});
 const sessions=new Map();

 const ephemeral=(content)=>({content,flags:MessageFlags.Ephemeral});
 async function replySafe(i,payload){
  try{
   if(i.deferred||i.replied)return await i.followUp(payload);
   return await i.reply(payload);
  }catch(e){
   if(e?.code===40060||e?.code===10062){console.warn(`[${label}] interaction ${e.code} ignored`);return;}
   throw e;
  }
 }
 function humans(ch){return ch?.members?.filter(m=>!m.user.bot).size??0;}
 function buttonId(a){return `music:${client.user.id}:${a}`;}
 function controls(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(buttonId('pause')).setLabel('⏸ 一時停止').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(buttonId('resume')).setLabel('▶ 再開').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(buttonId('skip')).setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(buttonId('stop')).setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId(buttonId('leave')).setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
 );}
 async function resolveTrack(input){
  const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
  const info=await youtubedl(target,{dumpSingleJson:true,noPlaylist:true,skipDownload:true,noWarnings:true});
  const row=Array.isArray(info?.entries)?info.entries[0]:info;
  if(!row)throw new Error('曲が見つかりませんでした。');
  const url=row.webpage_url||row.original_url||row.url;
  if(!url)throw new Error('動画URLを取得できませんでした。');
  return {title:row.title||input,url};
 }
 async function streamUrl(url){
  const raw=await youtubedl(url,{getUrl:true,format:'bestaudio/best',noPlaylist:true,noWarnings:true});
  const u=String(raw).trim().split(/\r?\n/).find(x=>/^https?:\/\//.test(x));
  if(!u)throw new Error('音声URLを取得できませんでした。');
  return u;
 }
 function resource(url,volume){
  const proc=spawn(ffmpegPath,[
   '-hide_banner','-loglevel','error','-reconnect','1','-reconnect_streamed','1',
   '-reconnect_delay_max','5','-i',url,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'
  ],{stdio:['ignore','pipe','pipe']});
  proc.stderr.on('data',d=>console.error(`[${label}] ffmpeg:`,String(d).trim()));
  proc.on('error',e=>console.error(`[${label}] ffmpeg process:`,e));
  const r=createAudioResource(proc.stdout,{inputType:StreamType.Raw,inlineVolume:true});
  r.volume?.setVolume(volume/100);
  return {proc,r};
 }
 function destroy(gid){
  const s=sessions.get(gid);if(!s)return;
  s.queue.length=0;
  try{s.ffmpeg?.kill();}catch{}
  try{s.player.stop(true);}catch{}
  try{s.connection.destroy();}catch{}
  sessions.delete(gid);
 }
 async function next(gid){
  const s=sessions.get(gid);if(!s||s.playing||!s.queue.length)return;
  const track=s.queue.shift();
  try{
   // 再生直前に取得するのでキュー待ちでURLが失効しにくい
   const direct=await streamUrl(track.url);
   const {proc,r}=resource(direct,s.volume);
   s.current=track;s.ffmpeg=proc;s.playing=true;s.player.play(r);
  }catch(e){
   console.error(`[${label}] 再生失敗:`,e);
   s.current=null;s.ffmpeg=null;s.playing=false;
   setTimeout(()=>next(gid).catch(console.error),500);
  }
 }
 async function session(guild,vc){
  let s=sessions.get(guild.id);
  if(s){
   if(s.channelId!==vc.id)throw new Error('このBOTは別のボイスチャンネルで使用中です。');
   return s;
  }
  const connection=joinVoiceChannel({
   channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,
   // 3つのClientが同じNodeプロセスにいるため接続グループをBOTごとに分離
   group:`music-${client.user.id}`
  });
  await entersState(connection,VoiceConnectionStatus.Ready,20000);
  const player=createAudioPlayer();
  connection.subscribe(player);
  s={channelId:vc.id,connection,player,queue:[],current:null,ffmpeg:null,playing:false,volume:100};
  sessions.set(guild.id,s);
  player.on(AudioPlayerStatus.Idle,()=>{
   try{s.ffmpeg?.kill();}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;next(guild.id).catch(console.error);
  });
  player.on('error',e=>{
   console.error(`[${label}] player:`,e);
   try{s.ffmpeg?.kill();}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;next(guild.id).catch(console.error);
  });
  connection.on(VoiceConnectionStatus.Destroyed,()=>sessions.delete(guild.id));
  return s;
 }
 function same(i){
  const s=sessions.get(i.guildId);
  return s&&i.member?.voice?.channelId===s.channelId?s:null;
 }
 async function autoLeave(gid){
  const s=sessions.get(gid);if(!s)return;
  const guild=client.guilds.cache.get(gid);
  const ch=guild?.channels.cache.get(s.channelId)??await guild?.channels.fetch(s.channelId).catch(()=>null);
  if(!ch||humans(ch)===0){console.log(`[${label}] 👋 無人VCから自動退出`);destroy(gid);}
 }

 client.on(Events.VoiceStateUpdate,o=>{
  if(sessions.has(o.guild.id))setTimeout(()=>autoLeave(o.guild.id).catch(console.error),1000);
 });
 setInterval(()=>{for(const gid of sessions.keys())autoLeave(gid).catch(console.error)},15000);
 client.once(Events.ClientReady,c=>console.log(`✅ ${label} 起動: ${c.user.tag}`));
 client.on('error',e=>console.error(`[${label}] client:`,e));

 client.on(Events.InteractionCreate,async i=>{
  try{
   if(i.isButton()){
    const p=i.customId.split(':');
    // 他の2台のBOT用ボタンには絶対に応答しない（40060対策）
    if(p.length!==3||p[0]!=='music'||p[1]!==client.user.id)return;
    const s=same(i);
    if(!s)return replySafe(i,ephemeral('❌ このBOTと同じボイスチャンネルに参加してください。'));
    const a=p[2];
    if(a==='pause'){s.player.pause();return replySafe(i,ephemeral('⏸ 一時停止しました。'));}
    if(a==='resume'){s.player.unpause();return replySafe(i,ephemeral('▶ 再開しました。'));}
    if(a==='skip'){s.player.stop(true);return replySafe(i,ephemeral('⏭ スキップしました。'));}
    if(a==='stop'){s.queue.length=0;s.player.stop(true);return replySafe(i,ephemeral('⏹ 停止しました。'));}
    if(a==='leave'){destroy(i.guildId);return replySafe(i,ephemeral('🚪 退出しました。'));}
    return;
   }
   if(!i.isChatInputCommand())return;
   const n=i.commandName;
   if(n==='play'){
    const vc=i.member?.voice?.channel;
    if(!vc)return replySafe(i,ephemeral('❌ 先にボイスチャンネルへ参加してください。'));
    await i.deferReply();
    try{
     const track=await resolveTrack(i.options.getString('query',true));
     const s=await session(i.guild,vc);
     s.queue.push(track);
     await i.editReply({embeds:[new EmbedBuilder().setTitle(`🎵 ${label}`).setDescription(`**${track.title}**\n${track.url}\n\nVC: <#${vc.id}>`)],components:[controls()]});
     next(i.guildId).catch(console.error);
    }catch(e){await i.editReply(`❌ 再生準備に失敗しました。\n${String(e.message||e).slice(0,1200)}`);}
    return;
   }
   if(n==='leave'){
    const s=same(i);if(!s)return replySafe(i,ephemeral('❌ このBOTと同じVCに参加してください。'));
    destroy(i.guildId);return replySafe(i,'🚪 ボイスチャンネルから退出しました。');
   }
   const s=same(i);if(!s)return replySafe(i,ephemeral('❌ このBOTと同じVCに参加してください。'));
   if(n==='queue')return replySafe(i,[s.current&&`▶️ **${s.current.title}**`,...s.queue.map((x,j)=>`${j+1}. ${x.title}`)].filter(Boolean).join('\n')||'キューは空です。');
   if(n==='skip'){s.player.stop(true);return replySafe(i,'⏭ スキップしました。');}
   if(n==='stop'){s.queue.length=0;s.player.stop(true);return replySafe(i,'⏹ 停止しました。');}
   if(n==='pause'){s.player.pause();return replySafe(i,'⏸ 一時停止しました。');}
   if(n==='resume'){s.player.unpause();return replySafe(i,'▶ 再開しました。');}
   if(n==='nowplaying')return replySafe(i,s.current?`🎵 **${s.current.title}**\n${s.current.url}`:'現在再生していません。');
   if(n==='volume'){
    s.volume=i.options.getInteger('percent',true);
    s.player.state.resource?.volume?.setVolume(s.volume/100);
    return replySafe(i,`🔊 音量を ${s.volume}% に変更しました。`);
   }
  }catch(e){
   console.error(`[${label}] interaction:`,e);
   await replySafe(i,ephemeral(`❌ エラー: ${String(e.message||e).slice(0,1000)}`)).catch(()=>{});
  }
 });
 client.login(token).catch(e=>console.error(`❌ ${label} ログイン失敗: ${e.message}`));
}
