'use strict';

// =====================================================
// セッションタイマー（経過時間）
// =====================================================
let elapsedSeconds = 0;
const timerEl = document.getElementById('timer');

const sessionTimer = setInterval(() => {
  elapsedSeconds++;
  timerEl.textContent = formatTime(elapsedSeconds);
}, 1000);

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// =====================================================
// トースト通知 (Toast)
// =====================================================
let toastTimer = null;

function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// =====================================================
// Kg 自動反映
// 1セット目の Kg 入力確定 → 後続セットの空欄へ同値を反映
// =====================================================
document.querySelectorAll('.set-list').forEach(setList => {
  setList.addEventListener('change', e => {
    const inp = e.target;
    if (!inp.classList.contains('kg-input')) return;

    const row = inp.closest('.set-row');
    if (!row) return;

    const allRows = [...setList.querySelectorAll('.set-row')];
    const idx = allRows.indexOf(row);
    if (idx !== 0) return; // 1セット目だけ反応

    const val = inp.value.trim();
    if (!val) return;

    let reflectedCount = 0;
    allRows.slice(1).forEach(r => {
      if (r.classList.contains('locked')) return;
      const target = r.querySelector('.kg-input');
      if (!target || target.value !== '') return; // 入力済みはスキップ
      target.value = val;
      target.classList.add('auto-filled');
      reflectedCount++;
    });

    if (reflectedCount > 0) {
      showToast(`後続 ${reflectedCount} セットへ ${val}kg を自動反映しました`);
    }
  });
});

// =====================================================
// 完了チェック → 行ロック
// =====================================================
document.addEventListener('change', e => {
  const check = e.target;
  if (!check.classList.contains('done-check')) return;

  const row = check.closest('.set-row');
  if (!row) return;

  if (check.checked) {
    // ロック
    row.classList.add('locked');
    row.querySelector('.kg-input').disabled = true;
    row.querySelector('.reps-input').disabled = true;

    // ロック解除ボタンがなければ追加
    if (!row.querySelector('.unlock-btn')) {
      const btn = document.createElement('button');
      btn.className = 'unlock-btn';
      btn.textContent = 'ロック解除';
      btn.setAttribute('type', 'button');
      row.appendChild(btn);
    }
  }
});

// =====================================================
// ロック解除ボタン
// =====================================================
document.addEventListener('click', e => {
  const btn = e.target;
  if (!btn.classList.contains('unlock-btn')) return;

  const row = btn.closest('.set-row');
  if (!row) return;

  row.classList.remove('locked');
  row.querySelector('.kg-input').disabled = false;
  row.querySelector('.reps-input').disabled = false;
  row.querySelector('.done-check').checked = false;
  showToast('ロックを解除しました。再入力後にチェックしてください。');
});

// =====================================================
// Add Set（セット追加）
// =====================================================
document.addEventListener('click', e => {
  const btn = e.target;
  if (!btn.classList.contains('btn-add-set')) return;

  const targetId = btn.dataset.target;
  const setList = document.getElementById(targetId);
  if (!setList) return;

  const rows = [...setList.querySelectorAll('.set-row')];
  const lastRow = rows[rows.length - 1];
  const newRow = lastRow.cloneNode(true);
  const newIndex = rows.length;

  // セット番号を更新
  newRow.dataset.setIndex = newIndex;
  newRow.querySelector('.set-num').textContent = newIndex + 1;

  // 入力値をクリア
  newRow.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.value = '';
    inp.disabled = false;
    inp.classList.remove('auto-filled');
  });
  const doneCheck = newRow.querySelector('.done-check');
  doneCheck.checked = false;

  // ロック解除
  newRow.classList.remove('locked');
  const unlockBtn = newRow.querySelector('.unlock-btn');
  if (unlockBtn) unlockBtn.remove();

  // Previous を "-" に（追加行は前回記録なし）
  const prevEl = newRow.querySelector('.prev-val');
  prevEl.textContent = '-';
  prevEl.classList.add('none');

  setList.appendChild(newRow);
  showToast('セットを追加しました');
});

// =====================================================
// 種目名タップ → 種目単体履歴画面へ遷移
// =====================================================
document.addEventListener('click', e => {
  const btn = e.target.closest('.exercise-name-btn');
  if (!btn) return;
  if (e.target.classList.contains('unlock-btn')) return;

  const name = btn.dataset.name || '';
  const type = btn.dataset.type || 'T3';
  // serve が index.html→ディレクトリへリダイレクトするためクエリが消える問題を避け、
  // ディレクトリ URL（末尾スラッシュ付き）で遷移する
  const url = `../exercise-history/?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  window.location.href = url;
});

// =====================================================
// Swap（種目置き換え）
// =====================================================
document.addEventListener('click', e => {
  const btn = e.target;
  if (!btn.classList.contains('btn-swap')) return;

  const block = btn.closest('.exercise-block');
  const name = block ? block.querySelector('.exercise-name-btn').dataset.name : '種目';
  showToast(`${name} を別の種目に置き換える（Swap — 実装準備中）`, 2500);
});

// =====================================================
// ・・・（その他操作）
// =====================================================
document.addEventListener('click', e => {
  if (!e.target.classList.contains('btn-more')) return;
  showToast('その他操作メニュー（実装準備中）');
});

// =====================================================
// Add Exercise（種目追加）
// =====================================================
document.getElementById('btn-add-exercise').addEventListener('click', () => {
  const area = document.getElementById('add-exercise-area');
  const uid = 'sets-new-' + Date.now();

  const newBlock = document.createElement('section');
  newBlock.className = 'exercise-block';
  newBlock.dataset.exercise = uid;
  newBlock.innerHTML = `
    <div class="exercise-header">
      <span class="type-badge t3">T3</span>
      <button class="exercise-name-btn" data-name="新規種目">
        新規種目 <span class="hist-arrow">›</span>
      </button>
    </div>
    <div class="set-list" id="${uid}">
      <div class="set-header-row">
        <span class="col-set">#</span>
        <span class="col-prev">前回</span>
        <span class="col-target">目標</span>
        <span class="col-kg">Kg</span>
        <span class="col-reps">Reps</span>
        <span class="col-done">✓</span>
      </div>
      <div class="set-row" data-set-index="0">
        <span class="col-set set-num">1</span>
        <span class="col-prev prev-val none">-</span>
        <span class="col-target target-val">-</span>
        <input class="col-kg kg-input" type="number" inputmode="decimal" placeholder="">
        <input class="col-reps reps-input" type="number" inputmode="numeric" placeholder="">
        <input class="col-done done-check" type="checkbox">
      </div>
    </div>
    <div class="exercise-actions">
      <button class="btn-add-set" data-target="${uid}">＋ Add Set</button>
      <button class="btn-swap">Swap</button>
      <button class="btn-more">・・・</button>
    </div>
  `;

  area.before(newBlock);
  newBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('種目を追加しました（ダミー）', 2000);
});

// =====================================================
// Calc（重量計算補助）
// =====================================================
document.getElementById('btn-calc').addEventListener('click', () => {
  showToast('Calc（重量計算補助 / 1RM換算）— 実装準備中', 2500);
});

// =====================================================
// Rest タイマー（休憩タイマー）モーダル
// =====================================================
const restModal = document.getElementById('rest-modal');
const restDisplay = document.getElementById('rest-timer-display');
const restStartBtn = document.getElementById('rest-start');

let restRemaining = 90;
let restInterval = null;
let isRestRunning = false;

document.getElementById('btn-rest').addEventListener('click', () => {
  restRemaining = 90;
  renderRestDisplay();
  restModal.removeAttribute('hidden');
  document.querySelector('.btn-preset[data-sec="90"]').classList.add('selected');
});

// プリセットボタン
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    restRemaining = parseInt(btn.dataset.sec, 10);
    renderRestDisplay();
    if (isRestRunning) stopRestTimer();
    restStartBtn.textContent = 'スタート';
    restStartBtn.classList.remove('running');
  });
});

document.getElementById('rest-cancel').addEventListener('click', () => {
  stopRestTimer();
  restModal.setAttribute('hidden', '');
});

restStartBtn.addEventListener('click', () => {
  if (isRestRunning) {
    stopRestTimer();
    restStartBtn.textContent = 'スタート';
    restStartBtn.classList.remove('running');
  } else {
    startRestTimer();
    restStartBtn.textContent = '停止';
    restStartBtn.classList.add('running');
  }
});

function startRestTimer() {
  isRestRunning = true;
  restInterval = setInterval(() => {
    restRemaining--;
    renderRestDisplay();
    if (restRemaining <= 0) {
      stopRestTimer();
      restStartBtn.textContent = 'スタート';
      restStartBtn.classList.remove('running');
      restModal.setAttribute('hidden', '');
      showToast('休憩終了！次のセットを始めましょう', 2500);
    }
  }, 1000);
}

function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  isRestRunning = false;
}

function renderRestDisplay() {
  const m = Math.floor(restRemaining / 60);
  const s = String(restRemaining % 60).padStart(2, '0');
  restDisplay.textContent = `${m}:${s}`;
}

// =====================================================
// Finish（ワークアウト終了）
// =====================================================
document.getElementById('btn-finish').addEventListener('click', () => {
  const totalSets = document.querySelectorAll('.set-row').length;
  const doneSets  = document.querySelectorAll('.set-row.locked').length;
  const remaining = totalSets - doneSets;

  if (remaining > 0) {
    const proceed = confirm(
      `未完了のセットが ${remaining} つあります。\nこのまま完了しますか？\n\n完了済み: ${doneSets}/${totalSets} セット`
    );
    if (!proceed) return;
  }

  clearInterval(sessionTimer);
  showToast(`ワークアウト完了！（${formatTime(elapsedSeconds)} 経過）記録完了画面へ — 実装準備中`, 3500);
});

// =====================================================
// モーダル外タップで閉じる
// =====================================================
restModal.addEventListener('click', e => {
  if (e.target === restModal) {
    stopRestTimer();
    restModal.setAttribute('hidden', '');
  }
});
