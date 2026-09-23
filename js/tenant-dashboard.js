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

function fhNormalizeFaultStatus(raw) {
  var s = (raw || '').toString().trim().toUpperCase();
  if (s.indexOf('LÖST') !== -1 || s.indexOf('LOST') !== -1 || s === 'KLAR') return 'lost';
  if (s.indexOf('PÅG') !== -1 || s.indexOf('PAG') !== -1) return 'pagaende';
  return 'ny';
}

function fhFaultStatusLabel(key) {
  if (key === 'lost') return 'Löst';
  if (key === 'pagaende') return 'Pågående';
  return 'Ny';
}

function fhBuildFaultItem(f, statusKey) {
  var item = document.createElement('div');
  item.className = 'fault-item';

  var top = document.createElement('div');
  top.className = 'fault-item-top';

  var text = document.createElement('div');
  text.className = 'fault-text';
  text.textContent = f.beskrivning;

  var badge = document.createElement('span');
  badge.className = 'fault-status fault-status--' + statusKey;
  badge.textContent = fhFaultStatusLabel(statusKey);

  top.appendChild(text);
  top.appendChild(badge);

  var meta = document.createElement('div');
  meta.className = 'fault-date';
  var dateText = '';
  if (f.datum) {
    var d = new Date(f.datum);
    if (!isNaN(d.getTime())) dateText = d.toLocaleDateString('sv-SE');
  }
  meta.textContent = dateText;

  if (f.bildlank) {
    var link = document.createElement('a');
    link.href = f.bildlank;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = (dateText ? ' · ' : '') + 'Bild bifogad';
    meta.appendChild(link);
  }

  item.appendChild(top);
  item.appendChild(meta);
  return item;
}

function fhRenderFaults(faults) {
  var list = document.getElementById('fhFaultList');
  if (!list) return;
  list.innerHTML = '';

  if (!faults.length) {
    var empty = document.createElement('p');
    empty.className = 'task-meta';
    empty.textContent = 'Inga felanmälningar inskickade ännu.';
    list.appendChild(empty);
    return;
  }

  var groups = { ny: [], pagaende: [], lost: [] };
  faults.forEach(function (f) {
    groups[fhNormalizeFaultStatus(f.status)].push(f);
  });

  var order = [
    { key: 'ny', label: 'Nya' },
    { key: 'pagaende', label: 'Pågående' },
    { key: 'lost', label: 'Lösta' }
  ];

  order.forEach(function (group) {
    var items = groups[group.key];
    if (!items.length) return;

    var heading = document.createElement('p');
    heading.className = 'fault-group-heading';
    heading.textContent = group.label + ' (' + items.length + ')';
    list.appendChild(heading);

    var groupList = document.createElement('div');
    groupList.className = 'fault-group-list';
    items.forEach(function (f) {
      groupList.appendChild(fhBuildFaultItem(f, group.key));
    });
    list.appendChild(groupList);
  });
}

function fhRenderNews(news) {
  var list = document.getElementById('fhNewsList');
  if (!list) return;
  list.innerHTML = '';

  if (!news.length) {
    var empty = document.createElement('p');
    empty.className = 'task-meta';
    empty.textContent = 'Inga nyheter just nu.';
    list.appendChild(empty);
    return;
  }

  news.forEach(function (n) {
    var item = document.createElement('details');
    item.className = 'news-item';

    var summary = document.createElement('summary');
    summary.className = 'news-item-summary';

    var titleWrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'news-item-title';
    title.textContent = n.rubrik;
    var date = document.createElement('div');
    date.className = 'news-item-date';
    var dateText = '';
    if (n.datum) {
      var d = new Date(n.datum);
      if (!isNaN(d.getTime())) dateText = d.toLocaleDateString('sv-SE');
    }
    date.textContent = dateText;
    titleWrap.appendChild(title);
    titleWrap.appendChild(date);

    var chevron = document.createElement('span');
    chevron.className = 'news-item-chevron';
    chevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    summary.appendChild(titleWrap);
    summary.appendChild(chevron);

    var body = document.createElement('div');
    body.className = 'news-item-body';
    body.textContent = n.text;

    item.appendChild(summary);
    item.appendChild(body);
    list.appendChild(item);
  });
}

function fhInitFaultModal() {
  var openBtn = document.getElementById('fhOpenFaultBtn');
  var overlay = document.getElementById('fhFaultModalOverlay');
  var closeBtn = document.getElementById('fhFaultModalClose');
  if (!openBtn || !overlay) return;

  function openModal() {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });
}

function fhInitFaultForm() {
  var form = document.getElementById('fhFaultForm');
  var status = document.getElementById('fhFaultStatus');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var token = fhGetToken();
    var text = form.fhFaultText.value.trim();
    var fileInput = form.fhFaultImage;
    var submitBtn = form.querySelector('button[type="submit"]');

    if (!text) return;

    var imageBase64 = null;
    var imageName = null;
    if (fileInput.files && fileInput.files[0]) {
      var file = fileInput.files[0];
      imageName = file.name;
      imageBase64 = await fhReadFileAsDataUrl(file);
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Skickar …'; }

    try {
      var res = await fhApiReportFault(token, text, imageBase64, imageName);
      if (res.ok) {
        status.textContent = 'Tack! Felanmälan är inskickad.';
        status.classList.add('show');
        form.reset();
        fhInitDashboard();
      } else {
        status.textContent = res.error || 'Något gick fel — försök igen.';
        status.classList.add('show');
      }
    } catch (err) {
      status.textContent = 'Kunde inte skicka in — kontrollera internetanslutningen och försök igen.';
      status.classList.add('show');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Skicka felanmälan →'; }
    }
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
    fhRenderFaults(data.faults || []);
    fhRenderNews(data.news || []);
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
