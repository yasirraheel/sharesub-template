import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const host = valueAfter('--host') || '127.0.0.1';
const port = Number(valueAfter('--port') || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};
const routeAliases = new Map([
  ['/en/subscriptions', 'en/subscriptions.html'],
  ['/en/subscriptions/house', 'en/subscriptions/house.html'],
  ['/en/brand/amazon', 'en/brand/amazon.html'],
  ['/en/register', 'en/register.html'],
  ['/en/userlogin', 'en/userlogin.html'],
  ['/en/dashboard', 'en/dashboard.html'],
  ['/en/my-shared-subscriptions', 'en/my-shared-subscriptions.html'],
  ['/en/joined-subscriptions', 'en/joined-subscriptions.html'],
  ['/en/waiting-list', 'en/waiting-list.html'],
  ['/en/my-wallet', 'en/my-wallet.html'],
  ['/en/my-cards', 'en/my-cards.html'],
  ['/en/my-account', 'en/my-account.html'],
  ['/en/my-settings', 'en/my-settings.html'],
  ['/en/my-chat/subscriptions', 'en/my-chat/subscriptions.html'],
]);

const server = http.createServer((req, res) => {
  if (!req.url) return res.writeHead(400).end();
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  const relativePath = routeAliases.get(requestPath) || (requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''));
  const filePath = path.resolve(siteRoot, relativePath);
  if (!filePath.startsWith(siteRoot + path.sep)) return res.writeHead(403).end('Forbidden');
  const sendFile = (candidate) => fs.stat(candidate, (error, stats) => {
    if (error || !stats.isFile()) return res.writeHead(404).end('Not found');
    res.setHeader('Content-Type', mime[path.extname(candidate).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(candidate).pipe(res);
  });
  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) return sendFile(path.join(filePath, 'index.html'));
    sendFile(filePath);
  });
});

server.listen(port, host, () => {
  console.log(`Sharesub offline template: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
});
