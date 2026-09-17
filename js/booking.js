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

function fhGCalDateTimePart(d) {
  return d.getUTCFullYear() + fhPad2(d.getUTCMonth() + 1) + fhPad2(d.getUTCDate()) +
    'T' + fhPad2(d.getUTCHours()) + fhPad2(d.getUTCMinutes()) + fhPad2(d.getUTCSeconds()) + 'Z';
}

/* Bygger dates-parametern för Google Kalenders "quick add"-länk
   utifrån datum + starttid/sluttid (alltid "HH:MM" från <input type=time>). */
function fhBuildGCalDatesParam(dateStr, startTimeStr, endTimeStr) {
  var dp = (dateStr || '').split('-');
  var sp = (startTimeStr || '').split(':');
  var ep = (endTimeStr || '').split(':');
  if (dp.length !== 3 || sp.length < 2 || ep.length < 2) return null;

  var year = parseInt(dp[0], 10);
  var month = parseInt(dp[1], 10) - 1;
  var day = parseInt(dp[2], 10);

  var start = new Date(year, month, day, parseInt(sp[0], 10), parseInt(sp[1], 10), 0);
  var end = new Date(year, month, day, parseInt(ep[0], 10), parseInt(ep[1], 10), 0);
  if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);

  return fhGCalDateTimePart(start) + '/' + fhGCalDateTimePart(end);
}

function fhBuildGCalLink(title, dateStr, startTimeStr, endTimeStr, details, location) {
  var datesParam = fhBuildGCalDatesParam(dateStr, startTimeStr, endTimeStr);
  if (!datesParam) return null;

  var params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesParam,
    details: details,
    location: location
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

function fhInitBookingForm() {
  var form = document.getElementById('fhBookingForm');
  var success = document.getElementById('fhBookingSuccess');

  if (!form) return;

  var startInput = form.fhTimeStart;
  var endInput = form.fhTimeEnd;

  function validateTimes() {
    if (startInput.value && endInput.value && endInput.value <= startInput.value) {
      endInput.setCustomValidity('Sluttid måste vara efter starttid.');
    } else {
      endInput.setCustomValidity('');
    }
  }
  startInput.addEventListener('change', validateTimes);
  endInput.addEventListener('change', validateTimes);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.fhName.value.trim();
    var email = form.fhEmail.value.trim();
    var phone = form.fhPhone.value.trim();
    var room = form.fhRoom.value;
    var date = form.fhDate.value;
    var startTime = startInput.value;
    var endTime = endInput.value;
    var purpose = form.fhPurpose.value.trim();

    var details = [
      'Bokad via föreningshusetystad.se',
      'Kontakt: ' + name + (phone ? ', ' + phone : '') + ', ' + email,
      purpose ? 'Syfte: ' + purpose : ''
    ].filter(Boolean).join('\n');

    var gcalUrl = fhBuildGCalLink(name, date, startTime, endTime, details, room);

    var subject = 'Bokningsförfrågan Föreningshuset – ' + room + ' (' + date + ')';

    var bodyLines = [
      'Ny bokningsförfrågan från föreningshusetystad.se',
      '',
      'Namn: ' + name,
      'E-post: ' + email,
      'Telefon: ' + (phone || '–'),
      'Lokal: ' + room,
      'Datum: ' + date,
      'Tid: ' + startTime + '–' + endTime,
      '',
      'Syfte / beskrivning:',
      purpose || '–',
      ''
    ];

    if (gcalUrl) {
      bodyLines.push('Godkänner du bokningen? Lägg till den i kalendern med ett klick:');
      bodyLines.push(gcalUrl);
    }

    var mailto =
      'mailto:sommarteatern@sommarteaternystad.com' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));

    success.classList.add('show');
    window.location.href = mailto;
  });
}
