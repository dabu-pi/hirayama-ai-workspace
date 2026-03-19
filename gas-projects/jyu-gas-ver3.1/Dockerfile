FROM python:3.11-slim

WORKDIR /app

# 依存インストール（キャッシュ活用のため先に COPY）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体とテンプレートをコピー
COPY server.py write_application.py 療養費支給申請書.xlsx ./

# Cloud Run はデフォルト 8080
ENV PORT=8080

# gunicorn: worker=1（xlsx生成はメモリ使用量が大きいため単一ワーカー）
# timeout=120s（openpyxl 処理 + 複数患者でも余裕を持たせる）
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "server:app"]
