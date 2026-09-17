/* Föreningshuset — egen kalendervisare för boka-lokal.html.
   Hämtar händelser från Google Calendar API (JSON, CORS-vänligt)
   och ritar en egen veckovy i husets design. Klick på en ledig
   tid förifyller bokningsformuläret längre ner på sidan. */

var FH_CAL_START_HOUR = 8;
var FH_CAL_END_HOUR = 22;
var FH_CAL_ROW_HEIGHT = 40;
var FH_CAL_DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
var FH_CAL_MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

var fhCalWeekStart = null;

function fhDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fhGetMonday(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fhEscapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function fhFormatRange(weekStart) {
  var end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  var sameMonth = weekStart.getMonth() === end.getMonth();
  var startStr = weekStart.getDate() + (sameMonth ? '' : ' ' + FH_CAL_MONTH_NAMES[weekStart.getMonth()]);
  var endStr = end.getDate() + ' ' + FH_CAL_MONTH_NAMES[end.getMonth()] + ' ' + end.getFullYear();
  return startStr + '–' + endStr;
}

function fhFormatTimeRange(start, end) {
  function pad(n) { return String(n).padStart(2, '0'); }
  return pad(start.getHours()) + ':' + pad(start.getMinutes()) + '–' + pad(end.getHours()) + ':' + pad(end.getMinutes());
}

async function fhFetchCalendarEvents(timeMinISO, timeMaxISO) {
  var params = new URLSearchParams({
    key: FH_CALENDAR_API_KEY,
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    fields: 'items(id,summary,location,start,end)'
  });
  var url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(FH_CALENDAR_ID) + '/events?' + params;
  var res = await fetch(url);
  if (!res.ok) {
    throw new Error('Kalendern kunde inte hämtas (' + res.status + ')');
  }
  var data = await res.json();
  return data.items || [];
}

function fhBuildGridSkeleton(container, weekStart) {
  container.innerHTML = '';

  var table = document.createElement('div');
  table.className = 'fh-cal-table';

  var headerRow = document.createElement('div');
  headerRow.className = 'fh-cal-header-row';
  var gutterHead = document.createElement('div');
  gutterHead.className = 'fh-cal-gutter fh-cal-gutter--head';
  headerRow.appendChild(gutterHead);

  var todayKey = fhDateKey(new Date());
  var dayDates = [];

  for (var i = 0; i < 7; i++) {
    var d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dayDates.push(d);

    var head = document.createElement('div');
    head.className = 'fh-cal-day-head';
    if (fhDateKey(d) === todayKey) head.classList.add('is-today');
    head.innerHTML =
      '<span class="fh-cal-day-name">' + FH_CAL_DAY_NAMES[i] + '</span>' +
      '<span class="fh-cal-day-num">' + d.getDate() + '</span>';
    headerRow.appendChild(head);
  }
  table.appendChild(headerRow);

  var body = document.createElement('div');
  body.className = 'fh-cal-body';

  var gutter = document.createElement('div');
  gutter.className = 'fh-cal-gutter';
  for (var h = FH_CAL_START_HOUR; h < FH_CAL_END_HOUR; h++) {
    var label = document.createElement('div');
    label.className = 'fh-cal-hour-label';
    label.style.height = FH_CAL_ROW_HEIGHT + 'px';
    label.textContent = String(h).padStart(2, '0') + ':00';
    gutter.appendChild(label);
  }
  body.appendChild(gutter);

  var dayColumnEls = [];
  dayDates.forEach(function (d) {
    var col = document.createElement('div');
    col.className = 'fh-cal-day-col';
    col.style.height = ((FH_CAL_END_HOUR - FH_CAL_START_HOUR) * FH_CAL_ROW_HEIGHT) + 'px';
    col.dataset.date = fhDateKey(d);

    for (var hh = FH_CAL_START_HOUR; hh < FH_CAL_END_HOUR; hh++) {
      (function (hour) {
        var cell = document.createElement('div');
        cell.className = 'fh-cal-hour-cell';
        cell.style.height = FH_CAL_ROW_HEIGHT + 'px';
        cell.addEventListener('click', function () { fhHandleSlotClick(d, hour); });
        col.appendChild(cell);
      })(hh);
    }

    dayColumnEls.push({ date: d, el: col });
    body.appendChild(col);
  });

  table.appendChild(body);
  container.appendChild(table);
  return dayColumnEls;
}

function fhPlaceEvent(dayColumnEls, ev) {
  var isAllDay = !ev.start.dateTime;
  var startDate = new Date(ev.start.dateTime || (ev.start.date + 'T00:00:00'));
  var endDate = new Date(ev.end.dateTime || (ev.end.date + 'T00:00:00'));
  var key = fhDateKey(startDate);
  var target = dayColumnEls.find(function (c) { return c.date.getFullYear() === startDate.getFullYear() && c.date.getMonth() === startDate.getMonth() && c.date.getDate() === startDate.getDate(); });
  if (!target) return;

  var block = document.createElement('div');
  block.className = 'fh-cal-event';

  if (isAllDay) {
    block.classList.add('fh-cal-event--allday');
    block.style.top = '0px';
    block.style.height = '18px';
    block.innerHTML = '<span class="fh-cal-event-title">' + fhEscapeHtml(ev.summary || 'Bokat') + '</span>';
    target.el.appendChild(block);
    return;
  }

  var startHour = Math.min(Math.max(startDate.getHours() + startDate.getMinutes() / 60, FH_CAL_START_HOUR), FH_CAL_END_HOUR);
  var endHour = Math.min(Math.max(endDate.getHours() + endDate.getMinutes() / 60, FH_CAL_START_HOUR), FH_CAL_END_HOUR);
  if (endHour <= startHour) return;

  var top = (startHour - FH_CAL_START_HOUR) * FH_CAL_ROW_HEIGHT;
  var height = Math.max(18, (endHour - startHour) * FH_CAL_ROW_HEIGHT - 2);

  block.style.top = top + 'px';
  block.style.height = height + 'px';
  block.innerHTML =
    '<span class="fh-cal-event-title">' + fhEscapeHtml(ev.summary || 'Bokat') + '</span>' +
    (ev.location ? '<span class="fh-cal-event-loc">' + fhEscapeHtml(ev.location) + '</span>' : '') +
    '<span class="fh-cal-event-time">' + fhFormatTimeRange(startDate, endDate) + '</span>';

  target.el.appendChild(block);
}

function fhHandleSlotClick(date, hour) {
  var dateInput = document.getElementById('fhDate');
  var timeInput = document.getElementById('fhTime');
  if (!dateInput || !timeInput) return;

  var yyyy = date.getFullYear();
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var dd = String(date.getDate()).padStart(2, '0');
  dateInput.value = yyyy + '-' + mm + '-' + dd;

  var endHour = Math.min(hour + 2, FH_CAL_END_HOUR);
  timeInput.value = String(hour).padStart(2, '0') + ':00–' + String(endHour).padStart(2, '0') + ':00';

  var note = document.getElementById('fhCalPickNote');
  if (note) {
    note.textContent = 'Vald tid: ' + dd + '/' + mm + ' kl ' + timeInput.value + ' — fortsätt i formuläret nedan.';
    note.classList.add('show');
  }

  var formCard = document.querySelector('.form-card');
  if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  var nameInput = document.getElementById('fhName');
  if (nameInput) setTimeout(function () { nameInput.focus(); }, 400);
}

function fhInitCalendarWidget() {
  var grid = document.getElementById('fhCalGrid');
  var rangeEl = document.getElementById('fhCalRange');
  var statusEl = document.getElementById('fhCalStatus');
  var prevBtn = document.getElementById('fhCalPrev');
  var nextBtn = document.getElementById('fhCalNext');
  var todayBtn = document.getElementById('fhCalToday');

  if (!grid) return;

  if (!FH_CALENDAR_API_KEY) {
    statusEl.textContent = 'Kalendern är inte ansluten ännu. Hör av dig till styrelsen om lediga tider tills vidare.';
    statusEl.className = 'fh-cal-status is-error';
    return;
  }

  fhCalWeekStart = fhGetMonday(new Date());

  async function load() {
    rangeEl.textContent = fhFormatRange(fhCalWeekStart);
    statusEl.textContent = 'Hämtar kalendern…';
    statusEl.className = 'fh-cal-status is-loading';

    try {
      var weekEnd = new Date(fhCalWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      var events = await fhFetchCalendarEvents(fhCalWeekStart.toISOString(), weekEnd.toISOString());
      var cols = fhBuildGridSkeleton(grid, fhCalWeekStart);
      events.forEach(function (ev) { fhPlaceEvent(cols, ev); });
      statusEl.textContent = '';
      statusEl.className = 'fh-cal-status';
    } catch (err) {
      statusEl.textContent = 'Kunde inte hämta kalendern just nu. Hör av dig till styrelsen om lediga tider tills vidare.';
      statusEl.className = 'fh-cal-status is-error';
    }
  }

  prevBtn.addEventListener('click', function () {
    fhCalWeekStart.setDate(fhCalWeekStart.getDate() - 7);
    load();
  });
  nextBtn.addEventListener('click', function () {
    fhCalWeekStart.setDate(fhCalWeekStart.getDate() + 7);
    load();
  });
  todayBtn.addEventListener('click', function () {
    fhCalWeekStart = fhGetMonday(new Date());
    load();
  });

  load();
}
