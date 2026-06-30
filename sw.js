// sw.js - RootFacts Service Worker with Workbox
// Precaches core assets AND AI model files for full offline support

importScripts(
	'https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js'
);

// Configure Workbox
workbox.setConfig({ debug: false });

const {
	precaching,
	routing,
	strategies,
	expiration,
	cacheableResponse
} = workbox;

const { precacheAndRoute, cleanupOutdatedCaches } = precaching;
const { registerRoute, NavigationRoute } = routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = strategies;
const { ExpirationPlugin } = expiration;
const { CacheableResponsePlugin } = cacheableResponse;

// ─── Core App Assets Precache ─────────────────────────────────────────────────
// These files are precached so the app shell works fully offline
precacheAndRoute([
	{ url: './index.html', revision: '1' },
	{ url: './manifest.json', revision: '1' },
	{ url: './assets/css/styles.css', revision: '1' },
	{ url: './assets/js/core/app.js', revision: '1' },
	{ url: './assets/js/core/config.js', revision: '1' },
	{ url: './assets/js/core/utils.js', revision: '1' },
	{ url: './assets/js/ui/ui.handler.js', revision: '1' },
	{ url: './assets/js/services/camera.service.js', revision: '1' },
	{ url: './assets/js/services/detection.service.js', revision: '1' },
	{ url: './assets/js/services/facts.service.js', revision: '1' },
	{ url: './assets/icons/icon-192x192.png', revision: '1' },
	{ url: './assets/icons/icon-512x512.png', revision: '1' },
	{ url: './assets/icons/apple-touch-icon.png', revision: '1' },
	{ url: './assets/icons/favicon.ico', revision: '1' },
]);

cleanupOutdatedCaches();

// ─── AI Model Files Precache (Advanced: Offline AI Model) ─────────────────────
// Cache the TF.js model files so detection works offline
const AI_MODEL_CACHE = 'rootfacts-ai-model-v1';
const MODEL_FILES = [
	'./model/model.json',
	'./model/metadata.json',
	'./model/weights.bin',
];

// Register CacheFirst strategy for model files
registerRoute(
	({ url }) => MODEL_FILES.some(file => url.pathname.endsWith(file.replace('./', ''))),
	new CacheFirst({
		cacheName: AI_MODEL_CACHE,
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 10,
				maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
			}),
		],
	})
);

// ─── Google Fonts Cache ────────────────────────────────────────────────────────
registerRoute(
	({ url }) => url.origin === 'https://fonts.googleapis.com',
	new StaleWhileRevalidate({
		cacheName: 'google-fonts-stylesheets',
	})
);

registerRoute(
	({ url }) => url.origin === 'https://fonts.gstatic.com',
	new CacheFirst({
		cacheName: 'google-fonts-webfonts',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 30,
				maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
			}),
		],
	})
);

// ─── External CDN Libraries ────────────────────────────────────────────────────
registerRoute(
	({ url }) =>
		url.origin === 'https://cdn.jsdelivr.net' ||
		url.origin === 'https://unpkg.com' ||
		url.origin === 'https://storage.googleapis.com',
	new CacheFirst({
		cacheName: 'cdn-libraries',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
			}),
		],
	})
);

// ─── Navigation Fallback ───────────────────────────────────────────────────────
// Serve index.html for all navigation requests (SPA support)
registerRoute(
	new NavigationRoute(
		new NetworkFirst({
			cacheName: 'rootfacts-pages',
			networkTimeoutSeconds: 3,
		}),
		{ allowlist: [/^\//] }
	)
);

// ─── Service Worker Lifecycle ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
	console.log('✅ RootFacts SW: Installing and precaching AI model files...');
	event.waitUntil(
		caches.open(AI_MODEL_CACHE).then(async (cache) => {
			for (const file of MODEL_FILES) {
				try {
					await cache.add(file);
					console.log(`✅ Cached model file: ${file}`);
				} catch (err) {
					console.warn(`⚠️ Failed to cache model file: ${file}`, err);
				}
			}
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	console.log('✅ RootFacts SW: Activated');
	event.waitUntil(self.clients.claim());
});
