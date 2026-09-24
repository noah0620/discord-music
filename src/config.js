import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
export const projectRoot=path.resolve(__dirname,'..');
dotenv.config({path:path.join(projectRoot,'.env')});

export const config={
  token:process.env.DISCORD_TOKEN?.trim(),
  clientId:process.env.DISCORD_CLIENT_ID?.trim()
};
export function assertConfig(){
  const missing=[];
  if(!config.token) missing.push('DISCORD_TOKEN');
  if(!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if(missing.length) throw new Error(`.env に設定が必要です: ${missing.join(', ')}`);
}
