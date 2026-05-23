const CACHE_NAME = 'survival-io-assets-v1';

// Файлы ядра игры, которые кэшируются сразу при первом посещении
const CORE_ASSETS = [
    './',
    './index.html',
    './main.js',
    './config.js',
    './entities.js',
    './ui.js',
    './utils.js'
];

// Установка воркера: скачиваем и сохраняем код игры
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Кэшируем ядро игры...');
            return cache.addAll(CORE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Активация: чистим старые версии кэша, если они были
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Удаляем старый кэш:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Перехват запросов: магия мгновенной загрузки текстур
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // ИСПРАВЛЕНО: Полностью игнорируем запросы от расширений Chrome/Firefox и data-url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return; 
    }

    // Стратегия для КАРТИНОК И ТЕКСТУР (Локальные img/* или внешние заглушки placehold.co)
    if (url.match(/\.(png|jpg|jpeg|gif|svg)$/) || url.includes('placehold.co')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // Если картинка есть в кэше — отдаем её секунда в секунду
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Если картинки нет — идем в сеть, скачиваем, отдаем игроку и сохраняем в кэш
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200) return networkResponse;
                    
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            })
        );
    } else {
        // Стратегия для КОДА И СКРИПТОВ (Stale-While-Revalidate):
        // Грузим из кэша мгновенно, но параллельно проверяем сеть на наличие обновлений.
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Оффлайн-режим: сеть упала, но у нас есть копия в кэше
                });
                
                return cachedResponse || fetchPromise;
            })
        );
    }
});