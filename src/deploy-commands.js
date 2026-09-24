import { REST, Routes } from 'discord.js';
import { config, assertConfig } from './config.js';
import { commandData } from './commands/definitions.js';
assertConfig();
const rest=new REST({version:'10'}).setToken(config.token);
const me=await rest.get(Routes.user('@me'));
await rest.put(Routes.applicationCommands(String(me.id)),{body:commandData.map(c=>c.toJSON())});
console.log(`✅ ${commandData.length}個の音楽コマンドを登録しました: ${me.username} (${me.id})`);
