import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
});

export function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function resolveRequestPath(root, requestUrl) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestUrl.split('?')[0]).replaceAll('\\', '/');
  } catch {
    return null;
  }

  const parts = decoded.split('/').filter(Boolean);
  if (parts.includes('..')) return null;
  const relative = parts.length === 0 ? 'index.html' : path.join(...parts);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`) ? resolved : null;
}

export function createStaticServer(root) {
  return createServer(async (request, response) => {
    const filePath = resolveRequestPath(root, request.url ?? '/');
    if (!filePath) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypeFor(filePath),
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntryPoint) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const port = Number(process.env.ELEMENTAL_SURVIVOR_PORT ?? 4173);
  createStaticServer(root).listen(port, '127.0.0.1', () => {
    console.log(`Elemental Survivor: http://127.0.0.1:${port}`);
  });
}
