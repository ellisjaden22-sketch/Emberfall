# Emberfall Online

A 3D fantasy MMO that runs in the browser. You can host it yourself and change anything you like.
It has no dependencies, needs no build step, and all the art is drawn by code.

```
emberfall/
  index.html   page layout (login screen, HUD, windows)
  style.css    all UI styling
  config.js    settings (server address, solo mode)
  game.js      the whole game: world, monsters, quests, 3D engine, UI
  server.js    tiny Node.js server: hosts the files + relays multiplayer
  package.json / Dockerfile / render.yaml   for hosting services
```

---

## 1. Play it on your computer

You only need **[Node.js](https://nodejs.org) 16 or newer**.

```bash
cd emberfall
node server.js
```

Then open **http://localhost:8080**. To test multiplayer, open a second browser window (or a different browser) at the same address.

To use a different port, run `PORT=3000 node server.js` (on Windows PowerShell: `$env:PORT=3000; node server.js`).

**Friends on the same Wi-Fi** can join at `http://YOUR-PC-IP:8080`. On Windows, run `ipconfig` to find your IP; on Mac or Linux, run `ip a`. You may need to allow Node through your firewall.

> You can open `index.html` straight from disk, but then there's no server, so you play solo.

---

## 2. Put it online (beta launch checklist)

The quickest free route is **Render.com** (about 10 minutes, no credit card):

1. Make a free **GitHub** account and create a new repository. Upload everything in this `emberfall` folder (drag and drop works on github.com).
2. On **render.com**, sign in with GitHub, then **New → Blueprint** and pick that repository. Render reads `render.yaml` for you.
3. When it asks for `GM_PASSWORD`, type a secret password. Only you should know it. (Optional: add `OWNER_IP` with your home IP so you are recognised without logging in.)
4. Wait for the deploy to finish, then open your address (for example `https://emberfall-xxxx.onrender.com`).
5. In the game, press Enter and type `/gm login yourpassword` once. You are now the realm owner, and your device is remembered.
6. Send the address to your beta testers. They create their own characters, which are saved on their own device. They never start as GMs.

While the beta runs:
- `https://your-address/health` shows who is online.
- Players report bugs from the **Esc menu → Report a bug**. Reports are saved in `bugs.log` on the server (on Render: **Shell** tab → `cat bugs.log`).
- Remove troublemakers with `/boot name` or `/ban name` (`/unban name` to undo). Bans are kept in `bans.json`.
- After you change the game, bump `const VERSION` in `game.js`. Players on the old version see "A newer version is available, refresh".

> Free Render servers sleep after 15 minutes without visitors; the first visit then takes about a minute to wake it. A paid plan (or any VPS) stays awake. Note that files like `bugs.log`, `bans.json` and `gms.json` are reset when a free Render server redeploys.

### Other hosts



The server is a normal Node app that listens on `$PORT`. Most hosts work with no changes:

| Host | How |
|---|---|
| **Render.com** (free tier) | New → Web Service → upload or connect this folder → Build command: *(leave empty)* → Start command: `node server.js` |
| **Railway / Fly.io / Koyeb** | Deploy the folder; they detect `package.json` (`npm start`) or the `Dockerfile` |
| **Any VPS** (DigitalOcean, Hetzner…) | Copy the folder, run `node server.js` (keep it running with `pm2 start server.js` or a systemd service), and put Nginx or Caddy in front for HTTPS |
| **Docker** | `docker build -t emberfall . && docker run -p 8080:8080 emberfall` |

Share the address (for example `https://my-emberfall.onrender.com`) and everyone who opens it plays in the same world.
Check `/health` to see how many players are online.

**Static host + separate server:** if you put the game files on a static host (GitHub Pages, Netlify…) and run `server.js` somewhere else, set the server address in `config.js`:

```js
serverUrl: 'wss://your-server.example.com/ws',
```

> Free hosting tiers often go to sleep when idle, so the first visit can take a while to wake the server. Saved characters live in each player's own browser (localStorage).

---

## 3. Game Master (GM) commands

Only Game Masters can use these. Everyone else gets *"You are not a Game Master."*

**You are recognised as the realm owner automatically when:**
- you play on the same computer that runs `server.js` (http://localhost:8080), or
- your internet IP is listed in `OWNER_IP` (for example `OWNER_IP=41.13.22.7`; find yours by searching "what is my IP"), or
- you logged in once with `/gm login <password>` on that device (it is remembered).

New players never start as GMs, on PC or mobile. Only the owner can appoint GMs with `/makegm`.

**Password login (works from anywhere).** Start the server with a password:

```bash
GM_PASSWORD=pick-a-secret node server.js            # Mac / Linux
$env:GM_PASSWORD="pick-a-secret"; node server.js    # Windows PowerShell
```

On Render, Railway and similar hosts, add `GM_PASSWORD` as an environment variable in the dashboard.
In the game, open chat (Enter) and type `/gm login pick-a-secret`. The server checks the password, so other players can't fake GM status, and it allows 5 wrong tries per connection.
A **GM** button then appears next to Help. Only other GMs ever see a GM tag; regular players never see GM effects.

**Make a friend a GM (owner only).** The player who logged in with `GM_PASSWORD` is the realm owner. While your friend is online, type `/makegm TheirName`. The server remembers them in `gms.json`, so they stay a GM when they come back. `/removegm TheirName` takes it away. Other GMs can't appoint anyone.

**Solo testing:** set `soloGM: true` in `config.js` if you want GM powers when playing solo from disk while editing. It is off by default, so nobody else ever starts as a GM.

| Command | What it does |
|---|---|
| `/gm` | Opens the GM window with buttons for everything below |
| `/gold 5000` | Adds gold (use a negative number to remove it) |
| `/level 15` · `/levelup 2` · `/xp 5000` | Sets your level, adds levels, or gives experience |
| `/god` | God mode on/off: no damage and unlimited mana or rage |
| `/nocd` | No cooldowns on/off |
| `/fly` | Noclip on/off: walk through walls, cliffs and water |
| `/speed 3` | Run speed ×1 to ×6 |
| `/tp 120 60` | Teleport to tile coordinates (the map is 160×112) |
| `/tp town` · `/tp hilde` · `/tp lich` · `/tp frostpeak` · `/tp Brenna` | Teleport to a place, NPC, boss, zone or player. You can also **Shift+click the world map** (M) |
| `/heal` · `/revive` | Full heal / come back to life where you are |
| `/item 3` | Creates an item: 0 common, 1 uncommon, 2 rare, 3 epic |
| `/mats 10` | Adds 10 of every herb and ore |
| `/mount` | Unlocks all mounts |
| `/kill` · `/kill all` | Kills your target / every monster nearby |
| `/time day` (dusk, night, dawn, auto) | Changes the time of day on your screen only |
| `/weather storm` (clear, cloudy, rain, auto) | Changes the weather on your screen only |
| `/questdone` | Completes the objectives of your active quests |
| `/announce Server restart in 5 min` | Banner message to every player (shown as a Realm Announcement, without your name) |
| `/aura` | A glowing aura around you that other players can see (on/off) |
| `/boot name` · `/ban name` · `/unban name` | Owner only: remove or ban a player from your server |
| `/invis` | Invisible on/off: other players can't see you on screen, on maps or in the player list, and monsters ignore you |
| `/makegm name` · `/removegm name` · `/gmlist` | Owner only: appoint or remove Game Masters |

To add your own command, search `game.js` for `function gmCmd` and add a `case`. Also add its name to `const GMCMDS`.

---

## 4. Edit the game

All gameplay data is plain JavaScript objects near the top of `game.js`. Save the file and refresh the browser to see the change; you only need to restart the server if you edit `server.js`.
Line numbers are approximate. Search for the text in the left column.

| What | Search `game.js` for | Notes |
|---|---|---|
| Classes (health, colours, auto-attack) | `const CLS={` | `hp`, `hpL` (per level), `mit` (damage taken multiplier) |
| Abilities | `const ABIL={` and `ABIL.warden.push(` | `dmg:[base,perLevel]`, `cd`, `cost`, `cast`, `lvl` (unlock level), `radius`, `stun`, `heal`, `hot`, `absorb`… |
| Monsters | `const MOBT=[` and `MOBT.push(` | `lv:[min,max]`, `hp`, `dmg`, `spd`, `aggro`, `zone`, `n` (how many), `elite`, `boss`, `pos:[tileX,tileY]`, `sp` (special attack) |
| Boss mechanics | `function mobSpecial` | `leap`, `slam`, `root`, `poison`, `drain`, `wyrm`, `lich` patterns. Add your own `case` |
| Quests | `const QUESTS=[` and `QUESTS.push(` | `type:'kill'/'gather'/'explore'`, `giver` (NPC id), `pre` (quest that must be finished first), `xp`, `gold`, `item` (rarity 1–3) |
| NPCs | `const NPCS=[`, `addNPC(` and `NPCGREET` | `addNPC(id, name, title, tileX, tileY, colour)`. Give them a look in `Object.assign(LOOK` |
| Landmarks to discover | `const POIS=[` | `{id, name, x, y, r}` in tile coordinates |
| Herbs and ore | `const MATS=` | `zones` controls where nodes spawn |
| Alchemy recipes | `const RECIPES=` | `need:{mat:count}`, `buff` or `give:'pots'` |
| Mounts | `const MOUNTS=` | `cost`, `speed`, `lvl`, colours |
| Levels and XP | `const MAXLVL` and `const xpNeed` | |
| Loot | `function genItem` and `function lootFor` | item names, stats, drop rates |
| Boss drop chances | `const BOSSLOOT=` | percent chance per rarity `[common, uncommon, rare, epic, legendary]` for each boss |
| Legendary weapons | `const LEGEND=` | one per class: name, stats and flavour text |
| Map layout | `function zoneOf` and `function genWorld` | the map is 160×112 tiles; zones are decided by position |
| Zone names | `const ZONES=` and `ZONES.frost=` | |
| Character and monster looks | `const LOOK=`, `Object.assign(LOOK`, `const QLOOK=`, `function drawLich`, `function drawWyrm` | colours are `[r,g,b]` from 0 to 1 |
| Buildings and landmarks (3D) | `function addLandmarks` and `const STATIC=` | built from boxes, cylinders and spheres with `gAdd(...)` |
| Sky, day/night, fog | `function computeSky` | the day length is the `600` in `dayLight()` (seconds) |
| Weather | `function weatherNow` | the chance of rain or storms in each 7-minute window |
| UI text, windows, help | `index.html` | |
| Music and ambience | `const PROG=`, `function schedStep`, `function audTick` | all sound is generated in code: chord progressions per track, which track plays in which zone, and ambience levels per zone |
| Mounts (incl. Celestial Steed) | `const MOUNTS=` and `function drawCelestial` | |
| UI colours and fonts | `style.css` | health/mana/rage bars are `.bar.hp`, `.bar.mana`, `.bar.rage` |
| Class colours | `const CLS={` → `col:` | used for name plates, chat names, cast bar, spell runes |
| Spell icons | `const ICONS={` | each icon is a small SVG drawing; `ISCHOOL` sets the background colours per school |
| GM commands | `function gmCmd` and `const GMCMDS` | |
| Stable Master and mounts | `addNPC('hilde'` and `const MOUNTS=` | |

### Quick recipes

**Make a new monster.** Add a line to `MOBT.push(...)`:
```js
{key:'goblin',name:'Cave Goblin',lv:[2,3],hp:60,hpL:15,dmg:5,dmgL:2,spd:85,rng:34,as:1.5,aggro:130,r:12,col:'#6a8a3a',zone:'forest',n:6},
```
Then give it a body. Add it to `Object.assign(LOOK,{ ... })`; any humanoid works:
```js
goblin:{scale:.7,torso:[.4,.5,.2],legs:[.3,.25,.15],arms:[.4,.55,.25],skin:[.45,.6,.25],head:'hood',hood:[.3,.2,.1],weapon:'rustsword',eyes:[1,.8,.2]},
```
Finally add a nameplate height to `const MOBH=` (`goblin:1.5`).

**Make a new quest.**
```js
QUESTS.push({id:'goblins',giver:'sylas',title:'Goblin Bother',type:'kill',mob:'goblin',n:5,xp:250,gold:5,lvl:2,text:'Goblins are stealing my arrows!'});
```

**Make the game easier to test.** Use the GM commands above (`/level 15`, `/gold 999`, `/tp 140 30`, `/god`).

**Reset your characters.** In the console, type `localStorage.clear()` and refresh.

### How multiplayer works (in case you change it)
Each player's browser sends its state (position, health, recent actions, chat) to the server about 10 times a second. The server forwards it to everyone else.
The player who has been online longest is the **world host**. Their browser runs the monsters and sends monster positions and health to everyone. When they leave, the next player takes over automatically.
This keeps `server.js` tiny, but it means players could cheat. For a public server with strangers, you'd move the monster logic (`function hostSim`) into the server.

If you change monsters, quests or the map, bump `const VERSION` in `game.js` so old and new versions don't mix in the same world.

---

## License
The code is yours to modify, host and share (MIT).
