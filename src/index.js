import {
  Client, GatewayIntentBits, Events, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, StreamType, VoiceConnectionStatus
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import youtubedl from 'youtube-dl-exec';
import { config, assertConfig } from './config.js';

assertConfig();

const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]
});
const sessions=new Map(); // guildId -> session

function validHttpUrl(v){
  try{const u=new URL(v);return u.protocol==='http:'||u.protocol==='https:';}catch{return false;}
}
function humanCount(channel){
  return channel?.members?.filter(m=>!m.user.bot).size ?? 0;
}
function controls(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:pause').setLabel('⏸ 一時停止').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:resume').setLabel('▶ 再開').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music:leave').setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
  );
}
async function resolveTrack(input){
  const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
  const info=await youtubedl(target,{dumpSingleJson:true,noPlaylist:true,skipDownload:true,noWarnings:true});
  const row=Array.isArray(info?.entries)?info.entries[0]:info;
  if(!row) throw new Error('曲が見つかりませんでした。');
  const page=row.webpage_url||row.original_url||row.url;
  const title=row.title||input;
  const direct=await youtubedl(page,{getUrl:true,format:'bestaudio/best',noPlaylist:true,noWarnings:true});
  const streamUrl=String(direct).trim().split(/\r?\n/).find(x=>/^https?:\/\//.test(x));
  if(!streamUrl) throw new Error('音声URLを取得できませんでした。');
  return {title,url:page,streamUrl};
}
function audioResource(url,volume){
  if(!validHttpUrl(url)) throw new Error('再生URLが不正です。');
  const proc=spawn(ffmpegPath,[
    '-hide_banner','-loglevel','error','-reconnect','1','-reconnect_streamed','1',
    '-reconnect_delay_max','5','-i',url,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'
  ],{stdio:['ignore','pipe','pipe']});
  proc.stderr.on('data',d=>console.error('ffmpeg:',String(d).trim()));
  const resource=createAudioResource(proc.stdout,{inputType:StreamType.Raw,inlineVolume:true});
  resource.volume?.setVolume(volume/100);
  return {proc,resource};
}
function destroySession(guildId){
  const s=sessions.get(guildId);
  if(!s)return;
  s.queue.length=0;
  try{s.ffmpeg?.kill();}catch{}
  try{s.player.stop(true);}catch{}
  try{s.connection.destroy();}catch{}
  sessions.delete(guildId);
}
async function playNext(guildId){
  const s=sessions.get(guildId);
  if(!s||s.playing)return;
  const track=s.queue.shift();
  if(!track)return;
  try{
    const {proc,resource}=audioResource(track.streamUrl,s.volume);
    s.current=track;s.ffmpeg=proc;s.playing=true;
    proc.on('error',e=>console.error('ffmpeg process error:',e));
    s.player.play(resource);
  }catch(e){
    console.error('playNext:',e);
    s.playing=false;s.current=null;s.ffmpeg=null;
    await playNext(guildId);
  }
}
function createSession(guild,channel){
  let s=sessions.get(guild.id);
  if(s){
    if(s.channelId!==channel.id) throw new Error('BOTは別のボイスチャンネルで使用中です。');
    return s;
  }
  const connection=joinVoiceChannel({
    channelId:channel.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true
  });
  const player=createAudioPlayer();
  connection.subscribe(player);
  s={guildId:guild.id,channelId:channel.id,connection,player,queue:[],current:null,playing:false,ffmpeg:null,volume:100};
  player.on(AudioPlayerStatus.Idle,()=>{
    try{s.ffmpeg?.kill();}catch{}
    s.ffmpeg=null;s.current=null;s.playing=false;
    playNext(guild.id).catch(console.error);
  });
  player.on('error',e=>{
    console.error('AudioPlayer:',e);
    try{s.ffmpeg?.kill();}catch{}
    s.ffmpeg=null;s.current=null;s.playing=false;
    playNext(guild.id).catch(console.error);
  });
  connection.on(VoiceConnectionStatus.Destroyed,()=>sessions.delete(guild.id));
  sessions.set(guild.id,s);
  return s;
}
function sessionFor(interaction){
  const s=sessions.get(interaction.guildId);
  return s && interaction.member?.voice?.channelId===s.channelId ? s : null;
}

// 誰もいなくなったら即座に自動退出。
// VoiceStateUpdateに加えて定期チェックも行い、取りこぼしを防止する。
async function autoLeaveGuild(guildId){
  const s=sessions.get(guildId);
  if(!s)return;
  const guild=client.guilds.cache.get(guildId);
  const channel=guild?.channels.cache.get(s.channelId) ?? await guild?.channels.fetch(s.channelId).catch(()=>null);
  if(!channel || humanCount(channel)===0){
    console.log(`👋 自動退出: ${guild?.name??guildId} / ${channel?.name??s.channelId}`);
    destroySession(guildId);
  }
}
client.on(Events.VoiceStateUpdate,(oldState,newState)=>{
  const guildId=oldState.guild.id;
  if(sessions.has(guildId)) setTimeout(()=>autoLeaveGuild(guildId).catch(console.error),1000);
});
setInterval(()=>{
  for(const guildId of sessions.keys()) autoLeaveGuild(guildId).catch(console.error);
},15000);

client.once(Events.ClientReady,c=>console.log(`✅ 音楽BOT起動: ${c.user.tag}`));

client.on(Events.InteractionCreate,async interaction=>{
  try{
    if(interaction.isButton()){
      if(!interaction.customId.startsWith('music:'))return;
      const s=sessionFor(interaction);
      if(!s)return interaction.reply({content:'❌ BOTと同じボイスチャンネルに参加してください。',ephemeral:true});
      const a=interaction.customId.split(':')[1];
      if(a==='pause'){s.player.pause();return interaction.reply({content:'⏸ 一時停止しました。',ephemeral:true});}
      if(a==='resume'){s.player.unpause();return interaction.reply({content:'▶ 再開しました。',ephemeral:true});}
      if(a==='skip'){s.player.stop(true);return interaction.reply({content:'⏭ スキップしました。',ephemeral:true});}
      if(a==='stop'){s.queue.length=0;s.player.stop(true);return interaction.reply({content:'⏹ 再生を停止しました。',ephemeral:true});}
      if(a==='leave'){destroySession(interaction.guildId);return interaction.reply({content:'🚪 ボイスチャンネルから退出しました。',ephemeral:true});}
    }
    if(!interaction.isChatInputCommand())return;
    const n=interaction.commandName;
    if(n==='play'){
      const vc=interaction.member?.voice?.channel;
      if(!vc)return interaction.reply({content:'❌ 先にボイスチャンネルへ参加してください。',ephemeral:true});
      await interaction.deferReply();
      try{
        const track=await resolveTrack(interaction.options.getString('query',true));
        const s=createSession(interaction.guild,vc);
        s.queue.push(track);
        await interaction.editReply({
          embeds:[new EmbedBuilder().setTitle('🎵 Music Player').setDescription(`**${track.title}**\n${track.url}\n\nVC: <#${vc.id}>`)],
          components:[controls()]
        });
        if(!s.playing)await playNext(interaction.guildId);
      }catch(e){await interaction.editReply(`❌ 再生準備に失敗しました。\n${String(e.message||e).slice(0,1000)}`);}
      return;
    }
    const s=sessionFor(interaction);
    if(n==='leave'){
      const existing=sessions.get(interaction.guildId);
      if(!existing)return interaction.reply({content:'BOTはボイスチャンネルに参加していません。',ephemeral:true});
      if(interaction.member?.voice?.channelId!==existing.channelId)return interaction.reply({content:'❌ BOTと同じボイスチャンネルに参加してください。',ephemeral:true});
      destroySession(interaction.guildId);return interaction.reply('🚪 ボイスチャンネルから退出しました。');
    }
    if(!s)return interaction.reply({content:'❌ BOTと同じボイスチャンネルに参加してください。',ephemeral:true});
    if(n==='queue'){
      const lines=[];if(s.current)lines.push(`▶️ **${s.current.title}**`);
      if(s.queue.length)lines.push(...s.queue.map((x,i)=>`${i+1}. ${x.title}`));
      return interaction.reply(lines.join('\n')||'キューは空です。');
    }
    if(n==='skip'){s.player.stop(true);return interaction.reply('⏭ スキップしました。');}
    if(n==='stop'){s.queue.length=0;s.player.stop(true);return interaction.reply('⏹ 再生を停止しました。');}
    if(n==='pause'){s.player.pause();return interaction.reply('⏸ 一時停止しました。');}
    if(n==='resume'){s.player.unpause();return interaction.reply('▶ 再開しました。');}
    if(n==='nowplaying')return interaction.reply(s.current?`🎵 **${s.current.title}**\n${s.current.url}`:'現在再生していません。');
    if(n==='volume'){
      s.volume=interaction.options.getInteger('percent',true);
      const r=s.player.state?.resource;r?.volume?.setVolume(s.volume/100);
      return interaction.reply(`🔊 音量を ${s.volume}% に変更しました。`);
    }
  }catch(e){
    console.error(e);
    const msg={content:`❌ エラー: ${String(e.message||e).slice(0,1000)}`,ephemeral:true};
    if(interaction.deferred||interaction.replied) await interaction.followUp(msg).catch(()=>{});
    else await interaction.reply(msg).catch(()=>{});
  }
});

client.login(config.token);
