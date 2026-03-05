// public/sw.js — Vortex Messenger Service Worker
// Кешируем shell приложения для работы без сети

const CACHE_NAME = "vortex-v1"
const OFFLINE_URL = "/offline"

// Файлы которые кешируем при установке (app shell)
const PRECACHE = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
]

// Устанавливаем SW — кешируем shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE).catch(() => {
        // Если что-то не закешировалось — не блокируем
      })
    })
  )
  self.skipWaiting()
})

// Активируем — удаляем старые кеши
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Перехватываем запросы
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API запросы — только сеть, не кешируем
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      })
    )
    return
  }

  // Socket.IO — пропускаем
  if (url.pathname.startsWith("/api/socket")) return

  // Навигация (HTML страницы) — Network first, fallback на кеш или /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кешируем успешный ответ
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          // Нет сети — ищем в кеше
          const cached = await caches.match(request)
          if (cached) return cached
          // Если нет даже в кеше — показываем offline страницу
          const offlinePage = await caches.match("/offline")
          return offlinePage || new Response("Нет соединения", { status: 503 })
        })
    )
    return
  }

  // Статика (JS, CSS, картинки) — Cache first, потом сеть
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached || new Response("", { status: 404 }))
      })
    )
    return
  }
})
