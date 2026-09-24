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
