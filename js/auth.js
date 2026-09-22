/* Föreningshuset — inloggning per förening/verksamhet.
   Lösenordet kollas säkert på servern (Apps Script, se
   js/tenant-api.js och apps-script/Code.gs) — aldrig i
   webbläsaren. En lyckad inloggning ger en token som identifierar
   vilken förening det är, utan att avslöja några andra föreningars
   lösenord. */

var FH_TOKEN_KEY = 'fh_tenant_token';
var FH_NAME_KEY = 'fh_tenant_name';

function fhHasAccess() {
  try {
    return !!sessionStorage.getItem(FH_TOKEN_KEY);
  } catch (e) {
    return false;
  }
}

function fhGetToken() {
  try {
    return sessionStorage.getItem(FH_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function fhGetTenantName() {
  try {
    return sessionStorage.getItem(FH_NAME_KEY);
  } catch (e) {
    return null;
  }
}

function fhGrantAccess(token, name) {
  try {
    sessionStorage.setItem(FH_TOKEN_KEY, token);
    sessionStorage.setItem(FH_NAME_KEY, name);
  } catch (e) {}
}

function fhLogout() {
  try {
    sessionStorage.removeItem(FH_TOKEN_KEY);
    sessionStorage.removeItem(FH_NAME_KEY);
  } catch (e) {}
  window.location.href = 'for-oss-i-huset.html';
}

function fhGuardPage() {
  if (!fhHasAccess()) {
    window.location.href = 'for-oss-i-huset.html';
  }
}

/* Skriver ut inloggad förenings namn där <span data-fh-tenant-name>
   finns på sidan — frivilligt, bara en trevlig detalj. */
function fhRenderTenantName() {
  var name = fhGetTenantName();
  if (!name) return;
  document.querySelectorAll('[data-fh-tenant-name]').forEach(function (el) {
    el.textContent = name;
  });
}

function fhInitPasswordForm() {
  var form = document.getElementById('fhPasswordForm');
  var input = document.getElementById('fhPasswordInput');
  var error = document.getElementById('fhPasswordError');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var value = (input.value || '').trim();
    if (!value) return;

    error.classList.remove('show');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Loggar in …';
    }

    try {
      var result = await fhApiLogin(value);
      if (result.ok) {
        fhGrantAccess(result.token, result.name);
        var params = new URLSearchParams(window.location.search);
        var redirect = params.get('redirect') || 'intranat.html';
        window.location.href = redirect;
        return;
      }
      error.textContent = result.error || 'Fel lösenord — försök igen.';
      error.classList.add('show');
      input.focus();
      input.select();
    } catch (err) {
      error.textContent = 'Kunde inte nå inloggningen just nu — kontrollera internetanslutningen och försök igen.';
      error.classList.add('show');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Logga in →';
      }
    }
  });

  input.addEventListener('input', function () {
    error.classList.remove('show');
  });
}
