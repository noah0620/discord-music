import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import { commandData } from './commands/definitions.js';
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
dotenv.config({path:path.resolve(__dirname,'../.env')});
const bots=[['Music BOT 1',process.env.DISCORD_TOKEN_1],['Music BOT 2',process.env.DISCORD_TOKEN_2],['Music BOT 3',process.env.DISCORD_TOKEN_3]];
for(const [label,token] of bots){
  if(!token?.trim()){console.log(`⚠️ ${label}: スキップ`);continue;}
  try{
    const rest=new REST({version:'10'}).setToken(token.trim());
    const me=await rest.get(Routes.user('@me'));
    await rest.put(Routes.applicationCommands(String(me.id)),{body:commandData.map(c=>c.toJSON())});
    console.log(`✅ ${label}: コマンド登録完了 (${me.username})`);
  }catch(e){console.error(`❌ ${label}:`,e.message);}
}
