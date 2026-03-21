FROM python:3.11-slim

WORKDIR /app

# 依存インストール（キャッシュ活用のため先に COPY）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体とテンプレートをコピー
COPY server.py write_application.py application_template.xlsx ./

# Cloud Run はデフォルト 8080
ENV PORT=8080

# gunicorn: worker=1（xlsx生成はメモリ使用量が大きいため単一ワーカー）
# timeout=120s（openpyxl 処理 + 複数患者でも余裕を持たせる）
# --preload 廃止（Revision 00018〜）:
#   旧: server.py モジュールレベルで write_application を import → master での重い import が
#       worker fork を阻害 → 全リクエストが 504 になる問題（Revision 00016-4lw で発覚）
#   新: write_application を /generate 内で遅延 import → server.py 本体は軽量
#       /health は標準ライブラリのみ → worker 起動直後から即応
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "server:app"]
