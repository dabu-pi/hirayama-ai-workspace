/**
 * ワイルドボア会員管理システム — PDF出力サービス
 *
 * 入会申込書・領収書等のPDF生成を担当する。
 *
 * 依存：Config.gs, SheetService.gs, DriveApp
 */

/**
 * 入会申込書のPDFを生成する
 *
 * 申込内容を整形してGoogleドライブに保存し、URLを返す。
 *
 * @param {string} applicationId - 申込ID
 * @returns {string} PDFのダウンロードURL
 */
function generateIntakeApplicationPdf(applicationId) {
  // TODO: Phase 8 で実装する
  // 1. IntakeService.getIntakeApplicationById で申込データを取得する
  // 2. HTMLテンプレートにデータを流し込む
  // 3. GASのHtmlOutput → PDFに変換する
  // 4. Googleドライブに保存する
  // 5. URLを返す
  throw new Error('未実装: PdfService.generateIntakeApplicationPdf');
}

/**
 * 領収書PDFを生成する
 *
 * @param {string} paymentId - 支払いID
 * @returns {string} PDFのダウンロードURL
 */
function generateReceiptPdf(paymentId) {
  // TODO: Phase 8 で実装する
  throw new Error('未実装: PdfService.generateReceiptPdf');
}

/**
 * HTML文字列をPDFに変換してGoogleドライブに保存する
 *
 * @param {string} htmlContent - HTMLの内容
 * @param {string} fileName - PDFのファイル名（拡張子なし）
 * @returns {string} PDFのダウンロードURL
 */
function convertHtmlToPdf(htmlContent, fileName) {
  // TODO: Phase 8 で実装する
  // GASではHTMLを直接PDFに変換する標準機能がないため、
  // Google Driveの変換機能を利用する方法を検討する
  throw new Error('未実装: PdfService.convertHtmlToPdf');
}
