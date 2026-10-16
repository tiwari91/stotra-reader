/* Stotra Reader service worker: keeps the page, icons and fonts on the device so the
   texts open with no signal. The page is network-first (so updates arrive), fonts are
   cache-first, and the font CSS is served from cache while it refreshes. */
const VERSION = "5ac20b8cb804";
const CACHE = "stotra-" + VERSION;
const FONTS = "stotra-fonts";
const SHELL = [ "./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png" ];

self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
	e.waitUntil(caches.keys()
		.then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
		.then(() => self.clients.claim()));
});

/* The page sends the font URLs it already loaded, so fonts work offline from the first visit. */
self.addEventListener("message", (e) => {
	const urls = e.data && e.data.type === "cache-fonts" && Array.isArray(e.data.urls) ? e.data.urls : [];
	const ok = urls.filter((u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
	if (!ok.length) return;
	e.waitUntil(caches.open(FONTS).then((c) => Promise.all(ok.map((u) =>
		c.match(u).then((hit) => hit || fetch(u, { mode: "cors", credentials: "omit" }).then((r) => { if (r.ok) return c.put(u, r); }).catch(() => {}))))));
});

self.addEventListener("fetch", (e) => {
	const req = e.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);

	if (url.hostname === "fonts.gstatic.com") {
		e.respondWith(caches.open(FONTS).then((c) => c.match(req.url).then((hit) => hit || fetch(req).then((r) => {
			if (r.ok || r.type === "opaque") c.put(req.url, r.clone());
			return r;
		}))));
		return;
	}
	if (url.hostname === "fonts.googleapis.com") {
		e.respondWith(caches.open(FONTS).then((c) => c.match(req.url).then((hit) => {
			const net = fetch(req).then((r) => { if (r.ok) c.put(req.url, r.clone()); return r; }).catch(() => hit);
			return hit || net;
		})));
		return;
	}
	if (url.origin !== self.location.origin) return;

	if (req.mode === "navigate") {
		e.respondWith(fetch(req).then((r) => {
			if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); }
			return r;
		}).catch(() => caches.match("./", { ignoreSearch: true }).then((hit) => hit || caches.match(req))));
		return;
	}
	e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
