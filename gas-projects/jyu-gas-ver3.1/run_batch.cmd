@echo off
chcp 65001 >nul
cd /d %~dp0

if not exist ".\.venv\Scripts\python.exe" (
  echo [ERROR] .venv\Scripts\python.exe が見つかりません
  pause
  exit /b 1
)

if not exist ".\write_application.py" (
  echo [ERROR] write_application.py が見つかりません
  pause
  exit /b 1
)

set "V3_BATCH_DOWNLOAD_DIR=%~dp0"
.\.venv\Scripts\python.exe .\write_application.py --batch
pause