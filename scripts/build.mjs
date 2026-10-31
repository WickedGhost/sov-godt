import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'www');
const assets = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'service-worker.js',
  'app-icon.svg',
  'app-icon-192.png',
  'app-icon-512.png',
  'apple-touch-icon.png',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(assets.map((asset) => cp(resolve(root, asset), resolve(output, asset))));
