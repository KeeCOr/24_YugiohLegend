const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { WebSocketServer } = require('ws');

let mainWindow;
let wss;
let serverPort = 8080;

function startServer() {
  // Load server modules from built server dist
  const serverDist = path.join(__dirname, '..', 'server', 'dist', 'server', 'src');
  const { RoomManager } = require(path.join(serverDist, 'RoomManager'));

  return new Promise((resolve, reject) => {
    wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    const manager = new RoomManager();

    wss.on('connection', (ws) => {
      console.log('[server] client connected');
      manager.handleConnection(ws);
    });

    wss.on('listening', () => {
      const address = wss.address();
      serverPort = typeof address === 'object' && address ? address.port : 8080;
      console.log(`[server] WebSocket server running on ws://127.0.0.1:${serverPort}`);
      resolve(serverPort);
    });

    wss.on('error', (err) => {
      console.error('[server] WebSocket server error:', err);
      reject(err);
    });
  });
}

function createWindow() {
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const clientDist = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  mainWindow.loadFile(clientDist, { query: { wsPort: String(serverPort) } });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (wss) {
    wss.close();
  }
  app.quit();
});
