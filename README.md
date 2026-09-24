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
