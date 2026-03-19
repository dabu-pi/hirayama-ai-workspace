#!/usr/bin/env python3
"""
申請書生成 Cloud Run サーバー

POST /generate を受け付け、NDJSON を openpyxl で xlsx に変換して base64 で返す。

認証: X-Secret-Key ヘッダ（環境変数 SECRET_KEY と照合）
将来: IAM/OIDC に移行する場合は認証部分のみ差し替え（本体ロジック変更不要）
"""
import os
import base64
import logging
from datetime import datetime, timezone, timedelta

from flask import Flask, request, jsonify
from write_application import batch_write_from_string

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# 環境変数から取得（Cloud Run では Secret Manager → 環境変数注入）
SECRET_KEY = os.environ.get("SECRET_KEY", "")


# ===== ヘルスチェック =====

@app.route("/health", methods=["GET"])
def health():
    """Cloud Run ヘルスチェック用エンドポイント"""
    return jsonify({"status": "ok"})


# ===== 申請書生成 =====

@app.route("/generate", methods=["POST"])
def generate():
    """
    リクエスト:
      Header: X-Secret-Key: <secret>
      Body:   {"ndjson": "<NDJSON文字列>", "month": "YYYY-MM"}

    レスポンス(200):
      {"status": "ok", "month": "YYYY-MM", "patients": [...], "generatedAt": "..."}

    患者要素:
      {"patientId": str, "fileName": str, "content": base64str, "warnings": []}
    """

    # 1. 認証チェック
    req_key = request.headers.get("X-Secret-Key", "")
    if not SECRET_KEY or req_key != SECRET_KEY:
        logger.warning("AUTH_FAILED: invalid or missing X-Secret-Key")
        return jsonify({
            "status": "error",
            "code": "AUTH_FAILED",
            "message": "Invalid secret key",
        }), 401

    # 2. リクエスト解析
    try:
        body = request.get_json(force=True, silent=True) or {}
    except Exception as e:
        return jsonify({
            "status": "error",
            "code": "INVALID_INPUT",
            "message": f"JSON parse error: {e}",
        }), 400

    ndjson_str = body.get("ndjson", "")
    month = body.get("month", "")

    if not ndjson_str:
        return jsonify({
            "status": "error",
            "code": "INVALID_INPUT",
            "message": "ndjson フィールドが空です",
        }), 400

    logger.info(f"generate start: month={month}")

    # 3. xlsx 生成
    try:
        results = batch_write_from_string(ndjson_str)
    except ValueError as e:
        logger.error(f"validation error: {e}")
        return jsonify({
            "status": "error",
            "code": "INVALID_INPUT",
            "message": str(e),
        }), 400
    except Exception as e:
        logger.error(f"generation error: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "code": "GENERATION_FAILED",
            "message": str(e),
            "detail": repr(e),
        }), 500

    # 4. レスポンス組み立て
    patients_out = []
    has_error = False
    for r in results:
        if r.get("error") or r.get("content") is None:
            has_error = True
            patients_out.append({
                "patientId": r["patientId"],
                "fileName": r["fileName"],
                "content": None,
                "warnings": r.get("warnings", []),
                "error": r.get("error", "生成失敗"),
            })
        else:
            patients_out.append({
                "patientId": r["patientId"],
                "fileName": r["fileName"],
                "content": base64.b64encode(r["content"]).decode("utf-8"),
                "warnings": r.get("warnings", []),
            })

    generated_at = datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00")
    logger.info(f"generate done: {len(results)} patients, has_error={has_error}")

    return jsonify({
        "status": "partial_error" if has_error else "ok",
        "month": month,
        "patients": patients_out,
        "generatedAt": generated_at,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
