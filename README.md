# 🌌 VortexMessenger (vMessenger)

> **Next-Generation Real-time Messaging Experience.**
> Скорость вортекса, мощь современных технологий.

---

## ✨ Основные возможности

* **Real-time Core:** Мгновенная доставка сообщений через **Socket.io**.
* **Fluid UI:** Плавные, "живые" анимации интерфейса на **Framer Motion**.
* **Secure Auth:** Надежная авторизация через **NextAuth.js**.
* **Cloud Backend:** База данных и хранилище медиафайлов на **Supabase (PostgreSQL)**.
* **Cross-Platform:** Работа на Web и Android через **Capacitor.js**.
* **OLED Ready:** Глубокая темная тема (`#0e1621`) для экономии заряда и комфорта глаз.

---

## 🛠 Технологический стек

### Frontend & Core
* **Next.js 15+** (App Router)
* **TypeScript** (85.2% кодовой базы)
* **Tailwind CSS** (Styling)
* **React 19**

### Backend & Infrastructure
* **Socket.io** (WebSockets)
* **Supabase** (Database, Auth, Storage)
* **NextAuth** (Session Management)

### Mobile & Native
* **Capacitor** (Native Bridge)
* **C++ / CMake** (Performance modules & Native optimizations)

---

## 📊 Статистика проекта

* **TypeScript:** 85.2% (Type-safe development)
* **C++:** 8.4% (Native performance)
* **JavaScript:** 3.8% (Config & Scripts)
* **CSS / CMake:** 2.6% (Styling & Build systems)

---

## 🚀 Разработка и сборка

### Локальный запуск
1. Установите зависимости:
   ```bash
   npm install
   ```
2. Настройте .env (Supabase URL & Anon Key).
3. Запустите dev-сервер:
   ```bash
   npm run dev
   ```

### Сборка Android (CI/CD)
Проект настроен на автоматическую сборку через **GitHub Actions**. При каждом пуше в `main`:

1. Выполняется `next build` и `next export`.
2. Результат синхронизируется с **Capacitor**.
3. Генерируется `app-debug.apk` во вкладке **Actions** -> **Artifacts**.

---

## 🔒 Лицензия
Private Project. All rights reserved.  
Created by **kirayxa2**.
