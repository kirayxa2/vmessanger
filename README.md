# VortexMessenger

A messenger built from scratch — no bloat, just what matters. Fast, dark, real-time.

---

## Features

- Instant message delivery via WebSockets
- Smooth animations that make the UI feel alive
- Secure authentication with NextAuth.js
- Media files and database on Supabase
- Works in browser and on Android
- Deep dark theme (#0e1621) — easy on the eyes and saves battery on OLED screens

---

## Stack

**Frontend**
- Next.js 15+ (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion

**Backend**
- Socket.io
- Supabase (PostgreSQL + Storage)
- NextAuth
- Prisma

**Mobile**
- Android APK via GitHub Actions (TWA/WebView)

---

## Codebase

| Language | Share |
|----------|-------|
| TypeScript | 85.2% |
| C++ | 8.4% |
| JavaScript | 3.8% |
| CSS / CMake | 2.6% |

---

## Running locally

```bash
npm install
```

Create a `.env` file and fill in the required variables (Supabase URL, NextAuth secret, etc.), then:

```bash
node server.js
```

---

## Android APK

The APK is built automatically via GitHub Actions on every push to `main`.  
Download the latest build from **Actions → Artifacts**.

---

## License

Private project. All rights reserved.  
Author: **kirayxa2**
