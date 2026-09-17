/* Föreningshuset — egen kalendervisare för boka-lokal.html.
   Hämtar händelser från Google Calendar API (JSON, CORS-vänligt)
   och ritar en egen veckovy i husets design, filtrerad på en
   vald lokal. Klick på en ledig tid förifyller bokningsformuläret
   längre ner på sidan. */

var FH_CAL_START_HOUR = 8;
var FH_CAL_END_HOUR = 22;
var FH_CAL_ROW_HEIGHT = 40;
var FH_CAL_DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
var FH_CAL_MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

var fhCalWeekStart = null;
var fhCalRawEvents = [];
var fhSelectedRoom = null;
var fhCalHasError = false;

/* Bokningarna i kalendern skrivs inte alltid likadant (olika personer
   skriver olika), så vi gissar lokal utifrån titel + plats. En bokning
   kan höra till flera lokaler samtidigt (t.ex. "Salen + Kafeet") och
   visas då under båda. Kollar man inte igen mot något alls hamnar den
   under "Okänd" och visas i alla lokalers vy så inget bokat göms av
   misstag — då syns hela originaltexten på bokningen så man kan bedöma
   själv. */
function fhClassifyRooms(text) {
  var t = (text || '').toLowerCase();
  var rooms = [];
  var isYmca = /ymca/.test(t);

  if (isYmca) rooms.push('YMCA-Salen');
  if (!isYmca && /\bsalen\b/.test(t)) rooms.push('Salen');
  if (/kampsport/.test(t)) rooms.push('Gamla Kampsportssalen');
  if (/rs[-\s]?rummet/.test(t)) rooms.push('RS-rummet');
  if (/kaffe|kaf[eé]|caffe|caf[eé]/.test(t)) rooms.push('Caféet');

  if (rooms.length === 0) rooms.push('Okänd');
  return rooms;
}

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

function fhNormalizeEvent(ev) {
  var isAllDay = !ev.start.dateTime;
  var rooms = fhClassifyRooms((ev.summary || '') + ' ' + (ev.location || ''));
  return {
    summary: ev.summary,
    location: ev.location,
    isAllDay: isAllDay,
    rooms: rooms,
    isUnsure: rooms.indexOf('Okänd') !== -1,
    start: new Date(ev.start.dateTime || (ev.start.date + 'T00:00:00')),
    end: new Date(ev.end.dateTime || (ev.end.date + 'T00:00:00'))
  };
}

/* Lägger flera tider som krockar i tid sida vid sida istället för
   ovanpå varandra — annars ser det lika rörigt ut som i Google
   Kalenders standardvy när flera bokningar krockar i tid. */
function fhLayoutDayEvents(events) {
  events.sort(function (a, b) { return a.start - b.start || a.end - b.end; });

  var clusterEvents = [];
  var clusterColumnEnds = [];
  var clusterEnd = null;

  function closeCluster() {
    var totalCols = clusterColumnEnds.length;
    clusterEvents.forEach(function (ev) { ev._totalCols = totalCols; });
    clusterEvents = [];
    clusterColumnEnds = [];
  }

  events.forEach(function (ev) {
    if (clusterEnd !== null && ev.start >= clusterEnd) {
      closeCluster();
      clusterEnd = null;
    }

    var placed = false;
    for (var i = 0; i < clusterColumnEnds.length; i++) {
      if (clusterColumnEnds[i] <= ev.start) {
        clusterColumnEnds[i] = ev.end;
        ev._col = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._col = clusterColumnEnds.length;
      clusterColumnEnds.push(ev.end);
    }

    clusterEvents.push(ev);
    clusterEnd = clusterEnd === null ? ev.end : new Date(Math.max(clusterEnd, ev.end));
  });
  if (clusterEvents.length) closeCluster();

  return events;
}

function fhRenderEvent(dayColumnEls, ev) {
  var target = dayColumnEls.find(function (c) {
    return c.date.getFullYear() === ev.start.getFullYear() && c.date.getMonth() === ev.start.getMonth() && c.date.getDate() === ev.start.getDate();
  });
  if (!target) return;

  var block = document.createElement('div');
  block.className = 'fh-cal-event';
  if (ev.isUnsure) block.classList.add('fh-cal-event--unsure');

  if (ev.isAllDay) {
    block.classList.add('fh-cal-event--allday');
    block.style.top = (ev._stackTop || 0) + 'px';
    block.style.left = '3px';
    block.style.right = '3px';
    block.style.height = '18px';
    block.innerHTML = '<span class="fh-cal-event-title">' + fhEscapeHtml(ev.summary || 'Bokat') + '</span>';
    target.el.appendChild(block);
    return;
  }

  var startHour = Math.min(Math.max(ev.start.getHours() + ev.start.getMinutes() / 60, FH_CAL_START_HOUR), FH_CAL_END_HOUR);
  var endHour = Math.min(Math.max(ev.end.getHours() + ev.end.getMinutes() / 60, FH_CAL_START_HOUR), FH_CAL_END_HOUR);
  if (endHour <= startHour) return;

  var top = (startHour - FH_CAL_START_HOUR) * FH_CAL_ROW_HEIGHT;
  var height = Math.max(18, (endHour - startHour) * FH_CAL_ROW_HEIGHT - 2);
  var totalCols = ev._totalCols || 1;
  var colWidth = 100 / totalCols;
  var left = (ev._col || 0) * colWidth;

  block.style.top = top + 'px';
  block.style.height = height + 'px';
  block.style.left = 'calc(' + left + '% + 2px)';
  block.style.width = 'calc(' + colWidth + '% - 4px)';
  block.innerHTML =
    '<span class="fh-cal-event-title">' + fhEscapeHtml(ev.summary || 'Bokat') + '</span>' +
    (ev.location ? '<span class="fh-cal-event-loc">' + fhEscapeHtml(ev.location) + '</span>' : '') +
    '<span class="fh-cal-event-time">' + fhFormatTimeRange(ev.start, ev.end) + '</span>';

  target.el.appendChild(block);
}

function fhRenderEvents(dayColumnEls, normalizedEvents) {
  var byDay = {};
  var allDay = [];

  normalizedEvents.forEach(function (ev) {
    if (ev.isAllDay) {
      allDay.push(ev);
      return;
    }
    var key = fhDateKey(ev.start);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(ev);
  });

  Object.keys(byDay).forEach(function (key) {
    fhLayoutDayEvents(byDay[key]).forEach(function (ev) { fhRenderEvent(dayColumnEls, ev); });
  });

  var allDayByKey = {};
  allDay.forEach(function (ev) {
    var key = fhDateKey(ev.start);
    var stackIndex = allDayByKey[key] || 0;
    ev._stackTop = stackIndex * 20;
    allDayByKey[key] = stackIndex + 1;
    fhRenderEvent(dayColumnEls, ev);
  });
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

  var bookingSection = document.getElementById('fhBookingSection');
  if (bookingSection) bookingSection.classList.remove('is-hidden');

  var formCard = document.querySelector('.form-card');
  if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  var nameInput = document.getElementById('fhName');
  if (nameInput) setTimeout(function () { nameInput.focus(); }, 400);
}

/* Filtrerar cachade händelser för vald vecka på vald lokal och
   ritar om rutnätet. Anropas både när lokal och vecka byts. */
function fhRenderForSelectedRoom() {
  var grid = document.getElementById('fhCalGrid');
  var statusEl = document.getElementById('fhCalStatus');
  var wrap = document.querySelector('.fh-cal-scroll');
  var legend = document.querySelector('.fh-cal-legend');
  if (!grid) return;

  if (fhCalHasError) {
    grid.innerHTML = '';
    if (wrap) wrap.style.display = 'none';
    if (legend) legend.style.display = 'none';
    return;
  }

  if (!fhSelectedRoom) {
    grid.innerHTML = '';
    if (wrap) wrap.style.display = 'none';
    if (legend) legend.style.display = 'none';
    statusEl.textContent = 'Välj en lokal ovan för att se bokningar och lediga tider.';
    statusEl.className = 'fh-cal-status';
    return;
  }

  if (wrap) wrap.style.display = '';
  if (legend) legend.style.display = '';
  statusEl.textContent = '';
  statusEl.className = 'fh-cal-status';

  var filtered = fhCalRawEvents.filter(function (ev) {
    return ev.rooms.indexOf(fhSelectedRoom) !== -1 || ev.rooms.indexOf('Okänd') !== -1;
  });

  var cols = fhBuildGridSkeleton(grid, fhCalWeekStart);
  fhRenderEvents(cols, filtered);
}

function fhSelectRoom(roomId) {
  fhSelectedRoom = roomId;

  document.querySelectorAll('.room-card').forEach(function (card) {
    card.classList.toggle('is-selected', card.dataset.room === roomId);
  });

  var heading = document.getElementById('fhCalRoomLabel');
  if (heading) heading.textContent = roomId;

  var roomSelect = document.getElementById('fhRoom');
  if (roomSelect) {
    var hasOption = Array.from(roomSelect.options).some(function (o) { return o.value === roomId; });
    if (hasOption) roomSelect.value = roomId;
  }

  fhRenderForSelectedRoom();

  var calSection = document.getElementById('fhCal');
  if (calSection) calSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fhInitRoomPicker() {
  document.querySelectorAll('.room-card').forEach(function (card) {
    card.addEventListener('click', function () { fhSelectRoom(card.dataset.room); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fhSelectRoom(card.dataset.room);
      }
    });
  });
}

function fhInitCalendarWidget() {
  var grid = document.getElementById('fhCalGrid');
  var rangeEl = document.getElementById('fhCalRange');
  var statusEl = document.getElementById('fhCalStatus');
  var prevBtn = document.getElementById('fhCalPrev');
  var nextBtn = document.getElementById('fhCalNext');
  var todayBtn = document.getElementById('fhCalToday');

  if (!grid) return;

  fhInitRoomPicker();

  if (!FH_CALENDAR_API_KEY) {
    statusEl.textContent = 'Kalendern är inte ansluten ännu. Hör av dig till verksamhetsansvarig om lediga tider tills vidare.';
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
      var rawItems = await fhFetchCalendarEvents(fhCalWeekStart.toISOString(), weekEnd.toISOString());
      fhCalRawEvents = rawItems.map(fhNormalizeEvent);
      fhCalHasError = false;
      fhRenderForSelectedRoom();
    } catch (err) {
      fhCalHasError = true;
      statusEl.textContent = 'Kunde inte hämta kalendern just nu. Hör av dig till verksamhetsansvarig om lediga tider tills vidare.';
      statusEl.className = 'fh-cal-status is-error';
      fhRenderForSelectedRoom();
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
