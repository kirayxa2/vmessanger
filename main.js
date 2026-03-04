const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');

const PRODUCTION_URL = 'https://vmessanger-production.up.railway.app';

const isDev = process.env.NODE_ENV === 'development' ||
              process.env.ELECTRON_DEV === '1';

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function getIconPath() {
  return path.join(__dirname, 'public', 'logo (1).ico');
}

let mainWindow;

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1c1c1c',
    icon: iconPath, // taskbar, alt+tab, dock — только это, без overlayIcon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      backgroundThrottling: false,
    },
  });

  const startUrl = isDev ? 'http://localhost:3000' : PRODUCTION_URL;
  mainWindow.loadURL(startUrl);

  if (isDev) mainWindow.webContents.openDevTools();

  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  mainWindow.on('closed', () => { mainWindow = null; });
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.vortex.messenger');
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

  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      try {
        app.dock.setIcon(nativeImage.createFromPath(getIconPath()));
      } catch (e) {}
    }
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
