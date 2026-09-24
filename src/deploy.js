import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token=process.env.DISCORD_TOKEN?.trim();
if(!token) throw new Error('DISCORD_TOKEN がありません。');

const commands=[
 new SlashCommandBuilder().setName('play').setDescription('曲名・URLを再生/キュー追加')
  .addStringOption(o=>o.setName('query').setDescription('曲名 / YouTube・SoundCloud等のURL').setRequired(true)),
 new SlashCommandBuilder().setName('pause').setDescription('一時停止'),
 new SlashCommandBuilder().setName('resume').setDescription('再開'),
 new SlashCommandBuilder().setName('skip').setDescription('スキップ'),
 new SlashCommandBuilder().setName('stop').setDescription('停止してキューを消去'),
 new SlashCommandBuilder().setName('queue').setDescription('キューを表示'),
 new SlashCommandBuilder().setName('nowplaying').setDescription('現在の曲を表示'),
 new SlashCommandBuilder().setName('volume').setDescription('音量変更')
  .addIntegerOption(o=>o.setName('percent').setDescription('1～150').setMinValue(1).setMaxValue(150).setRequired(true)),
 new SlashCommandBuilder().setName('loop').setDescription('ループ設定')
  .addStringOption(o=>o.setName('mode').setDescription('ループモード').setRequired(true)
   .addChoices({name:'OFF',value:'none'},{name:'1曲',value:'track'},{name:'キュー',value:'queue'})),
 new SlashCommandBuilder().setName('shuffle').setDescription('キューをシャッフル'),
 new SlashCommandBuilder().setName('leave').setDescription('VCから退出')
];

const rest=new REST({version:'10'}).setToken(token);
const me=await rest.get(Routes.user('@me'));
await rest.put(Routes.applicationCommands(me.id),{body:commands.map(x=>x.toJSON())});
console.log(`✅ ${me.username}: ${commands.length}個の音楽コマンドを登録しました。`);
