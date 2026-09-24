# Discord MusicBot 3台 再生修正版

アップロードされた `Discord_MultiBot_自販機管理パネルUI修正版(6).zip` の音楽再生処理を参照して作り直した版です。

## 主な修正
- 参照版と同じ `youtube-dl-exec + ffmpeg-static + @discordjs/voice` 構成
- 3台同時起動時のVoiceConnection衝突を防ぐため、BOTごとに `group` を分離
- キュー待ち中の音声URL期限切れを防ぐため「再生直前」にストリームURLを再取得
- ffmpegのreconnect設定を追加
- VC接続がReadyになるまで待ってから再生
- VC内の人間が0人になったら自動退出
- `/leave` と退出ボタンを実装

## 初回
1. `.env.example` を `.env` に変更
2. 3つのトークンを設定
3. `npm install`
4. `npm run deploy-commands`
5. `npm start`

以降は `起動.bat` でも起動できます。
