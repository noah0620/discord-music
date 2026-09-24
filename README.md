

## Windows `python3: No such file or directory` 修正
この版では `youtube-dl-exec` のインストール時Pythonチェックを回避する設定を追加しました。
ZIPに含まれていた `node_modules` は削除してあります。Windows上で必ず依存関係を入れ直してください。

PowerShell:
```powershell
$env:YOUTUBE_DL_SKIP_PYTHON_CHECK="1"
npm install
npm start
```

または `Windows_初回セットアップ.ps1` → `Windows_起動.ps1` の順に実行してください。

既存フォルダへ上書きする場合は、古い `node_modules` を削除してから `npm install` してください。
