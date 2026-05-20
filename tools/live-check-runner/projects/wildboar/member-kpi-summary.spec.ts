/**
 * wildboar/member-kpi-summary.spec.ts
 * Portal-20-002: Wildboar `?action=memberKpiSummary` endpoint smoke
 *
 * 目的:
 *   JBIZ Portal (hirayama-jyusei-strategy / portal-gateway-v1.gs) から fetch される
 *   read-only / aggregate-only / PII 不含の endpoint を PROD で検証する。
 *
 * アクセス:
 *   appsscript.json で webapp.access = ANYONE_ANONYMOUS。auth.json 不要。
 *
 * 設計 doc:
 *   wildboar-member-management/docs/PORTAL_20_WILDBOAR_MEMBER_KPI_ENDPOINT_2026-05-20.md
 *
 * 実行: npx playwright test projects/wildboar/member-kpi-summary.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";
import config from "./config.json";

const PROD_URL = (config as any).prodUrl as string;
const ENDPOINT = `${PROD_URL}?action=memberKpiSummary`;

// レスポンスに **含まれてはいけない** PII フィールド名（プロパティキーレベル）
const PII_FORBIDDEN_KEYS = [
  "family_name", "given_name",
  "family_name_kana", "given_name_kana",
  "birth_date", "phone_home", "phone_mobile",
  "email", "postal_code", "address1", "address2",
  "emergency_contact_name", "emergency_contact_phone",
  "member_id", "key_card_number",
];

function findForbiddenKey(obj: any, path: string = ""): string | null {
  if (obj === null || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const r = findForbiddenKey(obj[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  for (const k of Object.keys(obj)) {
    if (PII_FORBIDDEN_KEYS.includes(k)) {
      return `${path}.${k}`;
    }
    const r = findForbiddenKey(obj[k], `${path}.${k}`);
    if (r) return r;
  }
  return null;
}

test.describe("WILDBOAR W-MKS: Portal-20-002 memberKpiSummary endpoint", () => {
  test.setTimeout(120_000);

  test("W-MKS-1: endpoint が JSON で 200 を返す（最低限の schema 検証）", async ({ request }) => {
    const res = await request.get(ENDPOINT, { maxRedirects: 10 });
    expect(res.status(), "HTTP status").toBe(200);

    const ct = res.headers()["content-type"] || "";
    expect(ct.toLowerCase(), "content-type").toContain("application/json");

    const body = await res.json();
    expect(body.status, "status").toBe("ok");
    expect(body.source, "source").toBe("wildboar-member-management");
    expect(body.version, "version").toBe("portal20-member-kpi-v1");
    expect(typeof body.exported_at, "exported_at typeof").toBe("string");
    expect(body.exported_at, "exported_at format").toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.month, "month format").toMatch(/^\d{4}-\d{2}$/);
  });

  test("W-MKS-2: members / revenue / data_quality / meta の必須キーが揃っている", async ({ request }) => {
    const res = await request.get(ENDPOINT, { maxRedirects: 10 });
    const body = await res.json();

    expect(body.members, "members").toBeTruthy();
    for (const k of [
      "active_count", "paused_count", "withdrawn_count",
      "new_join_count_this_month", "withdraw_count_this_month",
      "pause_count_this_month", "restart_count_this_month",
      "pending_intake_count", "trial_or_pending_count",
    ]) {
      expect(body.members, `members.${k} key`).toHaveProperty(k);
    }

    expect(body.revenue, "revenue").toBeTruthy();
    for (const k of [
      "monthly_recurring_estimate", "billed_amount_this_month",
      "paid_amount_this_month", "unpaid_amount_this_month",
      "unpaid_count", "needs_attention_count",
    ]) {
      expect(body.revenue, `revenue.${k} key`).toHaveProperty(k);
    }

    expect(body.data_quality, "data_quality").toBeTruthy();
    expect(body.data_quality, "data_quality.warnings").toHaveProperty("warnings");
    expect(Array.isArray(body.data_quality.warnings), "warnings is array").toBe(true);
    expect(body.data_quality, "excluded_test_or_sample_count").toHaveProperty("excluded_test_or_sample_count");
    expect(body.data_quality, "anonymized_count").toHaveProperty("anonymized_count");

    expect(body.meta, "meta").toBeTruthy();
    expect(body.meta, "meta.cache_ttl_seconds").toHaveProperty("cache_ttl_seconds");
    expect(body.meta, "meta.cache_hit").toHaveProperty("cache_hit");
  });

  test("W-MKS-3: members の整数性 + 既知の Phase 14-3 取込結果と整合", async ({ request }) => {
    const res = await request.get(ENDPOINT, { maxRedirects: 10 });
    const body = await res.json();
    const m = body.members;

    expect(Number.isInteger(m.active_count), "active_count is integer").toBe(true);
    expect(m.active_count, "active_count >= 0").toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(m.paused_count), "paused_count is integer").toBe(true);
    expect(m.paused_count, "paused_count >= 0").toBeGreaterThanOrEqual(0);

    // Phase 14-3 取込結果: active 51 / paused 14 / withdrawn 0 / 計 65（PROD @50 時点）
    // 新規入会 / 退会が起きると変動するため、合計のみ妥当範囲で assertion
    const total = m.active_count + m.paused_count + m.withdrawn_count;
    expect(total, "members total in expected range").toBeGreaterThanOrEqual(50);
    expect(total, "members total upper bound (sanity)").toBeLessThanOrEqual(200);

    // 月会費見込みは active が居れば正の値（プラン全 0 円のサンプル DB でない限り）
    expect(body.revenue.monthly_recurring_estimate, "monthly_recurring_estimate >= 0")
      .toBeGreaterThanOrEqual(0);
  });

  test("W-MKS-4: レスポンスに PII フィールド名が含まれない", async ({ request }) => {
    const res = await request.get(ENDPOINT, { maxRedirects: 10 });
    const body = await res.json();

    const found = findForbiddenKey(body);
    if (found) {
      // どこに含まれていたか annotate（値は出さない / キーパスのみ）
      test.info().annotations.push({
        type: "pii-leak-path",
        description: found,
      });
    }
    expect(found, "no PII key found in response").toBeNull();

    // ボディ全体の長さも記録（aggregate-only なら 2KB 未満想定）
    const bodyText = JSON.stringify(body);
    test.info().annotations.push({
      type: "body-shape",
      description: JSON.stringify({
        totalBytes: bodyText.length,
        memberRows: body.meta?.total_member_rows,
        cacheHit:   body.meta?.cache_hit,
      }),
    });
    expect(bodyText.length, "response body size sanity").toBeLessThan(20_000);
  });

  test("W-MKS-5: targetMonth=YYYY-MM 指定が反映される", async ({ request }) => {
    const url = `${ENDPOINT}&targetMonth=2026-04`;
    const res = await request.get(url, { maxRedirects: 10 });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status, "status").toBe("ok");
    expect(body.month, "month echoes targetMonth").toBe("2026-04");
  });

  test("W-MKS-6: 2 回目呼び出しで cache_hit=true（同一 targetMonth）", async ({ request }) => {
    // W-MKS-1 等が既に warm 済みである可能性が高いが、別月で連続呼び出して確認
    const url = `${ENDPOINT}&targetMonth=2025-12`;

    const r1 = await request.get(url, { maxRedirects: 10 });
    const b1 = await r1.json();

    const r2 = await request.get(url, { maxRedirects: 10 });
    const b2 = await r2.json();

    expect(b2.status, "2nd call status").toBe("ok");
    expect(b2.meta?.cache_hit, "2nd call cache_hit").toBe(true);

    // 1 回目と 2 回目で集計値が同一（cache が同じ snapshot を返す）
    expect(b1.members.active_count, "active_count stable across cache").toBe(b2.members.active_count);
    expect(b1.revenue.monthly_recurring_estimate, "monthly_recurring_estimate stable across cache")
      .toBe(b2.revenue.monthly_recurring_estimate);
  });

  test("W-MKS-7: 不正な targetMonth 形式で status=error", async ({ request }) => {
    const url = `${ENDPOINT}&targetMonth=${encodeURIComponent("2026/05")}`;
    const res = await request.get(url, { maxRedirects: 10 });
    expect(res.status()).toBe(200); // GAS WebApp は基本 200
    const body = await res.json();
    expect(body.status, "status=error").toBe("error");
    expect(body.source, "source").toBe("wildboar-member-management");
    expect(body.message, "message mentions YYYY-MM").toMatch(/YYYY-MM/);
  });

  test("W-MKS-8: 未知 action は status=error + supported_actions を返す", async ({ request }) => {
    const url = `${PROD_URL}?action=unknownAction`;
    const res = await request.get(url, { maxRedirects: 10 });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status, "status=error").toBe("error");
    expect(Array.isArray(body.supported_actions), "supported_actions is array").toBe(true);
    expect(body.supported_actions, "memberKpiSummary listed").toContain("memberKpiSummary");
  });
});
