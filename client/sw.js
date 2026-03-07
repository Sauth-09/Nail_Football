/**
 * sw.js - Service Worker for Çivi Futbolu PWA
 * 
 * Caching strategy:
 * - Static assets: Cache-first (HTML, CSS, JS, images)
 * - API calls: Network-first with cache fallback
 * - Install: Pre-cache critical assets
 * - Activate: Clean up old caches
 */

'use strict';

const CACHE_NAME = 'civi-futbol-v2.0.0';

/** Critical assets to pre-cache on install */
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/responsive.css',
    '/css/animations.css',
    '/js/main.js',
    '/js/uiManager.js',
    '/js/gameRenderer.js',
    '/js/fieldRenderer.js',
    '/js/animationManager.js',
    '/js/effectsManager.js',
    '/js/soundManager.js',
    '/js/physicsClient.js',
    '/js/aiEngine.js',
    '/manifest.json',
    '/futbol.ico',
    '/fields/fieldData.json'
];

// ═══════════════════════════════════════════
// Install Event - Pre-cache critical assets
// ═══════════════════════════════════════════

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v2.0.0');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching critical assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate immediately
            .catch((err) => {
                console.error('[SW] Pre-cache failed:', err);
            })
    );
});

// ═══════════════════════════════════════════
// Activate Event - Clean old caches
// ═══════════════════════════════════════════

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v2.0.0');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // Take control immediately
    );
});

// ═══════════════════════════════════════════
// Fetch Event - Cache strategies
// ═══════════════════════════════════════════

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip WebSocket and admin panel requests
    if (url.pathname.startsWith('/admin') || url.pathname.includes('manager-ws')) return;

    // API calls: Network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Static assets: Cache-first with network fallback
    event.respondWith(cacheFirst(event.request));
});

/**
 * Cache-first strategy: try cache, fall back to network
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // If offline and no cache, return offline page
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        throw err;
    }
}

/**
 * Network-first strategy: try network, fall back to cache
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Return empty JSON for API requests when offline
        return new Response(JSON.stringify({ error: 'Çevrimdışısınız', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
