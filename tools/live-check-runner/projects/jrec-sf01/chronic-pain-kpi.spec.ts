/**
 * jrec-sf01 chronic-pain-kpi.spec.ts
 *
 * Portal-16-B  JREC-SF01 chronicPainKpiSummary endpoint verify (TEMPLATE)
 *
 * 現時点では endpoint が JREC-SF01 にまだ実装されていないため、全テストは
 * `test.skip(true, ...)` でスキップする。endpoint が deploy されたら、各テストの
 * skip 行を削除（または条件付き skip に変更）するだけで実装の動作確認が回る。
 *
 * 設計 spec:
 *   hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md
 *
 * 対応する Phase 分割:
 *   Portal-16-A: 設計 docs（CLOSED）
 *   Portal-16-B: endpoint 実装（JREC-SF01）  ← 待機中（PID 3136 Phase Q 並行作業のため）
 *   Portal-16-C: deploy + 本 spec を ENABLE
 *   Portal-16-D: JBIZ portal-gateway 接続
 *   Portal-16-E: Portal-15 §3 connected 化
 *
 * テスト方針:
 *   - HTTP fetch（auth 不要・ANYONE_ANONYMOUS / aggregate のみ）
 *   - PII 不在は JSON 全体を grep して keyword 検出
 *   - 既存 gymReferralKpiSummary が回帰していないことも併せ確認
 *
 * 実行コマンド: npm run test:jrec:chronic-pain-kpi
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

// chronicPainKpiSummary は ANYONE_ANONYMOUS deploymentId (@50/@51) で公開。
// 通常の prodUrl (@48 USER_ACCESSING) とは別の URL なので kpiEndpointUrl を使う。
const KPI_BASE_URL = (config as any).kpiEndpointUrl as string | undefined;
const PROD_URL = (config as any).prodUrl as string | undefined;
const FETCH_TIMEOUT_MS = 35_000;  // Portal-17: L3 questionnaire read が追加されたため延長

// Portal-16-B endpoint が deploy されたら false に切り替える。
// または config.json に portal16BReady フラグを足してそこから読む形に変える。
// 2026-05-14: @51 deploy 済（deploymentId AKfycbw0aWYY0... の Portal-12 ANYONE_ANONYMOUS と共有）。
const PORTAL16B_NOT_YET_DEPLOYED = false;

const ENDPOINT_URL = KPI_BASE_URL ? `${KPI_BASE_URL}?action=chronicPainKpiSummary` : "";

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
    try {
      json = JSON.parse(bodyText);
    } catch {
      json = null;
    }
    return { status: res.status, bodyText, json };
  } catch (e: any) {
    return { status: 0, bodyText: "", json: null, error: String(e && e.message ? e.message : e) };
  }
}

// PII を絶対に返却 JSON に含めないこと。grep 対象。
const PII_KEYWORDS = [
  "patient_id",
  "patientId",
  "selfPayVisitKey",
  "chartId",
  "氏名",
  "name",
  "電話",
  "phone",
  "tel",
  "住所",
  "address",
  "生年月日",
  "dob",
  "birth",
  // chiefComplaint そのものの free-text を返してはいけない（field 名は OK だが値の生文字列を含めない）。
  // ただし key 名としての "chiefComplaint" は使ってよい設計のため、grep 対象には含めない。
];

const REQUIRED_SYMPTOMS = ["lowback", "neckstiffness", "shoulderstiffness"];
const REQUIRED_SYMPTOM_LABELS: Record<string, string> = {
  lowback: "腰痛",
  neckstiffness: "首こり",
  shoulderstiffness: "肩こり",
};

function skipIfNotDeployed() {
  if (PORTAL16B_NOT_YET_DEPLOYED) {
    test.skip(
      true,
      "Portal-16-B endpoint is not yet deployed in JREC-SF01. " +
        "When deployed, flip PORTAL16B_NOT_YET_DEPLOYED to false (or add a config flag)."
    );
  }
  if (!KPI_BASE_URL) {
    test.skip(true, "config.json に kpiEndpointUrl が設定されていません（@50/@51 ANYONE_ANONYMOUS deployment）。");
  }
}

test.describe(
  "JREC-SF01 Portal-16-B chronicPainKpiSummary — endpoint structure / PII / regression",
  () => {
    test("CP-1: endpoint が 200 / Content-Type=application/json を返す", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.error, `fetch error: ${r.error}`).toBeUndefined();
      expect(r.status, `status=${r.status}`).toBe(200);
      expect(r.json, `JSON parse failed. body: ${r.bodyText.slice(0, 200)}`).not.toBeNull();
    });

    test("CP-2: ok=true / target_month が YYYY-MM 形式で返る", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.json?.ok).toBe(true);
      expect(typeof r.json?.target_month).toBe("string");
      expect(r.json?.target_month).toMatch(/^\d{4}-\d{2}$/);
    });

    test("CP-3: symptoms.{lowback,neckstiffness,shoulderstiffness} が全て存在 + label + 数値カウント", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(r.json?.symptoms).toBeTruthy();
      for (const key of REQUIRED_SYMPTOMS) {
        const s = r.json.symptoms[key];
        expect(s, `missing symptom: ${key}`).toBeTruthy();
        expect(s.label, `${key}.label`).toBe(REQUIRED_SYMPTOM_LABELS[key]);
        expect(typeof s.visit_count, `${key}.visit_count`).toBe("number");
        expect(typeof s.patient_count, `${key}.patient_count`).toBe("number");
      }
    });

    test("CP-4: total_chronic_pain_visit_count / total_chronic_pain_patient_count が数値", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      expect(typeof r.json?.total_chronic_pain_visit_count).toBe("number");
      expect(typeof r.json?.total_chronic_pain_patient_count).toBe("number");
    });

    test("CP-5: data_quality_warnings が返る（object か number）", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      const w = r.json?.data_quality_warnings;
      expect(w === null || typeof w === "number" || typeof w === "object").toBe(true);
    });

    test("CP-6: fetched_at が ISO 8601 形式で返る", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      const fa = r.json?.fetched_at;
      expect(typeof fa).toBe("string");
      expect(fa).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test("CP-7: PII が JSON 全体に含まれない (grep)", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      // bodyText（生 text）全体に対して grep。key 名としての出現も許容しない。
      for (const kw of PII_KEYWORDS) {
        // 大文字小文字を ignore せずに完全一致で見る（API 設計上、これらの key を返すのは禁止のため）。
        expect(
          r.bodyText.includes(kw),
          `PII keyword "${kw}" must not appear in JSON. body sample: ${r.bodyText.slice(0, 200)}`
        ).toBe(false);
      }
    });

    test("CP-8: 過去月 (targetMonth=2026-05) を指定したとき target_month が反映される", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL, { targetMonth: "2026-05" });
      expect(r.json?.target_month).toBe("2026-05");
    });

    test("CP-9: source フィールドが SelfPayVisits/SelfPayChart 由来であることを宣言している", async () => {
      skipIfNotDeployed();
      const r = await fetchEndpoint(ENDPOINT_URL);
      const src = String(r.json?.source || "");
      expect(src.length).toBeGreaterThan(0);
      // L1 / L2 のいずれかの言及があること。実装決定後に厳密化してよい。
      expect(/SelfPayVisits|SelfPayChart|chiefComplaint/.test(src)).toBe(true);
    });

    test("CP-REG-1: 回帰 — gymReferralKpiSummary が依然として ok=true を返す", async () => {
      skipIfNotDeployed();
      // 同 deploymentId（KPI_BASE_URL）上で gymReferralKpiSummary も regression していないこと
      const r = await fetchEndpoint(`${KPI_BASE_URL}?action=gymReferralKpiSummary`);
      expect(r.error, `fetch error: ${r.error}`).toBeUndefined();
      expect(r.status).toBe(200);
      expect(r.json?.ok).toBe(true);
      expect(typeof r.json?.selfpay_visit_count).toBe("number");
    });
  }
);

test.describe(
  "JREC-SF01 Portal-16-B — 設計参照ドキュメント存在確認 (常時実行)",
  () => {
    test("CP-DOC-1: hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md が存在する", async () => {
      const docPath = path.resolve(
        __dirname,
        "../../../../hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md"
      );
      expect(fs.existsSync(docPath), `Portal-16 design doc が見つかりません: ${docPath}`).toBe(true);
    });

    test("CP-DOC-2: Portal-16 design に PII 除外原則が明記されている", async () => {
      const docPath = path.resolve(
        __dirname,
        "../../../../hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md"
      );
      const content = fs.readFileSync(docPath, "utf-8");
      expect(content.includes("PII")).toBe(true);
      expect(content.includes("ANYONE_ANONYMOUS")).toBe(true);
    });

    test("CP-DOC-3: Portal-16 design に 3 症状 (腰痛/首こり/肩こり) が定義されている", async () => {
      const docPath = path.resolve(
        __dirname,
        "../../../../hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md"
      );
      const content = fs.readFileSync(docPath, "utf-8");
      expect(content.includes("腰痛")).toBe(true);
      expect(content.includes("首こり")).toBe(true);
      expect(content.includes("肩こり")).toBe(true);
      expect(content.includes("lowback")).toBe(true);
      expect(content.includes("neckstiffness")).toBe(true);
      expect(content.includes("shoulderstiffness")).toBe(true);
    });
  }
);
