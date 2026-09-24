import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags
} from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  StreamType, VoiceConnectionStatus, entersState
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import youtubedl from 'youtube-dl-exec';

const token=process.env.DISCORD_TOKEN?.trim();
if(!token) throw new Error('DISCORD_TOKEN が設定されていません。');

const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]
});
const sessions=new Map();

const ephemeral=content=>({content,flags:MessageFlags.Ephemeral});

async function safeReply(i,payload){
  try{
    if(i.deferred||i.replied) return await i.followUp(payload);
    return await i.reply(payload);
  }catch(e){
    if(e?.code===40060||e?.code===10062){
      console.warn(`Interaction ${e.code} を安全に無視しました`);
      return;
    }
    throw e;
  }
}

function humanCount(channel){
  return channel?.members?.filter(m=>!m.user.bot).size??0;
}

function panel(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:pause').setLabel('⏸ 一時停止').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:resume').setLabel('▶ 再開').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music:leave').setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
  );
}

// 参照MultiBotの youtube-dl-exec 検索方式を維持。
// ここではページURLだけ保存し、音声URLは再生直前に取り直す。
async function resolveTrack(input){
  const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
  const info=await youtubedl(target,{
    dumpSingleJson:true,noPlaylist:true,skipDownload:true,noWarnings:true,
    extractorArgs:'youtube:player_client=android,web'
  });
  const row=Array.isArray(info?.entries)?info.entries[0]:info;
  if(!row) throw new Error('曲が見つかりませんでした。');
  const url=row.webpage_url||row.original_url||row.url;
  if(!url) throw new Error('動画URLを取得できませんでした。');
  return {title:row.title||input,url,duration:Number(row.duration)||0};
}

async function getFreshStreamUrl(pageUrl){
  const stream=await youtubedl(pageUrl,{
    getUrl:true,format:'bestaudio/best',noPlaylist:true,noWarnings:true,
    extractorArgs:'youtube:player_client=android,web'
  });
  const url=String(stream).trim().split(/\r?\n/).find(x=>/^https?:\/\//.test(x));
  if(!url) throw new Error('音声ストリームURLを取得できませんでした。');
  return url;
}

// 参照版のFFmpegパイプ方式 + reconnectを追加。
function createFfmpegAudio(url,volume){
  const proc=spawn(ffmpegPath,[
    '-hide_banner','-loglevel','error',
    '-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5',
    '-i',url,'-vn',
    '-f','s16le','-ar','48000','-ac','2','pipe:1'
  ],{stdio:['ignore','pipe','pipe']});

  proc.stderr?.on('data',d=>console.error(`ffmpeg: ${String(d).trim()}`));
  proc.on('error',e=>console.error('ffmpeg process error:',e));

  const resource=createAudioResource(proc.stdout,{
    inputType:StreamType.Raw,inlineVolume:true
  });
  resource.volume?.setVolume((volume??100)/100);
  return {proc,resource};
}

function destroySession(guildId){
  const s=sessions.get(guildId);
  if(!s) return;
  s.queue.length=0;
  try{s.ffmpeg?.kill();}catch{}
  try{s.player.stop(true);}catch{}
  try{s.connection.destroy();}catch{}
  sessions.delete(guildId);
}

async function playNext(guildId){
  const s=sessions.get(guildId);
  if(!s||s.playing||!s.queue.length) return false;

  const track=s.queue.shift();
  try{
    // キュー待ちでYouTubeの一時URLが期限切れにならないよう再生直前に取得。
    const directUrl=await getFreshStreamUrl(track.url);
    const {proc,resource}=createFfmpegAudio(directUrl,s.volume);

    s.current=track;
    s.playing=true;
    s.ffmpeg=proc;
    s.player.play(resource);
    return true;
  }catch(e){
    s.current=null;
    s.playing=false;
    s.ffmpeg=null;
    console.error('playNext:',e);
    throw e;
  }
}

async function getSession(guild,voiceChannel){
  let s=sessions.get(guild.id);
  if(s){
    if(s.channelId!==voiceChannel.id)
      throw new Error('BOTは別のボイスチャンネルで使用中です。');
    return s;
  }

  const connection=joinVoiceChannel({
    channelId:voiceChannel.id,
    guildId:guild.id,
    adapterCreator:guild.voiceAdapterCreator,
    selfDeaf:true
  });

  // VC接続完了前に再生を開始しない。
  await entersState(connection,VoiceConnectionStatus.Ready,20000);

  const player=createAudioPlayer();
  connection.subscribe(player);

  s={
    channelId:voiceChannel.id,connection,player,
    queue:[],playing:false,current:null,volume:100,ffmpeg:null
  };
  sessions.set(guild.id,s);

  player.on(AudioPlayerStatus.Idle,()=>{
    try{s.ffmpeg?.kill();}catch{}
    s.ffmpeg=null;
    s.playing=false;
    s.current=null;
    playNext(guild.id).catch(e=>console.error('次曲の再生失敗:',e));
  });

  player.on('error',e=>{
    console.error('AudioPlayer error:',e);
    try{s.ffmpeg?.kill();}catch{}
    s.ffmpeg=null;
    s.playing=false;
    s.current=null;
    playNext(guild.id).catch(()=>{});
  });

  connection.on(VoiceConnectionStatus.Disconnected,async()=>{
    try{
      await Promise.race([
        entersState(connection,VoiceConnectionStatus.Signalling,5000),
        entersState(connection,VoiceConnectionStatus.Connecting,5000)
      ]);
    }catch{
      destroySession(guild.id);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed,()=>sessions.delete(guild.id));
  return s;
}

function sessionFor(i){
  const s=sessions.get(i.guildId);
  return s&&i.member?.voice?.channelId===s.channelId?s:null;
}

async function autoLeave(guildId){
  const s=sessions.get(guildId);
  if(!s) return;
  const guild=client.guilds.cache.get(guildId);
  const channel=guild?.channels.cache.get(s.channelId)
    ?? await guild?.channels.fetch(s.channelId).catch(()=>null);

  if(!channel||humanCount(channel)===0){
    console.log(`👋 ${guild?.name??guildId}: 人がいないため自動退出`);
    destroySession(guildId);
  }
}

client.on(Events.VoiceStateUpdate,state=>{
  if(sessions.has(state.guild.id))
    setTimeout(()=>autoLeave(state.guild.id).catch(console.error),1000);
});

// VoiceStateUpdate取りこぼし対策。
setInterval(()=>{
  for(const guildId of sessions.keys()) autoLeave(guildId).catch(console.error);
},15000);

client.once(Events.ClientReady,c=>{
  console.log(`✅ 音楽再生専用BOT 起動: ${c.user.tag}`);
});

client.on('error',e=>console.error('Discord Client error:',e));

client.on(Events.InteractionCreate,async i=>{
  try{
    if(i.isButton()){
      if(!i.customId.startsWith('music:')) return;
      const s=sessionFor(i);
      if(!s) return safeReply(i,ephemeral('❌ BOTと同じボイスチャンネルに参加してください。'));

      const action=i.customId.split(':')[1];
      if(action==='pause'){
        s.player.pause();
        return safeReply(i,ephemeral('⏸ 一時停止しました。'));
      }
      if(action==='resume'){
        s.player.unpause();
        return safeReply(i,ephemeral('▶ 再開しました。'));
      }
      if(action==='skip'){
        s.player.stop(true);
        return safeReply(i,ephemeral('⏭ スキップしました。'));
      }
      if(action==='stop'){
        s.queue.length=0;
        s.player.stop(true);
        return safeReply(i,ephemeral('⏹ 再生を停止しました。'));
      }
      if(action==='leave'){
        destroySession(i.guildId);
        return safeReply(i,ephemeral('🚪 ボイスチャンネルから退出しました。'));
      }
      return;
    }

    if(!i.isChatInputCommand()) return;
    const name=i.commandName;

    if(name==='play'){
      // DiscordはInteractionへの初回応答を約3秒以内に要求するため、
      // YouTube検索やVC接続より先に必ずdeferする。
      try{
        if(!i.deferred&&!i.replied) await i.deferReply();
      }catch(e){
        // 同じBOTをRailwayとPCなど2か所で同時起動すると、片方が先に応答して
        // 10062/40060になる。ここではプロセスを落とさない。
        if(e?.code===10062||e?.code===40060){
          console.warn(`⚠️ /play Interaction ${e.code}: 同一BOTの二重起動を確認してください。`);
          return;
        }
        throw e;
      }

      const vc=i.member?.voice?.channel;
      if(!vc) return i.editReply('❌ 先にボイスチャンネルへ参加してください。');

      try{
        const track=await resolveTrack(i.options.getString('query',true));
        const s=await getSession(i.guild,vc);
        s.queue.push(track);
        if(!s.playing) await playNext(i.guildId);

        return await i.editReply({
          embeds:[
            new EmbedBuilder()
              .setTitle(`🎵 ${client.user.username}`)
              .setDescription(`**${track.title}**\n${track.url}\n\nVC: 🔊 <#${vc.id}>`)
          ],
          components:[panel()]
        });
      }catch(e){
        console.error('/play:',e);
        const raw=String(e?.stderr||e?.message||e);
        const youtubeBlocked=/Sign in to confirm you.re not a bot|cookies-from-browser|authentication/i.test(raw);
        const msg=youtubeBlocked
          ? '❌ YouTube側で音声取得が拒否されました。BOT自体は正常です。Railway等のサーバーIPではYouTubeの自動判定で取得できない場合があります。別のYouTube URLでも同じ場合は、実行環境側の制限です。'
          : `❌ 再生に失敗しました。\n${raw.slice(0,1200)}`;
        return i.editReply(msg).catch(()=>{});
      }
    }

    if(name==='leave'){
      const s=sessionFor(i);
      if(!s) return safeReply(i,ephemeral('❌ BOTと同じVCに参加してください。'));
      destroySession(i.guildId);
      return safeReply(i,'🚪 ボイスチャンネルから退出しました。');
    }

    const s=sessionFor(i);
    if(!s) return safeReply(i,ephemeral('❌ このVCでは再生していません。'));

    if(name==='queue'){
      const lines=[];
      if(s.current) lines.push(`▶️ **${s.current.title}**`);
      if(s.queue.length) lines.push(...s.queue.map((x,n)=>`${n+1}. ${x.title}`));
      return safeReply(i,lines.join('\n')||'キューは空です。');
    }
    if(name==='skip'){
      s.player.stop(true);
      return safeReply(i,'⏭ スキップしました。');
    }
    if(name==='stop'){
      s.queue.length=0;
      s.player.stop(true);
      return safeReply(i,'⏹ 再生を停止しました。');
    }
    if(name==='pause'){
      s.player.pause();
      return safeReply(i,'⏸ 一時停止しました。');
    }
    if(name==='resume'){
      s.player.unpause();
      return safeReply(i,'▶ 再開しました。');
    }
    if(name==='nowplaying'){
      return safeReply(i,s.current
        ?`🎵 **${s.current.title}**\n${s.current.url}`
        :'現在再生していません。');
    }
    if(name==='volume'){
      const v=i.options.getInteger('percent',true);
      s.volume=v;
      s.player.state.resource?.volume?.setVolume(v/100);
      return safeReply(i,`🔊 音量を ${v}% に変更しました。`);
    }
  }catch(e){
    console.error('Interaction error:',e);
    await safeReply(i,ephemeral(`❌ エラー: ${String(e.message||e).slice(0,1000)}`)).catch(()=>{});
  }
});

client.login(token);
