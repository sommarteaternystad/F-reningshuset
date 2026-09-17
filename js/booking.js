/* Föreningshuset — bokningsförfrågan.
   Ingen bokningskalender ännu, så formuläret skickar en
   e-postförfrågan istället. Mejlet innehåller en färdig
   "Lägg till i Google Kalender"-länk för exakt den bokade
   tiden, så godkännande blir en klickning istället för att
   skriva in allt manuellt. Kan ersättas med riktig
   bokningslösning senare. */

function fhPad2(n) {
  return String(n).padStart(2, '0');
}

/* Tolkar fritext som "18:00–21:00", "18.00-21.00" eller "18-21".
   Returnerar null om inget tidsintervall kan hittas. */
function fhParseTimeRange(str) {
  var m = (str || '').match(/(\d{1,2})[:.]?(\d{2})?\s*[-–—]\s*(\d{1,2})[:.]?(\d{2})?/);
  if (!m) return null;
  var startH = parseInt(m[1], 10);
  var endH = parseInt(m[3], 10);
  if (isNaN(startH) || isNaN(endH)) return null;
  return {
    startH: startH,
    startM: m[2] ? parseInt(m[2], 10) : 0,
    endH: endH,
    endM: m[4] ? parseInt(m[4], 10) : 0
  };
}

function fhGCalDatePart(d) {
  return d.getFullYear() + fhPad2(d.getMonth() + 1) + fhPad2(d.getDate());
}

function fhGCalDateTimePart(d) {
  return d.getUTCFullYear() + fhPad2(d.getUTCMonth() + 1) + fhPad2(d.getUTCDate()) +
    'T' + fhPad2(d.getUTCHours()) + fhPad2(d.getUTCMinutes()) + fhPad2(d.getUTCSeconds()) + 'Z';
}

/* Bygger dates-parametern för Google Kalenders "quick add"-länk.
   Om tiden inte går att tolka blir det en heldagshändelse istället,
   med den inskrivna tiden kvar i beskrivningen så den som godkänner
   kan justera manuellt. */
function fhBuildGCalDates(dateStr, timeStr) {
  var parts = (dateStr || '').split('-');
  if (parts.length !== 3) return null;
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  var range = fhParseTimeRange(timeStr);
  if (!range) {
    var startDate = new Date(year, month, day);
    var endDate = new Date(year, month, day + 1);
    return { allDay: true, param: fhGCalDatePart(startDate) + '/' + fhGCalDatePart(endDate) };
  }

  var start = new Date(year, month, day, range.startH, range.startM, 0);
  var end = new Date(year, month, day, range.endH, range.endM, 0);
  if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
  return { allDay: false, param: fhGCalDateTimePart(start) + '/' + fhGCalDateTimePart(end) };
}

function fhBuildGCalLink(title, dateStr, timeStr, details, location) {
  var datesInfo = fhBuildGCalDates(dateStr, timeStr);
  if (!datesInfo) return null;

  var params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesInfo.param,
    details: details,
    location: location
  });
  return { url: 'https://calendar.google.com/calendar/render?' + params.toString(), allDay: datesInfo.allDay };
}

function fhInitBookingForm() {
  var form = document.getElementById('fhBookingForm');
  var success = document.getElementById('fhBookingSuccess');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.fhName.value.trim();
    var email = form.fhEmail.value.trim();
    var phone = form.fhPhone.value.trim();
    var room = form.fhRoom.value;
    var date = form.fhDate.value;
    var time = form.fhTime.value.trim();
    var purpose = form.fhPurpose.value.trim();

    var details = [
      'Bokad via föreningshusetystad.se',
      'Kontakt: ' + name + (phone ? ', ' + phone : '') + ', ' + email,
      purpose ? 'Syfte: ' + purpose : ''
    ].filter(Boolean).join('\n');

    var gcal = fhBuildGCalLink(name, date, time, details, room);

    var subject = 'Bokningsförfrågan Föreningshuset – ' + room + ' (' + date + ')';

    var bodyLines = [
      'Ny bokningsförfrågan från föreningshusetystad.se',
      '',
      'Namn: ' + name,
      'E-post: ' + email,
      'Telefon: ' + (phone || '–'),
      'Lokal: ' + room,
      'Datum: ' + date,
      'Tid: ' + (time || '–'),
      '',
      'Syfte / beskrivning:',
      purpose || '–',
      ''
    ];

    if (gcal) {
      bodyLines.push('Godkänner du bokningen? Lägg till den i kalendern med ett klick:');
      bodyLines.push(gcal.url);
      if (gcal.allDay) {
        bodyLines.push('(Tiden kunde inte tolkas automatiskt — justera tiden innan du sparar.)');
      }
    }

    var mailto =
      'mailto:sommarteatern@sommarteaternystad.com' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));

    success.classList.add('show');
    window.location.href = mailto;
  });
}
