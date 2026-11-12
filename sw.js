/* Caché del visor para trabajar con mala señal.
   - La página se pide primero a internet (así siempre llega la versión nueva) y, si no hay señal en 4 s, se usa la guardada.
   - El motor 3D, Firebase y las fuentes se guardan la primera vez y después se usan desde el teléfono.
   Para forzar que todos boten la caché, cambia el número de VERSION. */
const VERSION = 'estructuras3d-v1';
const PROPIOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(
    PROPIOS.map(u => c.add(u).catch(() => {})).concat(
    EXTERNOS.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(res => c.put(u, res)).catch(() => {})))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guardar(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(VERSION).then(cc => cc.put(req, c)); }
  return res;
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  /* páginas y archivos propios: primero internet, con plazo; si no, lo guardado */
  if (u.origin === self.location.origin) {
    e.respondWith(new Promise(resolve => {
      let listo = false;
      const desdeCache = () => caches.match(r, { ignoreSearch: true })
        .then(m => m || caches.match('./index.html'))
        .then(m => { if (!listo && m) { listo = true; resolve(m); } return m; });
      const t = setTimeout(desdeCache, 4000);
      fetch(r).then(res => { clearTimeout(t); guardar(r, res); if (!listo) { listo = true; resolve(res); } })
        .catch(() => { clearTimeout(t); desdeCache().then(m => { if (!listo) { listo = true; resolve(m || Response.error()); } }); });
    }));
    return;
  }

  /* motor 3D, Firebase (solo los scripts) y fuentes: primero lo guardado */
  if (/^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.host) ||
      (u.host === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => guardar(r, res))));
  }
  /* Firestore y el inicio de sesión no pasan por aquí: Firebase maneja su propia caché sin señal */
});
