# VortexMessenger — Полная инструкция по деплою

---

## ЧАСТЬ 1 — Исправленные уязвимости

Перед деплоем в код были внесены следующие исправления безопасности:

| # | Уязвимость | Где | Исправление |
|---|-----------|-----|-------------|
| 1 | **Нет валидации входных данных** при регистрации | `/api/register` | Проверка email-формата, username (только a-z/0-9/_, 3–30 символов), пароля (8–128 символов) |
| 2 | **Отсутствие rate limiting** на регистрацию | `/api/register` | Максимум 5 попыток с одного IP в час |
| 3 | **bcrypt cost factor = 10** — слабоват | `/api/register` | Увеличен до 12 |
| 4 | **Любой авторизованный мог читать чужие сообщения** | `/api/messages GET` | Добавлена проверка участия в беседе перед выдачей |
| 5 | **Любой авторизованный мог слать в чужие чаты** | `/api/messages POST` | Проверка участника до создания сообщения |
| 6 | **Нет лимита длины сообщения** — возможна DOS-атака | `/api/messages` | Максимум 4096 символов |
| 7 | **Загрузка любых файлов** как аватар | `/api/users/avatar` | Только JPEG/PNG/WebP/GIF, максимум 5MB, безопасное имя |
| 8 | **Anon key Supabase** на сервере для загрузки | `/lib/supabase.ts` | Добавлен `supabaseAdmin` с service role key |
| 9 | **DEBUG=true в production** + сессии в логах | `[...nextauth]/route.ts` | Debug только в development, убран console.log |
| 10 | **Нет security headers** | `next.config.ts` | X-Frame-Options, CSP, X-Content-Type-Options и др. |
| 11 | **Нет валидации username/bio** при обновлении | `/api/users/profile` | Валидация с теми же правилами что при регистрации |
| 12 | **Нет ограничения поискового запроса** | `/api/users/search` | Максимум 50 символов |
| 13 | **Credentials в .env захардкожены** | `.env` | Секреты нужно поменять перед деплоем (см. ниже) |

---

## ЧАСТЬ 2 — Деплой на Railway

### Почему Railway, а не Vercel?

Vercel — **serverless**-платформа. У неё нет поддержки постоянных WebSocket-соединений,
а `server.js` с Socket.IO требует постоянно работающего Node.js процесса.
Vercel убьёт соединение через 10–30 секунд.

**Railway** — полноценный сервер с поддержкой:
- Node.js как постоянный процесс
- WebSockets / Socket.IO без ограничений
- Бесплатный тир: $5 кредитов в месяц
- Автодеплой из GitHub

---

### Шаг 1 — Подготовь репозиторий

```bash
cd D:\vmessanger
git init
git add .
git commit -m "initial"
```

Создай **приватный** репозиторий на GitHub и запушь:
```bash
git remote add origin https://github.com/ТВО_НИКНЕЙМ/vmessanger.git
git branch -M main
git push -u origin main
```

Убедись что `.gitignore` содержит:
```
.env
.env.local
node_modules/
.next/
out/
dist/
```

---

### Шаг 2 — Получи Supabase Service Role Key

1. Открой [supabase.com](https://supabase.com) → твой проект
2. Перейди в **Settings → API**
3. Скопируй **service_role** key (длинный JWT, не anon!)

---

### Шаг 3 — Задеплой на Railway

1. Зайди на [railway.app](https://railway.app) → **Login with GitHub**
2. **New Project → Deploy from GitHub repo** → выбери `vmessanger`

#### Переменные окружения (Variables):

В Railway → твой сервис → вкладка **Variables**, добавь все эти переменные:

```
DATABASE_URL=postgresql://postgres.taozobjhniqhjukwgmvn:VortexDev2Brooo@aws-1-us-east-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.taozobjhniqhjukwgmvn:VortexDev2Brooo@aws-1-us-east-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://taozobjhniqhjukwgmvn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...твой_anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...твой_service_role_key...
NEXTAUTH_SECRET=СГЕНЕРИРУЙ_НОВЫЙ_СЕКРЕТ
NEXTAUTH_URL=https://vmessanger-production.up.railway.app
NODE_ENV=production
PORT=3000
```

> ⚠️ Сгенерируй новый NEXTAUTH_SECRET командой в терминале:
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

#### Команды деплоя (Settings → Deploy):

- **Build Command:** `npm run build`
- **Start Command:** `npm run start`

#### Получи домен:

Railway → Settings → **Domains → Generate Domain**
Скопируй URL вида `vmessanger-production.up.railway.app`
Обнови переменную `NEXTAUTH_URL` на этот URL.

---

### Шаг 4 — Примени схему БД

Открой терминал локально и выполни с production DATABASE_URL:

```bash
cd D:\vmessanger
npx dotenv -e .env -- npx prisma db push
```

Или в Railway: Settings → **Post-Deploy Command** → `npx prisma db push`

---

## ЧАСТЬ 3 — Сборка Electron (.exe + установщик NSIS)

### Шаг 1 — Установи electron-builder

```bash
cd D:\vmessanger
npm install --save-dev electron-builder
```

---

### Шаг 2 — Добавь в package.json секцию "build"

Открой `D:\vmessanger\package.json` и добавь/замени следующее:

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js",
    "electron": "electron .",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "electron-builder --win --x64"
  },
  "build": {
    "appId": "com.vortex.messenger",
    "productName": "VortexMessenger",
    "copyright": "Copyright © 2024 Vortex",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "package.json",
      "!node_modules/.cache",
      "!**/*.ts",
      "!**/*.tsx",
      "!.next",
      "!src"
    ],
    "extraResources": [],
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "public/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "allowElevation": true,
      "installerIcon": "public/icon.ico",
      "uninstallerIcon": "public/icon.ico",
      "installerHeaderIcon": "public/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "VortexMessenger",
      "license": "LICENSE.txt"
    },
    "mac": {
      "target": "dmg",
      "icon": "public/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "public/icon.png"
    }
  }
}
```

---

### Шаг 3 — Обнови main.js

Замени весь `D:\vmessanger\main.js` на следующий код
(вставь свой Railway URL в `PRODUCTION_URL`):

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ← Вставь сюда свой Railway URL
const PRODUCTION_URL = 'https://vmessanger-production.up.railway.app';

const isDev = process.env.NODE_ENV === 'development' ||
              process.env.ELECTRON_DEV === '1';

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1c1c1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      backgroundThrottling: false,
    },
  });

  // В production открываем Railway, в dev — localhost
  const startUrl = isDev ? 'http://localhost:3000' : PRODUCTION_URL;
  mainWindow.loadURL(startUrl);

  if (isDev) mainWindow.webContents.openDevTools();

  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

---

### Шаг 4 — Подготовь иконку

Нужен файл `D:\vmessanger\public\icon.ico` (256×256 пикселей).

Если у тебя есть PNG-логотип, конвертируй его онлайн:
- [convertico.com](https://convertico.com/) — PNG → ICO

Положи готовый файл в `D:\vmessanger\public\icon.ico`

---

### Шаг 5 — Собери установщик

```bash
cd D:\vmessanger
npm run electron:build
```

Дождись завершения (может занять 2–5 минут, скачает Electron).

В папке `D:\vmessanger\dist\` появится:
```
dist/
  VortexMessenger Setup 0.1.0.exe    ← установщик (отправляй пользователям)
  win-unpacked/                       ← папка с распакованным приложением
```

---

### Что делает установщик при запуске

Установщик `VortexMessenger Setup 0.1.0.exe` при запуске:
1. Показывает диалог выбора папки (`C:\Program Files\VortexMessenger` по умолчанию)
2. Распаковывает все файлы Electron-приложения
3. Создаёт ярлык **на рабочем столе**
4. Создаёт ярлык в **меню Пуск**
5. Регистрирует в **"Программы и компоненты"** (можно удалить через стандартный деинсталлятор)
6. Устанавливает иконку, название, версию приложения

---

## ЧАСТЬ 4 — Схема работы production

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION СХЕМА                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐   HTTPS+WSS   ┌──────────────────────┐   │
│  │  VortexMessenger  │◄─────────────►│  Railway.app         │   │
│  │  .exe             │               │  Next.js + Socket.IO │   │
│  │  (Electron)       │               │  node server.js      │   │
│  │                   │               └──────────┬───────────┘   │
│  │  Открывает        │                          │               │
│  │  Railway URL      │               ┌──────────┴───────────┐   │
│  │  как окно браузера│               │  Supabase            │   │
│  └───────────────────┘               │  PostgreSQL + Storage│   │
│                                      └──────────────────────┘   │
│  ┌───────────────────┐                                          │
│  │  Браузер (web)    │◄─────────────────────────────────────►   │
│  │  Тот же Railway   │                                          │
│  │  URL              │                                          │
│  └───────────────────┘                                          │
│                                                                 │
│  ⚡ Electron — это просто Chromium-обёртка вокруг Railway URL.   │
│     Никакого локального сервера в .exe нет.                     │
│     Все данные, чаты, файлы — на Railway + Supabase.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Чеклист перед деплоем

- [ ] Поменять `NEXTAUTH_SECRET` на новый (обязательно!)
- [ ] Добавить `SUPABASE_SERVICE_ROLE_KEY` в Railway переменные
- [ ] Обновить `NEXTAUTH_URL` на реальный Railway домен
- [ ] В `main.js` вставить реальный Railway URL в `PRODUCTION_URL`
- [ ] Убедиться что `.env` в `.gitignore`
- [ ] Подготовить иконку `public/icon.ico`
- [ ] Запустить `npx prisma db push` для применения схемы БД
- [ ] Проверить что Railway Build/Start команды настроены
