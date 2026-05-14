/**
 * jrec-sf01 initial-continuation-kpi.spec.ts
 *
 * Portal-15-C — JREC-SF01 selfpayInitialContinuationSummary endpoint verify
 *
 * 設計 spec:
 *   hirayama-jyusei-strategy/docs/PORTAL_15C_SELFPAY_INITIAL_CONTINUATION_2026-05-14.md
 *
 * endpoint: ?action=selfpayInitialContinuationSummary[&targetMonth=YYYY-MM]
 * deployment: @52 on AKfycbw0aWYY0... (Portal-12 と同 ANYONE_ANONYMOUS deploymentId)
 *
 * 実行: npm run test:jrec:initial-continuation-kpi
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const KPI_BASE_URL = (config as any).kpiEndpointUrl as string | undefined;
const FETCH_TIMEOUT_MS = 20_000;

const ENDPOINT_URL = KPI_BASE_URL
  ? `${KPI_BASE_URL}?action=selfpayInitialContinuationSummary`
  : "";

interface FetchResult {
  status: number;
  bodyText: string;
  json: any | null;
  error?: string;
}

async function fetchEndpoint(url: string, params: Record<string, string> = {}): Promise<FetchResult> {
  const qs = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  const fullUrl = qs ? `${url}&${qs}` : url;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(fullUrl, { redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    const bodyText = await res.text();
    let json: any = null;
    try { json = JSON.parse(bodyText); } catch { json = null; }
    return { status: res.status, bodyText, json };
  } catch (e: any) {
    return { status: 0, bodyText: "", json: null, error: String(e && e.message ? e.message : e) };
  }
}

// PII を絶対に返却 JSON に含めないこと（chronic-pain-kpi と同基準）
const PII_KEYWORDS = [
  "patient_id",
  "patientId",
  "selfPayVisitKey",
  "chartId",
  "氏名",
  "電話",
  "phone",
  "tel",
  "住所",
  "address",
  "生年月日",
  "dob",
  "birth",
];

function skipIfNoBase() {
  if (!KPI_BASE_URL) {
    test.skip(true, "config.json に kpiEndpointUrl が設定されていません");
  }
}

test.describe(
  "JREC-SF01 Portal-15-C selfpayInitialContinuationSummary — endpoint / PII / regression",
  () => {
    test("IC-1: endpoint が 200 / JSON を返す", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.error, `fetch error: ${r.error}`).toBeUndefined();
      expect(r.status).toBe(200);
      expect(r.json).not.toBeNull();
    });

    test("IC-2: ok=true + target_month が YYYY-MM 形式", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.json?.ok).toBe(true);
      expect(typeof r.json?.target_month).toBe("string");
      expect(r.json?.target_month).toMatch(/^\d{4}-\d{2}$/);
    });

    test("IC-3: first_visit_count / repeat_visit_count / total_visit_count が数値", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(typeof r.json?.first_visit_count).toBe("number");
      expect(typeof r.json?.repeat_visit_count).toBe("number");
      expect(typeof r.json?.total_visit_count).toBe("number");
      // 整合性: first + repeat == total
      expect(r.json.first_visit_count + r.json.repeat_visit_count).toBe(r.json.total_visit_count);
    });

    test("IC-4: first_visit_patient_count / repeat_visit_patient_count / distinct_patient_count が数値", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(typeof r.json?.first_visit_patient_count).toBe("number");
      expect(typeof r.json?.repeat_visit_patient_count).toBe("number");
      expect(typeof r.json?.distinct_patient_count).toBe("number");
    });

    test("IC-5: first_visit_ratio / repeat_visit_ratio が数値で 0..1 + 合計 ≒ 1（or 全 0）", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(typeof r.json?.first_visit_ratio).toBe("number");
      expect(typeof r.json?.repeat_visit_ratio).toBe("number");
      expect(r.json.first_visit_ratio).toBeGreaterThanOrEqual(0);
      expect(r.json.first_visit_ratio).toBeLessThanOrEqual(1);
      const sum = r.json.first_visit_ratio + r.json.repeat_visit_ratio;
      const total = r.json.total_visit_count;
      if (total > 0) {
        expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
      } else {
        expect(sum).toBe(0);
      }
    });

    test("IC-6: sales フィールド 3 つが（v1 では）「未計測」を返す", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.json?.first_visit_sales).toBe("未計測");
      expect(r.json?.repeat_visit_sales).toBe("未計測");
      expect(r.json?.average_unit_price_yen).toBe("未計測");
    });

    test("IC-7: continuation_shortage_alert が boolean", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(typeof r.json?.continuation_shortage_alert).toBe("boolean");
    });

    test("IC-8: data_quality_warnings.missing_visit_type_count が存在", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.json?.data_quality_warnings).toBeTruthy();
      expect(typeof r.json.data_quality_warnings.missing_visit_type_count).toBe("number");
    });

    test("IC-9: PII が JSON 全体に含まれない", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      for (const kw of PII_KEYWORDS) {
        expect(
          r.bodyText.includes(kw),
          `PII keyword "${kw}" must not appear in JSON. body sample: ${r.bodyText.slice(0, 200)}`
        ).toBe(false);
      }
    });

    test("IC-10: source フィールドが SelfPayVisits.来院区分 由来であることを宣言", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(ENDPOINT_URL);
      const src = String(r.json?.source || "");
      expect(src.length).toBeGreaterThan(0);
      expect(/SelfPayVisits|来院区分/.test(src)).toBe(true);
    });

    test("IC-REG-1: 回帰 — gymReferralKpiSummary が引き続き ok=true", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(`${KPI_BASE_URL}?action=gymReferralKpiSummary`);
      expect(r.status).toBe(200);
      expect(r.json?.ok).toBe(true);
    });

    test("IC-REG-2: 回帰 — chronicPainKpiSummary が引き続き ok=true + symptoms 3 つ", async () => {
      skipIfNoBase();
      const r = await fetchEndpoint(`${KPI_BASE_URL}?action=chronicPainKpiSummary`);
      expect(r.status).toBe(200);
      expect(r.json?.ok).toBe(true);
      expect(r.json?.symptoms?.lowback).toBeTruthy();
      expect(r.json?.symptoms?.neckstiffness).toBeTruthy();
      expect(r.json?.symptoms?.shoulderstiffness).toBeTruthy();
    });
  }
);

test.describe(
  "JREC-SF01 Portal-15-C — 設計参照ドキュメント存在確認",
  () => {
    test("IC-DOC-1: PORTAL_15C_SELFPAY_INITIAL_CONTINUATION_2026-05-14.md が存在する", async () => {
      const docPath = path.resolve(
        __dirname,
        "../../../../hirayama-jyusei-strategy/docs/PORTAL_15C_SELFPAY_INITIAL_CONTINUATION_2026-05-14.md"
      );
      expect(fs.existsSync(docPath), `Portal-15-C design doc が見つかりません: ${docPath}`).toBe(true);
    });

    test("IC-DOC-2: 設計 doc に PII 除外原則 + 初診/再診 分類が明記されている", async () => {
      const docPath = path.resolve(
        __dirname,
        "../../../../hirayama-jyusei-strategy/docs/PORTAL_15C_SELFPAY_INITIAL_CONTINUATION_2026-05-14.md"
      );
      const content = fs.readFileSync(docPath, "utf-8");
      expect(content.includes("PII")).toBe(true);
      expect(content.includes("ANYONE_ANONYMOUS")).toBe(true);
      expect(content.includes("初診")).toBe(true);
      expect(content.includes("再診")).toBe(true);
    });
  }
);
