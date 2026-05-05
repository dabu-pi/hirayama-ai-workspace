@echo off
echo [install] Phase 1 は追加インストール不要です
echo [install] Python 3.10+ と tkinter が必要です
echo.
python --version
python -c "import tkinter; print('tkinter OK:', tkinter.TkVersion)"
echo.
echo [install] 完了。run.bat で起動してください。
pause
