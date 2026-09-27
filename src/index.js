import dotenv from 'dotenv';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startMusicBot} from './music-bot.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
dotenv.config({path:path.resolve(__dirname,'../.env')});
const bots=[
 ['Music BOT 1',process.env.MUSIC_BOT_TOKEN_1],
 ['Music BOT 2',process.env.MUSIC_BOT_TOKEN_2],
 ['Music BOT 3',process.env.MUSIC_BOT_TOKEN_3]
];
let n=0;
for(const [label,token] of bots){
 if(token?.trim()){startMusicBot(token.trim(),label);n++;}
 else console.error(`⚠️ ${label}: トークン未設定`);
}
if(!n)throw new Error('.env に MUSIC_BOT_TOKEN_1～3 を設定してください。');
console.log(`🎵 ${n}台を起動します。`);
