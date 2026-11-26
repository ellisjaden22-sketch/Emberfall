// Emberfall Online server — serves the game files and relays multiplayer state.
// Zero dependencies: needs only Node.js 16+.  Run:  node server.js   (PORT env var optional, default 8080)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const SERVER_VERSION='v1.04';
// The newest desktop app (launcher) build. Raise it when a new app is released and the app tells players to download it.
const LAUNCHER_VERSION = 2;
const STARTED = Date.now();
// never let one bad message or a library hiccup take the whole realm down on test night
process.on('uncaughtException', e => { try { console.error(new Date().toISOString().slice(11, 19), '! uncaught', e && e.stack || e); } catch (_) {} });
process.on('unhandledRejection', e => { try { console.error(new Date().toISOString().slice(11, 19), '! unhandled', e && e.stack || e); } catch (_) {} });
const MAX_PLAYERS = +(process.env.MAX_PLAYERS || 50);
// Game Master password. Players type  /gm login <password>  in chat. Leave unset to disable GM logins.
const GM_PASSWORD = process.env.GM_PASSWORD || '';
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
// Players the owner made GM with /makegm are remembered here (by their player id).
const GMS_FILE = path.join(__dirname, 'gms.json');
let grants = []; try { grants = JSON.parse(fs.readFileSync(GMS_FILE, 'utf8')); if (!Array.isArray(grants)) grants = []; } catch (e) {}
const saveGrants = () => { try { fs.writeFileSync(GMS_FILE, JSON.stringify(grants)); } catch (e) {} };
// The Cinderhold raid stays sealed until the realm owner unveils it in game with /raid unveil (or start with RAID_OPEN=1).
const RAID_FILE = path.join(__dirname, 'raid.json');
let raidOpen = process.env.RAID_OPEN === '1'; try { raidOpen = raidOpen || !!JSON.parse(fs.readFileSync(RAID_FILE, 'utf8')).open; } catch (e) {}
// Banned players (by player id and IP address), managed in game with /ban and /unban by the owner.
const BANS_FILE = path.join(__dirname, 'bans.json');
let bans = []; try { bans = JSON.parse(fs.readFileSync(BANS_FILE, 'utf8')); if (!Array.isArray(bans)) bans = []; } catch (e) {}
const saveBans = () => { try { fs.writeFileSync(BANS_FILE, JSON.stringify(bans, null, 1)); } catch (e) {} };
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const isBanned = (pid, ip) => bans.some(b => (pid && b.pid === pid) || (ip && b.ip && b.ip === ip));
const BUG_FILE = path.join(__dirname, 'bugs.log');
// ---------- support tickets: players report bugs and problems in game, GMs work through them with the Tickets window ----------
// Tickets are kept in tickets.json. Hosts like Render's free plan wipe files when the server restarts, so you can also keep
// every ticket as a GitHub issue in a PRIVATE repository: set TICKETS_REPO=yourname/emberfall-tickets and GITHUB_TOKEN=<a token
// that may read and write issues in that repository>. The server then reloads open tickets from there when it starts.
const TICKETS_FILE = path.join(__dirname, 'tickets.json');
const TK_REPO = process.env.TICKETS_REPO || '', GH_TOKEN = process.env.GITHUB_TOKEN || '';
let tickets = []; try { tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')); if (!Array.isArray(tickets)) tickets = []; } catch (e) {}
const saveTickets = () => fs.writeFile(TICKETS_FILE, JSON.stringify(tickets), () => {});
const MSGS_FILE = path.join(__dirname, 'messages.json');   // GM replies waiting for players who were offline
let pendingMsgs = {}; try { pendingMsgs = JSON.parse(fs.readFileSync(MSGS_FILE, 'utf8')) || {}; } catch (e) {}
const saveMsgs = () => fs.writeFile(MSGS_FILE, JSON.stringify(pendingMsgs), () => {});
function gh(method, p, body) { return new Promise(res => { if (!TK_REPO || !GH_TOKEN) return res(null);
  const data = body ? JSON.stringify(body) : null;
  const rq = require('https').request({ host: 'api.github.com', path: '/repos/' + TK_REPO + p, method, headers: { 'User-Agent': 'emberfall-server', Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, r => {
    let b = ''; r.on('data', x => b += x); r.on('end', () => { try { res(r.statusCode < 300 ? JSON.parse(b || 'null') : null); } catch (e) { res(null); } }); });
  rq.on('error', () => res(null)); rq.setTimeout(15000, () => { rq.destroy(); res(null); }); if (data) rq.write(data); rq.end(); }); }
const tkBody = t => `${t.text}\n\n---\n**${t.name}** (level ${t.lvl} ${t.cls}) in ${t.zone} at ${t.pos}, game v${t.ver}\n\n${t.info}\n\n<!--emberfall ${Buffer.from(JSON.stringify({ ...t, gh: undefined })).toString('base64')} -->`;
async function ghCreate(t) { const r = await gh('POST', '/issues', { title: `#${t.id} ${t.cat}: ${t.text.replace(/\s+/g, ' ').slice(0, 70)} (${t.name})`, body: tkBody(t), labels: ['ticket', t.cat] }); if (r && r.number) { t.gh = r.number; saveTickets(); } }
async function ghSync(t, comment) { if (!t.gh) return; if (comment) await gh('POST', `/issues/${t.gh}/comments`, { body: comment }); await gh('PATCH', `/issues/${t.gh}`, { state: t.st === 'open' ? 'open' : 'closed', body: tkBody(t) }); }
async function ghLoad() { if (!TK_REPO || !GH_TOKEN) return; const have = new Set(tickets.map(t => t.id)); let added = 0;
  for (let page = 1; page <= 5; page++) { const list = await gh('GET', `/issues?state=open&per_page=100&page=${page}`); if (!Array.isArray(list) || !list.length) break;
    for (const is of list) { const m = /<!--emberfall ([A-Za-z0-9+/=]+) -->/.exec(is.body || ''); if (!m) continue; try { const t = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')); if (!t.id || have.has(t.id)) continue; t.gh = is.number; t.st = 'open'; tickets.push(t); have.add(t.id); added++; } catch (e) {} } }
  if (added) { tickets.sort((a, b) => a.id - b.id); saveTickets(); log(`# restored ${added} open ticket(s) from GitHub`); } }
setTimeout(ghLoad, 1000);
// ---------- auction house: players list items for gold; buyers pay, sellers are paid (by gift) even when offline ----------
const AH_FILE = path.join(__dirname, 'auctions.json');
let auctions = []; try { auctions = JSON.parse(fs.readFileSync(AH_FILE, 'utf8')); if (!Array.isArray(auctions)) auctions = []; } catch (e) {}
const saveAH = () => fs.writeFile(AH_FILE, JSON.stringify(auctions), () => {});
let ahNext = auctions.reduce((m, a) => Math.max(m, a.id | 0), 0) + 1;
function deliver(name, what) { const who = String(name || '').toLowerCase(); let done = false;
  for (const o of clients.values()) if (o.p && String(o.p.n || '').toLowerCase() === who) { send(o, { t: 'gift', what, from: 'the Auction House' }); done = true; }
  if (!done) { (pendingGifts[who] = pendingGifts[who] || []).push(what); saveGifts(); } }
/* The Hearthmere Trading Company keeps basic materials on the Auction House so there is always something to buy.
   Its lots are pricier than a fair player price, so players who gather can undercut it. */
const NPC_SELLER = 'Trading Company';
const NPC_STOCK = [['sunpetal','Sunpetal',1],['thornbloom','Thornbloom',1],['mireroot','Mireroot',2],['ghostcap','Ghostcap',2],['emberlily','Emberlily',3],['frostbloom','Frostbloom',5],
  ['copper','Copper Ore',1],['iron','Iron Ore',2],['obsidian','Obsidian',3],['mithril','Mithril Ore',5],
  ['lightleather','Light Leather',1],['thickhide','Thick Hide',2],['scaledhide','Scaled Hide',3],['frostpelt','Frost Pelt',5],
  ['linencloth','Linen Cloth',1],['woolcloth','Wool Cloth',2],['silkcloth','Silk Cloth',3],['runecloth','Runecloth',5],
  ['amberperch','Amber Perch',1],['mireeel','Mire Eel',2],['gamemeat','Game Meat',1],['crabmeat','Crab Meat',2],['amberstone','Amberstone',6],['moonstone','Moonstone',10]];
function ahSeed() { const now = Date.now(); let ch = false;
  for (const [k, name, base] of NPC_STOCK) { const have = auctions.filter(a => a.seller === NPC_SELLER && a.mat === k).length; if (have >= 2) continue;
    const n = [5, 10, 20][Math.floor(Math.random() * 3)], price = Math.max(n, Math.round(base * n * (1.25 + Math.random() * .35)));
    const item = JSON.stringify({ mat: k, n, name: name + ' ×' + n, rar: 0, slot: 'mat' });
    auctions.push({ id: ahNext++, seller: NPC_SELLER, item, name: name + ' ×' + n, rar: 0, lv: 0, slot: 'mat', mat: k, price, at: now, exp: now + (12 + Math.random() * 24) * 3600e3, npc: 1 }); ch = true; }
  if (ch) saveAH(); }
setTimeout(() => { const before = auctions.length; for (const a of auctions) if (a.npc && !a.repriced53) a.gone = true; auctions = auctions.filter(a => !a.gone); if (auctions.length !== before) saveAH(); ahSeed(); }, 3000); setInterval(ahSeed, 10 * 60000);
function ahExpire() { const now = Date.now(); let ch = false; for (const a of auctions) if (a.exp < now) { if (!a.npc) deliver(a.seller, 'item:' + a.item); a.gone = true; ch = true; }
  if (ch) { auctions = auctions.filter(a => !a.gone); saveAH(); } }
setInterval(ahExpire, 60000);
const nextTicketId = () => tickets.reduce((m, t) => Math.max(m, t.id | 0), 0) + 1;
const openTickets = () => tickets.filter(t => t.st === 'open').length;
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
const MIME = { '.mp3':'audio/mpeg', '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.bin':'application/octet-stream', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.md':'text/plain; charset=utf-8', '.webmanifest':'application/manifest+json' };
const GAME_FILES = new Set(['index.html','game.js','style.css','config.js','world.js','editor.html','icon.png','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','apple-touch-icon.png']);
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
  armory[key] = { name, cls: cleanStr(a.cls, 10), lvl: Math.max(1, Math.min(20, a.lvl | 0)), xp: a.xp | 0, xpNeed: a.xpNeed | 0, gold: a.gold | 0, zone: cleanStr(a.zone, 10),
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
/* music streams with byte ranges (Safari and iOS will not play audio without them) and may come from another origin (the desktop app) */
/* find the tavern music wherever it was uploaded: music/, Music/, play/music/, downloads/, next to server.js (a flattened
   upload) or any folder up to three levels deep, and under its short name or its original long name */
let MUSIC_CACHE = null, MUSIC_T = 0;
function allMusic() { if (MUSIC_CACHE && Date.now() - MUSIC_T < 60000) return MUSIC_CACHE; const out = [];
  const walk = (dir, depth) => { let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) { if (e.name.startsWith('.') || e.name === 'node_modules') continue; const f = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(f, depth + 1); else if (e.isFile() && /\.mp3$/i.test(e.name)) out.push(f); } };
  walk(ROOT, 0); MUSIC_CACHE = out; MUSIC_T = Date.now(); return out; }
function findMusic(file) { const base = path.basename(file).toLowerCase(), list = allMusic();
  let hit = list.find(f => path.basename(f).toLowerCase() === base); if (hit) return hit;
  for (const w of path.basename(base, '.mp3').split('-').filter(w => w && w !== 'tavern')) { hit = list.find(f => path.basename(f).toLowerCase().includes(w)); if (hit) return hit; }
  return null; }
function sendMusic(req, res, file) { file = findMusic(file); if (!file) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(file, (err, st) => { if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const H = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=604800', 'Access-Control-Allow-Origin': '*' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) { let a = m[1] === '' ? Math.max(0, st.size - (+m[2] || 0)) : +m[1], b = m[1] !== '' && m[2] !== '' ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, Object.assign(H, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size, 'Content-Length': b - a + 1 })); return fs.createReadStream(file, { start: a, end: b }).pipe(res); }
    res.writeHead(200, Object.assign(H, { 'Content-Length': st.size })); fs.createReadStream(file).pipe(res); });
}
function sendFile(res, file, extra) {
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, extra || {})); res.end(data); });
}


// ---------- world editor: publish world.js from /play/editor.html ----------
// Only the owner can publish (the GM_PASSWORD). The new world.js is live for every page load straight away.
// To keep it after Render restarts or redeploys, the server can also save it to GitHub: give GITHUB_TOKEN (or a separate
// WORLD_GITHUB_TOKEN) "Contents: Read and write" on your game repository. GITHUB_REPO and GITHUB_BRANCH pick the repo (default main).
const WORLD_FILE = path.join(ROOT, 'world.js');
const WORLD_REPO = process.env.GITHUB_REPO || 'ellisjaden22-sketch/Emberfall', WORLD_BRANCH = process.env.GITHUB_BRANCH || 'main', WORLD_PATH = process.env.WORLD_PATH || 'world.js';
const WORLD_TOKEN = process.env.WORLD_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
const pubTries = new Map();
function readBody(req, max, cb) { let b = [], n = 0, done = false; req.on('data', x => { if (done) return; n += x.length; if (n > max) { done = true; cb(null); req.destroy(); } else b.push(x); }); req.on('end', () => { if (!done) { done = true; cb(Buffer.concat(b).toString('utf8')); } }); req.on('error', () => { if (!done) { done = true; cb(null); } }); }
// moves and removals of the world's own objects: { kind: { id: 0 | [x, y, r?, s?] } }
function cleanBase(b) { const out = {}; if (!b || typeof b !== 'object') return out;
  for (const k of ['npc', 'mob', 'poi', 'lamp', 'stall', 'crate', 'fire', 'south']) { const o = b[k]; if (!o || typeof o !== 'object') continue; const m = {}; let n = 0;
    for (const id of Object.keys(o)) { if (n++ > 4000 || !/^[\w-]{1,40}$/.test(id)) continue; const v = o[id];
      if (v === 0) m[id] = 0; else if (Array.isArray(v) && v.length >= 2) m[id] = v.slice(0, 4).map(x => Math.round((+x || 0) * 100) / 100); }
    if (Object.keys(m).length) out[k] = m; }
  return out; }
function cleanWorld(d) {
  const int = v => Math.round(+v || 0), num = (v, a, b) => Math.max(a, Math.min(b, +(+v || 0).toFixed(2))), str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u2028\u2029]/g, ' ').slice(0, n);
  const A = v => Array.isArray(v) ? v : [];
  return { v: 1,
    tiles: A(d.tiles).slice(0, 200000).filter(e => Array.isArray(e) && /^[A-Z]{2,8}$/.test(e[2])).map(e => [int(e[0]), int(e[1]), e[2]]),
    zones: A(d.zones).slice(0, 200000).filter(e => Array.isArray(e) && /^[a-z]{2,12}$/.test(e[2])).map(e => [int(e[0]), int(e[1]), e[2]]),
    props: A(d.props).slice(0, 6000).filter(p => p && /^[a-z]{2,16}$/.test(p.k)).map(p => ({ k: p.k, x: num(p.x, 0, 4096), y: num(p.y, 0, 4096), r: num(p.r, -100, 100), s: num(p.s || 1, .3, 4) })),
    npcs: A(d.npcs).slice(0, 300).filter(n => n && typeof n === 'object').map(n => ({ name: str(n.name, 28), title: str(n.title, 28), x: int(n.x), y: int(n.y), col: /^#[0-9a-f]{6}$/i.test(n.col || '') ? n.col : '#8a7a5a', say: str(n.say, 240) })),
    spawns: A(d.spawns).slice(0, 1000).filter(x => x && /^[a-z0-9_]{1,24}$/i.test(x.mob)).map(x => ({ mob: x.mob, x: int(x.x), y: int(x.y), n: Math.max(1, Math.min(12, int(x.n) || 1)) })),
    pois: A(d.pois).slice(0, 300).filter(p => p && p.name).map(p => ({ name: str(p.name, 30), x: int(p.x), y: int(p.y), r: Math.max(2, Math.min(20, int(p.r) || 5)) })),
    base: cleanBase(d.base) };
}
function ghFile(method, body) { return new Promise(res => {
  const data = body ? JSON.stringify(body) : null, p = '/repos/' + WORLD_REPO + '/contents/' + WORLD_PATH.split('/').map(encodeURIComponent).join('/') + (method === 'GET' ? '?ref=' + encodeURIComponent(WORLD_BRANCH) : '');
  const rq = require('https').request({ host: 'api.github.com', path: p, method, headers: { 'User-Agent': 'emberfall-server', Authorization: 'Bearer ' + WORLD_TOKEN, Accept: 'application/vnd.github+json', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, r => {
    let b = ''; r.on('data', x => b += x); r.on('end', () => { let j = null; try { j = JSON.parse(b || 'null'); } catch (e) {} res({ code: r.statusCode, j }); }); });
  rq.on('error', e => res({ code: 0, j: { message: e.message } })); rq.setTimeout(20000, () => { rq.destroy(); res({ code: 0, j: { message: 'GitHub did not answer in time' } }); }); if (data) rq.write(data); rq.end(); }); }
async function worldToGitHub(text, who) {
  if (!WORLD_TOKEN) return { ok: false, msg: 'No GitHub token is set on the server (GITHUB_TOKEN or WORLD_GITHUB_TOKEN in Render).' };
  const cur = await ghFile('GET'); if (cur.code !== 200 && cur.code !== 404) return { ok: false, msg: `GitHub said ${cur.code}: ${(cur.j && cur.j.message) || 'no access'}. The token needs "Contents: Read and write" on ${WORLD_REPO}.` };
  const r = await ghFile('PUT', { message: `World edits from the World Editor${who ? ' (' + who + ')' : ''}`, content: Buffer.from(text).toString('base64'), branch: WORLD_BRANCH, ...(cur.code === 200 && cur.j && cur.j.sha ? { sha: cur.j.sha } : {}) });
  if (r.code === 200 || r.code === 201) return { ok: true, msg: `Saved to GitHub (${WORLD_REPO}, ${WORLD_BRANCH}). Render will redeploy in a few minutes.`, commit: r.j && r.j.commit && r.j.commit.html_url };
  return { ok: false, msg: `GitHub said ${r.code}: ${(r.j && r.j.message) || 'the save failed'}. The token needs "Contents: Read and write" on ${WORLD_REPO}.` };
}
function publishWorld(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim(), t = pubTries.get(ip) || { n: 0, at: 0 };
  if (Date.now() - t.at > 15 * 60000) { t.n = 0; t.at = Date.now(); }
  if (t.n >= 6) return json(res, 429, { ok: false, msg: 'Too many wrong passwords. Wait 15 minutes and try again.' });
  if (!GM_PASSWORD) return json(res, 403, { ok: false, msg: 'Publishing is switched off: this realm has no GM_PASSWORD. Add one in Render (Environment) first.' });
  readBody(req, 6 * 1024 * 1024, async body => {
    let d = null; try { d = JSON.parse(body || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object') return json(res, 400, { ok: false, msg: 'The editor sent something the server could not read.' });
    if (!crypto.timingSafeEqual(sha(d.pw || ''), sha(GM_PASSWORD))) { t.n++; pubTries.set(ip, t); return json(res, 403, { ok: false, msg: 'Wrong password. Use the same password as /gm login.' }); }
    const w = cleanWorld(d.world || {}), who = String(d.who || '').replace(/[^\w .'-]/g, '').slice(0, 30);
    const text = `/* Emberfall world edits, published from the World Editor on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.\n   The game reads this file at start-up. Edit it with /editor on your realm. */\nwindow.WORLD_EDITS=${JSON.stringify(w)};\n`;
    try { fs.writeFileSync(WORLD_FILE, text); } catch (e) { return json(res, 500, { ok: false, msg: 'The server could not write world.js: ' + e.message }); }
    log(`# world.js published from the editor${who ? ' by ' + who : ''} (${w.props.length} props, ${w.npcs.length} NPCs, ${w.spawns.length} spawns, ${w.tiles.length} tiles)`);
    const out = { ok: true, live: true, bytes: Buffer.byteLength(text) };
    if (d.github) out.github = await worldToGitHub(text, who);
    json(res, 200, out);
  });
}

// previews from an editor opened from disk: the editor hands its world to the realm, the game tab picks it up by id
const PREVIEWS = new Map(), prevTries = new Map();
function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Max-Age', '600'); }
function previewPut(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim(), t = prevTries.get(ip) || { n: 0, at: Date.now() };
  if (Date.now() - t.at > 10 * 60000) { t.n = 0; t.at = Date.now(); } if (++t.n > 30) { prevTries.set(ip, t); return json(res, 429, { ok: false, msg: 'Too many previews. Wait a few minutes.' }); } prevTries.set(ip, t);
  readBody(req, 6 * 1024 * 1024, body => { let d = null; try { d = JSON.parse(body || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object' || !d.world) return json(res, 400, { ok: false, msg: 'Nothing to preview.' });
    const now = Date.now(); for (const [k, v] of PREVIEWS) if (now - v.t > 2 * 3600000) PREVIEWS.delete(k);
    while (PREVIEWS.size >= 40) PREVIEWS.delete(PREVIEWS.keys().next().value);
    const id = crypto.randomBytes(6).toString('hex'), at = Array.isArray(d.at) ? [d.at[0] | 0, d.at[1] | 0] : null;
    PREVIEWS.set(id, { t: now, data: JSON.stringify({ ...cleanWorld(d.world), at }) }); json(res, 200, { ok: true, id }); });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x'); let name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  // ---- API ----
  if (name.startsWith('api/world/') || name === 'api/version' || name === 'play/world.js') cors(res);
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  if (name === 'api/world/preview' && req.method === 'POST') return previewPut(req, res);
  if (name.startsWith('api/world/preview/')) { const p = PREVIEWS.get(name.slice(18)); if (!p) return json(res, 404, { ok: false }); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(p.data); }
  if (name === 'api/world/publish' && req.method === 'POST') return publishWorld(req, res);
  if (name === 'api/world/info') return json(res, 200, { publish: !!GM_PASSWORD, github: !!WORLD_TOKEN, repo: WORLD_REPO, branch: WORLD_BRANCH, live: fs.existsSync(WORLD_FILE) });
  if (name === 'api/version') { MUSIC_CACHE = null; const music = allMusic().map(f => path.relative(ROOT, f).split(path.sep).join('/')); return json(res, 200, { server: SERVER_VERSION, launcher: LAUNCHER_VERSION, music, musicFound: music.length > 0, online: [...clients.values()].filter(c => c.p && c.p.v).length, connections: clients.size, uptimeMin: Math.round((Date.now() - STARTED) / 60000), memoryMB: Math.round(process.memoryUsage().rss / 1048576), slowClients: [...clients.values()].filter(c => c.slow).length, raidOpen }); }
  if (name === 'health' || name === 'api/status') return json(res, 200, { ok: true, online: [...clients.values()].filter(c => c.p && c.p.u && !c.p.iv).length, players: [...clients.values()].filter(c => c.p && c.p.u && !c.p.iv).map(c => ({ name: c.p.n, level: c.p.l, class: c.p.c, zone: c.p.z })), uptime: Math.round(process.uptime()) });
  if (name === 'api/armory') { const q = String(url.searchParams.get('name') || '').toLowerCase().trim(); if (!q) return json(res, 200, []);
    const all = armoryList(); const exact = all.filter(a => a.name.toLowerCase() === q); const part = all.filter(a => a.name.toLowerCase() !== q && a.name.toLowerCase().includes(q));
    return json(res, 200, [...exact, ...part].sort((a, b) => b.lvl - a.lvl || b.seen - a.seen).slice(0, 12)); }
  if (name === 'api/top') { const all = armoryList().sort((a, b) => b.lvl - a.lvl || b.xp - a.xp || Object.keys(b.ach).length - Object.keys(a.ach).length).slice(0, 25);
    return json(res, 200, all.map(a => ({ name: a.name, cls: a.cls, lvl: a.lvl, ach: Object.keys(a.ach).length, kills: a.stats.kills, title: a.cos.title, online: a.online, seen: a.seen }))); }
  // ---- downloads ----
  if (name === 'download' || name === 'download/') { res.writeHead(302, { Location: '/#download' }); return res.end(); }
  if ((name.startsWith('downloads/') || /^Emberfall-[\w-]+\.zip$/i.test(name)) && /\.zip$/i.test(name)) { const base = path.basename(name);
    // the zip may sit in downloads/ or (if the folder got flattened on upload) next to server.js
    const f = [path.join(ROOT, 'downloads', base), path.join(ROOT, base)].find(x => { try { return fs.statSync(x).isFile(); } catch (e) { return false; } });
    if (!f) { res.writeHead(302, { Location: 'https://github.com/' + (process.env.GITHUB_REPO || 'ellisjaden22-sketch/Emberfall') + '/raw/main/downloads/' + encodeURIComponent(base) }); return res.end(); }
    return fs.stat(f, (err, st) => { if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': st.size, 'Content-Disposition': `attachment; filename="${path.basename(f)}"` }); fs.createReadStream(f).pipe(res); }); }
  // ---- the game at /play/ ----
  if (name === 'play') { res.writeHead(302, { Location: '/play/' }); return res.end(); }
  if (name === 'editor' || name === 'editor/' || name === 'editor.html') return sendFile(res, path.join(ROOT, 'editor.html'));
  if (/^(play\/)?music\/[\w .()-]+\.mp3$/i.test(name)) return sendMusic(req, res, path.join(ROOT, 'music', name.split('/').pop()));
  // 3D models: play/models/NAME.(bin|json|jpg), found in models/ or, if the folder got flattened on upload, next to server.js
  if (/^(play\/)?models\/((nat|props|town|sky)\/)?[a-z0-9_]+\.(bin|json|jpg|png)$/i.test(name)) { const base = path.basename(name), sub = (name.match(/models\/(nat|props|town|sky)\//i) || [, ''])[1];
    const f = [path.join(ROOT, 'models', sub, base), path.join(ROOT, 'play', 'models', sub, base), path.join(ROOT, 'models', base), path.join(ROOT, sub, base), path.join(ROOT, base)].find(x => { try { return fs.statSync(x).isFile(); } catch (e) { return false; } });
    if (!f) { res.writeHead(404); return res.end('Not found'); } return sendFile(res, f, { 'Cache-Control': 'public, max-age=86400' }); }
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
const CHEST_CD = 1800; let chestAt = 0, chestBy = '';   // the arena chest, shared by everyone
const chestLeft = () => Math.max(0, Math.round(CHEST_CD - (Date.now() - chestAt) / 1000));
function broadcast(from, obj, skippable) { const f = frame(JSON.stringify(obj)); for (const c of clients.values()) { if (c === from || c.dead) continue; const q = c.sock.writableLength || 0;
    if (q > 8 << 20) { log(`! ${c.id} could not keep up (${Math.round(q / 1048576)} MB queued) - reconnecting it`); drop(c); continue; }
    if (skippable && q > 256 << 10) { c.slow = (c.slow || 0) + 1; continue; } if (c.slow && q < 64 << 10) c.slow = 0;
    try { c.sock.write(f); } catch (e) { drop(c); } } }
function drop(c) { if (c.dead) return; c.dead = true; clients.delete(c.id); try { c.sock.destroy(); } catch (e) {} broadcast(null, { t: 'leave', peer: c.id }); log(`- ${c.id} left (${clients.size} online)`); }
let worldWs = null;
const pmsg = c => ({ t: 'p', peer: c.id, p: c.p, gm: c.gm ? 1 : 0 });
function log(m) { console.log(new Date().toISOString().slice(11, 19), m); }

server.on('upgrade', (req, sock) => {
  if (!(req.url || '').startsWith('/ws') || req.headers.upgrade?.toLowerCase() !== 'websocket') return sock.destroy();
  if (clients.size >= MAX_PLAYERS) return sock.destroy();
  const ip = ipOf(req); if (isBanned('', ip)) return sock.destroy();
  const key = req.headers['sec-websocket-key']; if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true); try { sock.setKeepAlive(true, 15000); } catch (e) {}
  const c = { id: 'p' + String(++seq).padStart(9, '0'), sock, buf: Buffer.alloc(0), p: {}, alive: true, dead: false, gm: false, master: false, gmTries: 0, ip, rate: 0, rateT: Date.now(), ownerIp: ownerByIp(req) };
  clients.set(c.id, c);
  send(c, { t: 'hello', you: c.id, ws: worldWs, ro: raidOpen ? 1 : 0, ac: chestLeft() > 0 ? { left: chestLeft(), by: chestBy } : undefined, peers: [...clients.values()].filter(o => o !== c && o.p.v).map(o => ({ peer: o.id, p: o.p, gm: o.gm ? 1 : 0 })) });
  if (c.ownerIp) { c.gm = true; c.master = true; send(c, { t: 'gm', ok: true, master: 1, token: OWNER_TOKEN || undefined }); log(`* ${c.id} recognised as the realm owner (owner IP)`); }
  log(`+ ${c.id} joined (${clients.size} online)`);
  sock.on('data', d => { try { onData(c, d); } catch (e) { log(`! bad data from ${c.id}: ${e.message}`); } }); sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
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
  if (++c.rate > 60) { if (c.rate > 300) drop(c); return; }   // flood protection
  let d; try { d = JSON.parse(text); } catch (e) { return; }
  if (d && d.t === 'p' && d.p && typeof d.p === 'object' && !Array.isArray(d.p)) {
    const pid = typeof d.p.pid === 'string' ? d.p.pid : '';
    if (pid && isBanned(pid, '')) { send(c, { t: 'sys', msg: 'You are banned from this realm.' }); return setTimeout(() => drop(c), 200); }
    const gid = pid + ':' + String(d.p.n || '').toLowerCase();   // GM rights belong to one character, not the whole device
    if (pid && !c.master) { const should = grants.includes(gid); if (should && !c.gm) { c.gm = true; send(c, { t: 'gm', ok: true, granted: 1 }); log(`* ${d.p.n} is a Game Master (appointed)`); } else if (!should && c.gm) { c.gm = false; send(c, { t: 'gm', ok: false, revoked: 1 }); } }
    if (c.gm && Array.isArray(d.p.ws) && d.p.ws.length === 3 && (!worldWs || +d.p.ws[2] > +worldWs[2])) worldWs = d.p.ws.slice(0, 3);   // GM weather/time is shared with everyone, also players who join later
    c.p = d.p; broadcast(c, pmsg(c), true);
    const who = String(d.p.n || '').toLowerCase(); if (who && pendingGifts[who] && pendingGifts[who].length && d.p.u) { for (const what of pendingGifts[who]) send(c, { t: 'gift', what, from: 'the Realm' }); delete pendingGifts[who]; saveGifts(); }
    if (who && d.p.u && pendingMsgs[who] && pendingMsgs[who].length) { for (const msg of pendingMsgs[who]) send(c, { t: 'tkreply', msg }); delete pendingMsgs[who]; saveMsgs(); }
    if (c.gm && d.p.u && !c.tkTold) { c.tkTold = true; const n = openTickets(); if (n) send(c, { t: 'tknew', open: n }); }
  } else if (d && d.t === 'gm') {
    // GM login: only the server knows the password, and it tells everyone else who is a real GM.
    if (c.gmTries >= 5 || !GM_PASSWORD) return send(c, { t: 'gm', ok: false });
    const ok = crypto.timingSafeEqual(sha(d.pw || ''), sha(GM_PASSWORD));
    if (!ok) { c.gmTries++; log(`! ${c.id} failed GM login`); return send(c, { t: 'gm', ok: false }); }
    c.gm = true; c.master = true; log(`* ${c.id} is now the realm owner (master GM)`); send(c, { t: 'gm', ok: true, master: 1, token: OWNER_TOKEN }); if (c.p.v) broadcast(c, pmsg(c));
  } else if (d && d.t === 'ro' && c.master) {
    const was = raidOpen; raidOpen = !!d.open; try { fs.writeFileSync(RAID_FILE, JSON.stringify({ open: raidOpen })); } catch (e) {}
    if (was !== raidOpen) { broadcast(null, { t: 'ro', open: raidOpen ? 1 : 0 }); log(`* Cinderhold ${raidOpen ? 'UNVEILED' : 'sealed'} by the realm owner`); }
  } else if (d && d.t === 'arm' && d.c) {
    storeArmory(c, d.c);
  } else if (d && d.t === 'ac' && c.p && c.p.n) {
    // the Bloodsand Chest: the first player to finish opening it wins; it is gone for everyone for 30 minutes
    if (chestLeft() > 0) send(c, { t: 'ac', left: chestLeft(), by: chestBy, win: 0 });
    else { chestAt = Date.now(); chestBy = String(c.p.n).slice(0, 24); send(c, { t: 'ac', left: CHEST_CD, by: chestBy, win: 1 }); broadcast(c, { t: 'ac', left: CHEST_CD, by: chestBy }); log(`$ ${chestBy} looted the Bloodsand Chest`); }
  } else if (d && d.t === 'wh' && typeof d.name === 'string' && typeof d.txt === 'string' && c.p && c.p.n) {
    // whispers go only to the player they are meant for
    const tn = Date.now(); if (!c.whT || tn - c.whT > 5000) { c.whT = tn; c.whN = 0; }
    if (++c.whN <= 8) {
      const who = d.name.toLowerCase().slice(0, 24), txt = d.txt.slice(0, 200); let done = false;
      for (const o of clients.values()) if (o !== c && o.p && String(o.p.n || '').toLowerCase() === who) { send(o, { t: 'wh', from: String(c.p.n).slice(0, 24), txt }); done = true; }
      if (!done) send(c, { t: 'whx', name: d.name.slice(0, 24) });
    }
  } else if (d && d.t === 'gift' && c.gm && typeof d.name === 'string' && typeof d.what === 'string') {
    const who = d.name.toLowerCase().slice(0, 20), what = d.what.slice(0, 40); let done = false;
    for (const o of clients.values()) if (o.p && String(o.p.n || '').toLowerCase() === who) { send(o, { t: 'gift', what, from: 'the Realm' }); done = true; }
    if (!done) { (pendingGifts[who] = pendingGifts[who] || []).push(what); saveGifts(); }
    log(`$ gift "${what}" for ${d.name}${done ? '' : ' (waiting until they log in)'}`);
  } else if (d && d.t === 'gmtok' && typeof d.token === 'string') {
    if (OWNER_TOKEN && d.token.length === OWNER_TOKEN.length && crypto.timingSafeEqual(Buffer.from(d.token), Buffer.from(OWNER_TOKEN))) { c.gm = true; c.master = true; log(`* ${c.id} recognised as the realm owner (remembered device)`); send(c, { t: 'gm', ok: true, master: 1 }); if (c.p.v) broadcast(c, pmsg(c)); }
    else send(c, { t: 'gm', ok: false, forget: 1 });
  } else if (d && d.t === 'bug' && typeof d.text === 'string') {
    // a new ticket (older games send only text; newer ones send the text and the details separately)
    if (Date.now() - (c.lastTk || 0) < 20000) return send(c, { t: 'tkok', err: 'Please wait a little before sending another ticket.' });
    c.lastTk = Date.now(); const p = c.p || {};
    const cats = ['Bug', 'Stuck', 'Player', 'Item', 'Quest', 'Other'];
    const t = { id: nextTicketId(), at: Date.now(), st: 'open', cat: cats.includes(d.cat) ? d.cat : 'Bug', name: cleanStr(p.n || '?', 20), pid: cleanStr(p.pid, 48), cls: cleanStr(d.cls || p.c, 12), lvl: (d.lvl | 0) || (p.l | 0),
      zone: cleanStr(d.zone || p.z, 20), pos: cleanStr(d.pos, 20), ver: cleanStr(d.ver, 8), text: String(d.text).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 1500), info: cleanStr(d.info, 900), notes: [], reply: '' };
    if (!t.text.trim()) return; tickets.push(t); if (tickets.length > 2000) tickets = tickets.filter(x => x.st === 'open' || x.id > t.id - 1500); saveTickets(); ghCreate(t);
    fs.appendFile(BUG_FILE, `---- ${new Date().toISOString()} #${t.id} ${t.name}\n${t.text}\n`, () => {}); log(`# ticket #${t.id} from ${t.name}`);
    send(c, { t: 'tkok', id: t.id });
    const n = openTickets(); for (const o of clients.values()) if (o.gm && o !== c) send(o, { t: 'tknew', id: t.id, name: t.name, cat: t.cat, open: n });
  } else if (d && d.t === 'ah' && c.p && c.p.n) {
    const me = String(c.p.n), meL = me.toLowerCase();
    if (d.op === 'post' && typeof d.item === 'string' && d.item.length < 3000) {
      let it; try { it = JSON.parse(d.item); } catch (e) { return send(c, { t: 'ah', op: 'err', msg: 'That item could not be listed.' }); }
      const price = Math.max(1, Math.min(1000000, Math.round(+d.price || 0))), hrs = [12, 24, 48].includes(+d.hrs) ? +d.hrs : 24;
      if (auctions.filter(a => a.seller.toLowerCase() === meL).length >= 20) return send(c, { t: 'ah', op: 'err', msg: 'You can have at most 20 auctions at once.', back: d.item });
      if (me.toLowerCase() === NPC_SELLER.toLowerCase()) return send(c, { t: 'ah', op: 'err', msg: 'That name is reserved.', back: d.item });
      const a = { id: ahNext++, seller: cleanStr(me, 20), item: d.item, name: cleanStr(it.name, 40), rar: it.rar | 0, lv: it.lv | 0, slot: cleanStr(it.slot, 10), mat: typeof it.mat === 'string' ? cleanStr(it.mat, 20) : undefined, price, at: Date.now(), exp: Date.now() + hrs * 3600e3 };
      auctions.push(a); saveAH(); send(c, { t: 'ah', op: 'posted', id: a.id, name: a.name, price }); log(`# auction #${a.id} ${a.name} for ${price}g by ${me}`);
    } else if (d.op === 'buy') {
      const a = auctions.find(x => x.id === (d.id | 0)); if (!a) return send(c, { t: 'ah', op: 'err', msg: 'Someone else bought that one first.' });
      if (a.seller.toLowerCase() === meL) return send(c, { t: 'ah', op: 'err', msg: 'You cannot buy your own auction.' });
      if ((+d.gold || 0) < a.price) return send(c, { t: 'ah', op: 'err', msg: 'Not enough gold.' });
      auctions = auctions.filter(x => x !== a); saveAH(); send(c, { t: 'ah', op: 'bought', id: a.id, item: a.item, price: a.price, name: a.name });
      if (!a.npc) deliver(a.seller, 'gold:' + a.price + ':' + a.name); log(`# auction #${a.id} sold to ${me} for ${a.price}g`);
    } else if (d.op === 'cancel') {
      const a = auctions.find(x => x.id === (d.id | 0) && x.seller.toLowerCase() === meL); if (!a) return;
      auctions = auctions.filter(x => x !== a); saveAH(); send(c, { t: 'ah', op: 'cancelled', id: a.id, item: a.item, name: a.name });
    }
    if (d.op !== 'post' || true) send(c, { t: 'ah', op: 'list', list: auctions.slice(-600).map(a => ({ id: a.id, seller: a.seller, item: a.item, price: a.price, exp: a.exp })) });
  } else if (d && d.t === 'tk' && c.gm) {
    // Game Master ticket tools
    const t = tickets.find(x => x.id === (d.id | 0)), by = cleanStr((c.p && c.p.n) || 'GM', 20);
    if (d.op === 'close' && t) { t.st = 'closed'; t.closedBy = by; t.closedAt = Date.now(); const reply = String(d.reply || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 400).trim();
      if (reply) { t.reply = reply; const msg = `Reply from ${by} to your ticket #${t.id}: ${reply}`; let done = false;
        for (const o of clients.values()) if (o.p && o.p.pid === t.pid && String(o.p.n || '').toLowerCase() === t.name.toLowerCase()) { send(o, { t: 'tkreply', id: t.id, msg }); done = true; }
        if (!done) { const k = t.name.toLowerCase(); (pendingMsgs[k] = pendingMsgs[k] || []).push(msg); saveMsgs(); } }
      ghSync(t, `Closed by ${by}${reply ? ': ' + reply : ''}`); }
    else if (d.op === 'reopen' && t) { t.st = 'open'; ghSync(t, `Reopened by ${by}`); }
    else if (d.op === 'note' && t && typeof d.txt === 'string' && d.txt.trim()) { const txt = d.txt.replace(/[\u0000-\u001f]/g, ' ').slice(0, 400); t.notes.push({ by, at: Date.now(), txt }); ghSync(t, `Note from ${by}: ${txt}`); }
    else if (d.op === 'claim' && t) { t.claim = t.claim === by ? '' : by; }
    else if (d.op === 'delete' && t && c.master) { tickets = tickets.filter(x => x !== t); if (t.gh) gh('PATCH', `/issues/${t.gh}`, { state: 'closed' }); }
    if (d.op && d.op !== 'list') saveTickets();
    send(c, { t: 'tklist', list: tickets.slice(-300), open: openTickets() });
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
