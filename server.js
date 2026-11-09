// Emberfall Online server — serves the game files and relays multiplayer state.
// Zero dependencies: needs only Node.js 16+.  Run:  node server.js   (PORT env var optional, default 8080)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MAX_PLAYERS = +(process.env.MAX_PLAYERS || 50);
// Game Master password. Players type  /gm login <password>  in chat. Leave unset to disable GM logins.
const GM_PASSWORD = process.env.GM_PASSWORD || '';
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
// Players the owner made GM with /makegm are remembered here (by their player id).
const GMS_FILE = path.join(__dirname, 'gms.json');
let grants = []; try { grants = JSON.parse(fs.readFileSync(GMS_FILE, 'utf8')); if (!Array.isArray(grants)) grants = []; } catch (e) {}
const saveGrants = () => { try { fs.writeFileSync(GMS_FILE, JSON.stringify(grants)); } catch (e) {} };
// Banned players (by player id and IP address), managed in game with /ban and /unban by the owner.
const BANS_FILE = path.join(__dirname, 'bans.json');
let bans = []; try { bans = JSON.parse(fs.readFileSync(BANS_FILE, 'utf8')); if (!Array.isArray(bans)) bans = []; } catch (e) {}
const saveBans = () => { try { fs.writeFileSync(BANS_FILE, JSON.stringify(bans, null, 1)); } catch (e) {} };
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const isBanned = (pid, ip) => bans.some(b => (pid && b.pid === pid) || (ip && b.ip && b.ip === ip));
const BUG_FILE = path.join(__dirname, 'bugs.log');
// Who is the realm owner (master GM)?
//  1. anyone playing on the same computer as the server (http://localhost:8080),
//  2. any IP listed in OWNER_IP (comma separated), e.g. OWNER_IP=41.13.22.7
//  3. any device that once logged in with /gm login <GM_PASSWORD> (it remembers a token).
const OWNER_IPS = String(process.env.OWNER_IP || '').split(',').map(s => s.trim()).filter(Boolean);
const OWNER_TOKEN = GM_PASSWORD ? crypto.createHmac('sha256', GM_PASSWORD).update('emberfall-owner').digest('hex').slice(0, 32) : '';
const isLoopback = a => /^(::1|127\.|::ffff:127\.)/.test(a || '');
function ownerByIp(req) {
  const sockIp = req.socket.remoteAddress || '';
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!xff.length && isLoopback(sockIp)) return true;               // same machine, no proxy in between
  const real = xff.length ? xff[xff.length - 1] : sockIp.replace('::ffff:', ''); // rightmost = added by your host's proxy
  return OWNER_IPS.includes(real) || OWNER_IPS.includes(sockIp.replace('::ffff:', ''));
}
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.md':'text/plain; charset=utf-8' };
const GAME_FILES = new Set(['index.html','game.js','style.css','config.js','icon.png']);
// ---------- armory: character snapshots sent by players' games ----------
const ARMORY_FILE = path.join(__dirname, 'armory.json');
let armory = {}; try { armory = JSON.parse(fs.readFileSync(ARMORY_FILE, 'utf8')) || {}; } catch (e) {}
let armDirty = false; setInterval(() => { if (armDirty) { armDirty = false; fs.writeFile(ARMORY_FILE, JSON.stringify(armory), () => {}); } }, 10000);
const GIFTS_FILE = path.join(__dirname, 'gifts.json');      // donation rewards waiting for offline players
let pendingGifts = {}; try { pendingGifts = JSON.parse(fs.readFileSync(GIFTS_FILE, 'utf8')) || {}; } catch (e) {}
const saveGifts = () => fs.writeFile(GIFTS_FILE, JSON.stringify(pendingGifts), () => {});
function cleanStr(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').slice(0, n); }
function storeArmory(c, a) {
  if (!a || typeof a !== 'object' || typeof a.name !== 'string') return;
  const name = cleanStr(a.name, 14).trim(); if (name.length < 2) return;
  const key = cleanStr(a.pid, 16) + ':' + name.toLowerCase();
  const eq = {}; for (const s of ['weapon', 'armor', 'trinket']) { const it = a.eq && a.eq[s]; if (it && typeof it === 'object') eq[s] = { name: cleanStr(it.name, 48), rar: Math.max(0, Math.min(4, it.rar | 0)), slot: s, pow: it.pow | 0, sta: it.sta | 0, up: Math.min(9, it.up | 0), lv: it.lv | 0, leg: it.leg ? cleanStr(it.leg, 12) : null, desc: it.desc ? cleanStr(it.desc, 140) : null }; }
  const S = a.stats && typeof a.stats === 'object' ? a.stats : {}; const bosses = {}; for (const k in (S.bosses || {})) bosses[cleanStr(k, 16)] = S.bosses[k] | 0;
  const ach = {}; for (const k in (a.ach || {})) ach[cleanStr(k, 20)] = +a.ach[k] || 0;
  armory[key] = { name, cls: cleanStr(a.cls, 10), lvl: Math.max(1, Math.min(15, a.lvl | 0)), xp: a.xp | 0, xpNeed: a.xpNeed | 0, gold: a.gold | 0, zone: cleanStr(a.zone, 10),
    eq, hp: a.hp | 0, res: a.res | 0, pow: a.pow | 0, sta: a.sta | 0,
    quests: (Array.isArray(a.quests) ? a.quests : []).slice(0, 80).map(q => cleanStr(q, 20)), disc: (Array.isArray(a.disc) ? a.disc : []).slice(0, 40).map(q => cleanStr(q, 20)),
    mounts: (Array.isArray(a.mounts) ? a.mounts : []).slice(0, 10).map(n => n | 0), mount: a.mount | 0,
    stats: { kills: S.kills | 0, deaths: S.deaths | 0, gathered: S.gathered | 0, goldEarned: S.goldEarned | 0, legendary: S.legendary | 0, bosses }, ach,
    cos: { title: cleanStr(a.cos && a.cos.title, 20), wings: !!(a.cos && a.cos.wings), aura: !!(a.cos && a.cos.aura) },
    created: +a.created || 0, seen: Date.now(), online: true };
  c.armKey = key; armDirty = true;
}
function armoryList() { const now = Date.now(); const online = new Set([...clients.values()].map(c => c.armKey)); return Object.entries(armory).map(([k, v]) => ({ ...v, online: online.has(k) })); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function sendFile(res, file, extra) {
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, extra || {})); res.end(data); });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x'); let name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  // ---- API ----
  if (name === 'health' || name === 'api/status') return json(res, 200, { ok: true, online: [...clients.values()].filter(c => c.p && c.p.u && !c.p.iv).length, players: [...clients.values()].filter(c => c.p && c.p.u && !c.p.iv).map(c => ({ name: c.p.n, level: c.p.l, class: c.p.c, zone: c.p.z })), uptime: Math.round(process.uptime()) });
  if (name === 'api/armory') { const q = String(url.searchParams.get('name') || '').toLowerCase().trim(); if (!q) return json(res, 200, []);
    const all = armoryList(); const exact = all.filter(a => a.name.toLowerCase() === q); const part = all.filter(a => a.name.toLowerCase() !== q && a.name.toLowerCase().includes(q));
    return json(res, 200, [...exact, ...part].sort((a, b) => b.lvl - a.lvl || b.seen - a.seen).slice(0, 12)); }
  if (name === 'api/top') { const all = armoryList().sort((a, b) => b.lvl - a.lvl || b.xp - a.xp || Object.keys(b.ach).length - Object.keys(a.ach).length).slice(0, 25);
    return json(res, 200, all.map(a => ({ name: a.name, cls: a.cls, lvl: a.lvl, ach: Object.keys(a.ach).length, kills: a.stats.kills, title: a.cos.title, online: a.online, seen: a.seen }))); }
  // ---- downloads ----
  if (name === 'download' || name === 'download/') { res.writeHead(302, { Location: '/#download' }); return res.end(); }
  if (name.startsWith('downloads/') && /\.zip$/i.test(name)) { const f = path.join(ROOT, path.normalize(name));
    if (!f.startsWith(path.join(ROOT, 'downloads'))) { res.writeHead(404); return res.end('Not found'); }
    return fs.stat(f, (err, st) => { if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': st.size, 'Content-Disposition': `attachment; filename="${path.basename(f)}"` }); fs.createReadStream(f).pipe(res); }); }
  // ---- the game at /play/ ----
  if (name === 'play') { res.writeHead(302, { Location: '/play/' }); return res.end(); }
  if (name.startsWith('play/')) { let g = name.slice(5) || 'index.html'; if (!GAME_FILES.has(g)) { res.writeHead(404); return res.end('Not found'); } return sendFile(res, path.join(ROOT, g)); }
  if (GAME_FILES.has(name) && name !== 'index.html') return sendFile(res, path.join(ROOT, name));   // older game links
  if (name === 'Play Emberfall.html') return sendFile(res, path.join(ROOT, name), { 'Content-Disposition': 'attachment; filename="Play Emberfall.html"' });
  // ---- the website ----
  if (name === '' || name === 'index.html' || name === 'website.html') return sendFile(res, path.join(ROOT, fs.existsSync(path.join(ROOT, 'website.html')) ? 'website.html' : path.join('site', 'index.html')));
  if (name.startsWith('site/')) { const f = path.join(ROOT, path.normalize(name)); if (!f.startsWith(path.join(ROOT, 'site'))) { res.writeHead(404); return res.end('Not found'); } return sendFile(res, f, { 'Cache-Control': 'public, max-age=300' }); }
  res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<meta http-equiv="refresh" content="0;url=/">Not found');
});

// ---------- minimal WebSocket (RFC 6455) ----------
const clients = new Map(); let seq = 0;
function frame(str) {
  const p = Buffer.from(str); const n = p.length; let h;
  if (n < 126) { h = Buffer.alloc(2); h[1] = n; }
  else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  h[0] = 0x81; return Buffer.concat([h, p]);
}
function send(c, obj) { if (!c.dead) try { c.sock.write(frame(JSON.stringify(obj))); } catch (e) { drop(c); } }
function broadcast(from, obj) { const f = frame(JSON.stringify(obj)); for (const c of clients.values()) if (c !== from && !c.dead) try { c.sock.write(f); } catch (e) { drop(c); } }
function drop(c) { if (c.dead) return; c.dead = true; clients.delete(c.id); try { c.sock.destroy(); } catch (e) {} broadcast(null, { t: 'leave', peer: c.id }); log(`- ${c.id} left (${clients.size} online)`); }
const pmsg = c => ({ t: 'p', peer: c.id, p: c.p, gm: c.gm ? 1 : 0 });
function log(m) { console.log(new Date().toISOString().slice(11, 19), m); }

server.on('upgrade', (req, sock) => {
  if (!(req.url || '').startsWith('/ws') || req.headers.upgrade?.toLowerCase() !== 'websocket') return sock.destroy();
  if (clients.size >= MAX_PLAYERS) return sock.destroy();
  const ip = ipOf(req); if (isBanned('', ip)) return sock.destroy();
  const key = req.headers['sec-websocket-key']; if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { id: 'p' + String(++seq).padStart(9, '0'), sock, buf: Buffer.alloc(0), p: {}, alive: true, dead: false, gm: false, master: false, gmTries: 0, ip, rate: 0, rateT: Date.now(), ownerIp: ownerByIp(req) };
  clients.set(c.id, c);
  send(c, { t: 'hello', you: c.id, peers: [...clients.values()].filter(o => o !== c && o.p.v).map(o => ({ peer: o.id, p: o.p, gm: o.gm ? 1 : 0 })) });
  if (c.ownerIp) { c.gm = true; c.master = true; send(c, { t: 'gm', ok: true, master: 1, token: OWNER_TOKEN || undefined }); log(`* ${c.id} recognised as the realm owner (owner IP)`); }
  log(`+ ${c.id} joined (${clients.size} online)`);
  sock.on('data', d => onData(c, d)); sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
});

function onData(c, chunk) {
  c.buf = Buffer.concat([c.buf, chunk]);
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
    if (len > 65536) return drop(c);
    const need = off + (masked ? 4 : 0) + len; if (c.buf.length < need) return;
    let payload = c.buf.subarray(off + (masked ? 4 : 0), need);
    if (masked) { const m = c.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
    c.buf = c.buf.subarray(need);
    if (op === 8) return drop(c);
    if (op === 9) { try { c.sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) {} continue; }
    if (op === 10) { c.alive = true; continue; }
    if (op === 1) onMessage(c, payload.toString('utf8'));
  }
}
function onMessage(c, text) {
  if (text.length > 16000) return;            // messages must stay small
  const nowMs = Date.now(); if (nowMs - c.rateT > 1000) { c.rateT = nowMs; c.rate = 0; }
  if (++c.rate > 40) { if (c.rate > 200) drop(c); return; }   // flood protection
  let d; try { d = JSON.parse(text); } catch (e) { return; }
  if (d && d.t === 'p' && d.p && typeof d.p === 'object' && !Array.isArray(d.p)) {
    const pid = typeof d.p.pid === 'string' ? d.p.pid : '';
    if (pid && isBanned(pid, '')) { send(c, { t: 'sys', msg: 'You are banned from this realm.' }); return setTimeout(() => drop(c), 200); }
    const gid = pid + ':' + String(d.p.n || '').toLowerCase();   // GM rights belong to one character, not the whole device
    if (pid && !c.master) { const should = grants.includes(gid); if (should && !c.gm) { c.gm = true; send(c, { t: 'gm', ok: true, granted: 1 }); log(`* ${d.p.n} is a Game Master (appointed)`); } else if (!should && c.gm) { c.gm = false; send(c, { t: 'gm', ok: false, revoked: 1 }); } }
    c.p = d.p; broadcast(c, pmsg(c));
    const who = String(d.p.n || '').toLowerCase(); if (who && pendingGifts[who] && pendingGifts[who].length && d.p.u) { for (const what of pendingGifts[who]) send(c, { t: 'gift', what, from: 'the Realm' }); delete pendingGifts[who]; saveGifts(); }
  } else if (d && d.t === 'gm') {
    // GM login: only the server knows the password, and it tells everyone else who is a real GM.
    if (c.gmTries >= 5 || !GM_PASSWORD) return send(c, { t: 'gm', ok: false });
    const ok = crypto.timingSafeEqual(sha(d.pw || ''), sha(GM_PASSWORD));
    if (!ok) { c.gmTries++; log(`! ${c.id} failed GM login`); return send(c, { t: 'gm', ok: false }); }
    c.gm = true; c.master = true; log(`* ${c.id} is now the realm owner (master GM)`); send(c, { t: 'gm', ok: true, master: 1, token: OWNER_TOKEN }); if (c.p.v) broadcast(c, pmsg(c));
  } else if (d && d.t === 'arm' && d.c) {
    storeArmory(c, d.c);
  } else if (d && d.t === 'gift' && c.gm && typeof d.name === 'string' && typeof d.what === 'string') {
    const who = d.name.toLowerCase().slice(0, 20), what = d.what.slice(0, 40); let done = false;
    for (const o of clients.values()) if (o.p && String(o.p.n || '').toLowerCase() === who) { send(o, { t: 'gift', what, from: 'the Realm' }); done = true; }
    if (!done) { (pendingGifts[who] = pendingGifts[who] || []).push(what); saveGifts(); }
    log(`$ gift "${what}" for ${d.name}${done ? '' : ' (waiting until they log in)'}`);
  } else if (d && d.t === 'gmtok' && typeof d.token === 'string') {
    if (OWNER_TOKEN && d.token.length === OWNER_TOKEN.length && crypto.timingSafeEqual(Buffer.from(d.token), Buffer.from(OWNER_TOKEN))) { c.gm = true; c.master = true; log(`* ${c.id} recognised as the realm owner (remembered device)`); send(c, { t: 'gm', ok: true, master: 1 }); if (c.p.v) broadcast(c, pmsg(c)); }
    else send(c, { t: 'gm', ok: false, forget: 1 });
  } else if (d && d.t === 'bug' && typeof d.text === 'string') {
    fs.appendFile(BUG_FILE, `---- ${new Date().toISOString()} ${c.id} ${(c.p && c.p.n) || '?'}\n${d.text.slice(0, 2000)}\n`, () => {}); log(`# bug report from ${(c.p && c.p.n) || c.id}`);
  } else if (d && d.t === 'admin' && c.master) {
    const pid = String(d.pid || '').slice(0, 16), name = String(d.name || '').slice(0, 20);
    if (d.cmd === 'unban') { bans = bans.filter(b => b.pid !== pid && String(b.n).toLowerCase() !== name.toLowerCase()); saveBans(); return; }
    for (const o of clients.values()) if (o !== c && o.p && o.p.pid === pid) {
      if (d.cmd === 'ban') { bans.push({ pid, ip: o.ip, n: o.p.n, at: new Date().toISOString() }); saveBans(); }
      send(o, { t: 'sys', msg: d.cmd === 'ban' ? 'You have been banned from this realm.' : 'You were removed from the realm by the owner.' }); setTimeout(() => drop(o), 200);
      log(`! ${o.p.n} was ${d.cmd === 'ban' ? 'banned' : 'removed'} by the owner`); }
  } else if (d && d.t === 'mkgm' && typeof d.pid === 'string') {
    // only the owner (logged in with GM_PASSWORD) can appoint or remove GMs
    if (!c.master) return send(c, { t: 'sys', msg: 'Only the realm owner can make Game Masters.' });
    const pid = d.pid.slice(0, 48);
    if (d.on) { if (!grants.includes(pid)) grants.push(pid); } else grants = grants.filter(g => g !== pid);
    saveGrants();
    for (const o of clients.values()) if (o.p && (o.p.pid + ':' + String(o.p.n || '').toLowerCase()) === pid && !o.master) { o.gm = !!d.on; send(o, d.on ? { t: 'gm', ok: true, granted: 1 } : { t: 'gm', ok: false, revoked: 1 }); broadcast(o, pmsg(o)); }
  }
}
// heartbeat: drop silent connections
setInterval(() => { for (const c of clients.values()) { if (!c.alive) { drop(c); continue; } c.alive = false; try { c.sock.write(Buffer.from([0x89, 0])); } catch (e) { drop(c); } } }, 30000);

function lanAddresses() { const out = []; for (const list of Object.values(require('os').networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address); return out; }
server.listen(PORT, () => {
  for (const ip of lanAddresses()) log(`Friends on your Wi-Fi can join at  http://${ip}:${PORT}   (realm address: ${ip}:${PORT})`); log(`Emberfall running at http://localhost:${PORT}  (share your address so friends can join)`); log(GM_PASSWORD ? 'GM logins enabled: type /gm login <password> in game chat' : 'GM logins disabled (start with GM_PASSWORD=yourpassword to enable)'); });
