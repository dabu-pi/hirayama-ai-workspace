// 旧コード（2020大阪案件用）- 本プロジェクトでは未使用
// onOpen は hawkメール自動貼り付け.js で一元管理しているためここでは定義しない

function hideCompleteditems() {
  const sheetObj = SpreadsheetApp.getActive().getSheetByName('2020大阪案件');
  const lastRow = sheetObj.getLastRow();
  for (let currentRow = 1; currentRow <= lastRow; currentRow++) {
    const value = sheetObj.getRange(currentRow, 1).getValue();
    if (value == '完了' || value == '成約完了') sheetObj.hideRows(currentRow);
  }
}

function showCompleteditems() {
  const sheetObj = SpreadsheetApp.getActive().getSheetByName('2020大阪案件');
  const lastRow = sheetObj.getLastRow();
  for (let currentRow = 1; currentRow <= lastRow; currentRow++) {
    const value = sheetObj.getRange(currentRow, 1).getValue();
    if (value == '完了' || value == '成約完了') sheetObj.showRows(currentRow);
  }
}
