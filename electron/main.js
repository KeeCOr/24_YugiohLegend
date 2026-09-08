const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createStaticServer } = require('./staticServer.cjs');

let mainWindow;
let wss;
let serverPort = 8080;
let staticServerPromise = null;
let closePromise = null;
let quitting = false;

function startServer() {
  const serverDist = path.join(__dirname, '..', 'server', 'dist', 'server', 'src');
  const { RoomManager } = require(path.join(serverDist, 'RoomManager'));
  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    const manager = new RoomManager();
    wss.on('connection', (ws) => manager.handleConnection(ws));
    wss.on('listening', () => {
      const address = wss.address();
      serverPort = typeof address === 'object' && address ? address.port : 8080;
      resolve(serverPort);
    });
    wss.on('error', reject);
  });
}

function ensureStaticServer() {
  if (!staticServerPromise) {
    staticServerPromise = createStaticServer(path.join(__dirname, '..', 'client', 'dist'));
  }
  return staticServerPromise;
}

async function createWindow() {
  const staticServer = await ensureStaticServer();
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
  const targetWidth = 1600;
  const targetHeight = 900;
  const scale = Math.min(1, (workWidth - 80) / targetWidth, (workHeight - 80) / targetHeight);
  const windowWidth = Math.max(960, Math.floor(targetWidth * scale));
  const windowHeight = Math.max(540, Math.floor(targetHeight * scale));

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    useContentSize: true,
    resizable: true,
    minWidth: 960,
    minHeight: 540,
    title: 'YugiohLegend',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  await mainWindow.loadURL(`${staticServer.url}?wsPort=${encodeURIComponent(String(serverPort))}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function closeAll() {
  if (closePromise) return closePromise;
  closePromise = (async () => {
    if (wss) {
      await new Promise((resolve) => wss.close(resolve));
      wss = null;
    }
    if (staticServerPromise) {
      const staticServer = await staticServerPromise;
      await staticServer.close();
      staticServerPromise = null;
    }
  })();
  return closePromise;
}

app.whenReady().then(async () => {
  await startServer();
  await ensureStaticServer();
  await createWindow();
}).catch((error) => {
  console.error('[electron] startup failed', error);
  app.quit();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting || (!wss && !staticServerPromise)) return;
  event.preventDefault();
  void closeAll().finally(() => {
    quitting = true;
    app.quit();
  });
});
