import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token=process.env.DISCORD_TOKEN?.trim();
if(!token) throw new Error('DISCORD_TOKEN が設定されていません。');

const commands=[
  new SlashCommandBuilder().setName('play').setDescription('曲名またはURLから音楽を再生')
    .addStringOption(o=>o.setName('query').setDescription('曲名 / YouTube URL').setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('再生キューを表示'),
  new SlashCommandBuilder().setName('skip').setDescription('現在の曲をスキップ'),
  new SlashCommandBuilder().setName('stop').setDescription('再生を停止'),
  new SlashCommandBuilder().setName('pause').setDescription('一時停止'),
  new SlashCommandBuilder().setName('resume').setDescription('再生を再開'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('現在再生中の曲を表示'),
  new SlashCommandBuilder().setName('volume').setDescription('音量を変更')
    .addIntegerOption(o=>o.setName('percent').setDescription('1～200').setMinValue(1).setMaxValue(200).setRequired(true)),
  new SlashCommandBuilder().setName('leave').setDescription('BOTをボイスチャンネルから退出')
];

const rest=new REST({version:'10'}).setToken(token);
const me=await rest.get(Routes.user('@me'));
await rest.put(Routes.applicationCommands(me.id),{body:commands.map(c=>c.toJSON())});
console.log(`✅ ${me.username}: 音楽コマンド ${commands.length}個を登録しました。`);
