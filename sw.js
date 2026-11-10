/* Emberfall offline cache: always tries the network first so players get updates, falls back to the saved copy */
const C='emberfall-v16';
const CORE=['/play/','/play/game.js','/play/style.css','/play/config.js','/play/icon.png','/play/manifest.webmanifest'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith('/play/')) return;
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); } return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/play/')))); });
