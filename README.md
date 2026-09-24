# Discord MusicBot — 参照版ベース・音楽再生専用

アップロードされた `Discord_MultiBot_自販機管理パネルUI修正版 (2)(2)` の、
実際に使われていた `youtube-dl-exec + ffmpeg-static + @discordjs/voice` の再生方式だけを抽出して、
1台用に整理した版です。

## 残した機能
- `/play` 曲名またはYouTube URL
- 再生パネル
- 一時停止 / 再開 / スキップ / 停止 / 退出
- `/queue`
- `/nowplaying`
- `/volume`
- VCに人間が0人になったら自動退出

## 再生安定化
- 音声ストリームURLは再生直前に取得
- FFmpeg reconnect有効
- VoiceConnectionがReadyになってから再生
- Voice接続切断時の再接続待機
- 15秒ごとの無人VC確認
- Interaction 40060 / 10062でBOT全体が落ちないよう保護
- `MessageFlags.Ephemeral` 使用

## PowerShell
`.env.example` を `.env` にコピーし、BOTトークンを設定。

```powershell
npm install
npm run deploy
npm start
```

## Railway
Variables:
`DISCORD_TOKEN=BOTトークン`

Start Command:
`npm start`

本物のトークンはGitHubへアップロードしないでください。
