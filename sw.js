const CACHE_NAME = "muming-workkit-v9";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./tools.html",
  "./industries.html",
  "./about.html",
  "./privacy.html",
  "./terms.html",
  "./404.html",
  "./assets/css/styles.css",
  "./assets/js/main.js",
  "./assets/js/tools-data.js",
  "./assets/js/analytics.js",
  "./tools/admin-message/index.html",
  "./tools/foreign-workforce-message/index.html",
  "./tools/foreign-workforce-message/tool.css",
  "./tools/foreign-workforce-message/localization.js",
  "./tools/foreign-workforce-message/templates.js",
  "./tools/foreign-workforce-message/tool.js",
  "./tools/project-quote-helper/index.html",
  "./tools/project-quote-helper/tool.css",
  "./tools/project-quote-helper/rules.js",
  "./tools/project-quote-helper/tool.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match("./404.html"))
    )
  );
});







