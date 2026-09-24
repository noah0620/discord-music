$ErrorActionPreference = "Stop"
$env:YOUTUBE_DL_SKIP_PYTHON_CHECK="1"
Write-Host "Pythonチェックを無効化して依存関係をインストールします..."
npm install
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env" }
Write-Host ""
Write-Host "セットアップ完了。.env にBOTトークンを設定後、Windows_起動.ps1 を実行してください。"
