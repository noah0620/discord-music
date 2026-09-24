# Discord Music BOT ×3

3台とも同じ音楽再生機能で、トークンだけ別です。

## ローカル起動
`.env.example` を `.env` にコピーして3つのトークンを設定。

```bash
npm install
npm run deploy
npm start
```

## GitHub
アップロードするのは `src/`, `package.json`, `.gitignore`, `.env.example`, `README.md` だけでOKです。
本物のBot TokenはGitHubへコミットしないでください。

※ GitHub PagesはNode.js Discord Botの常時実行には使えません。


## 40060修正
3台同時起動時、同じボタンInteractionを複数BOTが処理しようとして
`DiscordAPIError[40060]: Interaction has already been acknowledged` でプロセスが終了する問題を修正しました。

- ボタンIDをBOTごとに分離
- ephemeral指定をMessageFlags.Ephemeralへ変更
- Interaction二重応答を安全に無視
- 40060/10062でNode.jsプロセスが落ちないように保護
