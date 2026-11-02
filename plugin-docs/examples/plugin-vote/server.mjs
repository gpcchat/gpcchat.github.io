import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyLogin, verifyWebhook } from './protocol.mjs';

const port = Number(process.env.PORT || 4399), origin = process.env.PLUGIN_ORIGIN || 'https://plugins.example';
const apiBase = process.env.GPC_API_BASE || 'https://api.gpcchat.com/api', appId = process.env.GPC_PLUGIN_APP_ID;
// Demonstration storage only. Production uses durable sessions, transactions,
// an event inbox with a unique event ID and a transactional job outbox.
const challenges = new Map(), inbox = new Set();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    let raw = Buffer.alloc(0);
    for await (const chunk of req) { raw = Buffer.concat([raw, chunk]); if (raw.length > 256 * 1024) return json(413, { error: 'BODY_TOO_LARGE' }); }
    if (req.method === 'GET' && url.pathname === '/auth/challenge') {
      const nonce = randomBytes(32).toString('hex'), session = randomBytes(24).toString('hex');
      for (const [id, value] of challenges) if (value.expires <= Date.now()) challenges.delete(id);
      challenges.set(session, { nonce, expires: Date.now() + 300000 });
      res.setHeader('Set-Cookie', `plugin_challenge=${session}; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=300`);
      return json(200, { nonce });
    }
    if (req.method === 'POST' && url.pathname === '/auth/verify') {
      if (req.headers.origin !== origin) return json(403, { error: 'ORIGIN_MISMATCH' });
      const session = /(?:^|;\s*)plugin_challenge=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
      const challenge = challenges.get(session);
      if (!challenge || challenge.expires <= Date.now()) return json(401, { error: 'NONCE_EXPIRED' });
      const address = verifyLogin(JSON.parse(raw), origin, challenge.nonce, Date.now(), Number(process.env.GPC_PLUGIN_CHAIN_ID || 56));
      challenges.delete(session); // Atomic in this one-process demo; use DB CAS in production.
      return json(200, { authenticated: true, address });
    }
    if (req.method === 'POST' && url.pathname === '/my-backend/verify-plugin') {
      if (!appId) return json(503, { error: 'APP_ID_REQUIRED' });
      const { token } = JSON.parse(raw);
      if (typeof token !== 'string' || !/^gps_[a-f0-9]{48}$/.test(token)) return json(400, { error: 'SCOPED_TOKEN_REQUIRED' });
      const response = await fetch(`${apiBase}/plugins/open/context`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (!response.ok || !body.success || body.data.appId !== appId) return json(403, { error: 'WRONG_PLUGIN_AUTHORIZATION' });
      return json(200, body.data);
    }
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const event = verifyWebhook(raw, req.headers, process.env.GPC_PLUGIN_WEBHOOK_SECRET, appId);
      if (!inbox.has(event.id)) { inbox.add(event.id); console.log('Verified event:', event.id, event.kind); }
      return json(200, { accepted: true });
    }
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(await readFile(new URL('./index.html', import.meta.url))); }
    if (req.method === 'GET' && url.pathname === '/gpc-plugin.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(await readFile(new URL('./gpc-plugin.js', import.meta.url)).catch(() => readFile(new URL('../../sdk/plugin/gpc-plugin.js', import.meta.url)))); }
    json(404, { error: 'NOT_FOUND' });
  } catch (e) { json(400, { error: e.message || 'INVALID_REQUEST' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Plugin example listening on 127.0.0.1:${port}; configure HTTPS origin ${origin}`));
