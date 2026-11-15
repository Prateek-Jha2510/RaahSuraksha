const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {pipeline} = require('node:stream');
const [data, scorer, portText, token, ready] = process.argv.slice(2);
process.chdir(data);
process.env.RAAH_SCORER = scorer;
const api = require('./services.cjs').services();
const dist = path.join(__dirname, 'web');
const port = Number(portText);
const host = '127.0.0.1:' + port;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req, res) => {
    const deny = status => { res.writeHead(status); res.end(); };
    if (req.headers.host !== host || !(req.headers.cookie || '').split(/;\s*/).includes('raah_session=' + token)) return deny(403);
    if (req.headers.origin && req.headers.origin !== 'http://' + host) return deny(403);
    if (req.url.startsWith('/api/')) {
        req.url = req.url.slice(4);
        return api(req, res);
    }
    if (req.method !== 'GET') return deny(405);
    const pathname = req.url.split('?')[0];
    if (!(pathname === '/' || /^\/assets\/[\w.-]+$/.test(pathname))) return deny(404);
    const file = path.join(dist, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(file)) return deny(404);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    pipeline(fs.createReadStream(file), res, () => {});
});
server.listen(port, '127.0.0.1', () => fs.writeFileSync(ready, 'ready'));
