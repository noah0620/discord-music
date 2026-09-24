import { REST, Routes } from 'discord.js';
import { config, assertConfig } from './config.js';
assertConfig();
const rest=new REST({version:'10'}).setToken(config.token);
const me=await rest.get(Routes.user('@me'));
await rest.put(Routes.applicationCommands(String(me.id)),{body:[]});
console.log('✅ グローバルコマンドを削除しました。');
