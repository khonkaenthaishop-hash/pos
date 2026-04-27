// Google Apps Script — Image Upload to Drive + Sheet logging
// Deploy as: Web app > Execute as: Me > Who has access: Anyone
// Replace FOLDER_ID and SHEET_ID with your values before deploying.

const FOLDER_ID = '1coPyZgvYmh3qlWHew0lx1SGRfoYTxJuA';
const SHEET_ID  = '1jjlfeGcNZEuyHPMmkevQA_AnZwWH8Nxqv8-VbPQ3i5k';

function doPost(e) {
  try {
    const { name, mimeType, data } = JSON.parse(e.postData.contents);
    if (!data) return jsonError('ไม่พบไฟล์');

    const bytes = Utilities.base64Decode(data);
    if (bytes.length > 2 * 1024 * 1024) return jsonError('ไฟล์ใหญ่เกิน 2MB');

    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', name || 'product');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const driveFile = folder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const url = 'https://drive.google.com/uc?export=view&id=' + driveFile.getId();

    SpreadsheetApp.openById(SHEET_ID).getActiveSheet()
      .appendRow([name, url, new Date().toISOString()]);

    return ContentService.createTextOutput(JSON.stringify({ url }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonError(err.message);
  }
}

function jsonError(msg) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
