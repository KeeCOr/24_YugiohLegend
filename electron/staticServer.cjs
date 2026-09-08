'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendText(res, statusCode, message) {
  const body = Buffer.from(message, 'utf-8');
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function createStaticServer(distRoot) {
  const resolvedRoot = path.resolve(distRoot);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendText(res, 405, 'Method Not Allowed');
          return;
        }

        let rawUrl = req.url || '/';
        const queryIndex = rawUrl.indexOf('?');
        if (queryIndex !== -1) rawUrl = rawUrl.slice(0, queryIndex);
        if (rawUrl.includes('\\')) {
          sendText(res, 403, 'Forbidden');
          return;
        }

        let decodedUrl;
        try {
          decodedUrl = decodeURIComponent(rawUrl);
        } catch {
          sendText(res, 400, 'Bad Request');
          return;
        }

        if (decodedUrl.includes('\\') || decodedUrl.includes('..')) {
          sendText(res, 403, 'Forbidden');
          return;
        }

        let urlPath = decodedUrl === '/' ? '/index.html' : decodedUrl;
        if (urlPath.startsWith('/')) urlPath = urlPath.slice(1);
        const targetPath = path.resolve(resolvedRoot, urlPath);
        const relative = path.relative(resolvedRoot, targetPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          sendText(res, 403, 'Forbidden');
          return;
        }

        fs.stat(targetPath, (err, stats) => {
          if (err || !stats.isFile()) {
            sendText(res, 404, 'Not Found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': getMimeType(targetPath),
            'Content-Length': stats.size,
          });
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          const stream = fs.createReadStream(targetPath);
          stream.on('error', () => res.end());
          stream.pipe(res);
        });
      } catch {
        sendText(res, 400, 'Bad Request');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const url = `http://127.0.0.1:${address.port}/`;
      const close = () => new Promise((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose());
      });
      resolve({ server, url, close });
    });
  });
}

module.exports = { createStaticServer };
