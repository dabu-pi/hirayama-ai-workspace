export const HIRAYAMA_LIVE_SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';

export const HIRAYAMA_INPUT_SYNC_CONFIG = [
  {
    sheetName: '保険・来院前提',
    kind: 'items',
    items: [
      { key: 'insurance_patients_current', label: '保険実人数（現在）', labelCell: 'A6', valueCell: 'B6' },
      { key: 'insurance_visits_current', label: '保険延べ来院数（現在）', labelCell: 'A7', valueCell: 'B7' },
      { key: 'new_patients_current', label: '新患数（現在）', labelCell: 'A9', valueCell: 'B9' },
      { key: 'chronic_candidate_rate_current', label: '慢性候補率（現在）', labelCell: 'A10', valueCell: 'B10' },
      { key: 'front_desk_unit_price', label: '窓口単価', labelCell: 'A15', valueCell: 'B15' },
      { key: 'total_insurance_unit_price', label: '総保険売上単価', labelCell: 'A16', valueCell: 'B16' },
    ],
  },
  {
    sheetName: '数値前提',
    kind: 'items',
    items: [
      { key: 'rent', label: '家賃', labelCell: 'A6', valueCell: 'B6' },
      { key: 'utilities', label: '水道光熱費', labelCell: 'A7', valueCell: 'B7' },
      { key: 'communication', label: '通信費', labelCell: 'A8', valueCell: 'B8' },
      { key: 'system_cost', label: 'システム費', labelCell: 'A9', valueCell: 'B9' },
      { key: 'advertising', label: '広告費', labelCell: 'A10', valueCell: 'B10' },
      { key: 'supplies', label: '消耗品費', labelCell: 'A11', valueCell: 'B11' },
      { key: 'outsourcing', label: '外注費', labelCell: 'A12', valueCell: 'B12' },
      { key: 'owner_minimum_labor', label: 'オーナー最低人件費', labelCell: 'A13', valueCell: 'B13' },
      { key: 'equipment_lease', label: '機器リース/返済', labelCell: 'A14', valueCell: 'B14' },
      { key: 'staff_labor', label: 'スタッフ人件費（いる場合）', labelCell: 'A15', valueCell: 'B15' },
      { key: 'business_days_per_month', label: '月次営業日数', labelCell: 'A25', valueCell: 'B25' },
    ],
  },
  {
    sheetName: '価格設定',
    kind: 'rows',
    rowLabelCellColumn: 'D',
    rows: [
      {
        row: 4,
        rowKey: 'insurance_treatment',
        rowLabel: '保険施術',
        fields: [
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K4' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L4' },
          { key: 'status', label: '確定状況', valueCell: 'M4' },
          { key: 'note', label: '備考', valueCell: 'N4' },
        ],
      },
      {
        row: 5,
        rowKey: 'manual_extension',
        rowLabel: '手技延長',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G5' },
          { key: 'member_price', label: '会員料金', valueCell: 'H5' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K5' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L5' },
          { key: 'status', label: '確定状況', valueCell: 'M5' },
          { key: 'note', label: '備考', valueCell: 'N5' },
        ],
      },
      {
        row: 6,
        rowKey: 'massage_gun_release',
        rowLabel: '筋膜リリース（マッサージガン）',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G6' },
          { key: 'member_price', label: '会員料金', valueCell: 'H6' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K6' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L6' },
          { key: 'status', label: '確定状況', valueCell: 'M6' },
          { key: 'note', label: '備考', valueCell: 'N6' },
        ],
      },
      {
        row: 7,
        rowKey: 'heat_option',
        rowLabel: '温熱追加',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G7' },
          { key: 'member_price', label: '会員料金', valueCell: 'H7' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K7' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L7' },
          { key: 'status', label: '確定状況', valueCell: 'M7' },
          { key: 'note', label: '備考', valueCell: 'N7' },
        ],
      },
      {
        row: 8,
        rowKey: 'deep_conditioning_future',
        rowLabel: '深部コンディショニング',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G8' },
          { key: 'member_price', label: '会員料金', valueCell: 'H8' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K8' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L8' },
          { key: 'status', label: '確定状況', valueCell: 'M8' },
          { key: 'note', label: '備考', valueCell: 'N8' },
        ],
      },
      {
        row: 9,
        rowKey: 'electric_therapy_single_future',
        rowLabel: '電気治療1回',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G9' },
          { key: 'member_price', label: '会員料金', valueCell: 'H9' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K9' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L9' },
          { key: 'status', label: '確定状況', valueCell: 'M9' },
          { key: 'note', label: '備考', valueCell: 'N9' },
        ],
      },
      {
        row: 10,
        rowKey: 'electric_therapy_subscription_future',
        rowLabel: '電気治療午前限定通い放題',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G10' },
          { key: 'member_price', label: '会員料金', valueCell: 'H10' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K10' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L10' },
          { key: 'status', label: '確定状況', valueCell: 'M10' },
          { key: 'note', label: '備考', valueCell: 'N10' },
        ],
      },
      {
        row: 11,
        rowKey: 'chronic_program_future',
        rowLabel: '慢性疼痛改善 8回プログラム',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G11' },
          { key: 'member_price', label: '会員料金', valueCell: 'H11' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K11' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L11' },
          { key: 'status', label: '確定状況', valueCell: 'M11' },
          { key: 'note', label: '備考', valueCell: 'N11' },
        ],
      },
      {
        row: 12,
        rowKey: 'chronic_manual_50min',
        rowLabel: '慢性ケア手技50分',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G12' },
          { key: 'member_price', label: '会員料金', valueCell: 'H12' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K12' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L12' },
          { key: 'status', label: '確定状況', valueCell: 'M12' },
          { key: 'note', label: '備考', valueCell: 'N12' },
        ],
      },
      {
        row: 13,
        rowKey: 'personal_training',
        rowLabel: 'パーソナルトレーニング',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G13' },
          { key: 'member_price', label: '会員料金', valueCell: 'H13' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K13' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L13' },
          { key: 'status', label: '確定状況', valueCell: 'M13' },
          { key: 'note', label: '備考', valueCell: 'N13' },
        ],
      },
      {
        row: 14,
        rowKey: 'training_course_4',
        rowLabel: '4回集中コース',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G14' },
          { key: 'member_price', label: '会員料金', valueCell: 'H14' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K14' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L14' },
          { key: 'status', label: '確定状況', valueCell: 'M14' },
          { key: 'note', label: '備考', valueCell: 'N14' },
        ],
      },
      {
        row: 15,
        rowKey: 'gym_monthly_member',
        rowLabel: '月会員',
        fields: [
          { key: 'general_price', label: '一般料金', valueCell: 'G15' },
          { key: 'main_technique_flag', label: '主力手技フラグ', valueCell: 'K15' },
          { key: 'kpi_target', label: 'KPI集計対象', valueCell: 'L15' },
          { key: 'status', label: '確定状況', valueCell: 'M15' },
          { key: 'note', label: '備考', valueCell: 'N15' },
        ],
      },
    ],
  },
  {
    sheetName: 'KPI目標',
    kind: 'items',
    items: [
      { key: 'monthly_total_insurance_revenue_actual', label: '月次総保険売上_実績値', expectedLabel: '月次総保険売上', labelCell: 'A5', valueCell: 'D5' },
      { key: 'self_pay_revenue_actual', label: '自費売上_実績値', expectedLabel: '自費売上', labelCell: 'A6', valueCell: 'D6' },
      { key: 'new_patients_actual', label: '新患数_実績値', expectedLabel: '新患数', labelCell: 'A8', valueCell: 'D8' },
      { key: 'total_visits_actual', label: '延べ来院数_実績値', expectedLabel: '延べ来院数', labelCell: 'A9', valueCell: 'D9' },
      { key: 'self_pay_avg_unit_price_actual', label: '自費平均単価_実績値', expectedLabel: '自費平均単価', labelCell: 'A11', valueCell: 'D11' },
    ],
  },
  {
    sheetName: '未確定項目',
    kind: 'rows',
    rowLabelCellColumn: 'B',
    rows: [
      { row: 4, rowKey: 'self_pay_price', rowLabel: '主力手技価格', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D4' },
        { key: 'status', label: '決定状況', valueCell: 'F4' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G4' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H4' },
        { key: 'note', label: '備考', valueCell: 'J4' },
      ]},
      { row: 5, rowKey: 'chronic_transition_rate', rowLabel: '慢性患者移行率', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D5' },
        { key: 'status', label: '決定状況', valueCell: 'F5' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G5' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H5' },
        { key: 'note', label: '備考', valueCell: 'J5' },
      ]},
      { row: 6, rowKey: 'avg_monthly_visits', rowLabel: '月平均来院回数', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D6' },
        { key: 'status', label: '決定状況', valueCell: 'F6' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G6' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H6' },
        { key: 'note', label: '備考', valueCell: 'J6' },
      ]},
      { row: 7, rowKey: 'self_pay_repeat_rate', rowLabel: '手技自費再来率', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D7' },
        { key: 'status', label: '決定状況', valueCell: 'F7' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G7' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H7' },
        { key: 'note', label: '備考', valueCell: 'J7' },
      ]},
      { row: 8, rowKey: 'gym_trial_rate', rowLabel: 'ジム体験誘導率', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D8' },
        { key: 'status', label: '決定状況', valueCell: 'F8' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G8' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H8' },
        { key: 'note', label: '備考', valueCell: 'J8' },
      ]},
      { row: 9, rowKey: 'gym_standard_price', rowLabel: 'ジム会員費（スタンダード月額）', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D9' },
        { key: 'status', label: '決定状況', valueCell: 'F9' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G9' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H9' },
        { key: 'note', label: '備考', valueCell: 'J9' },
      ]},
      { row: 10, rowKey: 'gym_premium_price', rowLabel: 'ジム会員費（プレミアム月額）', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D10' },
        { key: 'status', label: '決定状況', valueCell: 'F10' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G10' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H10' },
        { key: 'note', label: '備考', valueCell: 'J10' },
      ]},
      { row: 11, rowKey: 'fixed_cost_actuals', rowLabel: '固定費の実数値', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D11' },
        { key: 'status', label: '決定状況', valueCell: 'F11' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G11' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H11' },
        { key: 'note', label: '備考', valueCell: 'J11' },
      ]},
      { row: 12, rowKey: 'insurance_baseline', rowLabel: '月次保険売上・患者数ベースライン', fields: [
        { key: 'priority', label: '優先度', valueCell: 'D12' },
        { key: 'status', label: '決定状況', valueCell: 'F12' },
        { key: 'confirmed_value', label: '確定値', valueCell: 'G12' },
        { key: 'decide_when', label: 'いつ決めるか', valueCell: 'H12' },
        { key: 'note', label: '備考', valueCell: 'J12' },
      ]},
    ],
  },
];

export function buildSyncTargets(config = HIRAYAMA_INPUT_SYNC_CONFIG) {
  const ranges = [];
  for (const sheet of config) {
    if (sheet.kind === 'items') {
      for (const item of sheet.items) {
        ranges.push({ sheetName: sheet.sheetName, cell: item.labelCell, role: 'label', label: item.label });
        ranges.push({ sheetName: sheet.sheetName, cell: item.valueCell, role: 'value', label: item.label });
      }
      continue;
    }

    for (const row of sheet.rows) {
      ranges.push({
        sheetName: sheet.sheetName,
        cell: `${sheet.rowLabelCellColumn}${row.row}`,
        role: 'rowLabel',
        label: row.rowLabel,
      });
      for (const field of row.fields) {
        ranges.push({ sheetName: sheet.sheetName, cell: field.valueCell, role: 'value', label: `${row.rowLabel}:${field.label}` });
      }
    }
  }
  return ranges;
}
