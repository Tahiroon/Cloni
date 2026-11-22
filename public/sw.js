// THERASON CLINIC — Smart Browser-First Cache Service Worker
const ASSET_CACHE = 'therason-clinic-assets-v2';
const FONT_CACHE = 'therason-clinic-fonts-v1';
const SHELL_CACHE = 'therason-clinic-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allowed = new Set([ASSET_CACHE, FONT_CACHE, SHELL_CACHE]);
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

function shouldBypass(url) {
  const p = url.pathname;
  if (
    p.startsWith('/api/') ||
    p.startsWith('/src/') ||
    p.startsWith('/@') ||
    p.startsWith('/node_modules/') ||
    p.includes('hot-update') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v')
  ) {
    return true;
  }
  return false;
}

async function isValidAssetResponse(pathname, res) {
  if (!res || !res.ok || res.status !== 200) return false;
  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;
  if (pathname.endsWith('.glb')) {
    try {
      const buf = await res.clone().arrayBuffer();
      if (buf.byteLength < 12) return false;
      const b = new Uint8Array(buf, 0, 4);
      // Verify 'glTF' magic header (0x67, 0x6C, 0x54, 0x46)
      return b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46;
    } catch {
      return false;
    }
  }
  return true;
}

async function cacheFirst(request, cacheName) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    if (await isValidAssetResponse(pathname, cached)) {
      return cached;
    }
    await cache.delete(request).catch(() => {});
  }

  let networkRes = await fetch(request);
  if (!(await isValidAssetResponse(pathname, networkRes))) {
    networkRes = await fetch(new Request(request.url, { cache: 'reload' }));
  }
  if (await isValidAssetResponse(pathname, networkRes)) {
    cache.put(request, networkRes.clone()).catch(() => {});
  }
  return networkRes;
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && res.status === 200) {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }
  const fresh = await networkPromise;
  return fresh || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Google Fonts: fast Stale-While-Revalidate so typography paints immediately
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE, event));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  const pathname = url.pathname;

  // Heavy 3D GLBs, textures & key-art: Cache-First backed by shared CacheStorage
  if (
    pathname.startsWith('/models/') ||
    pathname.endsWith('.glb') ||
    pathname.startsWith('/assets/aistudio/')
  ) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // Production hashed bundles (/assets/*.js, /assets/*.css, fonts, images)
  if (pathname.startsWith('/assets/') && /\.(js|css|woff2|png|webp|svg|ico)$/i.test(pathname)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }
});
