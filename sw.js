/* sw.js — faz o app abrir sem internet e mostra as notificações. Troque VERSAO a cada publicação para os aparelhos receberem a nova versão. */
const VERSAO = 'rotina-v3.3.0';
const CASCA = ['./', 'index.html', 'config.js', 'nucleo.js', 'base.js', 'financas.js', 'graficos.js', 'telas.js', 'paineis.js', 'acoes.js', 'telas-fin.js', 'agenda.js', 'arquivos.js', 'importar.js', 'push.js',
  'manifest.webmanifest', 'icones/icone.svg', 'icones/icone-192.png', 'icones/apple-touch-icon.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA))); });
self.addEventListener('message', e => { if (e.data === 'ativar') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== 'rotina-libs').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // API (POST) nunca passa por cache
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  // Firebase e fontes: primeiro o cache
  if (/fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(caches.open('rotina-libs').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // Casca do app: rede primeiro (pega atualizações), cache se estiver sem internet (espera no máximo 4 s)
  if (url.origin === self.location.origin) {
    const doCache = () => caches.match(req, { ignoreSearch: true }).then(c => c || (req.mode === 'navigate' ? caches.match('index.html') : null));
    const rede = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); } return r; });
    e.respondWith(Promise.race([rede, new Promise(res => setTimeout(() => res(null), 4000))])
      .then(async r => r || (await doCache()) || rede)
      .catch(async () => (await doCache()) || Response.error()));
  }
});

/* ---------- notificações (Firebase Cloud Messaging) ----------
   O servidor manda só dados {titulo, corpo, url, tag}; aqui viram a notificação. Toda mensagem precisa mostrar uma notificação (o iPhone exige). */
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { corpo: e.data ? e.data.text() : '' } }; }
  const d = p.data || {}, n = p.notification || {};
  const opcoes = { body: d.corpo || n.body || '', icon: 'icones/icone-192.png', badge: 'icones/icone-192.png', data: { url: d.url || '#hoje' }, lang: 'pt-BR' };
  if (d.tag) { opcoes.tag = d.tag; opcoes.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.titulo || n.title || 'Rotina', opcoes));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#hoje';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aberto = lista.find(c => c.url.startsWith(self.registration.scope));
    if (aberto) { aberto.postMessage({ ir: url }); return aberto.focus(); }
    return self.clients.openWindow(self.registration.scope + url);
  }));
});
