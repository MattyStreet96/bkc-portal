/**
 * TKC 2027 Parent Research Portal
 * Google Apps Script backend: serves the survey and the admin dashboard,
 * and writes every response into the Google Sheet this script is attached to.
 *
 * Setup (once): set ADMIN_EMAILS below, then run setup() from the editor.
 */

// ===== SETTINGS =====
// Only these Google accounts can open the admin dashboard.
var ADMIN_EMAILS = [
  // Set the real staff emails in the Apps Script editor, not here.
  'admin@example.com'
];
var SHEET_NAME = 'Responses';

// Column order in the sheet. key = field name sent by the form, label = column header.
var COLUMNS = [
  ['id', 'Response ID'],
  ['startedAt', 'Started'],
  ['completedAt', 'Completed'],
  ['status', 'Status'],
  ['parentName', 'Parent name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['driverName', 'Driver name'],
  ['consent', 'Consent given'],
  ['class2026', 'Class 2026'],
  ['class2027', 'Class 2027'],
  ['classOther', 'Other class (detail)'],
  ['racedTkc2026', 'Raced TKC 2026'],
  ['liked2026', 'Liked about TKC 2026'],
  ['disliked2026', 'Did not like about TKC 2026'],
  ['nps', 'Recommend TKC (0-10)'],
  ['team', 'Ran with a team'],
  ['alsoRacing', 'Also racing in 2027'],
  ['alsoRacingOther', 'Also racing (other)'],
  ['clashDecider', 'Clash decider'],
  ['r_stream', 'Rating: Live streamed'],
  ['r_tyres', 'Rating: Controlled tyres'],
  ['r_msuk', 'Rating: Motorsport UK sanctioned'],
  ['r_biggrid', 'Rating: Big grid'],
  ['r_owngrid', 'Rating: Own grid, not shared'],
  ['r_officials', 'Rating: Stewards, Clerk, CCTV'],
  ['r_medical', 'Rating: Medical cover'],
  ['r_scrutineering', 'Rating: Scrutineers and dyno'],
  ['r_tv', 'Rating: TV show setting'],
  ['r_social', 'Rating: Social media coverage'],
  ['r_title', 'Rating: British or national title'],
  ['r_tracktime', 'Rating: Track time and races'],
  ['r_practiceincl', 'Rating: Practice included in entry'],
  ['format', 'Format preference'],
  ['roundFormat', 'Rounds vs racing per round'],
  ['sanction', 'MSUK or IKR'],
  ['budget', 'Total 2027 season budget'],
  ['raceWeekends', 'Race weekends per month'],
  ['testDays', 'Test days per month'],
  ['travel', 'Willing to travel'],
  ['postcode', 'Postcode area'],
  ['drivenDreams', 'Driven Dreams interest'],
  ['signed2027', 'Signed up TKC 2027'],
  ['racingInstead', 'Racing instead'],
  ['racingInsteadOther', 'Racing instead (other)'],
  ['why', 'Why']
];
var CONTACT_KEYS = ['parentName', 'email', 'phone', 'driverName', 'consent'];
var RATING_KEYS = ['r_stream', 'r_tyres', 'r_msuk', 'r_biggrid', 'r_owngrid', 'r_officials', 'r_medical', 'r_scrutineering', 'r_tv', 'r_social', 'r_title', 'r_tracktime', 'r_practiceincl'];
var REQUIRED_KEYS = ['class2026', 'class2027', 'racedTkc2026', 'team', 'alsoRacing', 'clashDecider', 'format', 'roundFormat', 'sanction', 'budget', 'raceWeekends', 'testDays', 'travel', 'postcode', 'drivenDreams', 'signed2027'];

// ===== WEB APP ENTRY POINTS =====
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || '';
  var file = page === 'admin' ? 'Admin' : 'Form';
  var title = page === 'admin' ? 'TKC 2027 Research Dashboard' : 'Help Shape 2027 | The Kart Championship';
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Used when the form is hosted on its own domain and posts here with fetch().
function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'start') out = startSurvey(body.data);
    else if (body.action === 'submit') out = submitSurvey(body.data);
    else out = { ok: false, error: 'Unknown action' };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ===== FORM HANDLERS =====
/** Step 1: saves contact details straight away so a lead is kept even if they stop. */
function startSurvey(data) {
  data = data || {};
  if (data.website) return { ok: true, id: '' }; // honeypot: bots fill hidden fields
  checkContact_(data);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var id = Utilities.getUuid();
    var row = COLUMNS.map(function (c) {
      if (c[0] === 'id') return id;
      if (c[0] === 'startedAt') return new Date();
      if (c[0] === 'status') return 'Started';
      return CONTACT_KEYS.indexOf(c[0]) > -1 ? clean_(data[c[0]]) : '';
    });
    sheet.appendRow(row);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Final step: writes the full set of answers onto the same row (or a new row if step 1 failed). */
function submitSurvey(data) {
  data = data || {};
  if (data.website) return { ok: true };
  checkContact_(data);
  REQUIRED_KEYS.forEach(function (k) { if (!data[k]) throw new Error('Missing answer: ' + k); });
  RATING_KEYS.forEach(function (k) {
    var n = Number(data[k]);
    if (!(n >= 1 && n <= 10)) throw new Error('Missing rating');
  });
  if (data.racedTkc2026 === 'Yes') {
    var nps = data.nps === '' || data.nps == null ? NaN : Number(data.nps);
    if (!(nps >= 0 && nps <= 10)) throw new Error('Missing recommend score');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var rowIndex = data.id ? findRowById_(sheet, String(data.id)) : -1;
    var existing = rowIndex > 0 ? sheet.getRange(rowIndex, 1, 1, COLUMNS.length).getValues()[0] : null;
    var now = new Date();
    var row = COLUMNS.map(function (c, i) {
      var k = c[0];
      if (k === 'id') return existing ? existing[i] : (data.id || Utilities.getUuid());
      if (k === 'startedAt') return existing && existing[i] ? existing[i] : now;
      if (k === 'completedAt') return now;
      if (k === 'status') return 'Completed';
      if (RATING_KEYS.indexOf(k) > -1) return Number(data[k]);
      if (k === 'nps') return data.racedTkc2026 === 'Yes' ? Number(data.nps) : '';
      return clean_(data[k]);
    });
    if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ===== ADMIN =====
function getAdminData() {
  var user = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var allowed = ADMIN_EMAILS.map(function (e) { return e.toLowerCase(); });
  if (!user || allowed.indexOf(user) === -1) {
    return { ok: false, error: user ? ('Access denied for ' + user) : 'Please open the admin link while signed in to an approved Google account.' };
  }
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    var o = {};
    COLUMNS.forEach(function (c, i) {
      var v = r[i];
      o[c[0]] = v instanceof Date ? v.toISOString() : v;
    });
    return o;
  });
  return { ok: true, user: user, rows: rows, sheetUrl: sheet.getParent().getUrl(), columns: COLUMNS, generatedAt: new Date().toISOString() };
}

// ===== SETUP =====
/** Run once from the Apps Script editor. Creates and formats the Responses tab. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the Google Sheet (Extensions > Apps Script) and run setup again.');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  var headers = COLUMNS.map(function (c) { return c[1]; });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0b0c0f').setFontColor('#f4f5f7').setWrap(true).setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(5);
  sheet.setRowHeight(1, 42);
  sheet.setColumnWidths(1, headers.length, 150);
  sheet.setColumnWidth(1, 90);
  sheet.getRange('B:C').setNumberFormat('dd/mm/yyyy hh:mm');
  sheet.getRange('G:G').setNumberFormat('@'); // keep leading zeros on phone numbers
  // Highlight responses that only completed step 1
  var rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2="Started"').setBackground('#f9eeda')
    .setRanges([sheet.getRange(2, 1, 1000, headers.length)]).build());
  sheet.setConditionalFormatRules(rules);
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  return 'Ready: ' + ss.getUrl();
}

// ===== HELPERS =====
function getSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Responses sheet missing. Run setup() in the Apps Script editor.');
  return sheet;
}

function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

function checkContact_(d) {
  if (!d.parentName || !d.driverName) throw new Error('Name missing');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email || ''))) throw new Error('Email invalid');
  if (String(d.phone || '').replace(/[^\d]/g, '').length < 10) throw new Error('Phone invalid');
  if (d.consent !== 'Yes') throw new Error('Consent missing');
}

/** Trims, caps length and stops anything being read as a spreadsheet formula. */
function clean_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim().slice(0, 2000);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
