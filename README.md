# Discord MusicBot 3台 完成版

アップロードされた1台用 `Discord_MusicBot_音楽再生専用_自動退出版(1)` を基準に3台化した版です。

## 修正済み
- 3台を1回の `npm start` で同時起動
- 3台のVoiceConnectionをBOT IDごとに分離
- `/play` の再生直前に音声ストリームURLを取得
- `DiscordAPIError[40060]` 対策：操作ボタンをBOT IDごとに分離
- `ephemeral` 非推奨警告対策：`MessageFlags.Ephemeral`
- VCに人間が0人になったら、そのBOTだけ自動退出
- `/leave` と退出ボタン
- GitHub / Railway向けの簡潔構成

## PowerShell
`.env.example` を `.env` にコピーし、3つのトークンを設定します。

```powershell
npm install
npm run deploy
npm start
```

## Railway
Variables に以下を設定:
- MUSIC_BOT_TOKEN_1
- MUSIC_BOT_TOKEN_2
- MUSIC_BOT_TOKEN_3

Start Command: `npm start`

本物のTokenをGitHubへアップロードしないでください。
