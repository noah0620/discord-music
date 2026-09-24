import 'dotenv/config';
import {
 Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags
} from 'discord.js';
import {Kazagumo} from 'kazagumo';
import {Connectors} from 'shoukaku';

const token=process.env.DISCORD_TOKEN?.trim();
if(!token) throw new Error('DISCORD_TOKEN が設定されていません。');

const host=process.env.LAVALINK_HOST||'127.0.0.1';
const port=Number(process.env.LAVALINK_PORT||2333);
const auth=process.env.LAVALINK_PASSWORD||'change-me';
const secure=String(process.env.LAVALINK_SECURE||'false').toLowerCase()==='true';

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});
const nodes=[{name:'main',url:`${host}:${port}`,auth,secure}];

const music=new Kazagumo({
 defaultSearchEngine:'youtube',
 send:(guildId,payload)=>{
  const guild=client.guilds.cache.get(guildId);
  if(guild) guild.shard.send(payload);
 }
},new Connectors.DiscordJS(client),nodes);

const panelMessages=new Map();
const emptyTimers=new Map();

const eph=content=>({content,flags:MessageFlags.Ephemeral});
async function safe(i,p){
 try{
  if(i.deferred||i.replied) return await i.followUp(p);
  return await i.reply(p);
 }catch(e){
  if(e?.code===40060||e?.code===10062){console.warn(`Interaction ${e.code} ignored`);return;}
  throw e;
 }
}
function fmt(ms=0){
 const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;
 return `${m}:${String(s).padStart(2,'0')}`;
}
function buttons(player){
 const paused=!!player?.paused;
 return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(paused?'music:resume':'music:pause').setLabel(paused?'▶ 再開':'⏸ 一時停止').setStyle(paused?ButtonStyle.Success:ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('music:shuffle').setLabel('🔀 シャッフル').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('music:leave').setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
 );
}
function embed(player,track){
 const q=player?.queue?.length??0;
 const uri=track?.uri||track?.realUri||'';
 const author=track?.author?`\nアーティスト: **${track.author}**`:'';
 return new EmbedBuilder()
  .setTitle(`🎵 ${client.user.username}`)
  .setDescription(`**${track?.title||'再生中'}**${author}${uri?`\n${uri}`:''}\n\nVC: 🔊 <#${player.voiceId}>\nキュー: **${q}曲** | 音量: **${player.volume??100}%**`)
  .setFooter({text:'Jockie Music風・Lavalink再生エンジン'});
}
async function updatePanel(player,track){
 const ch=client.channels.cache.get(player.textId);
 if(!ch?.isTextBased()) return;
 const old=panelMessages.get(player.guildId);
 const payload={embeds:[embed(player,track||player.queue.current)],components:[buttons(player)]};
 try{
  if(old){
   const msg=await ch.messages.fetch(old).catch(()=>null);
   if(msg){await msg.edit(payload);return;}
  }
  const msg=await ch.send(payload);
  panelMessages.set(player.guildId,msg.id);
 }catch(e){console.error('panel:',e);}
}
async function searchWithFallback(query,user){
 // URLはそのまま。曲名検索はYouTube→SoundCloudの順に試す。
 const isUrl=/^https?:\/\//i.test(query);
 if(isUrl) return music.search(query,{requester:user});
 let r=await music.search(query,{requester:user,source:'ytsearch:'}).catch(()=>null);
 if(r?.tracks?.length) return r;
 console.warn('YouTube search failed/empty. Trying SoundCloud...');
 r=await music.search(query,{requester:user,source:'scsearch:'}).catch(()=>null);
 return r;
}
function playerFor(i){
 const p=music.players.get(i.guildId);
 if(!p) return null;
 if(i.member?.voice?.channelId!==p.voiceId) return null;
 return p;
}
function destroyPlayer(gid){
 clearTimeout(emptyTimers.get(gid)); emptyTimers.delete(gid);
 panelMessages.delete(gid);
 const p=music.players.get(gid);
 if(p) p.destroy();
}
function scheduleEmptyCheck(guildId){
 clearTimeout(emptyTimers.get(guildId));
 const timer=setTimeout(()=>{
  const p=music.players.get(guildId); if(!p)return;
  const guild=client.guilds.cache.get(guildId);
  const ch=guild?.channels.cache.get(p.voiceId);
  const humans=ch?.members?.filter(m=>!m.user.bot).size??0;
  if(humans===0){
   console.log(`👋 ${guild?.name||guildId}: VC無人のため自動退出`);
   destroyPlayer(guildId);
  }
 },3000);
 emptyTimers.set(guildId,timer);
}

music.shoukaku.on('ready',name=>console.log(`✅ Lavalink ${name}: Ready`));
music.shoukaku.on('error',(name,e)=>console.error(`❌ Lavalink ${name}:`,e));
music.shoukaku.on('close',(name,code,reason)=>console.warn(`Lavalink ${name} closed ${code}: ${reason||''}`));

music.on('playerStart',(player,track)=>updatePanel(player,track));
music.on('playerEnd',(player)=>updatePanel(player,player.queue.current).catch(()=>{}));
music.on('playerEmpty',player=>{
 const ch=client.channels.cache.get(player.textId);
 ch?.send('✅ キューの再生が終了しました。').catch(()=>{});
});
music.on('playerDestroy',player=>{
 panelMessages.delete(player.guildId);
 clearTimeout(emptyTimers.get(player.guildId));
 emptyTimers.delete(player.guildId);
});

client.once(Events.ClientReady,c=>console.log(`✅ Music BOT 起動: ${c.user.tag}`));
client.on(Events.VoiceStateUpdate,(oldState,newState)=>{
 const gid=oldState.guild.id;
 const p=music.players.get(gid); if(!p)return;
 if(oldState.channelId===p.voiceId||newState.channelId===p.voiceId) scheduleEmptyCheck(gid);
});
client.on('error',e=>console.error('Discord client:',e));

client.on(Events.InteractionCreate,async i=>{
 try{
  if(i.isButton()){
   if(!i.customId.startsWith('music:'))return;
   const p=playerFor(i);
   if(!p)return safe(i,eph('❌ BOTと同じボイスチャンネルに参加してください。'));
   const a=i.customId.split(':')[1];
   if(a==='pause'){await p.pause(true);await updatePanel(p,p.queue.current);return safe(i,eph('⏸ 一時停止しました。'));}
   if(a==='resume'){await p.pause(false);await updatePanel(p,p.queue.current);return safe(i,eph('▶ 再開しました。'));}
   if(a==='skip'){await p.skip();return safe(i,eph('⏭ スキップしました。'));}
   if(a==='shuffle'){p.queue.shuffle();await updatePanel(p,p.queue.current);return safe(i,eph('🔀 キューをシャッフルしました。'));}
   if(a==='stop'){p.queue.clear();await p.skip();return safe(i,eph('⏹ 停止しました。'));}
   if(a==='leave'){destroyPlayer(i.guildId);return safe(i,eph('🚪 退出しました。'));}
   return;
  }
  if(!i.isChatInputCommand())return;

  // Discordの3秒制限対策。重い検索より先に必ずACKする。
  await i.deferReply().catch(e=>{
   if(e?.code!==40060&&e?.code!==10062)throw e;
  });

  if(i.commandName==='play'){
   const vc=i.member?.voice?.channel;
   if(!vc)return i.editReply('❌ 先にボイスチャンネルへ参加してください。');
   let p=music.players.get(i.guildId);
   if(p&&p.voiceId!==vc.id)return i.editReply('❌ このBOTは別のボイスチャンネルで再生中です。');
   if(!p){
    p=await music.createPlayer({
     guildId:i.guildId,textId:i.channelId,voiceId:vc.id,volume:70,deaf:true
    });
   }
   const query=i.options.getString('query',true);
   const result=await searchWithFallback(query,i.user);
   if(!result?.tracks?.length)return i.editReply('❌ 曲が見つかりませんでした。YouTubeが拒否された場合はSoundCloud検索も試しました。');

   if(result.type==='PLAYLIST'){
    p.queue.add(result.tracks);
    if(!p.playing&&!p.paused)await p.play();
    await updatePanel(p,p.queue.current||result.tracks[0]);
    return i.editReply(`📚 **${result.playlistName||'プレイリスト'}** を ${result.tracks.length}曲キューへ追加しました。`);
   }
   const track=result.tracks[0];
   p.queue.add(track);
   if(!p.playing&&!p.paused)await p.play();
   await updatePanel(p,p.queue.current||track);
   return i.editReply(p.queue.length?`➕ **${track.title}** をキューへ追加しました。`:`▶ **${track.title}** を再生します。`);
  }

  const p=playerFor(i);
  if(!p)return i.editReply('❌ BOTと同じボイスチャンネルに参加してください。');

  if(i.commandName==='pause'){await p.pause(true);await updatePanel(p,p.queue.current);return i.editReply('⏸ 一時停止しました。');}
  if(i.commandName==='resume'){await p.pause(false);await updatePanel(p,p.queue.current);return i.editReply('▶ 再開しました。');}
  if(i.commandName==='skip'){await p.skip();return i.editReply('⏭ スキップしました。');}
  if(i.commandName==='stop'){p.queue.clear();await p.skip();return i.editReply('⏹ 停止してキューを消去しました。');}
  if(i.commandName==='shuffle'){p.queue.shuffle();await updatePanel(p,p.queue.current);return i.editReply('🔀 シャッフルしました。');}
  if(i.commandName==='volume'){
   const v=i.options.getInteger('percent',true);await p.setVolume(v);await updatePanel(p,p.queue.current);
   return i.editReply(`🔊 音量を ${v}% に変更しました。`);
  }
  if(i.commandName==='loop'){
   const mode=i.options.getString('mode',true);
   p.setLoop(mode);
   return i.editReply(`🔁 ループ: **${mode==='none'?'OFF':mode==='track'?'1曲':'キュー'}**`);
  }
  if(i.commandName==='queue'){
   const current=p.queue.current;
   const list=[current&&`▶ **${current.title}**`,...p.queue.slice(0,10).map((t,n)=>`${n+1}. ${t.title}`)].filter(Boolean);
   return i.editReply(list.join('\n')||'キューは空です。');
  }
  if(i.commandName==='nowplaying'){
   const t=p.queue.current;
   return i.editReply(t?`🎵 **${t.title}** — ${t.author||'Unknown'}\n${t.uri||''}`:'現在再生していません。');
  }
  if(i.commandName==='leave'){destroyPlayer(i.guildId);return i.editReply('🚪 ボイスチャンネルから退出しました。');}
 }catch(e){
  console.error('Interaction:',e);
  const msg=`❌ 処理に失敗しました。\n${String(e?.message||e).slice(0,1200)}`;
  if(i.deferred||i.replied)await i.editReply(msg).catch(()=>{});
  else await safe(i,eph(msg)).catch(()=>{});
 }
});

client.login(token);
