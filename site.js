/* Emberfall Online website — no frameworks, no build step. Pages are drawn from hash routes (#home, #news, #armory/Name, #guides/topic, #store, #download). */
(function(){
'use strict';
const $=s=>document.querySelector(s), app=$('#app'), GD=window.GD, S=window.SITE||{};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RAR=['Common','Uncommon','Rare','Epic','Legendary'], RARCOL=['#9d9d9d','#1eff00','#3d8bff','#b45cff','#ff8000'];
const CLSI={warden:'⛨',mender:'✚',arcanist:'✦'};
const ago=t=>{ if(!t) return 'unknown'; const s=(Date.now()-t)/1000; if(s<90) return 'just now'; if(s<3600) return Math.round(s/60)+' min ago'; if(s<86400) return Math.round(s/3600)+' h ago'; return Math.round(s/86400)+' days ago'; };
const fmtDate=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});

/* ---------- embers ---------- */
(function(){ let h=''; for(let i=0;i<26;i++){ const l=Math.random()*100,d=8+Math.random()*12,dl=-Math.random()*20,s=2+Math.random()*3,dx=(Math.random()-.5)*140; h+=`<i style="left:${l}%;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:${dl}s;--dx:${dx}px"></i>`; } $('#embers').innerHTML=h; })();
$('#yr').textContent=new Date().getFullYear();
$('#burger').onclick=()=>$('#nav').classList.toggle('open');
if(S.contactEmail){ $('#footMail').href='mailto:'+S.contactEmail+'?subject=Emberfall'; }
if(S.discordUrl){ const d=$('#footDiscord'); d.href=S.discordUrl; d.classList.remove('hidden'); }

/* ---------- realm status ---------- */
let status=null;
async function loadStatus(){ try{ const r=await fetch('/api/status',{cache:'no-store'}); status=await r.json(); const el=$('#realm'); el.className='realm up'; el.querySelector('b').textContent=`${status.online} online`; const ho=$('#heroOnline'); if(ho) ho.innerHTML=heroOnline(); }catch(e){ const el=$('#realm'); el.className='realm sleep'; el.querySelector('b').textContent='Realm waking'; } }
loadStatus(); setInterval(loadStatus,30000);
const heroOnline=()=>status?`<span class="dot"></span> <b>${status.online}</b> adventurer${status.online===1?'':'s'} in the realm right now${status.players.length?': '+status.players.slice(0,6).map(p=>esc(p.name)).join(', ')+(status.players.length>6?'…':''):''}`:'';

/* ---------- item icons (same drawings as in the game) ---------- */
const IKP={sword:'<path d="M44 8 L52 8 L52 16 L26 42 L20 36Z" fill="#eef2f8" stroke="#1a1208" stroke-width="1.5"/><path d="M14 34 L28 48 L24 52 L10 38Z" fill="#d8ac4a" stroke="#1a1208" stroke-width="1.5"/><path d="M17 45 L19 47 L10 56 L8 54Z" fill="#6a4020"/>',
  axe:'<path d="M20 54 L46 14" stroke="#7a4a20" stroke-width="5" stroke-linecap="round"/><path d="M38 8 Q58 10 56 30 Q46 26 40 22Z" fill="#dfe6ee" stroke="#1a1208" stroke-width="1.5"/>',
  mace:'<path d="M18 52 L40 22" stroke="#7a4a20" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="18" r="10" fill="#c8ced8" stroke="#1a1208" stroke-width="1.5"/>',
  staff:'<path d="M18 58 L44 14" stroke="#8a5a28" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="12" r="8" fill="#fff4b0" stroke="#1a1208" stroke-width="1.5"/><circle cx="46" cy="12" r="4" fill="#fff"/>',
  wand:'<path d="M16 50 L40 22" stroke="#3a2040" stroke-width="5" stroke-linecap="round"/><polygon points="44,6 49,14 58,16 51,22 52,31 44,26 36,31 37,22 30,16 39,14" fill="#e8c0ff" stroke="#1a1208" stroke-width="1.5"/>',
  plate:'<path d="M18 14 L28 10 Q32 16 36 10 L46 14 L50 28 L44 30 L44 54 L20 54 L20 30 L14 28Z" fill="#c4ccd8" stroke="#1a1208" stroke-width="1.5"/><path d="M32 18 L32 50" stroke="#8a94a4" stroke-width="2"/>',
  robe:'<path d="M22 10 L42 10 L48 26 L44 28 L50 56 L14 56 L20 28 L16 26Z" fill="#8a5ac8" stroke="#1a1208" stroke-width="1.5"/><path d="M32 12 L32 56" stroke="#e8c870" stroke-width="2.5"/>',
  ring:'<circle cx="32" cy="36" r="13" fill="none" stroke="#e8c050" stroke-width="5"/><polygon points="32,12 39,20 32,28 25,20" fill="#bfe8ff" stroke="#1a1208" stroke-width="1.5"/>',
  amulet:'<path d="M18 10 Q32 34 46 10" fill="none" stroke="#c8a040" stroke-width="2.5"/><circle cx="32" cy="38" r="12" fill="#e8c050" stroke="#1a1208" stroke-width="1.5"/><circle cx="32" cy="38" r="6" fill="#ff6a8a"/>'};
function itemKind(it){ const n=(it.name||'').toLowerCase(); if(it.slot==='weapon'){ if(it.leg==='mender'||/staff/.test(n)) return 'staff'; if(it.leg==='arcanist'||/wand|focus/.test(n)) return 'wand'; if(/axe/.test(n)) return 'axe'; if(/morningstar|mace/.test(n)) return 'mace'; return 'sword'; }
  if(it.slot==='armor') return /robe|vestment|mantle/.test(n)?'robe':'plate'; return /charm|locket|talisman/.test(n)?'amulet':'ring'; }
function itemSVG(it){ const c=RARCOL[it.rar]||'#888'; const id='g'+Math.random().toString(36).slice(2,7); return `<svg viewBox="0 0 64 64"><defs><radialGradient id="${id}" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset=".6" stop-color="#1a1008"/><stop offset="1" stop-color="#050302"/></radialGradient></defs><rect width="64" height="64" fill="url(#${id})"/>${IKP[itemKind(it)]}</svg>`; }

/* ---------- routing ---------- */
const ROUTES={home,news,armory,guides,store,download};
function route(){ const h=decodeURIComponent(location.hash.replace(/^#/,''))||'home'; const [r,...rest]=h.split('/'); const fn=ROUTES[r]||home;
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===(ROUTES[r]?r:'home'))); $('#nav').classList.remove('open');
  app.innerHTML=''; fn(rest.join('/')); app.firstElementChild&&app.firstElementChild.classList.add('fade'); if(!rest.length||r!=='guides') window.scrollTo({top:0}); }
addEventListener('hashchange',route);

/* ---------- pages ---------- */
function secTitle(t,sub){ return `<div class="sec-title"><div class="rule"><span></span>✦<span></span></div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div>`; }
function home(){
  const news=window.NEWS.slice(0,3);
  app.innerHTML=`<div>
  <div class="hero"><div class="bg" style="background-image:url(/site/img/town.jpg)"></div><div class="in">
    <h1>EMBERFALL</h1><div class="tag">O N L I N E <span class="beta">OPEN BETA</span></div>
    <p class="lead">A free open-world fantasy MMO. Choose your class, explore nine zones from sunny meadows to a frozen crypt, team up with friends and bring down legendary bosses.</p>
    <div class="ctas"><a class="btn gold big" href="/play/">▶ Play free in your browser</a><a class="btn big" href="#download">⬇ Download the game</a></div>
    <div class="online" id="heroOnline">${heroOnline()}</div></div></div>
  <section><div class="wrap">${secTitle('Choose your path','Three classes, each with eight abilities that unlock as you level up.')}
    <div class="grid g3">${Object.entries(GD.CLS).map(([k,c])=>`<a class="panel cls" href="#guides/class-${k}" style="--cc:${c.col}"><div class="em">${CLSI[k]}</div><h3>${c.name}</h3><div class="role">${c.role}</div><p>${esc(c.desc)}</p><span class="btn">Class guide →</span></a>`).join('')}</div></div></section>
  <section style="padding-top:10px"><div class="wrap">${secTitle('A world worth exploring')}
    <div class="grid g3">
      ${[['🗺️','Nine zones','From Hearthmere and Amberfield to the Cinder Caldera, Frostpeak and Hollowdeep Crypt, all drawn in real-time 3D.'],
        ['🐉','World bosses','Old Tusk, the Hollow King, the Cinder Wyrm, Hrimgar and Morvath the Lich, each with mechanics and their own loot table.'],
        ['🤝','Play together','Invite friends to a party, share kill credit and quest progress, and talk in party chat.'],
        ['🔥','Legendary loot','Common to legendary gear, a blacksmith to upgrade it, and one legendary weapon per class.'],
        ['🐎','Mounts','Four mounts from the Chestnut Steed to the translucent Celestial Steed.'],
        ['🌿','Gathering & alchemy','Pick herbs, mine ore and brew potions and elixirs at the alchemy table.']].map(([i,t,d])=>`<div class="panel feat"><div class="ic">${i}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div></div></section>
  <section style="padding-top:10px"><div class="wrap">${secTitle('Screenshots')}
    <div class="gallery">${[['town','Hearthmere, the starting town'],['wyrm','Facing the Cinder Wyrm'],['steed','The Celestial Steed in Hearthmere'],['crypt','Morvath the Lich and his crypt guard']].map(([f,c])=>`<figure data-img="/site/img/${f}.jpg"><img src="/site/img/${f}.jpg" alt="${c}" loading="lazy"><figcaption>${c}</figcaption></figure>`).join('')}</div></div></section>
  <section style="padding-top:10px"><div class="wrap"><div class="grid g2">
    <div>${secTitle('Latest news')}${news.map(n=>`<a class="panel home-news" href="#news" style="display:block;margin-bottom:12px"><span class="news-item"><span class="ver">${n.v}</span><span class="date">${n.date}</span></span><h4>${esc(n.title)}</h4><p>${esc(n.sum)}</p></a>`).join('')}<a class="btn" href="#news">All patch notes →</a></div>
    <div>${secTitle('Hall of Heroes')}<div class="panel" style="padding:8px 4px" id="homeTop"><div class="empty">Loading heroes…</div></div><div style="margin-top:12px"><a class="btn" href="#armory">Open the Armory →</a></div></div>
  </div></div></section></div>`;
  app.querySelectorAll('[data-img]').forEach(f=>f.onclick=()=>{ const lb=$('#lightbox'); lb.querySelector('img').src=f.dataset.img; lb.classList.remove('hidden'); });
  topTable($('#homeTop'),5);
}
$('#lightbox').onclick=()=>$('#lightbox').classList.add('hidden');

function news(){
  const K={new:['k-new','NEW'],imp:['k-imp','IMPROVED'],fix:['k-fix','FIXED'],gm:['k-gm','GM']};
  app.innerHTML=`<section><div class="wrap" style="max-width:900px">${secTitle('Patch notes','Everything the developer has added, changed and fixed. Newest first.')}
  ${window.NEWS.map(n=>`<article class="panel news-item"><span class="ver">${n.v}</span><span class="date">${n.date}</span><h3>${esc(n.title)}</h3><p class="sum">${esc(n.sum)}</p><ul class="chg">${n.items.map(([k,t])=>`<li><b class="${K[k][0]}">${K[k][1]}</b>${esc(t)}</li>`).join('')}</ul></article>`).join('')}</div></section>`;
}

async function topTable(el,n){ try{ const r=await fetch('/api/top',{cache:'no-store'}); const L=(await r.json()).slice(0,n||25);
    if(!L.length){ el.innerHTML='<div class="empty">No heroes yet. Be the first! Your character appears here after you play online.</div>'; return; }
    el.innerHTML=`<table class="lb"><thead><tr><th>#</th><th>Hero</th><th>Class</th><th>Level</th><th>Achievements</th></tr></thead><tbody>${L.map((a,i)=>{ const c=GD.CLS[a.cls]||{col:'#ccc',name:a.cls}; return `<tr class="r${i+1}" data-n="${esc(a.name)}"><td class="rank">${i+1}</td><td><b style="color:${c.col}">${esc(a.name)}</b>${a.title?` <small style="color:#ffd36a">&lt;${esc(a.title)}&gt;</small>`:''}${a.online?'<span class="dot" title="Online now"></span>':''}</td><td>${c.name}</td><td>${a.lvl}</td><td>${a.ach}</td></tr>`; }).join('')}</tbody></table>`;
    el.querySelectorAll('tr[data-n]').forEach(tr=>tr.onclick=()=>location.hash='#armory/'+encodeURIComponent(tr.dataset.n));
  }catch(e){ el.innerHTML='<div class="empty">The realm is waking up. Refresh in a moment.</div>'; } }

function armory(q){
  app.innerHTML=`<section><div class="wrap">${secTitle('The Armory','Look up any hero who has played on this realm: their gear, achievements, boss kills and more.')}
    <form class="search" id="sf"><input id="sq" placeholder="Type a character name…" autocomplete="off" value="${esc(q||'')}"><button class="btn gold">Search</button></form>
    <div id="ares"></div></div></section>`;
  $('#sf').onsubmit=e=>{ e.preventDefault(); const v=$('#sq').value.trim(); location.hash='#armory/'+encodeURIComponent(v); };
  const out=$('#ares');
  if(!q){ out.innerHTML=`<h3 style="text-align:center;color:var(--gold2)">Hall of Heroes</h3><div class="panel" style="padding:8px 4px" id="lbAll"></div>`; topTable($('#lbAll'),25); return; }
  out.innerHTML='<div class="empty">Searching the realm…</div>';
  fetch('/api/armory?name='+encodeURIComponent(q),{cache:'no-store'}).then(r=>r.json()).then(L=>{
    if(!L.length){ out.innerHTML=`<div class="panel empty">No hero called <b>${esc(q)}</b> has been seen on this realm yet.<br>Characters appear here after they play online for a minute.</div>`; return; }
    const exact=L.filter(a=>a.name.toLowerCase()===q.toLowerCase());
    if(exact.length===1) return charPage(out,exact[0],L.length>1?L:null);
    out.innerHTML=`<div class="panel" style="padding:8px 4px"><table class="lb"><thead><tr><th>Hero</th><th>Class</th><th>Level</th><th>Last seen</th></tr></thead><tbody>${L.map((a,i)=>{ const c=GD.CLS[a.cls]||{col:'#ccc',name:a.cls}; return `<tr data-i="${i}"><td><b style="color:${c.col}">${esc(a.name)}</b>${a.online?'<span class="dot"></span>':''}</td><td>${c.name}</td><td>${a.lvl}</td><td>${a.online?'Online now':ago(a.seen)}</td></tr>`; }).join('')}</tbody></table></div>`;
    out.querySelectorAll('tr[data-i]').forEach(tr=>tr.onclick=()=>charPage(out,L[+tr.dataset.i],L));
  }).catch(()=>out.innerHTML='<div class="panel empty">The realm is waking up. Try again in a moment.</div>');
}
function charPage(out,a,others){
  const c=GD.CLS[a.cls]||{col:'#ccc',name:a.cls,role:''}; const z=GD.ZONES[a.zone]; const st=a.stats||{}; const ach=a.ach||{};
  const gear=['weapon','armor','trinket'].map(s=>{ const it=a.eq&&a.eq[s]; if(!it) return `<div class="gear"><div class="ico" style="display:flex;align-items:center;justify-content:center;color:#5a4a30;font-size:26px">∅</div><div><div class="sub">${s}</div><div class="nm" style="color:#7a6a50">Empty</div></div></div>`;
    return `<div class="gear" data-tip="${esc(it.name)}"><div class="ico r${it.rar}">${itemSVG(it)}</div><div><div class="nm t${it.rar}">${esc(it.name)}${it.up?' +'+it.up:''}</div><div class="sub">${RAR[it.rar]} ${s} · item level ${it.lv||'?'} · +${it.pow} power · +${it.sta} stamina</div>${it.desc?`<div class="ds">${esc(it.desc)}</div>`:''}</div></div>`; }).join('');
  const bosses=GD.BOSSES.map(b=>{ const n=(st.bosses||{})[b.key]||0; return `<span class="pill ${n?'on':''}">${b.boss?'☠':'★'} ${esc(b.name)}${n?' ×'+n:''}</span>`; }).join('');
  const mounts=GD.MOUNTS.slice(1).map((m,i)=>`<span class="pill ${a.mounts.includes(i+1)?'on':''}">🐎 ${esc(m.name)}</span>`).join('');
  const got=Object.keys(ach).length;
  out.innerHTML=`<div class="fade">${others?`<p style="text-align:center"><a href="#armory/${encodeURIComponent(a.name)}" onclick="history.back();return false">← back to results</a></p>`:''}
   <div class="panel ch-head" style="--cc:${c.col}"><div class="em">${CLSI[a.cls]||'?'}</div><div style="flex:1">
     <h2>${esc(a.name)}</h2>${a.cos&&a.cos.title?`<div class="ti">&lt;${esc(a.cos.title)}&gt;</div>`:''}
     <div class="meta">Level <b>${a.lvl}</b> ${c.name} · ${c.role}${z?' · last seen in <b>'+esc(z.name)+'</b>':''} · ${a.online?'<span style="color:#7dff8a">● Online now</span>':'seen '+ago(a.seen)}</div>
     ${a.lvl<GD.MAXLVL?`<div class="xpbar" title="${a.xp} / ${a.xpNeed} XP"><i style="width:${a.xpNeed?Math.round(a.xp/a.xpNeed*100):0}%"></i></div>`:'<div class="meta" style="color:#ffd36a">★ Maximum level</div>'}
   </div><div style="text-align:right;position:relative"><div style="font-family:Cinzel,serif;font-size:34px;color:var(--gold2)">${got}<small style="font-size:16px;color:var(--dim)">/${window.ACH.length}</small></div><div style="color:var(--dim);font-size:13px">achievements</div></div></div>
   <div class="ch-cols">
     <div class="panel box"><h3>Equipment</h3>${gear}
       <h3 style="margin-top:16px">Statistics</h3><div class="stats">
         <div><span>Health</span><b>${a.hp}</b></div><div><span>${c.res==='rage'?'Rage':'Mana'}</span><b>${a.res}</b></div><div><span>Power</span><b>${a.pow}</b></div><div><span>Stamina</span><b>${a.sta}</b></div>
         <div><span>Monsters defeated</span><b>${st.kills||0}</b></div><div><span>Deaths</span><b>${st.deaths||0}</b></div><div><span>Herbs &amp; ore gathered</span><b>${st.gathered||0}</b></div><div><span>Gold earned</span><b>${st.goldEarned||0}</b></div>
         <div><span>Quests completed</span><b>${a.quests.length}/${GD.QUESTS.length}</b></div><div><span>Gold</span><b>${a.gold}</b></div></div>
       <h3 style="margin-top:16px">Exploration <small>${a.disc.length}/${GD.POIS.length} landmarks</small></h3><div class="prog"><i style="width:${Math.round(a.disc.length/GD.POIS.length*100)}%"></i></div>
       ${GD.POIS.map(p=>`<span class="pill ${a.disc.includes(p.id)?'on':''}">◆ ${esc(p.name)}</span>`).join('')}
     </div>
     <div>
       <div class="panel box"><h3>Boss kills</h3>${bosses}</div>
       <div class="panel box" style="margin-top:18px"><h3>Mounts &amp; cosmetics</h3>${mounts}${a.cos&&a.cos.wings?'<span class="pill on">🔥 Phoenix Wings</span>':''}${a.cos&&a.cos.aura?'<span class="pill on">✨ Supporter Aura</span>':''}</div>
       <div class="panel box" style="margin-top:18px"><h3>Achievements <small>${got} of ${window.ACH.length}</small></h3><div class="achs">
         ${window.ACH.map(x=>`<div class="ach ${ach[x.id]?'':'locked'}"><div class="ai">${x.ic}</div><div><div class="an">${esc(x.n)}</div><div class="ad">${esc(x.d)}</div>${ach[x.id]?`<div class="when">✓ ${fmtDate(ach[x.id])}</div>`:''}</div></div>`).join('')}
       </div></div>
     </div></div></div>`;
}

const GUIDES=[['start','Getting started'],['class-warden','Warden (tank)'],['class-mender','Mender (healer)'],['class-arcanist','Arcanist (damage)'],['leveling','Zones & leveling'],['bosses','Bosses & loot'],['gathering','Gathering & alchemy'],['mounts','Mounts'],['party','Parties & multiplayer'],['controls','Controls'],['faq','FAQ']];
function guides(topic){ topic=topic||'start'; const body=GUIDE[topic]?GUIDE[topic]():GUIDE.start();
  app.innerHTML=`<section><div class="wrap">${secTitle('Guides','Everything you need to go from fresh recruit to Hero of Emberfall.')}
  <div class="guides"><nav class="panel gnav">${GUIDES.map(([k,t])=>`<a href="#guides/${k}" class="${k===topic?'on':''}">${t}</a>`).join('')}</nav><article class="panel gbody">${body}</article></div></div></section>`; }
const zoneRow=k=>{ const z=GD.ZONES[k]; return z?`<tr><td><b>${esc(z.name)}</b></td><td>${esc(z.sub||'')}</td><td>${GD.MOBS.filter(m=>m.zone===k).map(m=>esc(m.name)).join(', ')||'—'}</td></tr>`:''; };
const GUIDE={
  start:()=>`<h2>Getting started</h2><p>Welcome to Emberfall! Here is how to go from your first step to your first boss.</p>
   <ol class="steps"><li><b>Make a hero.</b> Open <a href="/play/">the game</a> (or the <a href="#download">desktop app</a>), type a name and pick a class. Not sure? The <b>Warden</b> is the most forgiving.</li>
   <li><b>Talk to Captain Oriel.</b> People with a gold <b>!</b> over their head have quests. Walk up and press <kbd>F</kbd>.</li>
   <li><b>Follow the gold arrow.</b> The arrow at the top of your screen points to your current quest goal and shows the distance.</li>
   <li><b>Fight!</b> Click a monster (or press <kbd>Tab</kbd>) and use your abilities with <kbd>1</kbd>–<kbd>8</kbd>. Drink a potion with <kbd>Q</kbd> when you are low.</li>
   <li><b>Loot and gear up.</b> Defeated monsters drop a glowing bag. Press <kbd>F</kbd> next to it. Open your Character panel with <kbd>C</kbd> and your bags with <kbd>B</kbd>.</li>
   <li><b>Get a mount at level 3</b> from Hilde the Stable Master (look for the golden horseshoe), then press <kbd>R</kbd> to ride.</li></ol>
   <div class="callout">Your characters are saved on your own device. Use the same browser (or the desktop app) every time to keep them.</div>`,
  leveling:()=>`<h2>Zones & leveling</h2><p>Emberfall has ${Object.keys(GD.ZONES).length} zones. The level cap is <b>${GD.MAXLVL}</b>. Follow the quest givers and you will move through them roughly in this order:</p>
   <table><tr><th>Zone</th><th>Level</th><th>Monsters</th></tr>${['town','meadow','forest','swamp','lake','ruins','ash','frost','crypt'].map(zoneRow).join('')}</table>
   <h3>Tips</h3><ul><li>Monsters three or more levels below you give very little experience. Move on when they turn grey.</li><li>Complete every quest you see: quests give far more experience than grinding.</li><li>Discovering landmarks gives experience too. Open the world map with <kbd>M</kbd>.</li><li>Group up for elites and bosses: party members share kill credit.</li></ul>`,
  bosses:()=>`<h2>Bosses & loot</h2><p>Bosses respawn a few minutes after they fall. The map (<kbd>M</kbd>) shows a skull on every boss, with a countdown while it is dead.</p>
   <table><tr><th>Boss</th><th>Level</th><th>Zone</th><th>Respawn</th><th>Drop chances</th></tr>${GD.BOSSES.map(b=>{ const L=GD.BOSSLOOT[b.key]; return `<tr><td><b>${b.boss?'☠':'★'} ${esc(b.name)}</b></td><td>${b.lv[0]}</td><td>${esc(b.zone==='lair'?'Cinder Caldera':(GD.ZONES[b.zone]||{}).name||b.zone)}</td><td>${b.resp?Math.round(b.resp/60*10)/10+' min':'—'}</td><td>${L?L.p.map((v,i)=>v?`<span class="t${i}">${RAR[i]} ${v}%</span>`:'').filter(Boolean).join(' · ')+(L.n>1?` <small>(${L.n} items)</small>`:''):'Rare or epic'}</td></tr>`; }).join('')}</table>
   <h3>Item rarity</h3><p>${RAR.map((r,i)=>`<b class="t${i}">${r}</b>`).join(' → ')}</p>
   <h3>Legendary weapons</h3><p>Each class has one legendary weapon. It can drop from the Cinder Wyrm, Hrimgar and Morvath the Lich.</p><ul>${Object.entries(GD.LEGEND).map(([k,l])=>`<li><b class="t4">${esc(l.name)}</b> (${GD.CLS[k].name}): ${esc(l.desc)}</li>`).join('')}</ul>
   <h3>Fighting bosses</h3><ul><li>Watch the ground: bosses telegraph their big attacks with glowing circles. Step out!</li><li>The boss bar at the top shows what it is casting.</li><li>Bring a Warden to hold its attention and a Mender to keep everyone alive.</li></ul>`,
  gathering:()=>`<h2>Gathering & alchemy</h2><p>Herbs and ore nodes glow in the world. Walk up and press <kbd>F</kbd> to gather (it takes a moment, so stand still).</p>
   <table><tr><th>Material</th><th>Type</th><th>Found in</th></tr>${Object.values(GD.MATS).map(m=>`<tr><td>${m.icon} <b>${esc(m.name)}</b></td><td>${m.kind}</td><td>${m.zones.map(z=>esc((GD.ZONES[z]||{}).name||z)).join(', ')}</td></tr>`).join('')}</table>
   <h3>Recipes</h3><table><tr><th>Recipe</th><th>Effect</th><th>Ingredients</th></tr>${GD.RECIPES.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.desc)}</td><td>${Object.entries(r.need).map(([k,n])=>n+'× '+esc((GD.MATS[k]||{}).name||k)).join(', ')}</td></tr>`).join('')}</table>
   <p>Ore is also used by Doran Ironhand, the blacksmith, to upgrade your gear (up to +7).</p>`,
  mounts:()=>`<h2>Mounts</h2><p>From level 3 you can buy a mount from <b>Hilde the Stable Master</b> in Hearthmere. Press <kbd>R</kbd> to mount up or dismount. Taking damage knocks you off.</p>
   <table><tr><th>Mount</th><th>Level</th><th>Price</th><th>Speed</th></tr>${GD.MOUNTS.slice(1).map(m=>`<tr><td><b>${esc(m.name)}</b></td><td>${m.lvl}</td><td>${m.cost} gold</td><td>+${Math.round((m.speed-1)*100)}%</td></tr>`).join('')}</table>`,
  party:()=>`<h2>Parties & multiplayer</h2><ul><li>Click another player and press <b>Invite to party</b>, press <kbd>P</kbd> for the party window, or type <code>/invite Name</code>.</li><li>Party members share kill credit and quest progress when nearby, and see each other on the map.</li><li>Talk to your party with <code>/p message</code>. The leader has a ♛ crown and can remove members.</li><li>Up to ${5} players per party.</li></ul>
   <h3>Chat commands</h3><table><tr><td><code>/p message</code></td><td>Party chat</td></tr><tr><td><code>/invite Name</code></td><td>Invite to party</td></tr><tr><td><code>/leave</code></td><td>Leave your party</td></tr><tr><td><code>/who</code></td><td>Who is online</td></tr><tr><td><code>/dance /wave /sit /cheer /bow /kneel</code></td><td>Emotes</td></tr></table>`,
  controls:()=>`<h2>Controls</h2><table>${[['W A S D','Move (arrow keys work too)'],['Mouse drag','Look around · hold both buttons to run forward'],['Mouse wheel','Zoom'],['1 – 8','Abilities'],['Tab','Target nearest enemy'],['Q','Drink a potion'],['F','Talk, loot or gather'],['R','Mount / dismount'],['Space','Jump'],['`','Auto-run'],['C / B','Character panel / bags'],['M / L','World map / quest log'],['P / O','Party / players online'],['Enter','Chat'],['Esc','Game menu: options, keybinds, sound, bug reports, character select']].map(([k,d])=>`<tr><td>${k.split(' ').map(x=>/^[\w`]+$/.test(x)&&x.length<6?`<kbd>${x}</kbd>`:esc(x)).join(' ')}</td><td>${d}</td></tr>`).join('')}</table>
   <p>Every key can be changed in <b>Esc → Keybinds</b>. On phones and tablets, use the joystick to move and drag the screen to look.</p>`,
  faq:()=>`<h2>FAQ</h2><h3>Is it free?</h3><p>Yes. Everything that affects gameplay can be earned in game. Supporting the game only unlocks cosmetics (see <a href="#store">Support</a>).</p>
   <h3>Where are my characters saved?</h3><p>On your own device, in the browser or desktop app you play with. Playing in a different browser starts fresh.</p>
   <h3>The game takes a minute to load</h3><p>The realm server sleeps when nobody is playing. The first visitor wakes it up, which can take up to a minute.</p>
   <h3>Windows says "Windows protected your PC"</h3><p>The desktop app is new and not yet signed. Click <b>More info → Run anyway</b>.</p>
   <h3>I found a bug</h3><p>Press <kbd>Esc</kbd> in game and choose <b>Report a bug</b>${S.contactEmail?`, or email <a href="mailto:${S.contactEmail}">${S.contactEmail}</a>`:''}.</p>`
};
for(const k of ['warden','mender','arcanist']) GUIDE['class-'+k]=()=>{ const c=GD.CLS[k]; return `<h2 style="color:${c.col}">${CLSI[k]} ${c.name}</h2><p><b>${c.role}.</b> ${esc(c.desc)} Uses <b>${c.res}</b>${c.res==='rage'?' (built by dealing and taking damage)':' (regenerates over time)'}.</p>
  <h3>Abilities</h3>${GD.ABIL[k].map(a=>`<div class="abil"><div class="lv">Lv ${a.lvl}</div><div><b>${esc(a.name)}</b> <small style="color:var(--dim)">${a.cost?a.cost+' '+c.res+' · ':''}${a.cd?a.cd+'s cooldown':'no cooldown'}${a.cast?' · '+a.cast+'s cast':''}</small><br>${esc(a.desc)}</div></div>`).join('')}
  <h3>Legendary weapon</h3><p><b class="t4">${esc(GD.LEGEND[k].name)}</b>: ${esc(GD.LEGEND[k].desc)}</p>`; };

function store(){
  const T=window.TIERS, cur=S.currency||'$', open=!!S.donateUrl;
  app.innerHTML=`<section><div class="wrap">${secTitle('Support Emberfall','Emberfall is free and made by one developer. If you enjoy it, you can support the game and get a cosmetic thank-you in return.')}
   <div class="grid g4">${T.map(t=>`<div class="panel tier ${t.hot?'feat-t':''}">${t.hot?'<div class="badge">BEST VALUE</div>':''}<div class="art">${t.art}</div><h3>${esc(t.name)}</h3><div class="price">${cur}${t.price}</div><ul>${t.gets.map(g=>`<li>${esc(g)}</li>`).join('')}</ul><button class="btn ${t.hot?'gold':''}" data-t="${t.id}" ${open?'':'disabled'}>${open?'Choose':'Coming soon'}</button></div>`).join('')}</div>
   <div class="panel donate-box"><div><h3 style="color:var(--gold2);margin-bottom:6px">How it works</h3><ol class="steps" style="margin:0">
     <li>Pick a pack above and type the <b>exact name of the character</b> who should receive it.</li><li>You are taken to the secure donation page. Put your character name in the note.</li><li>The developer delivers your reward in game, usually within a day. You get a message when it arrives, even if you were offline.</li></ol>
     <p style="color:var(--dim);font-size:14px;margin-top:10px">Rewards are cosmetic (titles, auras, wings) plus the Celestial Steed, which can also be earned with gold in game. Donations are voluntary and non-refundable. Questions? ${S.contactEmail?`<a href="mailto:${S.contactEmail}?subject=Emberfall%20support">${S.contactEmail}</a>`:'Contact the developer.'}</p></div>
     <div style="min-width:280px"><label style="font-family:Cinzel,serif;color:var(--gold)">Character name</label><input id="dn" maxlength="14" placeholder="e.g. Randomskrskr"><div id="dmsg" style="font-size:14px;color:var(--dim);margin-top:8px">${open?'Choose a pack to continue.':'Donations open soon. The developer is setting up payments.'}</div></div></div>
  </div></section>`;
  app.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ const n=$('#dn').value.trim(); if(n.length<2){ $('#dmsg').innerHTML='<span style="color:#ff8a6a">Type your character name first.</span>'; $('#dn').focus(); return; }
    const t=T.find(x=>x.id===b.dataset.t); const note=`Emberfall ${t.name} for ${n}`; let url=S.donateUrl;
    try{ navigator.clipboard.writeText(note); }catch(e){}
    $('#dmsg').innerHTML=`Opening the donation page… Please add this note: <b>${esc(note)}</b> (copied to your clipboard).`; window.open(url,'_blank','noopener'); });
}

function download(){
  app.innerHTML=`<section><div class="wrap">${secTitle('Download Emberfall','Play in your browser instantly, or install the game app for its own window and taskbar icon.')}
   <div class="grid g4">
     <div class="panel dl"><div class="os">🌐</div><h3>Browser</h3><p>Nothing to install. Works on PC, Mac, phones and tablets.</p><a class="btn gold" href="/play/">▶ Play now</a></div>
     <div class="panel dl"><div class="os">🪟</div><h3>Windows</h3><p>Windows 10 or 11.<br>Unzip and run Emberfall.exe</p><a class="btn" href="/downloads/Emberfall-Windows.zip">⬇ Download</a></div>
     <div class="panel dl"><div class="os">🍎</div><h3>Mac</h3><p>macOS 11 or newer, Apple Silicon and Intel.</p><a class="btn" href="/downloads/Emberfall-Mac.zip">⬇ Download</a></div>
     <div class="panel dl"><div class="os">🐧</div><h3>Linux</h3><p>64-bit, with Chrome or Chromium installed.</p><a class="btn" href="/downloads/Emberfall-Linux.zip">⬇ Download</a></div></div>
   <div class="panel gbody" style="margin-top:22px"><h3 style="margin-top:0">Installing</h3><ul>
     <li><b>Windows:</b> unzip, double-click <code>Emberfall.exe</code>. If you see "Windows protected your PC", click <b>More info → Run anyway</b> (first time only).</li>
     <li><b>Mac:</b> unzip, right-click <code>Emberfall.app</code> → <b>Open</b> → <b>Open</b>. If it is still blocked: System Settings → Privacy &amp; Security → <b>Open Anyway</b>.</li>
     <li>The app connects to this realm automatically and always runs the latest version.</li></ul></div></div></section>`;
}
route();
})();
