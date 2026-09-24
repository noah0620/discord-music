# Discord MusicBot — Jockie Music風 / Lavalink版

従来の `yt-dlp → FFmpeg → Discord` 直結方式をやめ、
**Discord Bot → Kazagumo/Shoukaku → Lavalink → Discord Voice** に変更した版です。

## 主な機能
- `/play 曲名 / URL`
- YouTube検索。失敗・空結果時はSoundCloud検索へフォールバック
- プレイリストをキューへ一括追加
- 再生パネル（停止・一時停止・再開・スキップ・シャッフル・退出）
- `/queue`
- `/nowplaying`
- `/volume`
- `/loop`（OFF / 1曲 / キュー）
- `/shuffle`
- VCが無人になったら自動退出
- Discord Interaction 3秒制限対策
- 1台用。安定後に同じLavalinkへ複数BOTを接続可能

## Railway
このZIPをGitHubリポジトリ直下へアップロードします。

Railway Variables:
- `DISCORD_TOKEN` = Discord Bot Token
- `LAVALINK_PASSWORD` = 好きな長いパスワード

`LAVALINK_HOST` / `PORT` は同一コンテナ版では未設定でOKです。
DockerfileがLavalinkとDiscord BOTを同じRailway Service内で起動します。

## Discordコマンド登録
最初の1回だけローカルPowerShellで:

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run deploy
```

`.env` の `DISCORD_TOKEN` を設定してください。

## ローカル実行について
`npm start` だけでは別途Lavalinkが必要です。
RailwayではDockerfileがLavalinkも自動起動します。

## YouTubeについて
Lavalink 4.2.2 + 公式 youtube-source 1.18.2 を使用します。
複数のYouTubeクライアントを設定しています。ただしYouTube側の仕様・アクセス制限により、
データセンターIPからのYouTube再生を100%保証するものではありません。
曲名検索ではYouTubeが利用できない場合にSoundCloud検索を試します。
