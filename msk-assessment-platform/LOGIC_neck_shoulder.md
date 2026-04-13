# LOGIC_neck_shoulder.md — 頚肩こり版判定ロジック設計案 (JASSESS-01)

**対象:** 頚肩こり_初期評価モジュール（Phase 2）
**最終更新:** 2026-03-26
**ステータス:** 設計フェーズ（実装前）

> 腰痛版ロジックは `LOGIC.md` および `gas/logic_engine.js` を参照。
> 本ファイルは頚肩こり専用の設計仕様。
> 実装は `gas/logic_engine_neck_shoulder.js` に分離する（既存コード変更なし）。

---

## 1. 設計方針

- 腰痛版 `logic_engine.js` とは完全に分離する（互いに干渉しない）
- フラグ変数名は `NS_` プレフィックスで腰痛版と区別する
- セル位置定数は `NS_CELLS` オブジェクトで別管理する
- onEdit トリガーは頚肩こりシート専用のものを追加する（既存 onEdit は変更しない）
- 判定マトリクスは腰痛版より単純な構造で開始し、実臨床テスト後に精緻化する

---

## 2. セル位置定数（NS_CELLS）

GAS 実装時は以下を `logic_engine_neck_shoulder.js` 内の定数として定義する。

```javascript
const NS_CELLS = {
  // 共通_初期評価から参照
  EVAL_DATE:       '共通_初期評価!C3',
  PATIENT_ID:      '共通_初期評価!C4',
  NRS:             '共通_初期評価!C30',
  ONSET_DURATION:  '共通_初期評価!C16',  // 2週未満 / 2週〜3か月 / 3か月以上
  FIRST_OR_RECUR:  '共通_初期評価!C18',  // 初発 / 再発 / 反復性 / 不明

  // 頚肩こり_初期評価シート（C列）
  // NS-A: 頚部特有赤旗
  NS_REDFLAG_SCORE:       'C11',   // =COUNTIF(C6:C10,TRUE)（Sheets数式）
  // NS-B: 神経症状
  NS_RADIATE:             'C13',   // なし / 片側 / 両側
  NS_DEXTERITY:           'C15',   // FALSE / TRUE（巧緻性低下）
  NS_NERVE_LEVEL:         'C18',   // Sheets数式: なし / 神経根性 / 頚髄症疑い
  // NS-D: 日常生活負荷
  NS_LIFESTYLE_FLAG:      'C30',   // Sheets数式: 標準 / 高
  // NS-F: ROM
  NS_ROM_TYPE:            'C44',   // Sheets数式: 正常 / 単方向 / 複合 / 全方向 / 疼痛誘発型
  // NS-J: 総合判定（書き込み先）
  NS_RULE_RESULT:         'C51',   // GASが書き込む
  NS_NEXT_STEP:           'C52',   // GASが書き込む
  // NS-K: 自動生成コメント（書き込み先）
  NS_CMT_SUMMARY:         'C54',
  NS_CMT_CAUTION:         'C55',
  NS_CMT_EXPLAIN:         'C56',
  NS_CMT_PRIORITY:        'C57',
  NS_CMT_SELFCARE:        'C58',
  NS_CMT_REASSESS:        'C59',
  NS_CMT_PATIENT:         'C60',
  NS_CMT_REFERRAL:        'C61',
};
```

---

## 3. Step 8: フラグ集計ロジック

腰痛版の `readAndComputeFlags()` に相当する処理。
頚肩こりシート専用として独立実装する。

### フラグ一覧と判定条件

| フラグID | 判定条件 | 優先度 |
|---|---|---|
| NS_FLAG_REDFLAG | NS_REDFLAG_SCORE >= 1 | 最高（医療連携） |
| NS_FLAG_MYELOPATHY | NS_DEXTERITY = TRUE または NS_RADIATE = "両側" | 高（施術保留） |
| NS_FLAG_RADICULOPATHY | NS_NERVE_LEVEL = "神経根性" | 中高（施術方針変更） |
| NS_FLAG_CHRONIC | ONSET_DURATION = "3か月以上" | 中 |
| NS_FLAG_RECURRENT | FIRST_OR_RECUR = "再発" または "反復性" | 中 |
| NS_FLAG_LIFESTYLE_HIGH | NS_LIFESTYLE_FLAG = "高" | 中 |
| NS_FLAG_ROM_GLOBAL | NS_ROM_TYPE = "全方向制限型" | 低（情報） |
| NS_FLAG_ROM_PAIN | NS_ROM_TYPE = "疼痛誘発型" | 低（情報） |
| NS_FLAG_NRS_HIGH | NRS >= 7 | 低（情報） |

### GAS 実装イメージ（設計）

```javascript
function nsReadAndComputeFlags(nsSheet) {
  const get = (cell) => {
    // 共通_初期評価シートの値は別シート参照で取得
    if (cell.startsWith('共通_初期評価!')) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const commonSheet = ss.getSheetByName('共通_初期評価');
      return commonSheet.getRange(cell.replace('共通_初期評価!', '')).getValue();
    }
    return nsSheet.getRange(cell).getValue();
  };

  const data = {
    nrsScore:       get(NS_CELLS.NRS),
    onsetDuration:  get(NS_CELLS.ONSET_DURATION),
    firstOrRecur:   get(NS_CELLS.FIRST_OR_RECUR),
    nsFlagScore:    get(NS_CELLS.NS_REDFLAG_SCORE),
    nsRadiate:      get(NS_CELLS.NS_RADIATE),
    nsDexterity:    get(NS_CELLS.NS_DEXTERITY),
    nsNerveLevel:   get(NS_CELLS.NS_NERVE_LEVEL),
    nsLifestyleFlag:get(NS_CELLS.NS_LIFESTYLE_FLAG),
    nsRomType:      get(NS_CELLS.NS_ROM_TYPE),
  };

  const flags = {
    NS_FLAG_REDFLAG:         Number(data.nsFlagScore) >= 1,
    NS_FLAG_MYELOPATHY:      data.nsDexterity === true || data.nsRadiate === '両側',
    NS_FLAG_RADICULOPATHY:   data.nsNerveLevel === '神経根性',
    NS_FLAG_CHRONIC:         data.onsetDuration === '3か月以上',
    NS_FLAG_RECURRENT:       data.firstOrRecur === '再発' || data.firstOrRecur === '反復性',
    NS_FLAG_LIFESTYLE_HIGH:  data.nsLifestyleFlag === '高',
    NS_FLAG_ROM_GLOBAL:      data.nsRomType === '全方向制限型',
    NS_FLAG_ROM_PAIN:        data.nsRomType === '疼痛誘発型',
    NS_FLAG_NRS_HIGH:        Number(data.nrsScore) >= 7,
  };

  return { data, flags };
}
```

---

## 4. Step 9: 総合方針判定マトリクス

腰痛版の15パターンより単純な構造で開始する。実臨床テスト後に精緻化する。

### 判定優先順位と出力テキスト

| 優先順位 | 条件 | 総合方針テキスト（C51） | 次の介入先（C52） |
|---|---|---|---|
| 1 | NS_FLAG_REDFLAG = true | 医療連携を優先してください（頚部危険所見あり） | 医療連携 |
| 2 | NS_FLAG_MYELOPATHY = true | 頚髄症疑い：施術保留・整形外科受診を推奨します | 医療連携 |
| 3 | NS_FLAG_RADICULOPATHY = true かつ NS_FLAG_NRS_HIGH = true | 神経根障害・疼痛コントロール優先：神経刺激を避けた施術から開始してください | 施術（神経根対応） |
| 4 | NS_FLAG_RADICULOPATHY = true かつ NS_FLAG_NRS_HIGH = false | 神経根障害・施術と段階的なセルフケア導入を並行してください | 施術＋セルフケア |
| 5 | NS_FLAG_CHRONIC = true かつ NS_FLAG_LIFESTYLE_HIGH = true | 慢性期・生活負荷高：施術と生活指導を並行して進めてください | 施術＋生活指導 |
| 6 | NS_FLAG_CHRONIC = true かつ NS_FLAG_RECURRENT = true | 慢性期・再発型：セルフケア習慣化と再発予防を重点に進めてください | 施術＋運動療法初回評価 |
| 7 | NS_FLAG_CHRONIC = true | 慢性期：姿勢再教育とセルフケア習慣化を軸に進めてください | 施術＋セルフケア |
| 8 | NS_FLAG_LIFESTYLE_HIGH = true かつ NS_FLAG_CHRONIC = false | 生活負荷高（急性〜亜急性）：施術と負荷軽減指導から始めてください | 施術＋生活指導 |
| 9 | 上記いずれにも該当しない | 施術中心で症状緩和から始めてください | 施術 |

### GAS 実装イメージ（設計）

```javascript
function nsDeterminePolicy(flags) {
  if (flags.NS_FLAG_REDFLAG)
    return { policy: '医療連携を優先してください（頚部危険所見あり）', nextStep: '医療連携' };
  if (flags.NS_FLAG_MYELOPATHY)
    return { policy: '頚髄症疑い：施術保留・整形外科受診を推奨します', nextStep: '医療連携' };
  if (flags.NS_FLAG_RADICULOPATHY && flags.NS_FLAG_NRS_HIGH)
    return { policy: '神経根障害・疼痛コントロール優先：神経刺激を避けた施術から開始してください', nextStep: '施術（神経根対応）' };
  if (flags.NS_FLAG_RADICULOPATHY)
    return { policy: '神経根障害・施術と段階的なセルフケア導入を並行してください', nextStep: '施術＋セルフケア' };
  if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_LIFESTYLE_HIGH)
    return { policy: '慢性期・生活負荷高：施術と生活指導を並行して進めてください', nextStep: '施術＋生活指導' };
  if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_RECURRENT)
    return { policy: '慢性期・再発型：セルフケア習慣化と再発予防を重点に進めてください', nextStep: '施術＋運動療法初回評価' };
  if (flags.NS_FLAG_CHRONIC)
    return { policy: '慢性期：姿勢再教育とセルフケア習慣化を軸に進めてください', nextStep: '施術＋セルフケア' };
  if (flags.NS_FLAG_LIFESTYLE_HIGH)
    return { policy: '生活負荷高（急性〜亜急性）：施術と負荷軽減指導から始めてください', nextStep: '施術＋生活指導' };
  return { policy: '施術中心で症状緩和から始めてください', nextStep: '施術' };
}
```

---

## 5. Step 10: 自動生成コメント選択ロジック

コメントキーの選択は、フラグの優先順位順にマッチングする。
各カテゴリのコメントキーは `COMMENT_DESIGN_neck_shoulder.md` で定義。

### コメントキー選択ロジック

```javascript
function nsSelectCommentKey(flags) {
  // フラグに応じたキープレフィックスを決定
  let prefix;
  if (flags.NS_FLAG_REDFLAG)            prefix = 'NS_REDFLAG';
  else if (flags.NS_FLAG_MYELOPATHY)    prefix = 'NS_MYELOPATHY';
  else if (flags.NS_FLAG_RADICULOPATHY) prefix = 'NS_RADICULOPATHY';
  else if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_LIFESTYLE_HIGH) prefix = 'NS_CHRONIC_LIFE';
  else if (flags.NS_FLAG_CHRONIC)       prefix = 'NS_CHRONIC';
  else if (flags.NS_FLAG_LIFESTYLE_HIGH) prefix = 'NS_LIFESTYLE';
  else                                   prefix = 'NS_STANDARD';

  return {
    summary:   `${prefix}_SUMMARY`,
    caution:   prefix === 'NS_REDFLAG' ? 'NS_REDFLAG_CAUTION'
                : prefix === 'NS_MYELOPATHY' ? 'NS_MYELOPATHY_CAUTION'
                : prefix === 'NS_RADICULOPATHY' ? 'NS_RADICULOPATHY_CAUTION'
                : prefix.includes('LIFESTYLE') ? 'NS_LIFESTYLE_CAUTION'
                : 'NS_STANDARD_CAUTION',
    explain:   `${prefix}_EXPLAIN`,
    priority:  `${prefix}_PRIORITY`,
    selfcare:  `${prefix}_SELFCARE`,
    reassess:  `${prefix}_REASSESS`,
    patient:   `${prefix}_PATIENT`,
    referral:  `${prefix}_REFERRAL`,
  };
}
```

### コメントマスタからの取得

```javascript
function nsGetComment(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('頚肩こり_コメントマスタ');
  const data = masterSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][3];  // D列: コメント本文
  }
  return `（コメント未定義: ${key}）`;
}
```

---

## 6. エントリポイント設計

### nsRunLogicAll()
```
1. 頚肩こり_初期評価 シートを取得
2. nsReadAndComputeFlags() でデータ・フラグを取得
3. nsDeterminePolicy() で総合方針・次の介入先を決定
4. nsSelectCommentKey() でコメントキーを取得
5. nsGetComment() で8コメントを取得
6. 各セルに書き込む（C51・C52・C54〜C61）
```

### nsOnEdit(e)
```
対象シート: '頚肩こり_初期評価' のみ（腰痛シートは対象外）
対象セル: 以下のいずれかが変更された場合に nsRunLogicAll() を呼び出す
```

### nsOnEdit の監視対象セル

```javascript
const NS_TRIGGER_CELLS = new Set([
  'C6','C7','C8','C9','C10',          // NS-A 赤旗
  'C13','C14','C15','C16','C17',       // NS-B 神経症状
  'C25','C26','C27',                   // NS-D 日常生活負荷
  'C38','C39','C40','C41','C42','C43', // NS-F ROM
]);
// 共通_初期評価シートの変更（C16/C18/C30）も対象にする場合は
// 別途 onEdit で シート名チェックを追加する
```

---

## 7. 腰痛版との共存設計

### onEdit の分岐

既存の `onEdit(e)` は腰痛シート専用のまま変更しない。
頚肩こり用は独立した `nsOnEdit(e)` として追加する。

GAS プロジェクトでは installable trigger を2本立てる:
1. 既存: `onEdit` → 腰痛評価入力 を監視
2. 新規: `nsOnEdit` → 頚肩こり_初期評価 を監視

```javascript
// logic_engine_neck_shoulder.js 内に追加
function nsOnEdit(e) {
  const sheet = e.range.getSheet();
  // 頚肩こりシートの変更のみ処理する
  if (sheet.getName() !== '頚肩こり_初期評価') return;
  if (!NS_TRIGGER_CELLS.has(e.range.getA1Notation())) return;
  const nsSheet = sheet;
  const { data, flags } = nsReadAndComputeFlags(nsSheet);
  const policy = nsDeterminePolicy(flags);
  const keys = nsSelectCommentKey(flags);
  // 結果を書き込む
  nsSheet.getRange(NS_CELLS.NS_RULE_RESULT).setValue(policy.policy);
  nsSheet.getRange(NS_CELLS.NS_NEXT_STEP).setValue(policy.nextStep);
  nsSheet.getRange(NS_CELLS.NS_CMT_SUMMARY).setValue(nsGetComment(keys.summary));
  nsSheet.getRange(NS_CELLS.NS_CMT_CAUTION).setValue(nsGetComment(keys.caution));
  nsSheet.getRange(NS_CELLS.NS_CMT_EXPLAIN).setValue(nsGetComment(keys.explain));
  nsSheet.getRange(NS_CELLS.NS_CMT_PRIORITY).setValue(nsGetComment(keys.priority));
  nsSheet.getRange(NS_CELLS.NS_CMT_SELFCARE).setValue(nsGetComment(keys.selfcare));
  nsSheet.getRange(NS_CELLS.NS_CMT_REASSESS).setValue(nsGetComment(keys.reassess));
  nsSheet.getRange(NS_CELLS.NS_CMT_PATIENT).setValue(nsGetComment(keys.patient));
  nsSheet.getRange(NS_CELLS.NS_CMT_REFERRAL).setValue(nsGetComment(keys.referral));
}
```

---

## 8. 将来の拡張ポイント

| 拡張内容 | 方法 |
|---|---|
| 判定パターンを増やす | `nsDeterminePolicy()` に条件を追加 |
| コメントを追加・修正 | `頚肩こり_コメントマスタ` シートの行を追加 / `COMMENT_DESIGN_neck_shoulder.md` を更新 |
| 神経根詳細評価を追加 | `NS_CELLS` に新セルを追加 + フラグを追加 |
| 首痛優位/肩こり優位に分岐 | prefix 決定ロジックに `主症状` 値を加える |
| NDI スコアを追加 | `NS_CELLS` に NDI スコアセルを追加 + フラグ追加 |
