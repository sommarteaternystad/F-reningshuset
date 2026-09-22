/* Föreningshuset — Mina sidor: nycklar, uppdrag och formulär för
   att skicka in text/logga till hemsidan. Hämtar och skriver data
   via Apps Script-backend (js/tenant-api.js). */

function fhReadFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fhIsSubmitTask(taskName) {
  var t = (taskName || '').toLowerCase();
  return t.indexOf('skicka in') !== -1 && (t.indexOf('text') !== -1 || t.indexOf('logga') !== -1 || t.indexOf('bild') !== -1);
}

function fhToggleSubmitPanel() {
  var panel = document.getElementById('fhSubmitPanel');
  if (!panel) return;
  var willShow = !panel.classList.contains('is-visible');
  panel.classList.toggle('is-visible', willShow);
  if (willShow) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fhRenderTasks(tasks, token) {
  var list = document.getElementById('fhTaskList');
  if (!list) return;
  list.innerHTML = '';

  if (!tasks.length) {
    var empty = document.createElement('p');
    empty.className = 'task-meta';
    empty.textContent = 'Inga uppdrag inlagda ännu.';
    list.appendChild(empty);
    return;
  }

  tasks.forEach(function (task) {
    var item = document.createElement('div');
    item.className = 'task-item' + (task.klar ? ' is-done' : '');
    item.setAttribute('role', 'checkbox');
    item.setAttribute('aria-checked', task.klar ? 'true' : 'false');
    item.tabIndex = 0;

    var box = document.createElement('div');
    box.className = 'task-checkbox';
    box.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

    var body = document.createElement('div');
    body.className = 'task-body';
    var title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.uppdrag;
    var meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = task.ar ? ('År ' + task.ar) + (task.klar ? ' · Avklarat' : '') : (task.klar ? 'Avklarat' : 'Ej avklarat');
    body.appendChild(title);
    body.appendChild(meta);

    item.appendChild(box);
    item.appendChild(body);

    var pending = false;
    async function toggle() {
      if (pending) return;
      pending = true;
      var willBeDone = !item.classList.contains('is-done');
      item.classList.toggle('is-done', willBeDone);
      item.setAttribute('aria-checked', willBeDone ? 'true' : 'false');
      meta.textContent = (task.ar ? 'År ' + task.ar : '') + (willBeDone ? ' · Avklarat' : ' · Ej avklarat');

      try {
        var res = await fhApiToggleTask(token, task.uppdrag);
        if (!res.ok) {
          item.classList.toggle('is-done', !willBeDone);
          meta.textContent = (task.ar ? 'År ' + task.ar : '') + (!willBeDone ? ' · Avklarat' : ' · Ej avklarat');
        } else {
          task.klar = res.klar;
        }
      } catch (err) {
        item.classList.toggle('is-done', !willBeDone);
      } finally {
        pending = false;
      }
    }

    var isSubmitTask = fhIsSubmitTask(task.uppdrag);
    function handleActivate() {
      toggle();
      if (isSubmitTask) fhToggleSubmitPanel();
    }

    item.addEventListener('click', handleActivate);
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); }
    });

    list.appendChild(item);
  });
}

async function fhInitDashboard() {
  var token = fhGetToken();
  var statusEl = document.getElementById('fhDashboardStatus');
  var keyNumberEl = document.getElementById('fhKeyCount');

  fhRenderTenantName();

  try {
    var data = await fhApiGetDashboard(token);
    if (!data.ok) {
      if (statusEl) {
        statusEl.textContent = data.error || 'Kunde inte hämta din information.';
        statusEl.className = 'fh-cal-status is-error';
      }
      if (data.error && data.error.indexOf('Sessionen') !== -1) {
        setTimeout(function () { fhLogout(); }, 1500);
      }
      return;
    }

    if (keyNumberEl) keyNumberEl.textContent = data.nycklar;
    document.querySelectorAll('[data-fh-tenant-name]').forEach(function (el) { el.textContent = data.name; });
    fhRenderTasks(data.tasks || [], token);
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Kunde inte nå servern just nu. Kontrollera internetanslutningen och ladda om sidan.';
      statusEl.className = 'fh-cal-status is-error';
    }
  }
}

function fhInitSubmitForm() {
  var form = document.getElementById('fhSubmitForm');
  var status = document.getElementById('fhSubmitStatus');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var token = fhGetToken();
    var type = form.fhSubmitType.value;
    var text = form.fhSubmitText.value.trim();
    var fileInput = form.fhSubmitImage;
    var submitBtn = form.querySelector('button[type="submit"]');

    if (!text && !(fileInput.files && fileInput.files[0])) return;

    var imageBase64 = null;
    var imageName = null;
    if (fileInput.files && fileInput.files[0]) {
      var file = fileInput.files[0];
      imageName = file.name;
      imageBase64 = await fhReadFileAsDataUrl(file);
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Skickar …'; }

    try {
      var res = await fhApiSubmitContent(token, type, text, imageBase64, imageName);
      if (res.ok) {
        status.textContent = 'Tack! Ditt förslag är inskickat och väntar på granskning.';
        status.classList.add('show');
        form.reset();
      } else {
        status.textContent = res.error || 'Något gick fel — försök igen.';
        status.classList.add('show');
      }
    } catch (err) {
      status.textContent = 'Kunde inte skicka in — kontrollera internetanslutningen och försök igen.';
      status.classList.add('show');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Skicka in →'; }
    }
  });
}
