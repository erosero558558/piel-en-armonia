const CACHE_NAME = 'pielarmonia-v4-20260220-phase8warmups1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/telemedicina.html',
  '/styles-deferred.css?v=ui-20260220-deferred15-cookiebannerfix1',
  '/bootstrap-inline-engine.js?v=figo-bootstrap-20260220-cachecoherence1',
  '/script.js?v=figo-20260220-phase8-warmuptiers1',
  '/hero-woman.jpg',
  '/favicon.ico',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

const NETWORK_ONLY_PREFIXES = [
  '/api.php',
  '/figo-chat.php',
  '/figo-backend.php',
  '/proxy.php',
  '/admin-auth.php',
  '/stripe-webhook.php'
];

const CACHEABLE_EXTENSIONS = [
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.svg',
  '.gif',
  '.woff',
  '.woff2',
  '.ico'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isVersionedAsset(url) {
  return url.searchParams.has('v') || url.searchParams.has('cv');
}

function isNetworkOnlyPath(pathname) {
  return NETWORK_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') {
    return true;
  }
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || url.pathname.endsWith('.html');
}

function isCacheableAsset(pathname) {
  return CACHEABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

async function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return;
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    await putInCache(request, networkResponse);
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  await putInCache(request, networkResponse);
  return networkResponse;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return;
  }

  if (isNetworkOnlyPath(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    const isPotentiallyMutableScriptOrStyle = (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) && !isVersionedAsset(url);
    event.respondWith(isPotentiallyMutableScriptOrStyle ? networkFirst(request) : cacheFirst(request));
    return;
  }

  event.respondWith(fetch(request));
});
