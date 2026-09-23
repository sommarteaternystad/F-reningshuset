/* Föreningshuset — koppling till Apps Script-backend (se
   apps-script/Code.gs). Backend körs på Googles servrar och kollar
   lösenord/skriver till kalkylarket säkert — se den filen för
   varför det inte kan göras direkt i webbläsaren. */

var FH_API_URL = 'https://script.google.com/macros/s/AKfycbyhjrZMiiYF06qZdB9k8rWwPDx6IqfmBbtD6emkxoYe3moIAHyJO2F0nsFvpZkvadfE/exec';

async function fhApiCall(payload) {
  var res = await fetch(FH_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Kunde inte nå servern (' + res.status + ')');
  return res.json();
}

function fhApiLogin(password) {
  return fhApiCall({ action: 'login', password: password });
}

function fhApiGetDashboard(token) {
  return fhApiCall({ action: 'getDashboard', token: token });
}

function fhApiToggleTask(token, task) {
  return fhApiCall({ action: 'toggleTask', token: token, task: task });
}

function fhApiSubmitContent(token, type, text, imageBase64, imageName) {
  return fhApiCall({
    action: 'submitContent',
    token: token,
    type: type,
    text: text,
    imageBase64: imageBase64 || null,
    imageName: imageName || null
  });
}

function fhApiReportFault(token, text, imageBase64, imageName) {
  return fhApiCall({
    action: 'reportFault',
    token: token,
    text: text,
    imageBase64: imageBase64 || null,
    imageName: imageName || null
  });
}

function fhApiReportDeviation(token, text, imageBase64, imageName) {
  return fhApiCall({
    action: 'reportDeviation',
    token: token,
    text: text,
    imageBase64: imageBase64 || null,
    imageName: imageName || null
  });
}
