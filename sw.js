// Roteiro BA: guarda o app no celular pra abrir sem internet
const V = 'ba-app-v1';
const TILES = 'ba-tiles-v1';
const MAX_TILES = 800;
const CORE = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-512.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all([
    c.addAll(CORE),
    ...CDN.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {}))
  ])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // página: tenta a versão nova, sem internet usa a guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put('./index.html', copy));
      return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // mapa: cada pedaço visto fica guardado
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      c.put(req, r.clone()).then(trimTiles);
      return r;
    }))).catch(() => new Response('', { status: 504 })));
    return;
  }

  // scripts, fontes e ícones: usa o guardado, senão busca e guarda
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) {
      const copy = r.clone();
      caches.open(V).then(c => c.put(req, copy));
    }
    return r;
  })));
});
