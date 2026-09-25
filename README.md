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

## Windows 自動起動修正
Java 17以上が入っていれば `npm start` だけで Lavalink.jar を自動取得・起動し、2333番ポートの準備完了後にDiscord BOTを起動します。


## 音が出ない場合
この版では再生/再開ボタンを常時表示し、Lavalinkの playerStuck / playerException をコンソールへ出します。
BOTに接続・発言権限があること、Discord側でBOTをミュートしていないことも確認してください。


## 今回の修正
- YouTubeがログイン/bot確認で音声取得を拒否した場合、同じ曲名・アーティストをSoundCloudで自動検索して代替再生します。
- 再起動後も既存の再生パネルを再利用し、同じBOTのパネル重複を削除します。
- `InteractionNotReplied` が出るACK処理を修正しました。
- YouTube側の制限そのものを解除するものではないため、代替音源がない曲は再生できません。


## 再生パネル復元版
- パネルを「Music BOT 1」形式に戻しました。
- 一時停止 / 再生・再開 / スキップ / 停止 / 退出を表示します。
- 同じチャンネルのBOT再生パネルは1枚だけ残します。
- Interactionはコマンド受信直後にdeferして10062を抑制します。
- YouTube OAuthは既定でOFFです。必要な場合だけ `.env` の `YOUTUBE_OAUTH_ENABLED=true` にしてください。
- youtube-source公式の注意どおり、OAuthは万能ではなくアカウント制限の可能性があります。メインアカウントの利用は推奨されません。


## Lavalink起動修正
前版の application.yml にインデント崩れがあり、Lavalinkが起動できない問題を修正しました。
OAuthは初期状態ではOFFです。まず通常起動を確認してください。
