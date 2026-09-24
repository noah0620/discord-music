import 'dotenv/config';
import {startMusicBot} from './music-bot.js';
const bots=[
 ['Music BOT 1',process.env.MUSIC_BOT_TOKEN_1],
 ['Music BOT 2',process.env.MUSIC_BOT_TOKEN_2],
 ['Music BOT 3',process.env.MUSIC_BOT_TOKEN_3]
];
let count=0;
for(const [name,token] of bots){
 if(token?.trim()){startMusicBot(token.trim(),name);count++;}
 else console.warn(`⚠️ ${name}: トークン未設定`);
}
if(!count)throw new Error('.env / Railway Variables に MUSIC_BOT_TOKEN_1～3 を設定してください。');
console.log(`🎵 ${count}台のMusic BOTを起動中...`);
