import {
 Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle
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

 function key(guildId){return guildId;}
 function humans(ch){return ch?.members?.filter(m=>!m.user.bot).size??0;}
 function buttons(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('m:pause').setLabel('⏸ 一時停止').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('m:resume').setLabel('▶ 再開').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('m:skip').setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('m:stop').setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('m:leave').setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
 );}

 // 参照ファイルと同じ youtube-dl-exec 方式。
 // キュー待ちで音声URLが期限切れにならないよう、ここでは動画ページ情報だけ保持する。
 async function resolveTrack(input){
  const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
  const info=await youtubedl(target,{dumpSingleJson:true,noPlaylist:true,skipDownload:true,noWarnings:true});
  const row=Array.isArray(info?.entries)?info.entries[0]:info;
  if(!row)throw new Error('曲が見つかりませんでした。');
  return {
   title:row.title||input,
   url:row.webpage_url||row.original_url||row.url,
   duration:Number(row.duration)||0
  };
 }
 async function freshStreamUrl(pageUrl){
  const stream=await youtubedl(pageUrl,{
   getUrl:true,format:'bestaudio/best',noPlaylist:true,noWarnings:true
  });
  const u=String(stream).trim().split(/\r?\n/).find(x=>/^https?:\/\//.test(x));
  if(!u)throw new Error('音声ストリームURLを取得できませんでした。');
  return u;
 }
 function makeAudio(url,volume){
  const proc=spawn(ffmpegPath,[
   '-hide_banner','-loglevel','warning',
   '-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5',
   '-i',url,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'
  ],{stdio:['ignore','pipe','pipe']});
  proc.stderr.on('data',d=>console.error(`[${label}] ffmpeg: ${String(d).trim()}`));
  const resource=createAudioResource(proc.stdout,{inputType:StreamType.Raw,inlineVolume:true});
  resource.volume?.setVolume((volume??100)/100);
  return {proc,resource};
 }
 function destroy(guildId){
  const s=sessions.get(key(guildId)); if(!s)return;
  s.queue.length=0;
  try{s.ffmpeg?.kill('SIGKILL');}catch{}
  try{s.player.stop(true);}catch{}
  try{s.connection.destroy();}catch{}
  sessions.delete(key(guildId));
 }
 async function next(guildId){
  const s=sessions.get(key(guildId));
  if(!s||s.playing||!s.queue.length)return;
  const track=s.queue.shift();
  try{
   // 再生直前にURLを取り直す（期限切れ対策）
   const streamUrl=await freshStreamUrl(track.url);
   const {proc,resource}=makeAudio(streamUrl,s.volume);
   s.current=track;s.playing=true;s.ffmpeg=proc;
   proc.on('error',e=>console.error(`[${label}] ffmpeg process error`,e));
   s.player.play(resource);
  }catch(e){
   console.error(`[${label}] play error`,e);
   s.current=null;s.playing=false;s.ffmpeg=null;
   setTimeout(()=>next(guildId).catch(console.error),500);
  }
 }
 async function join(guild,vc){
  let s=sessions.get(key(guild.id));
  if(s){
   if(s.channelId!==vc.id)throw new Error('このBOTは別のボイスチャンネルで使用中です。');
   return s;
  }
  // 重要: 3台同時起動時に@discordjs/voiceの接続が衝突しないようBOT IDごとにgroupを分離
  const connection=joinVoiceChannel({
   channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,
   selfDeaf:true,group:`music-${client.user.id}`
  });
  await entersState(connection,VoiceConnectionStatus.Ready,20000);
  const player=createAudioPlayer();
  connection.subscribe(player);
  s={channelId:vc.id,connection,player,queue:[],current:null,playing:false,ffmpeg:null,volume:100};
  sessions.set(key(guild.id),s);
  player.on(AudioPlayerStatus.Idle,()=>{
   try{s.ffmpeg?.kill('SIGKILL');}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;
   next(guild.id).catch(console.error);
  });
  player.on('error',e=>{
   console.error(`[${label}] AudioPlayer`,e);
   try{s.ffmpeg?.kill('SIGKILL');}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;
   next(guild.id).catch(console.error);
  });
  connection.on(VoiceConnectionStatus.Destroyed,()=>sessions.delete(key(guild.id)));
  return s;
 }
 function sameVC(i){
  const s=sessions.get(key(i.guildId));
  return s&&i.member?.voice?.channelId===s.channelId?s:null;
 }
 async function autoLeave(guildId){
  const s=sessions.get(key(guildId));if(!s)return;
  const guild=client.guilds.cache.get(guildId);
  const ch=guild?.channels.cache.get(s.channelId)||await guild?.channels.fetch(s.channelId).catch(()=>null);
  if(!ch||humans(ch)===0){
   console.log(`[${label}] 👋 VCが無人のため自動退出`);
   destroy(guildId);
  }
 }

 client.on(Events.VoiceStateUpdate,(o,n)=>{
  if(sessions.has(key(o.guild.id)))setTimeout(()=>autoLeave(o.guild.id).catch(console.error),1000);
 });
 setInterval(()=>{for(const gid of sessions.keys())autoLeave(gid).catch(console.error)},15000);

 client.once(Events.ClientReady,c=>console.log(`✅ ${label}: ${c.user.tag} / ${c.user.id}`));
 client.on(Events.InteractionCreate,async i=>{
  try{
   if(i.isButton()&&i.customId.startsWith('m:')){
    const s=sameVC(i);
    if(!s)return i.reply({content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
    const a=i.customId.slice(2);
    if(a==='pause'){s.player.pause();return i.reply({content:'⏸ 一時停止しました。',ephemeral:true});}
    if(a==='resume'){s.player.unpause();return i.reply({content:'▶ 再開しました。',ephemeral:true});}
    if(a==='skip'){s.player.stop(true);return i.reply({content:'⏭ スキップしました。',ephemeral:true});}
    if(a==='stop'){s.queue.length=0;s.player.stop(true);return i.reply({content:'⏹ 停止しました。',ephemeral:true});}
    if(a==='leave'){destroy(i.guildId);return i.reply({content:'🚪 退出しました。',ephemeral:true});}
   }
   if(!i.isChatInputCommand())return;
   const n=i.commandName;
   if(n==='play'){
    const vc=i.member?.voice?.channel;
    if(!vc)return i.reply({content:'❌ 先にボイスチャンネルへ参加してください。',ephemeral:true});
    await i.deferReply();
    try{
     const track=await resolveTrack(i.options.getString('query',true));
     const s=await join(i.guild,vc);
     s.queue.push(track);
     await i.editReply({embeds:[new EmbedBuilder().setTitle(`🎵 ${label}`).setDescription(`**${track.title}**\n${track.url}\n\nVC: <#${vc.id}>`)],components:[buttons()]});
     if(!s.playing)next(i.guildId).catch(console.error);
    }catch(e){await i.editReply(`❌ 再生準備に失敗しました。\n${String(e.message||e).slice(0,1200)}`);}
    return;
   }
   if(n==='leave'){
    const s=sameVC(i);if(!s)return i.reply({content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
    destroy(i.guildId);return i.reply('🚪 退出しました。');
   }
   const s=sameVC(i);
   if(!s)return i.reply({content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
   if(n==='queue')return i.reply([s.current&&`▶️ **${s.current.title}**`,...s.queue.map((x,j)=>`${j+1}. ${x.title}`)].filter(Boolean).join('\n')||'キューは空です。');
   if(n==='skip'){s.player.stop(true);return i.reply('⏭ スキップしました。');}
   if(n==='stop'){s.queue.length=0;s.player.stop(true);return i.reply('⏹ 停止しました。');}
   if(n==='pause'){s.player.pause();return i.reply('⏸ 一時停止しました。');}
   if(n==='resume'){s.player.unpause();return i.reply('▶ 再開しました。');}
   if(n==='nowplaying')return i.reply(s.current?`🎵 **${s.current.title}**\n${s.current.url}`:'現在再生していません。');
   if(n==='volume'){
    s.volume=i.options.getInteger('percent',true);
    s.player.state.resource?.volume?.setVolume(s.volume/100);
    return i.reply(`🔊 音量を ${s.volume}% に変更しました。`);
   }
  }catch(e){
   console.error(`[${label}]`,e);
   const msg={content:`❌ エラー: ${String(e.message||e).slice(0,1200)}`,ephemeral:true};
   if(i.replied||i.deferred)await i.followUp(msg).catch(()=>{});else await i.reply(msg).catch(()=>{});
  }
 });
 client.login(token).catch(e=>console.error(`❌ ${label} ログイン失敗: ${e.message}`));
 return client;
}
