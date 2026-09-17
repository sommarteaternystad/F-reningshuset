/* Föreningshuset — enkelt lösenordsskydd för intranätet.
   OBS: Detta är ENDAST en enkel spärr, inte riktig säkerhet.
   Lösenordet ligger i klartext i koden. Byt till en riktig
   inloggningslösning innan känslig information läggs här. */

var FH_AUTH_KEY = 'fh_intranet_auth';
var FH_PASSWORD = '2026';

function fhHasAccess() {
  try {
    return sessionStorage.getItem(FH_AUTH_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function fhGrantAccess() {
  try {
    sessionStorage.setItem(FH_AUTH_KEY, '1');
  } catch (e) {}
}

function fhLogout() {
  try {
    sessionStorage.removeItem(FH_AUTH_KEY);
  } catch (e) {}
  window.location.href = 'for-oss-i-huset.html';
}

function fhGuardPage() {
  if (!fhHasAccess()) {
    window.location.href = 'for-oss-i-huset.html';
  }
}

function fhInitPasswordForm() {
  var form = document.getElementById('fhPasswordForm');
  var input = document.getElementById('fhPasswordInput');
  var error = document.getElementById('fhPasswordError');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = (input.value || '').trim();

    if (value === FH_PASSWORD) {
      fhGrantAccess();
      var params = new URLSearchParams(window.location.search);
      var redirect = params.get('redirect') || 'intranat.html';
      window.location.href = redirect;
    } else {
      error.classList.add('show');
      input.focus();
      input.select();
    }
  });

  input.addEventListener('input', function () {
    error.classList.remove('show');
  });
}
