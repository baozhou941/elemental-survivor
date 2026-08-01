import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { contentTypeFor, resolveRequestPath } from '../scripts/serve.mjs';

const root = path.resolve('D:/workspace');

test('static server maps root and safe asset paths inside the workspace', () => {
  assert.equal(resolveRequestPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolveRequestPath(root, '/src/main.js'), path.join(root, 'src', 'main.js'));
});

test('static server rejects traversal and decodes safe paths', () => {
  assert.equal(resolveRequestPath(root, '/%2e%2e/secret.txt'), null);
  assert.equal(resolveRequestPath(root, '/docs/game/vision.md?raw=1'), path.join(root, 'docs', 'game', 'vision.md'));
});

test('static server returns browser-safe content types', () => {
  assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('main.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('styles.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('asset.bin'), 'application/octet-stream');
});

test('production page uses relative assets for GitHub Pages project paths', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/src\/main\.js"/);
  assert.doesNotMatch(html, /(?:href|src)="\/(?:styles\.css|src\/main\.js)"/);
});
