/**
 * ワイルドボア会員管理システム — メインエントリポイント
 *
 * GAS Webアプリのエントリポイント。
 * URLパラメータ（page）に基づいて適切なHTMLを返す。
 *
 * 画面構成：
 *   page=home            ホーム画面
 *   page=intake-form     入会申込フォーム（タブレット用）
 *   page=intake-confirm  入会申込確認画面
 *   page=member-list     会員一覧（スタッフ用）
 *   page=member-detail   会員詳細（スタッフ用）
 *   page=member-edit     会員編集（スタッフ用）
 *   page=status-change   ステータス変更（スタッフ用）
 *   page=billing         請求ダッシュボード（スタッフ用）
 *   page=settings        システム設定（スタッフ用）
 *
 * @param {Object} e - GASのWebアプリイベントオブジェクト
 * @returns {HtmlOutput} HTML出力
 */
function doGet(e) {
  // TODO: Phase 2 以降で実装する
  var page = e.parameter.page || 'home';
  var template;

  // スタッフ画面は認証チェックを行う
  var staffPages = ['member-list', 'member-detail', 'member-edit', 'status-change', 'billing', 'settings'];
  if (staffPages.indexOf(page) !== -1) {
    // TODO: 認証チェックを実装する
    // if (!isAuthenticated()) {
    //   return HtmlService.createHtmlOutput('<p>アクセス権限がありません。</p>');
    // }
  }

  switch (page) {
    case 'home':
      template = HtmlService.createTemplateFromFile('html/home');
      break;
    case 'intake-form':
      template = HtmlService.createTemplateFromFile('html/intake-form');
      break;
    case 'intake-confirm':
      template = HtmlService.createTemplateFromFile('html/intake-confirm');
      break;
    case 'member-list':
      template = HtmlService.createTemplateFromFile('html/member-list');
      break;
    case 'member-detail':
      template = HtmlService.createTemplateFromFile('html/member-detail');
      break;
    case 'member-edit':
      template = HtmlService.createTemplateFromFile('html/member-edit');
      break;
    case 'status-change':
      template = HtmlService.createTemplateFromFile('html/status-change');
      break;
    case 'billing':
      template = HtmlService.createTemplateFromFile('html/billing-dashboard');
      break;
    case 'settings':
      template = HtmlService.createTemplateFromFile('html/settings');
      break;
    default:
      template = HtmlService.createTemplateFromFile('html/home');
  }

  return template.evaluate()
    .setTitle('ワイルドボア会員管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTMLファイルに共通レイアウトをインクルードするためのヘルパー関数
 *
 * @param {string} filename - インクルードするHTMLファイル名（拡張子なし）
 * @returns {string} HTMLの内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
