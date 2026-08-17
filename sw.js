/* Brasil na Palma da Mão — service worker
   Estratégia: app shell em cache (abre offline) + cache em tempo de execução
   para fontes e dados do IBGE já visitados. Os dados ao vivo precisam de rede. */
const CACHE = 'bpm-v1';
const SHELL = 'brasil-na-palma-da-mao.html';
const CORE = ['./', SHELL, 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', ev=>{
  ev.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(CORE.map(u=>new Request(u, {cache:'reload'}))))
      .catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', ev=>{
  ev.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', ev=>{
  const req = ev.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);

  // Navegação: tenta a rede; se offline, entrega o shell em cache.
  if(req.mode==='navigate'){
    ev.respondWith(
      fetch(req).catch(()=>caches.match(SHELL).then(r=>r||caches.match('./')))
    );
    return;
  }

  // Mesma origem (arquivos do app): cache primeiro.
  if(url.origin===location.origin){
    ev.respondWith(
      caches.match(req).then(hit=>hit || fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>hit))
    );
    return;
  }

  // Terceiros (IBGE, Google Fonts): stale-while-revalidate.
  ev.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});
