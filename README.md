# Discord MusicBot 3台同時起動版

同一機能の音楽BOTを、異なる3つのDiscord Botトークンで同時起動します。

## 機能
/play /queue /skip /stop /pause /resume /nowplaying /volume /leave

各BOTは独立してボイスチャンネルへ参加できます。BOTがいるVCから人間が全員いなくなると、そのBOTだけ自動退出します。

## 設定
`.env.example` を `.env` にコピーし、BOT1～BOT3のトークンを設定してください。

## 初回
npm install
npm run deploy-commands
npm start

以後は `npm start` または `起動.bat` で3台同時起動できます。
