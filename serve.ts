// Minimal static file server for local play-testing of ASHFALL YARD.
// Serves game/ at http://localhost:<port>/ (default 8080). Node 22, standard
// library only — no dependencies, no build step.
//
//   node serve.ts [port]
//
// Open http://localhost:8080 in desktop Chrome. Click DEPLOY to lock the
// mouse and play. Deterministic screenshot poses live behind query strings:
//   ?shot=menu | ?shot=action | ?shot=buy | ?shot=plant | ?shot=end
//   ?shot=selftest   (headless smoke test: plays a round to its conclusion)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const port = Number(process.argv[2] ?? 8080);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    const file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME.get(extname(file)) ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`ASHFALL YARD at http://localhost:${port} (serving game/)`);
});
