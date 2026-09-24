# Discord MusicBot 音楽再生専用版

この版は元のMultiBotから自販機・天気・地震・RSS・ロール等を削除し、音楽再生だけにしたものです。

## 機能
- `/play` 曲名またはURLで再生
- `/queue` キュー表示
- `/skip` `/stop` `/pause` `/resume`
- `/nowplaying`
- `/volume`
- `/leave` でBOTをVCから退出
- 再生パネルの「🚪 退出」ボタン
- BOTがいるVCから人間が全員退出したら自動退出
- VoiceStateUpdateに加え15秒ごとの安全チェック

## 起動
1. `.env.example` を `.env` にコピー
2. `DISCORD_TOKEN` と `DISCORD_CLIENT_ID` を設定
3. PowerShellでこのフォルダーを開く
4. `npm install`
5. `npm run deploy-commands`
6. `npm start`

Node.js 20以上を使用してください。
