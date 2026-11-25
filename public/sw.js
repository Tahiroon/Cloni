// THERASON CLINIC — Smart Browser-First Cache Service Worker
const ASSET_CACHE = 'therason-clinic-assets-v5';
const FONT_CACHE = 'therason-clinic-fonts-v1';
const SHELL_CACHE = 'therason-clinic-shell-v4';

const PRECACHE_ASSETS = [
  '/assets/aistudio/splash_cover.webp',
  '/assets/aistudio/splash_backdrop.webp',
  '/models/med/Textures/colormap.png',
  '/models/furn/desk.glb',
  '/models/furn/chair_desk.glb',
  '/models/furn/monitor.glb',
  '/models/furn/coffee_table.glb',
  '/models/furn/bookshelf.glb',
  '/models/furn/plant_1.glb',
  '/models/furn/plant_ficus.glb',
  '/models/med/wheelchair.glb',
  '/models/kenney_furn/desk_corner.glb',
  '/models/kenney_furn/lamp_wall.glb',
  '/models/kenney_furn/med_cabinet.glb',
  '/models/furn/trashcan.glb',
  '/models/furn/lamp_floor.glb',
  '/models/furn/lamp_desk.glb',
  '/models/nature/bush_1.glb',
  '/models/nature/bush_2.glb',
  '/models/nature/grass_clump.glb',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(ASSET_CACHE).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (assetUrl) => {
          try {
            const hit = await cache.match(assetUrl);
            if (hit) return;
            const res = await fetch(assetUrl, { cache: 'default' });
            if (await isValidAssetResponse(assetUrl, res, false)) {
              await cache.put(assetUrl, res);
            }
          } catch {
            // Non-fatal precache miss
          }
        })
      );
    })
  );
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

async function isValidAssetResponse(pathname, res, isFromCache = false) {
  if (!res || !res.ok || res.status !== 200) return false;
  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;

  // Fast-path: cached entries already validated when stored avoid cloning/reading multi-MB buffers
  if (isFromCache && res.headers.get('X-Therason-Valid') === '1') {
    return true;
  }

  if (pathname.endsWith('.glb')) {
    try {
      // Inspect only the first 4 bytes when readable stream is available instead of buffering MBs
      if (res.body && typeof res.clone().body?.getReader === 'function') {
        const reader = res.clone().body.getReader();
        const head = new Uint8Array(4);
        let filled = 0;
        while (filled < 4) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          const take = Math.min(4 - filled, value.byteLength);
          head.set(value.subarray(0, take), filled);
          filled += take;
        }
        await reader.cancel().catch(() => {});
        return (
          filled >= 4 &&
          head[0] === 0x67 &&
          head[1] === 0x6c &&
          head[2] === 0x54 &&
          head[3] === 0x46
        );
      }
      const buf = await res.clone().arrayBuffer();
      if (buf.byteLength < 12) return false;
      const b = new Uint8Array(buf, 0, 4);
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
  const cached = (await cache.match(request)) || (await cache.match(pathname));
  if (cached) {
    if (await isValidAssetResponse(pathname, cached, true)) {
      return cached;
    }
    await cache.delete(request).catch(() => {});
    await cache.delete(pathname).catch(() => {});
  }

  let networkRes = await fetch(request);
  if (!(await isValidAssetResponse(pathname, networkRes, false))) {
    networkRes = await fetch(new Request(request.url, { cache: 'reload' }));
  }
  if (await isValidAssetResponse(pathname, networkRes, false)) {
    const cacheKey = pathname.startsWith('/models/') || pathname.startsWith('/assets/aistudio/') ? pathname : request;
    const headers = new Headers(networkRes.headers);
    headers.set('X-Therason-Valid', '1');
    networkRes
      .clone()
      .arrayBuffer()
      .then((buf) =>
        cache.put(
          cacheKey,
          new Response(buf, {
            status: networkRes.status,
            statusText: networkRes.statusText,
            headers,
          })
        )
      )
      .catch(() => {});
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

  // App shell HTML navigation: fast Stale-While-Revalidate for instant mobile boot
  if (req.mode === 'navigate' || pathname === '/') {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE, event));
  }
});
