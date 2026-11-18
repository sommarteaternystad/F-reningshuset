/* Föreningshuset — publik nyhetsblogg (nyheter.html). Hämtar samma
   lista som intranätets Nyheter-ruta, men utan inloggning krävd. */

function fhRenderPublicNews(news) {
  var list = document.getElementById('fhNewsList');
  if (!list) return;
  list.innerHTML = '';

  if (!news.length) {
    var empty = document.createElement('p');
    empty.className = 'task-meta';
    empty.textContent = 'Inga nyheter publicerade ännu.';
    list.appendChild(empty);
    return;
  }

  news.forEach(function (n) {
    var post = document.createElement('article');
    post.className = 'panel-card';

    var date = document.createElement('p');
    date.className = 'blog-post-date';
    var dateText = '';
    if (n.datum) {
      var d = new Date(n.datum);
      if (!isNaN(d.getTime())) {
        dateText = d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
    date.textContent = dateText;

    var title = document.createElement('h2');
    title.className = 'blog-post-title';
    title.textContent = n.rubrik;

    var text = document.createElement('p');
    text.className = 'blog-post-text';
    text.textContent = n.text;

    post.appendChild(date);
    post.appendChild(title);
    post.appendChild(text);
    list.appendChild(post);
  });
}

async function fhInitPublicNews() {
  var list = document.getElementById('fhNewsList');
  try {
    var res = await fhApiGetNews();
    if (!res.ok) {
      if (list) list.innerHTML = '<p class="task-meta">Kunde inte hämta nyheter just nu.</p>';
      return;
    }
    fhRenderPublicNews(res.news || []);
  } catch (err) {
    if (list) list.innerHTML = '<p class="task-meta">Kunde inte nå servern just nu. Kontrollera internetanslutningen och ladda om sidan.</p>';
  }
}
