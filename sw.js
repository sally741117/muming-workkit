const CACHE_NAME = "muming-workkit-v11";
const CACHE_PREFIX = "muming-workkit-";

const HTML_ASSETS = [
  "./",
  "./index.html",
  "./tools.html",
  "./industries.html",
  "./about.html",
  "./privacy.html",
  "./terms.html",
  "./404.html",
  "./tools/admin-message/index.html",
  "./tools/foreign-workforce-message/index.html",
  "./tools/project-quote-helper/index.html"
];

const STATIC_ASSETS = [
  "./assets/css/styles.css",
  "./assets/js/main.js",
  "./assets/js/tools-data.js",
  "./assets/js/analytics.js",
  "./tools/foreign-workforce-message/tool.css",
  "./tools/foreign-workforce-message/localization.js",
  "./tools/foreign-workforce-message/templates.js",
  "./tools/foreign-workforce-message/tool.js",
  "./tools/project-quote-helper/tool.css",
  "./tools/project-quote-helper/rules.js",
  "./tools/project-quote-helper/tool.js",
  "./manifest.webmanifest"
];

const CORE_ASSETS = [...HTML_ASSETS, ...STATIC_ASSETS];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) return true;
  const url = new URL(request.url);
  return url.pathname.endsWith(".html") || url.pathname.endsWith("/");
}

function fallbackHtmlPath(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/tools/project-quote-helper/")) return "./tools/project-quote-helper/index.html";
  if (url.pathname.endsWith("/tools/admin-message/")) return "./tools/admin-message/index.html";
  if (url.pathname.endsWith("/tools/foreign-workforce-message/")) return "./tools/foreign-workforce-message/index.html";
  return "./404.html";
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || (await cache.match(fallbackHtmlPath(request)));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(isHtmlRequest(event.request) ? networkFirst(event.request) : cacheFirst(event.request));
});
