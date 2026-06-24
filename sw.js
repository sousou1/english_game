const VERSION = 'v26';
const CACHE = `kotodama-${VERSION}`;
const CORE = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/ui.js',
  './js/workshop.js',
  './js/economy.js',
  './js/schedule.js',
  './js/story.js',
  './js/story-lines.js',
  './js/pool.js',
  './js/battle.js',
  './js/armory.js',
  './js/jobs.js',
  './js/party.js',
  './js/events.js',
  './js/scenario.js',
  './js/quiz.js',
  './js/srs.js',
  './js/audio.js',
  './js/storage.js',
  './data/words.js',
  './data/weapons.js',
  './data/events.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ナビゲーション: ネットワーク優先だが2.5秒で諦めてキャッシュ起動(低速回線で固まらない)
// その他: stale-while-revalidate(キャッシュ即返し+裏で更新→次回起動に反映される)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = caches.match('./index.html');
      const net = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
      const winner = await Promise.race([
        net.then((res) => ({ res })).catch(() => ({ failed: true })),
        new Promise((r) => setTimeout(() => r({ timeout: true }), 2500)),
      ]);
      if (winner.res) return winner.res;
      const c = await cached;
      if (c) return c;
      return net.catch(() => Response.error());
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || net;
  })());
});
