'use strict';

// =====================================================
// ダミーデータ（種目別の過去セッション記録）
// =====================================================
const DUMMY_HISTORY = {
  'Bench Press': [
    {
      date: '2026-04-01',
      program: 'GZCLP Week 8 Day 1',
      sets: [
        { set: 1, kg: 80,   reps: 3, note: '' },
        { set: 2, kg: 80,   reps: 3, note: '' },
        { set: 3, kg: 80,   reps: 7, note: 'AMRAP（最大回数）', amrap: true },
      ]
    },
    {
      date: '2026-03-28',
      program: 'GZCLP Week 7 Day 3',
      sets: [
        { set: 1, kg: 77.5, reps: 3, note: '' },
        { set: 2, kg: 77.5, reps: 3, note: '' },
        { set: 3, kg: 77.5, reps: 3, note: '' },
      ]
    },
    {
      date: '2026-03-25',
      program: 'GZCLP Week 7 Day 1',
      sets: [
        { set: 1, kg: 77.5, reps: 5, note: '' },
        { set: 2, kg: 77.5, reps: 5, note: '' },
        { set: 3, kg: 77.5, reps: 4, note: '' },
      ]
    },
    {
      date: '2026-03-18',
      program: 'GZCLP Week 6 Day 3',
      sets: [
        { set: 1, kg: 75,   reps: 3, note: '' },
        { set: 2, kg: 75,   reps: 3, note: '' },
        { set: 3, kg: 75,   reps: 6, note: 'AMRAP（最大回数）', amrap: true },
      ]
    },
  ],

  'Squat': [
    {
      date: '2026-04-01',
      program: '5/3/1 Week 2 Day 1',
      sets: [
        { set: 1, kg: 100,  reps: 8, note: '' },
        { set: 2, kg: 100,  reps: 8, note: '' },
        { set: 3, kg: 100,  reps: 6, note: '' },
      ]
    },
    {
      date: '2026-03-28',
      program: '5/3/1 Week 1 Day 3',
      sets: [
        { set: 1, kg: 97.5, reps: 8, note: '' },
        { set: 2, kg: 97.5, reps: 8, note: '' },
        { set: 3, kg: 97.5, reps: 8, note: '' },
      ]
    },
    {
      date: '2026-03-22',
      program: '5/3/1 Week 1 Day 1',
      sets: [
        { set: 1, kg: 95,   reps: 10, note: '' },
        { set: 2, kg: 95,   reps: 10, note: '' },
        { set: 3, kg: 95,   reps: 9,  note: '' },
      ]
    },
    {
      date: '2026-03-15',
      program: '5/3/1 Week 0 Day 3（テスト）',
      sets: [
        { set: 1, kg: 90,   reps: 5,  note: '' },
        { set: 2, kg: 90,   reps: 5,  note: '' },
        { set: 3, kg: 90,   reps: 5,  note: '' },
      ]
    },
  ],

  'Lat Pulldown': [
    // 空配列 = 初回・記録なし
  ],

  // その他の種目はフォールバックデータを使う
  '__default__': [
    {
      date: '2026-04-01',
      program: '5/3/1 Beginner Week 2 Day 1',
      sets: [
        { set: 1, kg: 60, reps: 10, note: '' },
        { set: 2, kg: 60, reps: 10, note: '' },
      ]
    },
    {
      date: '2026-03-28',
      program: '5/3/1 Beginner Week 1 Day 3',
      sets: [
        { set: 1, kg: 57.5, reps: 10, note: '' },
        { set: 2, kg: 57.5, reps: 10, note: '' },
      ]
    },
  ]
};

// =====================================================
// URL パラメータを読み込む
// =====================================================
const params  = new URLSearchParams(window.location.search);
const exName  = params.get('name') || 'Bench Press';
const exType  = params.get('type') || 'T1';

// =====================================================
// ヘッダーに種目名・タイプバッジを反映
// =====================================================
document.title = `${exName} — 履歴`;
document.getElementById('exercise-title').textContent = exName;

const badge = document.getElementById('type-badge');
badge.textContent = exType;
badge.className = `type-badge ${exType.toLowerCase()}`;

// =====================================================
// 履歴データを取得（種目名で分岐、なければデフォルト）
// =====================================================
const sessions = DUMMY_HISTORY[exName] !== undefined
  ? DUMMY_HISTORY[exName]
  : DUMMY_HISTORY['__default__'];

// =====================================================
// 空状態（記録なし）の表示
// =====================================================
if (sessions.length === 0) {
  document.getElementById('summary-section').hidden = true;
  document.getElementById('prev-hint').hidden = true;
  document.getElementById('empty-state').removeAttribute('hidden');
} else {
  // =====================================================
  // サマリーエリアを最新セッションで更新
  // =====================================================
  const latest = sessions[0];
  document.getElementById('summary-date').textContent = `最新: ${latest.date}`;
  document.getElementById('summary-sets').textContent =
    latest.sets.map(s => `${s.kg}kg×${s.reps}`).join(',  ');
  document.getElementById('summary-program').textContent = latest.program;

  // =====================================================
  // 履歴一覧を生成（新しい順）
  // =====================================================
  const listEl = document.getElementById('history-list');

  sessions.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';

    // カードヘッダー（日付・プログラム名）
    const header = document.createElement('div');
    header.className = 'session-card-header';
    header.innerHTML = `
      <span class="session-date">${session.date}</span>
      <span class="session-program">${session.program}</span>
    `;
    card.appendChild(header);

    // セット明細ヘッダー行
    const setHeader = document.createElement('div');
    setHeader.className = 'set-detail-header';
    setHeader.innerHTML = `
      <span>#</span>
      <span>Kg</span>
      <span>Reps</span>
      <span></span>
    `;
    card.appendChild(setHeader);

    // セット明細行
    session.sets.forEach(s => {
      const row = document.createElement('div');
      row.className = `set-detail-row${s.amrap ? ' amrap-row' : ''}`;
      row.innerHTML = `
        <span class="col-set-num">${s.set}</span>
        <span class="col-kg-val">${s.kg}kg</span>
        <span class="col-reps-val">${s.reps}${s.amrap ? ' 🔥' : ''}</span>
        <span class="col-note">${s.note}</span>
      `;
      card.appendChild(row);
    });

    listEl.appendChild(card);
  });
}

// =====================================================
// 戻るボタン → 今日のワークアウト画面へ
// =====================================================
document.getElementById('btn-back').addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = '../workout-session/';
  }
});
