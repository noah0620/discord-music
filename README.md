# Discord MusicBot - GitHub / Railway 完成版

音楽再生だけの1台用BOTです。

## GitHubへアップロード
このZIPの中身をリポジトリ直下へアップロードしてください。

**`.env` とBOT TokenはGitHubへアップロードしないでください。**

## Railway
GitHubリポジトリをRailwayへ接続し、Variablesに次を追加します。

`DISCORD_TOKEN=BOTのトークン`

この版には `Dockerfile` と `railway.json` が入っています。
RailwayのLinux環境へ `python3` を明示的に導入するため、
以前の `env: python3: No such file or directory` を回避します。

Start Command: `npm start`

## Discordコマンド登録
ローカルPowerShellで `.env` にTokenを設定して一度だけ:

```powershell
npm install
npm run deploy
```

その後Railwayでは `npm start` だけで常時起動します。

## 音楽機能
- /play
- /pause
- /resume
- /skip
- /stop
- /queue
- /nowplaying
- /volume
- /leave
- 再生パネル
- VCが無人になったら自動退出

## 10062 / 40060 と YouTube取得エラー対策
- `/play` はYouTube検索より前に `deferReply()` して、Discordの3秒制限に対応。
- 10062 / 40060 が起きてもプロセスを終了しない。
- YouTube取得は `android,web` player clientを試す構成。
- YouTubeが `Sign in to confirm you're not a bot` を返した場合は、BOTを落とさずDiscordへ原因を表示。

### 重要
同じ `DISCORD_TOKEN` のBOTを **PCとRailwayで同時起動しないでください**。同じInteractionを2プロセスが受け取り、10062/40060の原因になります。Railway運用時はPC側の `npm start` を `Ctrl+C` で停止してください。
