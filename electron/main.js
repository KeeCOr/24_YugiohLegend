const { app, BrowserWindow } = require('electron');
const path = require('path');
const { WebSocketServer } = require('ws');

let mainWindow;
let wss;

function startServer() {
  // Load server modules from built server dist
  const serverDist = path.join(__dirname, '..', 'server', 'dist', 'server', 'src');
  const { RoomManager } = require(path.join(serverDist, 'RoomManager'));

  const PORT = 8080;
  wss = new WebSocketServer({ port: PORT });
  const manager = new RoomManager();

  wss.on('connection', (ws) => {
    console.log('[server] client connected');
    manager.handleConnection(ws);
  });

  wss.on('error', (err) => {
    console.error('[server] WebSocket server error:', err);
  });

  console.log(`[server] WebSocket server running on ws://localhost:${PORT}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 1600,
    useContentSize: true,
    resizable: false,
    title: 'YugiohLegend',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const clientDist = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  mainWindow.loadFile(clientDist);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (wss) {
    wss.close();
  }
  app.quit();
});
