@echo off
chcp 65001 >nul

cd /d "C:\Users\pinsh\OneDrive\ドキュメント\GitHub\claude-sandbox\jyu-gas-ver3.1"
set "V3_BATCH_DOWNLOAD_DIR=G:\マイドライブ\ダウンロード"
python .\write_application.py --batch
pause