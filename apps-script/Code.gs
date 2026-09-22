/* Föreningshuset — backend för inloggning per förening, uppdrag,
   nycklar och inskickat innehåll. Körs som ett Google Apps Script
   Web App, kopplat till kalkylarket "Konto för inlogg Föreningshuset".

   VARFÖR DET HÄR BEHÖVS: en vanlig hemsida (utan egen server) kan
   aldrig kolla ett lösenord säkert mot en lista som hämtas till
   besökarens webbläsare — då skulle vem som helst kunna se ALLA
   föreningars lösenord. Det här skriptet körs istället på Googles
   servrar och skickar bara tillbaka "rätt/fel", aldrig listan.

   ─────────────────────────────────────────────────────────────
   FÖRVÄNTAD KALKYLARKSSTRUKTUR (flikar/tabs):

   1. "Föreningar"
      Namn | Lösenord | Nycklar
      (en rad per förening/verksamhet — du fyller i namn, lösenord
      och hur många nycklar de har. Uppdatera "Nycklar" när de ber
      om fler.)

   2. "Uppdrag"
      Uppdrag | År
      (en rad per uppgift du vill att ALLA föreningar ska göra,
      t.ex. "Berätta om brandrutinerna för era medlemmar" | 2026.
      Lägg till en ny rad varje år.)

   3. "Uppdrag_klart"
      Datum | Förening | Uppdrag
      (fylls i AUTOMATISKT av skriptet när en förening bockar av
      ett uppdrag på sin sida — rör inte den här manuellt.)

   4. "Förslag"
      Datum | Förening | Typ | Text | Bildlänk | Status
      (fylls i AUTOMATISKT när en förening skickar in text eller
      en logga för granskning. Status börjar som "Väntar" — ändra
      till "Godkänd" eller "Avvisad" när du hanterat det. Publicera
      sedan manuellt på hemsidan, precis som idag.)
   ───────────────────────────────────────────────────────────── */

var NOTIFY_EMAIL = 'info@sommarteaternystad.com'; // hit skickas ett mejl vid nya förslag
var SESSION_HOURS = 6; // hur länge en inloggning gäller innan man behöver logga in igen
var DRIVE_FOLDER_NAME = 'Föreningshuset – Inskickat material';

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Ogiltig förfrågan' });
  }

  var action = body.action;
  if (action === 'login') return login_(body.password);
  if (action === 'getDashboard') return getDashboard_(body.token);
  if (action === 'toggleTask') return toggleTask_(body.token, body.task);
  if (action === 'submitContent') return submitContent_(body.token, body.type, body.text, body.imageBase64, body.imageName);

  return jsonOut_({ ok: false, error: 'Okänd åtgärd' });
}

function doGet() {
  return jsonOut_({ ok: true, message: 'Föreningshuset API är igång.' });
}

/* ── Inloggning ───────────────────────────────────────────── */

function login_(password) {
  if (!password) return jsonOut_({ ok: false, error: 'Lösenord saknas' });

  var sheet = getSheet_('Föreningar');
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var name = String(rows[i][0] || '').trim();
    var pass = String(rows[i][1] || '').trim();
    if (!name || !pass) continue;
    if (pass === String(password).trim()) {
      var token = Utilities.getUuid();
      CacheService.getScriptCache().put('session_' + token, name, SESSION_HOURS * 3600);
      return jsonOut_({ ok: true, token: token, name: name });
    }
  }

  return jsonOut_({ ok: false, error: 'Fel lösenord' });
}

function nameFromToken_(token) {
  if (!token) return null;
  return CacheService.getScriptCache().get('session_' + token);
}

/* ── Dashboard: nycklar + uppdrag ────────────────────────────── */

function getDashboard_(token) {
  var name = nameFromToken_(token);
  if (!name) return jsonOut_({ ok: false, error: 'Sessionen har gått ut — logga in igen.' });

  var foreningar = getSheet_('Föreningar').getDataRange().getValues();
  var nycklar = 0;
  for (var i = 1; i < foreningar.length; i++) {
    if (String(foreningar[i][0] || '').trim() === name) {
      nycklar = Number(foreningar[i][2] || 0);
      break;
    }
  }

  var uppdragRows = getSheet_('Uppdrag').getDataRange().getValues();
  var klartRows = getSheet_('Uppdrag_klart').getDataRange().getValues();

  var klarSet = {};
  for (var k = 1; k < klartRows.length; k++) {
    if (String(klartRows[k][1] || '').trim() === name) {
      klarSet[String(klartRows[k][2] || '').trim()] = String(klartRows[k][0] || '');
    }
  }

  var tasks = [];
  for (var u = 1; u < uppdragRows.length; u++) {
    var uppdrag = String(uppdragRows[u][0] || '').trim();
    if (!uppdrag) continue;
    tasks.push({
      uppdrag: uppdrag,
      ar: uppdragRows[u][1],
      klar: Object.prototype.hasOwnProperty.call(klarSet, uppdrag),
      datum: klarSet[uppdrag] || null
    });
  }

  return jsonOut_({ ok: true, name: name, nycklar: nycklar, tasks: tasks });
}

/* ── Bocka av / ångra ett uppdrag ─────────────────────────────── */

function toggleTask_(token, taskName) {
  var name = nameFromToken_(token);
  if (!name) return jsonOut_({ ok: false, error: 'Sessionen har gått ut — logga in igen.' });
  if (!taskName) return jsonOut_({ ok: false, error: 'Uppdrag saknas' });

  var sheet = getSheet_('Uppdrag_klart');
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim() === name && String(rows[i][2] || '').trim() === taskName) {
      sheet.deleteRow(i + 1);
      return jsonOut_({ ok: true, klar: false });
    }
  }

  sheet.appendRow([new Date(), name, taskName]);
  return jsonOut_({ ok: true, klar: true });
}

/* ── Skicka in text/logga för granskning ─────────────────────── */

function submitContent_(token, type, text, imageBase64, imageName) {
  var name = nameFromToken_(token);
  if (!name) return jsonOut_({ ok: false, error: 'Sessionen har gått ut — logga in igen.' });

  var link = '';
  if (imageBase64) {
    try {
      var folder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
      var bytes = Utilities.base64Decode(imageBase64.split(',').pop());
      var blob = Utilities.newBlob(bytes, MimeType.PNG, (imageName || 'logga') + '-' + Date.now() + '.png');
      var file = folder.createFile(blob);
      link = file.getUrl();
    } catch (err) {
      return jsonOut_({ ok: false, error: 'Kunde inte spara bilden: ' + err.message });
    }
  }

  getSheet_('Förslag').appendRow([new Date(), name, type || '', text || '', link, 'Väntar']);

  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Nytt förslag från ' + name + ' — Föreningshuset',
      body: 'Förening: ' + name + '\nTyp: ' + (type || '') + '\n\nText:\n' + (text || '(ingen text)') +
        (link ? '\n\nBild: ' + link : '') +
        '\n\nGranska och uppdatera status i fliken "Förslag" i kalkylarket.'
    });
  } catch (err) {
    // Mejlet är trevligt att ha men får inte stoppa inskicket.
  }

  return jsonOut_({ ok: true });
}

/* ── Hjälpfunktioner ──────────────────────────────────────────── */

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Fliken "' + name + '" saknas i kalkylarket.');
  return sheet;
}

function getOrCreateFolder_(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
