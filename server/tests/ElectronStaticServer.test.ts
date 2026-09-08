import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http, { type IncomingHttpHeaders } from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { createStaticServer } = require('../../electron/staticServer.cjs') as {
  createStaticServer: (rootDir: string) => Promise<ServerState>;
};

interface ServerState {
  url: string;
  close: () => Promise<void>;
}

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

function rawRequest(base: string, requestPath: string, method = 'GET'): Promise<RawResponse> {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port: Number(port), path: requestPath, method }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

let root: string;
let serverState: ServerState;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'yugioh-static-'));
  await writeFile(path.join(root, 'index.html'), '<html><body>Hello</body></html>', 'utf8');
  await writeFile(path.join(root, 'app.js'), 'console.log("app");', 'utf8');
  await writeFile(path.join(root, 'sound.ogg'), Buffer.from([0x4f, 0x67, 0x67, 0x53]));
  serverState = await createStaticServer(root);
});

afterEach(async () => {
  await serverState.close();
  await rm(root, { recursive: true, force: true });
});

describe('Electron static server', () => {
  it('serves the root document with HTML MIME', async () => {
    const response = await rawRequest(serverState.url, '/');
    expect(response.status).toBe(200);
    expect(response.body).toContain('Hello');
    expect(response.headers['content-type']).toMatch(/html/i);
  });

  it('serves JavaScript and OGG assets with explicit MIME types', async () => {
    const script = await rawRequest(serverState.url, '/app.js');
    const audio = await rawRequest(serverState.url, '/sound.ogg');
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toMatch(/javascript/i);
    expect(audio.status).toBe(200);
    expect(audio.headers['content-type']).toMatch(/ogg/i);
  });

  it('rejects encoded and backslash traversal attempts', async () => {
    expect((await rawRequest(serverState.url, '/%2e%2e%2fapp.js')).status).toBe(403);
    expect((await rawRequest(serverState.url, '/..\\app.js')).status).toBe(403);
  });

  it('returns 404 for missing files and 405 for disallowed methods', async () => {
    expect((await rawRequest(serverState.url, '/missing.txt')).status).toBe(404);
    expect((await rawRequest(serverState.url, '/', 'POST')).status).toBe(405);
  });
});
