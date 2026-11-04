// Cache only this public offline document. Never cache authenticated pages or household data.
const CACHE='cheese-the-rooster-static-v4';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));});
self.addEventListener('message',event=>{
 if(event.data?.type!=='site-copy')return;
 const copy=event.data.offline;
 if(!copy||!['title','heading','description','retry'].every(key=>typeof copy[key]==='string'&&copy[key].length<=5000))return;
 const escape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const html='<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escape(copy.title)+'</title><style>body{font:18px system-ui;background:#faf9f6;color:#292735;max-width:500px;margin:20vh auto;padding:24px}a{color:#66539d}</style><h1>'+escape(copy.heading)+'</h1><p>'+escape(copy.description)+'</p><a href="/">'+escape(copy.retry)+'</a></html>';
 event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/offline.html',new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}))));
});
