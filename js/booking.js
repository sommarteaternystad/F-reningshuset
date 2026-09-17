/* Föreningshuset — bokningsförfrågan.
   Ingen bokningskalender ännu, så formuläret skickar en
   e-postförfrågan istället. Kan ersättas med riktig
   bokningslösning senare. */

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

    var subject = 'Bokningsförfrågan Föreningshuset – ' + room + ' (' + date + ')';

    var bodyLines = [
      'Ny bokningsförfrågan från föreningshuset.sommarteaternystad.com',
      '',
      'Namn: ' + name,
      'E-post: ' + email,
      'Telefon: ' + (phone || '–'),
      'Lokal: ' + room,
      'Datum: ' + date,
      'Tid: ' + (time || '–'),
      '',
      'Syfte / beskrivning:',
      purpose || '–'
    ];

    var mailto =
      'mailto:sommarteatern@sommarteaternystad.com' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));

    success.classList.add('show');
    window.location.href = mailto;
  });
}
