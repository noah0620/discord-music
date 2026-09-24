import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicBot } from './music-bot.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
dotenv.config({path:path.resolve(__dirname,'../.env')});

const bots=[
  {label:'Music BOT 1',token:process.env.DISCORD_TOKEN_1},
  {label:'Music BOT 2',token:process.env.DISCORD_TOKEN_2},
  {label:'Music BOT 3',token:process.env.DISCORD_TOKEN_3}
];
let started=0;
for(const bot of bots){
  if(!bot.token?.trim()){ console.error(`❌ ${bot.label}: トークン未設定`); continue; }
  createMusicBot({label:bot.label,token:bot.token.trim()});
  started++;
}
if(!started) throw new Error('.env に DISCORD_TOKEN_1～3 を設定してください。');
console.log(`🎵 ${started}台のMusic BOTを起動します...`);
