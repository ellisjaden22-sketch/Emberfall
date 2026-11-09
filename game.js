// Emberfall Online — the whole game. Edit freely; see README.md for a map of this file.
"use strict";
/* =====================================================================
   EMBERFALL ONLINE — an original browser MMO.
   Multiplayer: every open page shares one world through room presence.
   The peer with the lowest label simulates monsters ("world host") and
   publishes them; others send their actions in their own presence.
   ===================================================================== */
const VERSION = 15;
const TS = 32, MW = 160, MH = 112;
const now = () => performance.now() / 1000;

/* ---------- RNG & noise ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash2(x,y,s=0){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,s){return vnoise(x,y,s)*.57+vnoise(x*2.03,y*2.03,s+7)*.29+vnoise(x*4.1,y*4.1,s+13)*.14}
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  if(f>0){r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f}else{r*=1+f;g*=1+f;b*=1+f}
  return `rgb(${r|0},${g|0},${b|0})`}
const clean = s => String(s||'').replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ue000-\uf8ff]/g,'');
const rid = n => Array.from({length:n},()=> 'abcdefghjkmnpqrstuvwxyz23456789'[Math.random()*31|0]).join('');

/* =====================================================================
   WORLD
   ===================================================================== */
const T={GRASS:0,FOREST:1,TREE:2,WATER:3,PATH:4,SAND:5,SWAMP:6,RUIN:7,WALL:8,ASH:9,LAVA:10,COBBLE:11,HOUSE:12,ROCK:13,BRIDGE:14,FOUNT:15};
T.ICE=17; T.SNOW=18;
const SOLID=new Set([T.TREE,T.WATER,T.WALL,T.LAVA,T.HOUSE,T.ROCK,T.FOUNT]);
const TOWN={x:56,y:82,r:11};
const LAIR={x:56,y:9};
const ZONES={
  town:{name:'Hearthmere',sub:'Sanctuary',lv:''},
  meadow:{name:'Amberfield',sub:'Level 1–2',lv:''},
  forest:{name:'Thornwood',sub:'Level 2–4'},
  swamp:{name:'Gloamfen',sub:'Level 3–5'},
  ruins:{name:'Ruins of Vael',sub:'Level 5–7'},
  ash:{name:'Cinder Caldera',sub:'Level 7–10'},
  lake:{name:'Mirrowmere',sub:'Tranquil waters'},
};
function zoneOf(tx,ty){
  if(Math.hypot(tx-TOWN.x,ty-TOWN.y)<TOWN.r) return 'town';
  if(tx>=130&&tx<=150&&ty>=8&&ty<=24) return 'crypt';
  if(tx+(fbm(tx*.07,ty*.07,44)-.5)*6>117) return 'frost';
  const x=tx+(fbm(tx*.07,ty*.07,21)-.5)*12, y=ty+(fbm(tx*.07,ty*.07,33)-.5)*12;
  if(y<25) return 'ash';
  if(Math.hypot(x-90,y-93)<12) return 'lake';
  if(x<43 && y>74) return 'swamp';
  if(x<45) return 'forest';
  if(x>69 && y<63) return 'ruins';
  return 'meadow';
}
const map=new Uint8Array(MW*MH), zmap=[];
const houses=[];
const tAt=(tx,ty)=> (tx<0||ty<0||tx>=MW||ty>=MH)?T.ROCK:map[ty*MW+tx];
const setT=(tx,ty,v)=>{ if(tx>=0&&ty>=0&&tx<MW&&ty<MH) map[ty*MW+tx]=v; };
function genWorld(){
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const z=zoneOf(x,y); zmap[y*MW+x]=z;
    const h=hash2(x,y,3), n=fbm(x*.13,y*.13,1);
    let t=T.GRASS;
    switch(z){
      case 'town': t=T.COBBLE; break;
      case 'meadow': t=T.GRASS; if(n>.70&&h<.55) t=T.TREE; else if(h<.006) t=T.ROCK; break;
      case 'forest': t=T.FOREST; if(h<.36&&n>.33) t=T.TREE; else if(h>.995) t=T.ROCK; break;
      case 'swamp': t=T.SWAMP; if(fbm(x*.21,y*.21,5)>.6) t=T.WATER; else if(h<.07) t=T.TREE; break;
      case 'ruins': { const f=fbm(x*.16,y*.16,8); t=f>.42?T.RUIN:T.GRASS;
        if(t===T.RUIN && ((x%7===0)||(y%7===0)) && hash2(x>>1,y>>1,4)<.5) t=T.WALL;
        if(t===T.GRASS && h<.05) t=T.TREE; break; }
      case 'ash': t=T.ASH; if(fbm(x*.19,y*.19,9)>.64) t=T.LAVA; else if(h<.035) t=T.ROCK; break;
      case 'lake': { const d=Math.hypot(x-90,y-93)+(fbm(x*.2,y*.2,11)-.5)*6; t=d<8.5?T.WATER:d<10?T.SAND:T.GRASS; break; }
      case 'frost': { t=T.SNOW; const d=Math.hypot(x-142,y-84)+(fbm(x*.2,y*.2,12)-.5)*5; if(d<8) t=T.ICE; else if(h<.22&&n>.42) t=T.TREE; else if(h>.985) t=T.ROCK; break; }
      case 'crypt': t=T.RUIN; break;
    }
    if(x<2||y<2||x>=MW-2||y>=MH-2|| (x<3||y<3||x>=MW-3||y>=MH-3)&&h<.6) t=T.ROCK;
    if(x>=110+(h<.3?1:0)&&x<=114-(h>.7?1:0)&&!(y>=56&&y<=62)) t=T.ROCK;
    map[y*MW+x]=t;
  }
  // paths out of town
  const carve=(x0,y0,x1,y1,seed)=>{const L=Math.hypot(x1-x0,y1-y0);const nx=-(y1-y0)/L, ny=(x1-x0)/L;
    for(let i=0;i<=L*3;i++){const t=i/(L*3);const w=(fbm(t*5,seed,seed)-.5)*9*Math.sin(t*Math.PI);
      const cx=x0+(x1-x0)*t+nx*w, cy=y0+(y1-y0)*t+ny*w;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const tx=Math.round(cx+ox),ty=Math.round(cy+oy);
        if(tx<3||ty<3||tx>=MW-3||ty>=MH-3) continue; const cur=tAt(tx,ty);
        if(cur===T.COBBLE) continue; setT(tx,ty, cur===T.WATER||cur===T.LAVA ? T.BRIDGE : T.PATH);}}};
  carve(56,82,56,12,2); carve(56,82,26,48,3); carve(56,82,22,94,4); carve(56,82,84,44,5); carve(56,82,82,90,6); carve(26,48,40,20,7);
  carve(84,44,88,40,8);
  carve(86,58,124,59,9); carve(124,59,140,27,10); carve(124,59,144,76,11); carve(124,59,146,56,12);
  for(let y=8;y<=24;y++)for(let x=130;x<=150;x++){ const edge=x===130||x===150||y===8||y===24; if(edge&&!(y===24&&x>=138&&x<=142)) setT(x,y,T.WALL); else if(!edge) setT(x,y,T.RUIN); }
  for(const [px,py] of [[134,12],[146,12],[134,19],[146,19],[137,16],[143,16]]) setT(px,py,T.WALL);
  for(let y=33;y<=47;y++)for(let x=81;x<=95;x++){ const d=Math.hypot(x-88,y-40); if(d<5.6) setT(x,y,T.RUIN); else if(d<6.6 && (x+y)%3===0 && tAt(x,y)!==T.PATH) setT(x,y,T.WALL); }
  // lair clearing
  for(let y=LAIR.y-7;y<=LAIR.y+7;y++)for(let x=LAIR.x-9;x<=LAIR.x+9;x++){const d=Math.hypot((x-LAIR.x)/1.3,y-LAIR.y);
    if(d<6.2) setT(x,y,T.ASH); else if(d<7.2 && tAt(x,y)!==T.PATH && tAt(x,y)!==T.BRIDGE) setT(x,y,T.ROCK);}
  // town: houses + fountain
  const H=[[-9,-7,5,3],[4,-7,5,3],[-9,3,5,3],[5,3,5,3],[-3,-10,6,2]];
  for(const [dx,dy,w,h] of H){const hx=TOWN.x+dx,hy=TOWN.y+dy;houses.push({x:hx,y:hy,w,h});
    for(let y=hy;y<hy+h;y++)for(let x=hx;x<hx+w;x++)setT(x,y,T.HOUSE);}
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)setT(TOWN.x+x,TOWN.y+y,T.FOUNT);
}
genWorld();
const isSolidPx=(px,py)=>SOLID.has(tAt(Math.floor(px/TS),Math.floor(py/TS)));
function blocked(x,y,r){return isSolidPx(x-r,y-r)||isSolidPx(x+r,y-r)||isSolidPx(x-r,y+r)||isSolidPx(x+r,y+r)}
function moveEnt(e,dx,dy,r){
  if(!blocked(e.x+dx,e.y,r)) e.x+=dx; else if(Math.abs(dy)<.01 && !blocked(e.x+dx,e.y+Math.abs(dx)*.7,r)) {e.x+=dx;e.y+=Math.abs(dx)*.7}
  if(!blocked(e.x,e.y+dy,r)) e.y+=dy;
}
const zoneAtPx=(x,y)=>zmap[clamp(Math.floor(y/TS),0,MH-1)*MW+clamp(Math.floor(x/TS),0,MW-1)];
const inTown=(x,y)=>Math.hypot(x/TS-TOWN.x,y/TS-TOWN.y)<TOWN.r+1;

/* =====================================================================
   DATA
   ===================================================================== */
const CLS={
  warden:{name:'Warden',role:'Tank',col:'#3f8cff',glyph:'⛨',hp:150,hpL:28,res:'rage',mit:.72,
    desc:'Plate-clad protector. Holds monsters\' attention, charges into the fray and spins through crowds.',
    auto:{rng:46,dmg:7,dmgL:2.3,spd:2.0}},
  mender:{name:'Mender',role:'Healer',col:'#ffd23f',glyph:'✚',hp:110,hpL:19,res:'mana',mit:.9,
    desc:'Channels dawnlight to mend and shield allies, and calls down pillars of light on foes.',
    auto:{rng:270,dmg:4,dmgL:1.4,spd:2.0,proj:'wand'}},
  arcanist:{name:'Arcanist',role:'Damage',col:'#b45cff',glyph:'✦',hp:100,hpL:17,res:'mana',mit:.92,
    desc:'Hurls embers, frost, meteors and chain lightning from afar. Fragile, but devastating.',
    auto:{rng:270,dmg:4,dmgL:1.5,spd:2.0,proj:'wand'}},
};
const ABIL={
  warden:[
    {id:'strike',lvl:1,name:'Sundering Strike',icon:'⚔',cost:20,cd:0,rng:50,hostile:true,melee:true,dmg:[13,4.6],threatMul:1.6,desc:'A heavy blow that causes high threat.'},
    {id:'bash',lvl:1,name:'Shield Bash',icon:'⛨',cost:15,cd:10,rng:50,hostile:true,melee:true,dmg:[7,2.2],stun:2.2,desc:'Slam your shield into the target, stunning it for 2s.'},
    {id:'taunt',lvl:2,name:'Challenge',icon:'❗',cost:0,cd:8,rng:280,hostile:true,taunt:true,desc:'Force the target to attack you.'},
    {id:'bulwark',lvl:3,name:'Bulwark',icon:'🛡',cost:0,cd:30,self:true,buff:'bulwark',dur:6,noGcd:true,desc:'Reduce all damage taken by 50% for 6s.'},
    {id:'whirl',lvl:4,name:'Whirlwind',icon:'🌀',cost:25,cd:6,self:true,radius:95,aoeDmg:[11,3.8],vis:10,desc:'Spin with your blade, striking every enemy around you.'},
    {id:'charge',lvl:6,name:'Charge',icon:'➹',cost:0,cd:15,rng:320,minRng:70,hostile:true,charge:true,noGcd:true,desc:'Rush to a distant enemy, stunning it and generating 20 rage.'},
  ],
  mender:[
    {id:'smite',lvl:1,name:'Sunlance',icon:'☀',cost:10,cd:0,cast:1.5,rng:330,hostile:true,dmg:[13,4.3],proj:'holy',desc:'Strike an enemy with searing light.'},
    {id:'mend',lvl:1,name:'Mend',icon:'✚',cost:16,cd:0,cast:1.8,rng:340,friendly:true,heal:[32,11],desc:'A strong heal on a friendly target (or yourself).'},
    {id:'bloom',lvl:2,name:'Bloom',icon:'❀',cost:12,cd:0,rng:340,friendly:true,hot:[8,2.8],desc:'Heals the target every 2s for 10s.'},
    {id:'radiance',lvl:3,name:'Radiance',icon:'✺',cost:28,cd:18,self:true,aoeHeal:[22,7.5],radius:280,desc:'Heal every ally near you.'},
    {id:'aegis',lvl:4,name:'Aegis',icon:'◈',cost:14,cd:6,rng:340,friendly:true,absorb:[30,10],desc:'Wrap a friend in light that absorbs damage for 12s.'},
    {id:'dawn',lvl:6,name:'Dawnfall',icon:'✴',cost:22,cd:12,cast:1.2,rng:340,hostile:true,area:110,aoeDmg:[20,6],aoeHealAlly:[12,4],vis:12,desc:'A pillar of light on the target: damages enemies and heals allies in the area.'},
  ],
  arcanist:[
    {id:'ember',lvl:1,name:'Emberbolt',icon:'🔥',cost:12,cd:0,cast:1.8,rng:380,hostile:true,dmg:[22,6.8],proj:'fire',desc:'Launch a bolt of fire.'},
    {id:'lance',lvl:1,name:'Arcane Lance',icon:'✦',cost:9,cd:4,rng:380,hostile:true,dmg:[12,3.8],proj:'arcane',desc:'An instant arcane strike.'},
    {id:'nova',lvl:2,name:'Frost Nova',icon:'❄',cost:15,cd:16,self:true,radius:150,aoeDmg:[8,2.2],root:4,vis:9,desc:'Freeze nearby enemies in place for 4s.'},
    {id:'blink',lvl:3,name:'Blink',icon:'➶',cost:10,cd:14,self:true,blink:200,noGcd:true,desc:'Teleport 200 yards forward.'},
    {id:'meteor',lvl:4,name:'Meteor',icon:'☄',cost:26,cd:10,cast:2.2,rng:380,hostile:true,area:105,aoeDmg:[30,9],vis:13,desc:'Call down a meteor that crushes everything near the target.'},
    {id:'chain',lvl:6,name:'Chain Lightning',icon:'ϟ',cost:18,cd:8,rng:380,hostile:true,chain:3,dmg:[17,5],desc:'Lightning leaps between up to 3 enemies.'},
  ],
};
const MOBT=[
  {key:'boar',name:'Thornback Boar',lv:[1,2],hp:58,hpL:18,dmg:4,dmgL:2,spd:72,rng:34,as:2.0,aggro:105,r:13,col:'#8a5a3b',zone:'meadow',n:8},
  {key:'moth',name:'Glimmerwing Moth',lv:[1,2],hp:42,hpL:14,dmg:3,dmgL:1.6,spd:82,rng:32,as:1.6,aggro:90,r:11,col:'#d9c7ff',zone:'meadow',n:5,fly:true,light:'#cbb8ff'},
  {key:'oldtusk',name:'Old Tusk',lv:[3,3],hp:420,hpL:0,dmg:9,dmgL:0,spd:80,rng:38,as:2.0,aggro:120,r:19,col:'#5e3a24',zone:'meadow',n:1,elite:true,resp:60,sp:{k:'leap',cd:9,r:62,delay:1.2,mul:1.6}},
  {key:'wolf',name:'Dusk Wolf',lv:[2,4],hp:72,hpL:20,dmg:5,dmgL:2.2,spd:96,rng:34,as:1.7,aggro:150,r:13,col:'#6d7280',zone:'forest',n:8},
  {key:'thornling',name:'Thornling',lv:[3,4],hp:95,hpL:21,dmg:5,dmgL:2,spd:58,rng:36,as:2.2,aggro:120,r:14,col:'#6b5232',zone:'forest',n:5,sp:{k:'root',cd:10,rng:220}},
  {key:'fangmaw',name:'Fangmaw the Alpha',lv:[5,5],hp:640,hpL:0,dmg:12,dmgL:0,spd:100,rng:36,as:1.6,aggro:170,r:18,col:'#2b2d36',zone:'forest',n:1,elite:true,resp:60,sp:{k:'leap',cd:8,r:66,delay:1.1,mul:1.5}},
  {key:'lurker',name:'Mire Lurker',lv:[3,5],hp:110,hpL:23,dmg:7,dmgL:2.3,spd:62,rng:38,as:2.2,aggro:120,r:16,col:'#4f7a46',zone:'swamp',n:6},
  {key:'bogwitch',name:'Bog Witch',lv:[4,5],hp:100,hpL:21,dmg:6,dmgL:2.2,spd:60,rng:220,as:2.4,aggro:170,r:13,col:'#3d5c3a',zone:'swamp',n:4,ranged:true,proj:14,light:'#9dff6a',sp:{k:'poison',cd:9}},
  {key:'sentinel',name:'Hollow Sentinel',lv:[5,7],hp:150,hpL:26,dmg:9,dmgL:2.5,spd:72,rng:36,as:2.0,aggro:140,r:14,col:'#d8d2bf',zone:'ruins',n:7},
  {key:'wraith',name:'Vael Wraith',lv:[6,7],hp:140,hpL:24,dmg:9,dmgL:2.5,spd:84,rng:40,as:1.9,aggro:150,r:14,col:'#8a6bd6',zone:'ruins',n:4,fly:true,light:'#a98aff',sp:{k:'drain',cd:7}},
  {key:'hking',name:'The Hollow King',lv:[8,8],hp:2200,hpL:0,dmg:17,dmgL:0,spd:76,rng:54,as:2.1,aggro:200,r:26,col:'#e3dcc4',zone:'ruins',n:1,elite:true,boss:true,resp:90,pos:[88,40],light:'#7ef0ff',sp:{k:'slam',cd:8,r:135,delay:1.6,mul:1.4}},
  {key:'cultist',name:'Ashbound Cultist',lv:[7,9],hp:140,hpL:25,dmg:11,dmgL:2.7,spd:74,rng:230,as:2.4,aggro:190,r:13,col:'#7a1f2b',zone:'ash',n:6,ranged:true,proj:2,light:'#ff7a1a'},
  {key:'magma',name:'Magma Elemental',lv:[8,9],hp:200,hpL:28,dmg:12,dmgL:2.7,spd:62,rng:40,as:2.3,aggro:140,r:17,col:'#3a2620',zone:'ash',n:4,light:'#ff6a1a',sp:{k:'slam',cd:9,r:95,delay:1.3,mul:1.2}},
  {key:'wyrm',name:'Cinder Wyrm',lv:[10,10],hp:3800,hpL:0,dmg:28,dmgL:0,spd:86,rng:62,as:2.2,aggro:230,r:34,col:'#d4521c',zone:'lair',n:1,boss:true,resp:120,pos:[56,9],light:'#ff8a2a',sp:{k:'wyrm'}},
  {key:'emberling',name:'Emberling',lv:[9,9],hp:160,hpL:0,dmg:10,dmgL:0,spd:105,rng:30,as:1.4,aggro:320,r:10,col:'#ff9a2a',zone:'lair',n:3,summon:true,pos:[56,9],fly:true,light:'#ffb03a'},
];
/* ---------- open world: landmarks, NPCs, quests, materials ---------- */
T.PROP=16; SOLID.add(T.PROP);
const ZGROUND={meadow:T.GRASS,forest:T.FOREST,swamp:T.SWAMP,ruins:T.RUIN,ash:T.ASH,lake:T.GRASS,town:T.COBBLE};
function findOpen(tx,ty){ for(let r=0;r<14;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
  const x=tx+dx,y=ty+dy, t=tAt(x,y); if(SOLID.has(t)||t===T.WATER||t===T.LAVA) continue; let ok=true;
  for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]){ const n=tAt(x+ax,y+ay); if(SOLID.has(n)) ok=false; } if(ok) return [x,y]; } return [tx,ty]; }
function clearArea(cx,cy,r,keepWater){ for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){ if(Math.hypot(x-cx,y-cy)>r+.3||x<4||y<4||x>MW-5||y>MH-5) continue;
  const t=tAt(x,y); if((t===T.WATER&&keepWater)||t===T.PATH||t===T.BRIDGE||t===T.COBBLE) continue; if(SOLID.has(t)||t===T.WATER||t===T.LAVA) setT(x,y,ZGROUND[zmap[y*MW+x]]||T.GRASS); } }
const POIS=[
  {id:'windmill',name:'Amberfield Mill',x:68,y:71,r:5},
  {id:'watchtower',name:'Old Thornwood Watchtower',x:18,y:40,r:5},
  {id:'hollow',name:"Witch's Hollow",x:15,y:96,r:5},
  {id:'archive',name:'Sunken Archive',x:97,y:31,r:5},
  {id:'throne',name:'Throne of Vael',x:88,y:38,r:4},
  {id:'dock',name:'Mirrowmere Dock',x:81,y:93,r:5},
  {id:'gate',name:'The Ember Gate',x:56,y:27,r:4},
  {id:'lair',name:"The Wyrm's Lair",x:56,y:11,r:6},
];
const STABLE={x:0,y:0,z:0}; const WINDMILL={}, CAULDRON={}, DOCK={x0:0,x1:0,z:93};
(function prepWorld(){
  clearArea(68,71,3); clearArea(18,40,3); clearArea(15,96,3,true); clearArea(97,31,3); clearArea(56,27,2);
  for(let y=70;y<=72;y++)for(let x=67;x<=69;x++) setT(x,y,T.PROP);
  for(let y=95;y<=96;y++)for(let x=14;x<=15;x++) setT(x,y,T.PROP);
  setT(95,31,T.PROP); setT(99,31,T.PROP); setT(54,27,T.PROP); setT(58,27,T.PROP);
  for(let x=74;x<100;x++){ if(tAt(x,93)===T.WATER){ DOCK.x0=x-1; DOCK.x1=x+6; break; } }
  if(DOCK.x0){ POIS.find(p=>p.id==='dock').x=DOCK.x0; clearArea(DOCK.x0-1,93,2,true); }
})();
const NPCS=[
  {id:'oriel',name:'Captain Oriel',title:'Quests',x:(TOWN.x-3.5)*TS,y:(TOWN.y+2.4)*TS,col:'#c9a14a'},
  {id:'mira',name:'Mira the Peddler',title:'Alchemy & Goods',x:(TOWN.x+4.5)*TS,y:(TOWN.y+2.4)*TS,col:'#6fae7a'},
];
function addNPC(id,name,title,tx,ty,col){ const [x,y]=findOpen(tx,ty); NPCS.push({id,name,title,x:x*TS+16,y:y*TS+16,col}); }
addNPC('doran','Doran Ironhand','Blacksmith',TOWN.x-6,TOWN.y+8,'#8a5a3a');
addNPC('hilde','Hilde','Stable Master',TOWN.x+8,TOWN.y-2,'#a07a4a');
addNPC('sylas','Ranger Sylas','Thornwood Camp',20,43,'#3a6a3a');
addNPC('marla','Old Marla','Gloamfen Herbalist',18,98,'#6a5a3a');
addNPC('ithren','Scholar Ithren','Vael Expedition',95,34,'#4a5a9a');
addNPC('vok','Sergeant Vok','Ember Gate Watch',60,29,'#8a2a2a');
addNPC('bram','Fisher Bram','Mirrowmere',(DOCK.x0||82)-2,91,'#4a7a9a');
const NPCGREET={oriel:'"Hearthmere stands because people like you stand for it. There\'s always work."',mira:'"Herbs in, potions out. Bring me petals and roots and I\'ll brew you something strong."',
  doran:'"Bring me ore and coin, and I\'ll make that blade of yours sing."',hilde:'"Every adventurer needs four good legs under them. Have a look at my beauties."',
  sylas:'"Quiet. The forest is listening. Something has the wolves and the thornlings stirred up."',marla:'"Mind the mud, dearie. The fen gives, and the fen takes."',
  ithren:'"Do you know how old these stones are? Older than the Wyrm. Older than fire, maybe."',vok:'"Nothing comes through this gate without my say. Nothing good, anyway."',
  bram:'"Fish aren\'t biting. Too many moths over the water, and that old boar keeps wrecking my nets."'};
const QUESTS=[
  {id:'boar',giver:'oriel',title:'Boar Trouble',type:'kill',mob:'boar',n:6,xp:140,gold:4,lvl:1,text:'Thornback boars have been tearing up the fields of Amberfield, just north of town. Thin their numbers.'},
  {id:'explore',giver:'oriel',title:'Lay of the Land',type:'explore',pois:['windmill','dock','watchtower'],n:3,xp:260,gold:5,lvl:1,text:'Before you go hunting, learn the land. Find the Amberfield Mill, the dock at Mirrowmere and the old watchtower in Thornwood.'},
  {id:'wolf',giver:'oriel',pre:'boar',title:'Howls at Dusk',type:'kill',mob:'wolf',n:8,xp:300,gold:6,lvl:2,text:'Dusk Wolves prowl Thornwood to the west, led by a great black alpha. Our hunters won\'t go near. Will you?'},
  {id:'lurker',giver:'oriel',pre:'wolf',title:'What Lurks in the Mire',type:'kill',mob:'lurker',n:6,xp:480,gold:9,lvl:3,text:'Something drags travellers into Gloamfen, the south-western marsh. End the lurkers.'},
  {id:'sentinel',giver:'oriel',pre:'lurker',title:'Restless Stones',type:'kill',mob:'sentinel',n:8,xp:760,gold:12,lvl:5,text:'The Ruins of Vael have stirred. Hollow Sentinels walk its broken halls again.'},
  {id:'hking',giver:'oriel',pre:'sentinel',title:'The Hollow King',type:'kill',mob:'hking',n:1,xp:1100,gold:20,lvl:6,item:2,text:'At the heart of Vael sits a crowned skeleton who commands the dead. When he raises his blade, get out of the circle. Bring friends.'},
  {id:'cultist',giver:'oriel',pre:'hking',title:'The Ashbound',type:'kill',mob:'cultist',n:6,xp:1000,gold:16,lvl:7,text:'Cultists gather in the Cinder Caldera, chanting to something beneath the lava. Silence them.'},
  {id:'wyrm',giver:'oriel',pre:'cultist',title:'Heart of the Caldera',type:'kill',mob:'wyrm',n:1,xp:2400,gold:40,lvl:9,epic:true,text:'They have woken the Cinder Wyrm. It breathes fire, rains embers and calls its brood when wounded. Gather a party.'},
  {id:'sunpetal',giver:'mira',title:'Petals for Potions',type:'gather',mat:'sunpetal',n:5,xp:130,gold:3,lvl:1,text:'Sunpetals grow wild in Amberfield. Walk up to the glowing yellow flowers and press F to pick them.'},
  {id:'moths',giver:'bram',title:'Lights on the Water',type:'kill',mob:'moth',n:6,xp:160,gold:3,lvl:1,text:'Glimmerwing moths swarm the meadows at dusk and scare the fish. Swat a few for me.'},
  {id:'tusk',giver:'bram',pre:'moths',title:'Old Tusk',type:'kill',mob:'oldtusk',n:1,xp:420,gold:8,lvl:3,item:2,text:'That scarred old boar has wrecked my nets three times. He roams Amberfield. Bring a friend, he leaps.'},
  {id:'thorn',giver:'sylas',title:'Thornling Menace',type:'kill',mob:'thornling',n:5,xp:300,gold:5,lvl:2,text:'Walking trees with a grudge. Thornlings root anyone who comes close. Cut them down.'},
  {id:'copper',giver:'sylas',title:'Arrowheads',type:'gather',mat:'copper',n:4,xp:260,gold:4,lvl:2,text:'I\'m low on arrowheads. Copper veins glint orange in the rocks around Thornwood and Amberfield.'},
  {id:'fangmaw',giver:'sylas',pre:'thorn',title:'Hunt the Alpha',type:'kill',mob:'fangmaw',n:1,xp:650,gold:10,lvl:4,item:2,text:'Fangmaw leads the pack. Kill the alpha and the wolves will scatter.'},
  {id:'mireroot',giver:'marla',title:'Roots of the Fen',type:'gather',mat:'mireroot',n:5,xp:380,gold:6,lvl:3,text:'Mireroot glows green near the water. My old knees can\'t take the mud any more.'},
  {id:'witches',giver:'marla',pre:'mireroot',title:'Sisters of the Bog',type:'kill',mob:'bogwitch',n:4,xp:520,gold:8,lvl:4,text:'Those bog witches poison the water with their hexes. Put an end to it, and mind their poison.'},
  {id:'wraiths',giver:'ithren',title:'Restless Spirits',type:'kill',mob:'wraith',n:5,xp:700,gold:10,lvl:5,text:'The wraiths drift through my dig site and drain the life from my workers. Please, deal with them.'},
  {id:'ghostcap',giver:'ithren',title:'Ghostcap Samples',type:'gather',mat:'ghostcap',n:5,xp:600,gold:9,lvl:5,text:'Pale ghostcap mushrooms grow among the ruins. I need samples for my research.'},
  {id:'archive',giver:'ithren',pre:'wraiths',title:'Echoes of Vael',type:'explore',pois:['archive','throne'],n:2,xp:500,gold:6,lvl:5,text:'Find the Sunken Archive to the north-east and the Throne of Vael at the heart of the ruins.'},
  {id:'iron',giver:'doran',title:'Iron for Hearthmere',type:'gather',mat:'iron',n:5,xp:650,gold:10,lvl:5,text:'Iron veins run through the Ruins of Vael. Bring me some and I\'ll keep the town\'s blades sharp.'},
  {id:'magma',giver:'vok',title:'Cooling the Flames',type:'kill',mob:'magma',n:4,xp:950,gold:14,lvl:7,text:'Magma elementals keep wandering up to my gate. Smash them before they melt it.'},
  {id:'obsidian',giver:'vok',title:'Obsidian for the Forge',type:'gather',mat:'obsidian',n:5,xp:900,gold:14,lvl:7,text:'Obsidian forms where lava cools. Mine the purple shards in the Caldera.'},
];
const MATS={
  sunpetal:{name:'Sunpetal',icon:'🌼',col:'#ffd34a',kind:'herb',zones:['meadow','lake']},
  thornbloom:{name:'Thornbloom',icon:'🌺',col:'#ff4a8a',kind:'herb',zones:['forest']},
  mireroot:{name:'Mireroot',icon:'🌿',col:'#8cff4a',kind:'herb',zones:['swamp']},
  ghostcap:{name:'Ghostcap',icon:'🍄',col:'#b9a0ff',kind:'herb',zones:['ruins']},
  emberlily:{name:'Emberlily',icon:'🔥',col:'#ff7a1a',kind:'herb',zones:['ash']},
  copper:{name:'Copper Ore',icon:'🟠',col:'#e08a3a',kind:'ore',zones:['meadow','forest']},
  iron:{name:'Iron Ore',icon:'⚙️',col:'#c8d4e0',kind:'ore',zones:['ruins']},
  obsidian:{name:'Obsidian',icon:'💎',col:'#9a5aff',kind:'ore',zones:['ash']},
};
const NODES=[]; (function(){ const R=mulberry32(777); let id=1; for(const k in MATS){ const M=MATS[k]; let n=0,tries=0;
  while(n<12&&tries<8000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(MH-8)); if(!M.zones.includes(zmap[ty*MW+tx])) continue;
    const t=tAt(tx,ty); if(SOLID.has(t)||t===T.WATER||t===T.LAVA||t===T.PATH||t===T.BRIDGE) continue; if(inTown(tx*TS,ty*TS)||Math.hypot(tx-LAIR.x,ty-LAIR.y)<9) continue;
    if(NODES.some(o=>Math.hypot(o.tx-tx,o.ty-ty)<4)) continue; NODES.push({id:id++,mat:k,tx,ty,x:tx*TS+16,y:ty*TS+16,resp:0}); n++; } } })();
const RECIPES=[
  {id:'pot',name:'Healing Draught ×2',desc:'Two potions for your belt.',need:{sunpetal:2},give:'pots'},
  {id:'might',name:'Elixir of Might',desc:'+20% damage and healing for 10 minutes.',need:{thornbloom:2,mireroot:1},buff:'might'},
  {id:'fort',name:'Elixir of Fortitude',desc:'+25% maximum health for 10 minutes.',need:{ghostcap:2,mireroot:1},buff:'fort'},
  {id:'ward',name:'Emberlily Tonic',desc:'Take 15% less damage for 10 minutes.',need:{emberlily:2,sunpetal:1},buff:'ward'},
];
const BUFFNAME={might:['Might','💪'],fort:['Fortitude','❤️'],ward:['Emberward','🔥']};
const MOUNTS=[null,
  {name:'Chestnut Steed',col:[.45,.27,.14],mane:[.12,.08,.05],cost:20,speed:1.7,lvl:3},
  {name:'Midnight Charger',col:[.08,.08,.1],mane:[.78,.78,.82],cost:60,speed:1.85,lvl:5,armor:true},
  {name:'Emberhorn Elk',col:[.52,.36,.22],mane:[.92,.86,.76],cost:120,speed:2.0,lvl:7,elk:true},
  {name:'Celestial Steed',col:[.55,.78,1],mane:[.9,.95,1],cost:500,speed:2.3,lvl:12,celestial:true}];
const EMOTES={dance:'bursts into dance!',wave:'waves.',sit:'sits down.',cheer:'cheers!',bow:'bows gracefully.',kneel:'kneels.'};
const CRITTERS=[]; (function(){ const R=mulberry32(4321); for(const [k,zs,n] of [['deer',['meadow','forest','frost'],15],['rabbit',['meadow','lake','town'],14],['frog',['swamp'],10]]){ let c=0,tries=0;
  while(c<n&&tries<5000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(MH-8)); if(!zs.includes(zmap[ty*MW+tx])) continue; const t=tAt(tx,ty); if(SOLID.has(t)||t===T.WATER) continue;
    if(k!=='rabbit'&&inTown(tx*TS,ty*TS)) continue; CRITTERS.push({k,x:tx*TS+16,y:ty*TS+16,sx:tx*TS+16,sy:ty*TS+16,face:R()*6.28,st:0,t:R()*5,walkP:0,mv:0}); c++; } }
  for(let f=0;f<5;f++) CRITTERS.push({k:'flock',cx:(25+R()*62)+0,cz:(30+R()*60),r:6+R()*9,ph:R()*6.28,n:5+Math.floor(R()*4),h:9+R()*6,sp:.15+R()*.15}); })();

/* ---------- Frostpeak & Hollowdeep Crypt content ---------- */
ZONES.frost={name:'Frostpeak',sub:'Level 10–13'}; ZONES.crypt={name:'Hollowdeep Crypt',sub:'Group dungeon · Level 13–15'};
MOBT.find(m=>m.key==='emberling').owner='wyrm';
MOBT.push(
  {key:'frostwolf',name:'Frost Wolf',lv:[10,11],hp:230,hpL:20,dmg:15,dmgL:1.5,spd:100,rng:36,as:1.6,aggro:160,r:14,col:'#c8d4e4',zone:'frost',n:10},
  {key:'yeti',name:'Snowmane Yeti',lv:[11,12],hp:420,hpL:30,dmg:20,dmgL:2,spd:74,rng:44,as:2.2,aggro:150,r:20,col:'#e8eef4',zone:'frost',n:6,sp:{k:'slam',cd:9,r:110,delay:1.4,mul:1.3}},
  {key:'icewraith',name:'Ice Wraith',lv:[11,12],hp:260,hpL:24,dmg:16,dmgL:1.8,spd:84,rng:220,as:2.2,aggro:180,r:14,col:'#9fd8ff',zone:'frost',n:6,fly:true,ranged:true,proj:15,light:'#9fe0ff',sp:{k:'root',cd:11,rng:240}},
  {key:'frostgiant',name:'Hrimgar the Frost Giant',lv:[13,13],hp:3400,hpL:0,dmg:30,dmgL:0,spd:70,rng:70,as:2.4,aggro:210,r:30,col:'#8fb4d8',zone:'frost',n:1,elite:true,resp:120,pos:[146,56],sp:{k:'slam',cd:8,r:150,delay:1.6,mul:1.5}},
  {key:'cryptmage',name:'Crypt Necromancer',lv:[12,13],hp:320,hpL:26,dmg:19,dmgL:2,spd:66,rng:230,as:2.4,aggro:200,r:14,col:'#3a2a4a',zone:'crypt',n:5,ranged:true,proj:16,light:'#9dff6a',sp:{k:'poison',cd:8}},
  {key:'deathguard',name:'Deathguard',lv:[13,14],hp:560,hpL:30,dmg:23,dmgL:2,spd:70,rng:48,as:2.1,aggro:180,r:16,col:'#bcb6a6',zone:'crypt',n:5},
  {key:'lich',name:'Morvath the Lich',lv:[15,15],hp:9500,hpL:0,dmg:34,dmgL:0,spd:62,rng:230,as:2.6,aggro:240,r:28,col:'#7ef0ff',zone:'crypt',n:1,boss:true,resp:180,pos:[140,13],ranged:true,proj:15,light:'#7ef0ff',sp:{k:'lich'}},
  {key:'thrall',name:'Risen Thrall',lv:[13,13],hp:300,hpL:0,dmg:16,dmgL:0,spd:90,rng:36,as:1.6,aggro:400,r:13,col:'#9a9484',zone:'crypt',n:4,summon:true,owner:'lich',pos:[140,13]}
);
ABIL.warden.push(
  {id:'rally',lvl:8,name:'Rallying Cry',icon:'📯',cost:30,cd:40,self:true,rallyHeal:.3,radius:300,desc:'Restore 30% of your health and heal nearby allies for 15% of theirs.'},
  {id:'avatar',lvl:11,name:'Avatar of Steel',icon:'⚡',cost:0,cd:60,self:true,buff:'avatar',dur:10,noGcd:true,desc:'For 10s grow larger, deal 40% more damage and take 30% less.'});
ABIL.mender.push(
  {id:'guardian',lvl:8,name:'Guardian Spirit',icon:'👼',cost:30,cd:30,rng:340,friendly:true,absorb:[80,22],hot:[14,4],desc:'A powerful shield plus healing over time on a friend.'},
  {id:'sanct',lvl:11,name:'Sanctuary',icon:'🕊',cost:40,cd:45,self:true,sanct:true,radius:260,desc:'Consecrate the ground. Every ally inside is healed each second for 8s.'});
ABIL.arcanist.push(
  {id:'blizzard',lvl:8,name:'Blizzard',icon:'🌨',cost:30,cd:18,cast:1.5,rng:380,hostile:true,area:130,aoeDmg:[18,5],root:2,ticks:3,vis:18,desc:'Three waves of ice crash down on the target area, freezing enemies in place.'},
  {id:'phoenix',lvl:11,name:'Phoenix Flame',icon:'✹',cost:35,cd:30,self:true,radius:190,aoeDmg:[42,11],vis:19,desc:'Erupt in phoenix fire, scorching everything around you.'});
POIS.push({id:'pass',name:'Frostpeak Pass',x:112,y:59,r:4},{id:'rimewater',name:'Rimewater',x:142,y:84,r:7},{id:'crypt',name:'Hollowdeep Crypt',x:140,y:22,r:5},{id:'giantcamp',name:"Hrimgar's Camp",x:146,y:56,r:6});
addNPC('hakon','Jarl Hakon','Frostwatch',124,63,'#7a8aa8');
NPCGREET.hakon='"Welcome to the frontier, southerner. Up here the cold kills more than the monsters do. Almost."';
MATS.frostbloom={name:'Frostbloom',icon:'❄️',col:'#8fe8ff',kind:'herb',zones:['frost']};
MATS.mithril={name:'Mithril Ore',icon:'🔷',col:'#7ab8ff',kind:'ore',zones:['frost']};
(function(){ const R=mulberry32(888); let id=NODES.length+1; for(const k of ['frostbloom','mithril']){ const M=MATS[k]; let n=0,tries=0;
  while(n<12&&tries<8000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(MH-8)); if(!M.zones.includes(zmap[ty*MW+tx])) continue; const t=tAt(tx,ty);
    if(SOLID.has(t)||t===T.WATER||t===T.PATH||t===T.ICE) continue; if(NODES.some(o=>Math.hypot(o.tx-tx,o.ty-ty)<4)) continue; NODES.push({id:id++,mat:k,tx,ty,x:tx*TS+16,y:ty*TS+16,resp:0}); n++; } } })();
RECIPES.push({id:'swift',name:'Frostbloom Tonic',desc:'+20% movement speed for 10 minutes.',need:{frostbloom:2,sunpetal:1},buff:'swift'});
BUFFNAME.swift=['Swiftness','💨'];
QUESTS.push(
  {id:'frontier',giver:'oriel',title:'The Frozen Frontier',type:'explore',pois:['pass'],n:1,xp:900,gold:10,lvl:10,text:'Riders say the eastern mountains have a pass to a land of ice. Jarl Hakon holds a camp there. Find the pass and go to him.'},
  {id:'fwolf',giver:'hakon',title:'Teeth in the Snow',type:'kill',mob:'frostwolf',n:8,xp:2200,gold:25,lvl:10,text:'Frost wolves hunt in packs across the whole valley. Thin them out before they get my scouts.'},
  {id:'frostbloom',giver:'hakon',title:'Frostbloom for the Wounded',type:'gather',mat:'frostbloom',n:5,xp:2000,gold:20,lvl:10,text:'Frostbloom glows pale blue in the snow. My healers need it.'},
  {id:'yeti',giver:'hakon',title:'Snowmane Hunt',type:'kill',mob:'yeti',n:5,xp:2800,gold:30,lvl:11,text:'The yetis slam the ground hard enough to break bones. Watch for the circle, then strike.'},
  {id:'icewraith',giver:'hakon',title:'Ghosts of the Ice',type:'kill',mob:'icewraith',n:5,xp:2600,gold:28,lvl:11,text:'Ice wraiths drift above Rimewater. Their touch freezes you in place.'},
  {id:'mithril',giver:'hakon',title:'Mithril Veins',type:'gather',mat:'mithril',n:5,xp:2400,gold:24,lvl:11,text:'Mithril glints blue in Frostpeak\'s rocks. Doran in Hearthmere can forge it into your gear.'},
  {id:'giant',giver:'hakon',pre:'yeti',title:'The Frost Giant',type:'kill',mob:'frostgiant',n:1,xp:4500,gold:50,lvl:12,item:3,text:'Hrimgar the Frost Giant camps to the east. He crushes everything within reach of his club. Bring friends.'},
  {id:'cryptex',giver:'hakon',pre:'giant',title:'Into Hollowdeep',type:'explore',pois:['crypt'],n:1,xp:1500,gold:15,lvl:12,text:'North of here lies the Hollowdeep Crypt. Something cold and old stirs inside. Find the entrance.'},
  {id:'deathguard',giver:'hakon',pre:'cryptex',title:'Break the Deathguard',type:'kill',mob:'deathguard',n:5,xp:5000,gold:55,lvl:13,text:'Armoured dead guard the crypt halls, and necromancers raise more. Cut through them.'},
  {id:'lich',giver:'hakon',pre:'deathguard',title:'Morvath the Lich',type:'kill',mob:'lich',n:1,xp:9000,gold:120,lvl:14,epic:true,text:'Morvath is the source of the cold. He calls down frost orbs, blasts a death nova and raises the fallen when hurt. This is a fight for a full party.'}
);

const SPAWN={x:TOWN.x*TS+16,y:(TOWN.y+4)*TS};
const xpNeed=l=>Math.round(110*Math.pow(l,1.6));
const MAXLVL=15;
const RAR=['Common','Uncommon','Rare','Epic','Legendary'];
const RARCOL=['#a8a8a8','#3dff3d','#3d8bff','#b45cff','#ff8a1a'];
const SLOTS=['weapon','armor','trinket'];
const SLOTICON={weapon:'🗡',armor:'🥋',trinket:'💍'};

/* mob spawn table: deterministic so every client agrees on ids */
const mobs=[], mobById={};
(function genSpawns(){
  const R=mulberry32(1337); let id=1;
  for(let ti=0;ti<MOBT.length;ti++){const mt=MOBT[ti];
    for(let k=0;k<mt.n;k++){
      let x,y,tries=0;
      if(mt.pos){x=mt.pos[0]*TS+16+(mt.summon?(k-1)*60:0);y=mt.pos[1]*TS+16+(mt.summon?70:0)}
      else do{ x=(3+R()*(MW-6))*TS; y=(3+R()*(MH-6))*TS; tries++;
        const tx=Math.floor(x/TS),ty=Math.floor(y/TS);
        var ok=zmap[ty*MW+tx]===mt.zone && !blocked(x,y,22) && !blocked(x,y,12) && !blocked(x,y,4) && !inTown(x,y) && Math.hypot(tx-LAIR.x,ty-LAIR.y)>10;
        if(mt.zone==='meadow') ok = ok && Math.hypot(tx-TOWN.x,ty-TOWN.y)<30 && ty<TOWN.y;
        if(ok){ const gap=tries<1500?112:tries<3000?96:70; for(const o of mobs) if(dist(o.sx,o.sy,x,y)<gap){ok=false;break} }
      }while(!ok && tries<4000);
      const lv=mt.lv[0]+Math.floor(R()*(mt.lv[1]-mt.lv[0]+1));
      const mhp=Math.round(mt.hp+mt.hpL*(lv-1));
      const m={id:id++,ti,t:mt,lv,sx:x,sy:y,x,y,rx:x,ry:y,hp:mhp,mhp,dead:false,evade:false,stunU:0,rootU:0,tgt:'',tag:'',threat:{},atk:0,wT:0,wx:x,wy:y,resp:0,breath:6,face:0,flags:0,hit:0};
      if(mt.summon){m.dead=true;m.resp=Infinity} mobs.push(m); mobById[m.id]=m;
    }
  }
})();

/* =====================================================================
   SAVE / CHARACTER
   ===================================================================== */
const SAVE_KEY='emberfall.v1';
function loadAll(){try{return JSON.parse(localStorage.getItem(SAVE_KEY))||{}}catch(e){return {}}}
function saveAll(o){try{localStorage.setItem(SAVE_KEY,JSON.stringify(o))}catch(e){}}
let saves=loadAll();
let me=null; // set on enter
function newChar(name,cls){return {name,cls,lvl:1,xp:0,gold:5,pots:3,inv:[],eq:{weapon:null,armor:null,trinket:null},qs:{},mats:{},mounts:[],mount:0,disc:[],buffs:{},migrated:1}}
function persist(){ if(!me) return; const c=me.c; const RL=rosterList(); c.id=c.id||rid(6); const i=RL.findIndex(x=>x.id===c.id); if(i<0) RL.push(c); else RL[i]=c; c.lastT=Date.now(); c.zone=zoneAtPx(me.x,me.y); saves.lastId=c.id; saveAll(saves); }

/* =====================================================================
   NETWORK (room presence)
   ===================================================================== */
const MY_U=rid(4);
let room=null, netState='connecting', joinedAt=0, myPeer=null;
const others=new Map();  // peer -> other player
const othersByU=new Map();
let hostPeer=null, amHost=true, wasHost=false;
let actSeq=0, mdSeq=0, chSeq=0, tgSeq=0; const myActs=[], myMd=[], myChat=[], myTg=[];
let lastSend=0;

function realmWs(){ let r=String(saves.realm||'').trim(); if(!r) return ''; if(/^wss?:\/\//i.test(r)) return r; let sec=/^https:\/\//i.test(r)||/\.(onrender\.com|fly\.dev|railway\.app|koyeb\.app)$/i.test(r.replace(/^https?:\/\//i,'').split('/')[0]);
  r=r.replace(/^https?:\/\//i,'').replace(/\/.*$/,''); return (sec?'wss://':'ws://')+r+'/ws'; }
function initRealmBox(){ const box=document.getElementById('realmBox'); if(!box) return; const cfg=window.EMBERFALL_CONFIG||{}; if(cfg.serverUrl||(/^https?:$/.test(location.protocol)&&!saves.realm)) return;
  box.classList.remove('hidden'); const inp=document.getElementById('realmIn'); inp.value=saves.realm||'';
  document.getElementById('realmGo').onclick=()=>{ saves.realm=inp.value.trim(); saveAll(saves); location.reload(); };
  document.getElementById('realmSolo').onclick=()=>{ delete saves.realm; saveAll(saves); location.reload(); };
  inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') document.getElementById('realmGo').click(); }; }
setTimeout(initRealmBox,0);
setTimeout(()=>{ const d=document.getElementById('dlBar'); if(!d||!/^https?:$/.test(location.protocol)||/^(127\.|localhost)/.test(location.hostname)&&location.port==='47811') return; d.classList.remove('hidden'); if(/^\/download/.test(location.pathname)){ d.classList.add('flash'); d.scrollIntoView({block:'center'}); } },0);
function makeWsRoom(){ return new Promise(resolve=>{ const cfg=window.EMBERFALL_CONFIG||{};
  const url=cfg.serverUrl||realmWs()||(/^https?:$/.test(location.protocol)?(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws':null); if(!url) return resolve(null);
  let ws=null, myId=null, conn=false, done=false, mine={}, gmWait=null; const peers=new Map(), connCbs=[]; let snap=Object.freeze([]);
  const mk=(peer,p,gm)=>Object.freeze({peer,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false,gm:!!gm,presence:Object.freeze(p||{}),updatedAt:Date.now()});
  const rebuild=()=>{ const arr=[]; if(myId) arr.push(Object.freeze({peer:myId,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false,presence:Object.freeze({...mine}),updatedAt:Date.now()})); for(const v of peers.values()) arr.push(v); snap=Object.freeze(arr); };
  const finish=r=>{ if(!done){ done=true; resolve(r); } };
  const api={ presence(patch){ for(const k in patch){ if(patch[k]===null) delete mine[k]; else mine[k]=patch[k]; } rebuild(); if(conn&&ws.readyState===1) ws.send(JSON.stringify({t:'p',p:mine})); return Promise.resolve(); },
    peers:()=>snap, onPeers:()=>()=>{}, onConnection(fn){ connCbs.push(fn); setTimeout(()=>fn(conn),0); return ()=>{}; }, connected:()=>conn,
    armory(data){ if(conn) ws.send(JSON.stringify({t:'arm',c:data})); }, gift(name,what){ if(conn) ws.send(JSON.stringify({t:'gift',name,what})); },
    bug(text){ if(conn) ws.send(JSON.stringify({t:'bug',text:String(text).slice(0,2000)})); }, admin(cmd,pid,name){ if(conn) ws.send(JSON.stringify({t:'admin',cmd,pid,name})); },
    master:false, gmGrant(pid,on){ if(conn) ws.send(JSON.stringify({t:'mkgm',pid,on:!!on})); },
    gmLogin(pw){ return new Promise(res=>{ if(!conn) return res(false); gmWait=res; ws.send(JSON.stringify({t:'gm',pw:String(pw).slice(0,200)})); setTimeout(()=>{ if(gmWait===res){ gmWait=null; res(false); } },5000); }); } };
  function open(){ try{ ws=new WebSocket(url); }catch(e){ return finish(null); }
    const to=setTimeout(()=>{ if(!conn){ try{ws.close()}catch(e){} finish(null); } },15000);
    ws.onmessage=e=>{ let d; try{ d=JSON.parse(e.data); }catch(_){ return; }
      if(d.t==='hello'){ myId=d.you; peers.clear(); for(const q of d.peers||[]) peers.set(q.peer,mk(q.peer,q.p,q.gm)); conn=true; clearTimeout(to); rebuild(); finish(api); connCbs.forEach(f=>f(true)); if(saves.gmToken) ws.send(JSON.stringify({t:'gmtok',token:saves.gmToken})); if(Object.keys(mine).length) ws.send(JSON.stringify({t:'p',p:mine})); }
      else if(d.t==='p'){ peers.set(d.peer,mk(d.peer,d.p,d.gm)); rebuild(); }
      else if(d.t==='leave'){ peers.delete(d.peer); rebuild(); }
      else if(d.t==='gm'){ if(d.master) api.master=true; if(d.token){ saves.gmToken=d.token; saveAll(saves); } if(d.forget){ delete saves.gmToken; saveAll(saves); } if(gmWait){ const r=gmWait; gmWait=null; r(!!d.ok); }
        else if(d.ok&&d.master&&!isGM){ setGM(true,'master'); if(me) sysMsg('Welcome back, realm owner. Your Game Master tools are ready (/gm).','c-gm'); }
        else if(d.granted&&!isGM){ setGM(true,'server'); sysMsg('The realm owner made you a Game Master. Type /gm for your tools.','c-gm'); }
        else if(d.revoked&&isGM){ setGM(false); gm.god=gm.nocd=gm.fly=gm.invis=false; gm.speed=1; sysMsg('Your Game Master powers were removed.','c-err'); sendPresence(true); } }
      else if(d.t==='gift'&&typeof d.what==='string'){ applyGift(d.what,d.from||'the Realm'); }
      else if(d.t==='sys'){ sysMsg(String(d.msg||'').slice(0,200),'c-err'); } };
    ws.onclose=()=>{ clearTimeout(to); const was=conn; conn=false; peers.clear(); rebuild(); if(!done) return finish(null); if(was) connCbs.forEach(f=>f(false)); if(isGM&&gmSrc==='server') setGM(false); setTimeout(open,3000); };
    ws.onerror=()=>{}; }
  open(); }); }
async function connectRoom(){
  const cfg=window.EMBERFALL_CONFIG||{}; let tries=0;
  while(!(window.claude && typeof window.claude.use==='function') && tries<4){await new Promise(r=>setTimeout(r,150));tries++}
  if(window.claude && typeof window.claude.use==='function'){
    window.claude.use('user').then(async u=>{ if(!u) return; let ok=false; try{ ok=!!(await u.isOwner()); }catch(e){} if(!ok) try{ ok=!!(await u.canEdit()); }catch(e){} if(ok) setGM(true,'owner'); }).catch(()=>{});
    try{ room=await window.claude.use('room'); }catch(e){ room=null; } }
  if(!room && cfg.multiplayer!==false && (/^https?:$/.test(location.protocol)||saves.realm||cfg.serverUrl)) room=await makeWsRoom();
  if(!room){ netState='solo'; if(cfg.soloGM===true||(cfg.soloGM==='file'&&location.protocol==='file:')) setGM(true,'solo'); updateRealm(); return }
  joinedAt=now(); netState='online';
  try{
    room.onPeers(()=>{}, ()=>{room=null;netState='solo';updateRealm()});
    room.onConnection(c=>{ if(room) {netState=c?'online':'reconnecting'; updateRealm();} }, ()=>{room=null;netState='solo';updateRealm()});
  }catch(e){room=null;netState='solo'}
  updateRealm();
}
function peerList(){ if(!room) return []; try{return room.peers()}catch(e){return []} }
function SOLO_WHY(){ if(location.protocol==='file:') return 'You are playing solo. To play online, enter the realm address your host gave you on the start screen (or run the server: see README).';
  if(typeof makeWsRoom==='function') return 'Could not reach the realm server, so you are playing solo. Check the realm address on the start screen (or that server.js is running), then try again.';
  return 'Multiplayer is not available in this view, so you are playing solo. Open the game from its own link in a web browser (signed in to Claude) to play with others.'; }
function countOnline(){ let n=me?1:0; for(const o of others.values()) if(seenO(o)) n++; return n; }
function updateRealm(){
  const el=document.getElementById('realmStatus');
  let n=0; for(const p of peerList()) if(!p.sameTab && p.presence && p.presence.v===VERSION) n++;
  if(netState==='solo') el.innerHTML='<span class="dot solo"></span>Solo realm — no multiplayer server found (run: node server.js)';
  else if(netState==='connecting') el.innerHTML='<span class="dot"></span>Contacting realm…';
  else el.innerHTML=`<span class="dot on"></span>Realm online · ${n} adventurer${n===1?'':'s'} in the world`;
  const nl=document.getElementById('netline');
  if(nl) nl.innerHTML = netState==='solo' ? '<span class="dot solo"></span>Solo' : `<span class="dot ${netState==='online'?'on':''}"></span>${countOnline()} online${amHost?' · world host':''}`;
}
setInterval(updateRealm,2000);

function pushAct(kind,tgt,amt,vis,x,y){ // kinds: 0 dmg mob,1 heal,2 stun,3 taunt,4 hot,5 root,6 visual,7 absorb
  const a=[++actSeq,kind,tgt,Math.round(amt||0),vis||0]; if(x!==undefined){ a.push(Math.round(x),Math.round(y||0)); }
  myActs.push(a); if(myActs.length>18) myActs.shift();
  if(amHost && kind!==6 && kind!==7) hostApplyAct(MY_U,me.c.cls,a);
  return a;
}
function pushMd(u,amt,mobId,vis){ const a=[++mdSeq,u,Math.round(amt),mobId,vis||0]; myMd.push(a); if(myMd.length>16) myMd.shift();
  if(u===MY_U) mobHitsMe(a); else visualMobHit(mobById[mobId],u,vis); }
function pushTg(x,y,r,dur,kind){ const a=[++tgSeq,Math.round(x),Math.round(y),Math.round(r),Math.round(dur*1000),kind]; myTg.push(a); if(myTg.length>8) myTg.shift(); addTel(a); return a; }
function packMobs(){ const t=now(); const ps=[]; if(me) ps.push([me.x,me.y]); for(const o of others.values()) ps.push([o.x,o.y]);
  const out=[]; for(const m of mobs){ if(!m.tgt&&!ps.some(p=>Math.abs(p[0]-m.x)<1700&&Math.abs(p[1]-m.y)<1700)) continue;
    if(m.dead){ out.push([m.id]); continue; } const fl=(m.stunU>t?2:0)|(m.rootU>t?4:0)|(m.evade?8:0)|(m.enr?16:0);
    if(m.hp>=m.mhp && !fl && !m.tgt && !m.tag) out.push([m.id,Math.round(m.x),Math.round(m.y)]);
    else out.push([m.id,Math.round(m.x),Math.round(m.y),Math.max(0,Math.round(m.hp)),fl,m.tgt||'',m.tag||'']); } return out; }

function sendPresence(force){
  if(!room||!me) return; const t=now(); if(!force && t-lastSend<.1) return; lastSend=t;
  const p={v:VERSION,u:MY_U,n:me.c.name,c:me.c.cls,l:me.c.lvl,x:Math.round(me.x),y:Math.round(me.y),f:+me.face.toFixed(2),
    hp:Math.round(me.hp),mhp:me.mhp,d:me.dead?1:0,pt:me.party||'',mt:me.mounted||null,em:me.emote?me.emote.k:null,wr:me.c.eq.weapon?me.c.eq.weapon.rar:0,ar:me.c.eq.armor?me.c.eq.armor.rar:0,gv:myGearVis(),
    b:(me.bulwark>t?1:0)|(me.hots.length?2:0)|(me.cast?4:0)|(me.absorb>0&&me.absorbU>t?8:0)|(me.rootU>t?16:0)|(me.dots.length?32:0)|(me.avatarU>t?64:0),
    z:zoneAtPx(me.x,me.y), gm:isGM?1:null, pid:MY_PID, iv:gm.invis?1:null, cs:cosBits()||null, ti:myTitle()||null, own:isRealmOwner()?1:null, au:gm.aura&&isGM&&!gm.invis?1:null, gl:isRealmOwner()&&(saves.gmGrants||[]).length?saves.gmGrants.map(g=>g.gid||g.pid).slice(0,20):null,
    inv:myInv, ir:myIr, kk:myKick, pl:me.party&&amLeader()?1:null, cn:me.cast&&!me.cast.node?[String(me.cast.ab.name||'').slice(0,24),Math.round(clamp((t-me.cast.t0)/me.cast.dur,0,1)*100),Math.round(me.cast.dur*1000)]:null, a:myActs.slice(-18), ch:myChat.slice(-3),
    w: amHost? packMobs(): null, md: amHost? myMd.slice(-16): null, tg: amHost? myTg.slice(-8): null, hs: amHost?1:null };
  let s=JSON.stringify(p);
  while(s.length>3900 && p.ch.length){p.ch.shift();s=JSON.stringify(p)}
  while(s.length>3900 && p.a.length>4){p.a.shift();s=JSON.stringify(p)}
  if(s.length>4000) return;
  room.presence(p).catch(()=>{});
}

function syncPeers(){
  const t=now(); const list=peerList(); const seen=new Set(); const cand=[];
  for(const p of list){ if(p.sameTab){myPeer=p.peer;continue}
    if(p.presence&&p.presence.v>VERSION&&!window.__newVer){ window.__newVer=1; setTimeout(()=>{ sysMsg('A newer version of Emberfall is available. Refresh the page to update.','c-err'); toast('New version available — refresh to update','small'); },500); }
    if(p.kind!=='viewer'||!p.presence||p.presence.v!==VERSION||!p.presence.u) continue; cand.push(p.peer); }
  const mine=myPeer||'~';
  const claim=[]; for(const p of list){ if(!p.sameTab && cand.includes(p.peer) && p.presence.hs) claim.push(p.peer); }
  const graceOver=!room||t-joinedAt>1.6; const lowest=a=>a.reduce((x,y)=>y<x?y:x);
  if(!room){ amHost=true; hostPeer=null; }
  else if(!me){ amHost=cand.length===0; hostPeer=claim.length?lowest(claim):cand.length?lowest(cand):null; }
  else { let pool=claim.slice(); if(amHost) pool.push(mine); if(!pool.length){ pool=cand.slice(); pool.push(mine); }
    const low=lowest(pool); amHost=low===mine&&(graceOver||amHost); hostPeer=low===mine?null:low; }
  if(amHost && !wasHost){ for(const m of mobs){ m.threat={}; if(m.tgt) m.threat[m.tgt]=10; } }
  wasHost=amHost;

  for(const p of list){
    if(p.sameTab||p.kind!=='viewer') continue; const pr=p.presence; if(!pr||pr.v!==VERSION||!pr.u) continue;
    seen.add(p.peer);
    let o=others.get(p.peer);
    if(!o){ o={peer:p.peer,u:pr.u,rx:pr.x,ry:pr.y,last:null,aSeq:null,mSeq:null,gSeq:null,cSeq:null,bubble:'',bubbleT:0,isNew:true,swingT:0,spinT:0}; others.set(p.peer,o); }
    if(o.u!==pr.u){othersByU.delete(o.u); o.u=pr.u}
    othersByU.set(o.u,o);
    if(o.last===pr) continue; o.last=pr;
    o.n=clean(pr.n).slice(0,14)||'Stranger'; o.c=CLS[pr.c]?pr.c:'warden'; o.l=clamp(pr.l|0,1,MAXLVL);
    o.x=+pr.x||0;o.y=+pr.y||0;o.f=+pr.f||0;o.hp=+pr.hp||0;o.mhp=Math.max(1,+pr.mhp||1);o.d=!!pr.d;
    o.wr=clamp(pr.wr|0,0,4); o.ar=clamp(pr.ar|0,0,4); o.gv=parseGV(pr.gv); o.pid=typeof pr.pid==='string'?pr.pid.slice(0,16):''; o.cs=pr.cs|0; o.ti=typeof pr.ti==='string'?clean(pr.ti).slice(0,20):''; o.own=!!pr.own&&!!pr.gm; o.au=!!pr.au&&!!pr.gm; o.iv=!!pr.iv; o.pl=!!pr.pl; if(Array.isArray(pr.cn)){ const nm=clean(pr.cn[0]).slice(0,24); if(!o.cast||o.cast.nm!==nm||Math.abs((pr.cn[1]|0)-o.cast.p0)>15&&(pr.cn[1]|0)<o.cast.p0) o.cast={nm,p0:clamp(pr.cn[1]|0,0,100),t0:t,dur:clamp(+pr.cn[2]||1000,200,10000)/1000}; } else o.cast=null; o.pt=clean(pr.pt).slice(0,20); o.gm=!!pr.gm&&(p.gm===undefined||!!p.gm); o.b=pr.b|0; o.wr=clamp(pr.wr|0,0,4); o.ar=clamp(pr.ar|0,0,3); o.mt=clamp(pr.mt|0,0,MOUNTS.length-1); { const ek=EMOTES[pr.em]?pr.em:''; if(ek!==(o.emk||'')){ o.emk=ek; o.emote=ek?{k:ek,t0:t}:null; if(ek&&me) chatLine(`${o.n} ${EMOTES[ek]}`,'c-say'); } } o.z=ZONES[pr.z]?pr.z:'meadow'; o.seenAt=t;
    if(o.isNew){ o.isNew=false; o.rx=o.x; o.ry=o.y; if(me&&seenO(o)) sysMsg(`${o.n} the ${CLS[o.c].name} has entered Emberfall.`); }
    else if(o.wasVis!==undefined&&o.wasVis!==seenO(o)&&me) sysMsg(seenO(o)?`${o.n} the ${CLS[o.c].name} has entered Emberfall.`:`${o.n} has left the realm.`); o.wasVis=seenO(o);
    partyNet(o,pr);
    const acts=Array.isArray(pr.a)?pr.a:[];
    if(o.aSeq===null){ let mx=-1; for(const a of acts) if(Array.isArray(a)) mx=Math.max(mx,a[0]|0); o.aSeq=mx; }
    else { let mx=o.aSeq; for(const a of acts){ if(!Array.isArray(a)||(a[0]|0)<=o.aSeq) continue; mx=Math.max(mx,a[0]|0); handleRemoteAct(o,a); } o.aSeq=mx; }
    const isHost = p.peer===hostPeer && pr.hs;
    if(isHost){
      const md=Array.isArray(pr.md)?pr.md:[];
      if(o.mSeq===null){ let mx=-1; for(const a of md) mx=Math.max(mx,a[0]|0); o.mSeq=mx; }
      else for(const a of md){ if(!Array.isArray(a)||(a[0]|0)<=o.mSeq) continue; o.mSeq=a[0]|0;
        if(a[1]===MY_U) mobHitsMe(a); else visualMobHit(mobById[a[3]],a[1],a[4]|0); }
      const tg=Array.isArray(pr.tg)?pr.tg:[];
      if(o.gSeq===null){ let mx=-1; for(const a of tg) mx=Math.max(mx,a[0]|0); o.gSeq=mx; }
      else for(const a of tg){ if(!Array.isArray(a)||(a[0]|0)<=o.gSeq) continue; o.gSeq=a[0]|0; if(!amHost) addTel(a); }
      if(Array.isArray(pr.w) && !amHost) applySnapshot(pr.w);
    } else { o.mSeq=null; o.gSeq=null; }
    const ch=Array.isArray(pr.ch)?pr.ch:[];
    if(o.cSeq===null){ let mx=-1; for(const c of ch) mx=Math.max(mx,c[0]|0); o.cSeq=mx; }
    else for(const c of ch){ if(!Array.isArray(c)||(c[0]|0)<=o.cSeq) continue; o.cSeq=c[0]|0;
      const party=c[1]===1, txt=clean(c[2]).slice(0,120); if(!txt) continue;
      if(c[1]===2&&o.gm){ const art=room&&typeof room.emit==='function'; if(!art||(lastGrant&&lastGrant.pids.includes(o.pid+':'+o.n.toLowerCase()))) gmAnnounceShow(o.n,txt,art?'gm':(o.own?'owner':'gm')); continue; }
      if(party && (!me||!me.party||o.pt!==me.party)) continue;
      chatLine(txt, party?'c-party':'c-say', party?'[Party] ':'', {n:o.n,col:CLS[o.c].col,gm:o.gm&&isGM}); o.bubble=txt; o.bubbleT=t+6; }
  }
  for(const [peer,o] of others) if(!seen.has(peer)){ others.delete(peer); if(othersByU.get(o.u)===o) othersByU.delete(o.u); if(me&&seenO(o)) sysMsg(`${o.n} has left the realm.`);
    if(me&&me.target&&me.target.kind==='p'&&me.target.id===o.u) me.target=null; }
}
function handleRemoteAct(o,a){
  const kind=a[1],tgt=a[2],amt=a[3]|0,vis=a[4]|0;
  if(amHost && kind!==6 && kind!==7) hostApplyAct(o.u,o.c,a);
  if(me && !me.dead && tgt===MY_U){
    if(kind===1 && amt>0) healMe(amt,o.n);
    if(kind===4){ me.hots=me.hots.filter(h=>h.src!==o.u); me.hots.push({src:o.u,amt,left:5,next:now()+2}); }
    if(kind===7){ me.absorb=amt; me.absorbU=now()+12; sysMsg(`${o.n} shields you with Aegis.`,'c-party'); }
  }
  if(kind===0 && vis===0) o.swingT=now();
  if(kind===6 && vis===10) o.spinT=now();
  visualAct({x:o.rx,y:o.ry,u:o.u},a,false);
}
function applySnapshot(w){
  const t=now();
  for(const s of w){ if(!Array.isArray(s)) continue; const m=mobById[s[0]]; if(!m) continue;
    const wasDead=m.dead;
    if(s.length===1){ if(!wasDead){ m.dead=true; m.tgt=''; onMobDeath(m); } continue; }
    m.x=+s[1]; m.y=+s[2];
    let hp=m.mhp,fl=0,tg='',tag='';
    if(s.length>=7){ hp=+s[3]; fl=s[4]|0; tg=String(s[5]||''); tag=String(s[6]||''); }
    if(hp<m.hp && !wasDead) m.hit=t;
    m.hp=hp; m.dead=false; m.flags=fl; m.evade=!!(fl&8); m.enr=!!(fl&16);
    m.stunU=fl&2?t+.2:0; m.rootU=fl&4?t+.2:0; m.tgt=tg; m.tag=tag;
    if(wasDead){ m.rx=m.x; m.ry=m.y; m.spawnT=t; }
  }
}

/* =====================================================================
   HOST: monster simulation
   ===================================================================== */
function alivePlayers(){
  const arr=[]; if(me&&!me.dead&&!gm.invis) arr.push({u:MY_U,x:me.x,y:me.y,l:me.c.lvl});
  for(const o of others.values()) if(!o.d&&!o.iv) arr.push({u:o.u,x:o.x,y:o.y,l:o.l});
  return arr;
}
function hostApplyAct(u,cls,a){
  const kind=a[1],tgt=a[2],amt=a[3]|0; const t=now();
  if(kind===0||kind===2||kind===3||kind===5){
    const m=mobById[tgt]; if(!m||m.dead||m.evade) return;
    if(!m.tag) m.tag=u;
    if(kind===0){ m.hp-=amt; m.hit=t; m.threat[u]=(m.threat[u]||0)+amt*(cls==='warden'?2.4:1)+1; if(m.hp<=0){ m.hp=0; killMob(m); } }
    else if(kind===2){ m.stunU=t+amt/1000/(m.t.boss?3:1); m.threat[u]=(m.threat[u]||0)+20; }
    else if(kind===3){ let mx=0; for(const k in m.threat) mx=Math.max(mx,m.threat[k]); m.threat[u]=mx+60; m.tgt=u; }
    else if(kind===5){ if(!m.t.boss) m.rootU=t+amt/1000; m.threat[u]=(m.threat[u]||0)+10; }
  } else if(kind===1||kind===4){
    for(const m of mobs) if(!m.dead && (m.tgt===tgt || m.threat[tgt])) m.threat[u]=(m.threat[u]||0)+amt*.5;
  }
}
function killMob(m){ m.dead=true; m.resp=m.t.summon?Infinity:now()+(m.t.resp||(38+Math.random()*17)); m.tgt=''; m.threat={};
  if(m.t.boss) despawnAdds(m.t.key); onMobDeath(m); }
function despawnAdds(key){ for(const a of mobs) if(a.t.summon && !a.dead && (!key||a.t.owner===key)){ a.dead=true; a.resp=Infinity; a.tgt=''; a.threat={}; a.deathT=now(); a.dx=a.rx; a.dy=a.ry; } }
function respawnMob(m){ m.dead=false; m.x=m.sx; m.y=m.sy; m.rx=m.x; m.ry=m.y; m.hp=m.mhp; m.tag=''; m.threat={}; m.tgt=''; m.evade=false; m.enr=false; m.summoned=false; m.summoned2=false; m.spT=null; m.chanU=0; m.spawnT=now(); }
function summonAdds(boss){ let i=0; for(const a of mobs) if(a.t.summon&&a.t.owner===boss.t.key){ const an=i++*2.1; respawnMob(a);
  a.x=a.rx=a.sx=boss.x+Math.cos(an)*80; a.y=a.ry=a.sy=boss.y+Math.sin(an)*80; a.threat={...boss.threat}; a.tag=boss.tag; }
  pushTg(boss.x,boss.y,110,.6,5); }
const hostTels=[];
const mobDmg=m=>m.t.dmg+m.t.dmgL*(m.lv-1);
function hostTel(m,x,y,r,delay,mul,kind,after){ pushTg(x,y,r,delay,kind); hostTels.push({m,x,y,r,at:now()+delay,dmg:mobDmg(m)*mul,after}); }
function mobSpecial(m,p,players,dt,t){
  const sp=m.t.sp; if(!sp) return;
  if(m.spT==null) m.spT=(sp.cd||7)*.5;
  m.spT-=dt; if(m.spT>0) return;
  const d=dist(m.x,m.y,p.x,p.y);
  switch(sp.k){
    case 'leap': if(d>45&&d<320){ m.spT=sp.cd; const tx=p.x,ty=p.y; m.chanU=t+sp.delay;
      hostTel(m,tx,ty,sp.r,sp.delay,sp.mul,1,()=>{ if(!m.dead&&!m.evade&&!blocked(tx,ty,m.t.r*.7)){ m.x=tx; m.y=ty; } }); } else m.spT=1; break;
    case 'slam': if(d<sp.r*.9){ m.spT=sp.cd; m.chanU=t+sp.delay; hostTel(m,m.x,m.y,sp.r,sp.delay,sp.mul,2); } else m.spT=1; break;
    case 'root': if(d<sp.rng){ m.spT=sp.cd; pushMd(p.u,mobDmg(m)*.5,m.id,5); } else m.spT=1; break;
    case 'poison': if(d<260){ m.spT=sp.cd; pushMd(p.u,mobDmg(m)*.6,m.id,6); } else m.spT=1; break;
    case 'drain': if(d<m.t.rng+12){ m.spT=sp.cd; const dm=mobDmg(m)*1.2; pushMd(p.u,dm,m.id,8); m.hp=Math.min(m.mhp,m.hp+dm); } else m.spT=1; break;
    case 'lich': { m.phase=(m.phase||0)+1; m.spT=m.enr?4.5:6.5; const pick=m.phase%3;
      if(pick===1){ for(const q of players) if(dist(q.x,q.y,m.x,m.y)<650) hostTel(m,q.x,q.y,80,1.6,1.0,6); }
      else if(pick===2){ m.chanU=t+1.8; hostTel(m,m.x,m.y,175,1.8,1.3,7); }
      else { const q=players[Math.floor(Math.random()*players.length)]; if(q) pushMd(q.u,mobDmg(m)*.7,m.id,5); }
      break; }
    case 'wyrm': {
      m.phase=(m.phase||0)+1; m.spT=m.enr?5:7; const pick=m.phase%3;
      if(pick===1){ const a=Math.atan2(p.y-m.y,p.x-m.x); m.face=a; m.chanU=t+1.6; hostTel(m,m.x+Math.cos(a)*125,m.y+Math.sin(a)*125,150,1.6,1.5,3); }
      else if(pick===2){ for(const q of players) if(dist(q.x,q.y,m.x,m.y)<520) hostTel(m,q.x+(Math.random()-.5)*30,q.y+(Math.random()-.5)*30,74,1.5,.9,4); }
      else { m.chanU=t+1.3; hostTel(m,m.x,m.y,125,1.3,1.1,2); }
      break; }
  }
}
function hostSim(dt){
  const t=now(); const players=alivePlayers(); const pmap={}; for(const p of players) pmap[p.u]=p;
  for(let i=hostTels.length-1;i>=0;i--){ const h=hostTels[i]; if(t<h.at) continue; hostTels.splice(i,1);
    if(h.m.dead||h.m.evade) continue;
    for(const p of players) if(dist(p.x,p.y,h.x,h.y)<h.r+6) pushMd(p.u,h.dmg*(.9+Math.random()*.2),h.m.id,7);
    if(h.after) h.after(); }
  for(const m of mobs){
    const mt=m.t;
    if(m.dead){ if(t>=m.resp) respawnMob(m); continue; }
    if(m.evade){ const d=dist(m.x,m.y,m.sx,m.sy); m.hp=Math.min(m.mhp,m.hp+m.mhp*dt*.5);
      if(d<8){ m.evade=false; m.hp=m.mhp; m.tag=''; m.enr=false; m.summoned=false; }
      else { const s=mt.spd*1.8*dt/d; m.face=Math.atan2(m.sy-m.y,m.sx-m.x); m.x+=(m.sx-m.x)*Math.min(1,s); m.y+=(m.sy-m.y)*Math.min(1,s); }
      continue; }
    for(const k in m.threat) if(!pmap[k]) delete m.threat[k];
    for(const p of players){ if(m.threat[p.u]) continue; const ag=mt.aggro*(p.l>m.lv+4?.5:1);
      if(dist(p.x,p.y,m.x,m.y)<ag && !inTown(p.x,p.y)) m.threat[p.u]=1; }
    let best='',bv=-1; for(const k in m.threat) if(m.threat[k]>bv){bv=m.threat[k];best=k}
    if(m.tgt && pmap[m.tgt] && m.threat[m.tgt]>0 && m.threat[m.tgt]*1.1>=bv) best=m.tgt;
    m.tgt=best;
    if(!best && (m.tag||m.hp<m.mhp)){ m.tag=''; m.hp=m.mhp; m.enr=false; if(mt.boss){ m.summoned=false; m.summoned2=false; despawnAdds(mt.key); } }
    m.atk-=dt;
    if(best){
      const p=pmap[best];
      if(dist(m.x,m.y,m.sx,m.sy)>(mt.boss?820:700) || inTown(p.x,p.y)){ m.evade=true; m.threat={}; m.tgt=''; if(mt.boss) despawnAdds(mt.key); continue; }
      const d=dist(m.x,m.y,p.x,p.y);
      const stunned=m.stunU>t, rooted=m.rootU>t, chan=m.chanU>t;
      if(!stunned && !chan) m.face=Math.atan2(p.y-m.y,p.x-m.x);
      if(d>mt.rng-6 && !stunned && !rooted && !chan){ const s=mt.spd*(m.enr?1.2:1)*dt; moveEnt(m,(p.x-m.x)/d*s,(p.y-m.y)/d*s,mt.r*.7); }
      if(d<=mt.rng+4 && m.atk<=0 && !stunned && !chan){
        m.atk=mt.as*(m.enr?.65:1); const dmg=mobDmg(m)*(.85+Math.random()*.3);
        pushMd(best,dmg,m.id,mt.ranged?(mt.proj||2):mt.boss?3:1); m.swingT=t;
      }
      if(!stunned && !chan) mobSpecial(m,p,players,dt,t);
      if(mt.key==='wyrm'){ if(!m.summoned && m.hp<m.mhp*.5){ m.summoned=true; summonAdds(m); } if(!m.enr && m.hp<m.mhp*.25) m.enr=true; }
      if(mt.key==='lich'){ if(!m.summoned&&m.hp<m.mhp*.66){ m.summoned=true; summonAdds(m); } if(!m.summoned2&&m.hp<m.mhp*.33){ m.summoned2=true; summonAdds(m); } if(!m.enr&&m.hp<m.mhp*.15) m.enr=true; }
    } else {
      m.wT-=dt;
      if(m.wT<=0){ m.wT=3+Math.random()*5; const a=Math.random()*6.28, r=Math.random()*(mt.boss?40:70); m.wx=m.sx+Math.cos(a)*r; m.wy=m.sy+Math.sin(a)*r; }
      const d=dist(m.x,m.y,m.wx,m.wy); if(d>4){ const s=mt.spd*.35*dt; m.face=Math.atan2(m.wy-m.y,m.wx-m.x); moveEnt(m,(m.wx-m.x)/d*s,(m.wy-m.y)/d*s,mt.r*.7); }
    }
  }
}

/* =====================================================================
   PLAYER
   ===================================================================== */
function gearStats(c){ let pow=0,sta=0; for(const s of SLOTS){const it=c.eq[s]; if(it){const u=1+.15*(it.up||0); pow+=Math.round(it.pow*u); sta+=Math.round(it.sta*u);}} return {pow,sta}; }
function recalc(){ const c=me.c, cl=CLS[c.cls]; const g=gearStats(c);
  me.pow=g.pow; me.sta=g.sta;
  me.mhp=Math.round((cl.hp+cl.hpL*(c.lvl-1)+g.sta*8)*(buffOn('fort')?1.25:1));
  me.mres= cl.res==='rage'?100:Math.round(100+22*(c.lvl-1)+g.sta*2);
  me.hp=Math.min(me.hp??me.mhp,me.mhp); me.res=Math.min(me.res??me.mres,me.mres);
}
const costOf=ab=> CLS[me.c.cls].res==='rage'? ab.cost : Math.round(ab.cost*(1+.22*(me.c.lvl-1)));
const scaleV=v=>(v[0]+v[1]*(me.c.lvl-1)+me.pow*.8)*(buffOn('might')?1.2:1)*(me.c.eq.weapon&&me.c.eq.weapon.rar===4?1.1:1)*(me.avatarU>now()?1.4:1);
function enterWorld(name,cls,existing,fresh){
  try{ audInit(); }catch(e){}
  const RL=rosterList(); let c=existing||(!fresh&&RL.find(x=>x.name===name&&x.cls===cls)); if(!c){ c=newChar(name,cls); c.id=rid(6); c.created=Date.now(); RL.push(c); } migrateChar(c);
  me={c,x:SPAWN.x,y:SPAWN.y,face:-Math.PI/2,hp:null,res:null,dead:false,target:null,cast:null,gcd:0,cds:{},auto:false,autoT:0,
    bulwark:0,hots:[],mounted:0,emote:null,jumpH:0,jumpV:0,absorb:0,absorbU:0,rootU:0,dots:[],dash:null,swingT:0,spinT:0,stepT:0,lastCombat:-99,lastSpend:-99,potCd:0,party:saves.party||'',moving:false,zone:'',tabIdx:0};
  recalc(); me.hp=me.mhp; me.res=CLS[cls].res==='rage'?0:me.mres;
  persist();
  document.getElementById('login').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  buildBar(); renderInv(); renderTracker(); renderBuffs();
  sysMsg(`Welcome to Emberfall, ${name}. Press H for help. Talk to Captain Oriel (F) for your first quest.`);
  if(netState==='solo') sysMsg(SOLO_WHY(),'c-err');
  if(me.party) sysMsg(`You rejoined the party "${me.party}".`);
  if(saves.pendingGifts&&saves.pendingGifts.length){ const G=saves.pendingGifts; saves.pendingGifts=[]; saveAll(saves); setTimeout(()=>G.forEach(g=>applyGift(g,'the Realm')),1500); }
  setTimeout(()=>armorySync(true),3000);
  applyOwner(); if(isGM){ sysMsg('You are a Game Master. Type /gm or press the GM button for your tools.','c-gm'); $('gmBtn').classList.remove('hidden'); } else $('gmBtn').classList.add('hidden');
  sendPresence(true);
}
function inCombat(){ const t=now(); if(t-me.lastCombat<5) return true; for(const m of mobs) if(!m.dead&&m.tgt===MY_U) return true; return false; }
function mobHitsMe(a){ const mob=mobById[a[3]], vis=a[4]|0; takeDamage(Math.max(0,a[2]|0),mob,vis);
  if(!me||me.dead) return;
  if(vis===5){ me.rootU=now()+2; err('Entangled!'); }
  if(vis===6){ me.dots=me.dots.filter(d=>d.src!==a[3]); me.dots.push({src:a[3],amt:Math.max(1,Math.round(a[2]*.35)),left:4,next:now()+1.5}); err('Poisoned!'); }
}
function takeDamage(amt,mob,vis){
  if(!me||me.dead) return; if(gm.god){ if(mob) visualMobHit(mob,MY_U,vis||0,true); return; } const cl=CLS[me.c.cls]; let d=amt*cl.mit; if(me.bulwark>now()) d*=.5; if(buffOn('ward')) d*=.85; if(me.avatarU>now()) d*=.7; if(me.mounted) dismount(); d=Math.max(1,Math.round(d));
  let absorbed=0; if(me.absorb>0 && me.absorbU>now()){ absorbed=Math.min(me.absorb,d); me.absorb-=absorbed; d-=absorbed; }
  me.hp-=d; me.lastCombat=now(); if(cl.res==='rage') me.res=Math.min(100,me.res+(d+absorbed)/2.5);
  if(d>0) fct(me.x,me.y-24,'-'+d,'#ff5a4a',true);
  if(absorbed) fct(me.x+16,me.y-38,'('+absorbed+' absorbed)','#9fd8ff');
  if(mob) visualMobHit(mob,MY_U,vis||0,true);
  hurtFlash=Math.min(1,hurtFlash+d/me.mhp*3); if(d>me.mhp*.12) shake(6);
  if(me.cast && !me.cast.pushed){ me.cast.t0+=.25; me.cast.pushed=true; }
  if(me.hp<=0){ me.hp=0; die(); }
}
function healMe(amt,from){ if(me.dead) return; const before=me.hp; me.hp=Math.min(me.mhp,me.hp+amt); const h=Math.round(me.hp-before);
  if(h>0) fct(me.x,me.y-30,'+'+h,'#6dff7a'); sparkle(me.x,me.y,'#9dffb0'); }
function die(){ stat('deaths',1); me.dead=true; me.cast=null; me.mounted=0; me.emote=null; me.auto=false; me.hots=[]; me.dots=[]; me.dash=null; me.absorb=0; document.getElementById('deathWin').classList.remove('hidden'); sysMsg('You have died.','c-err'); sendPresence(true); }
function release(){ me.dead=false; me.x=SPAWN.x; me.y=SPAWN.y; me.rootU=0; me.hp=Math.round(me.mhp*.7); me.res=CLS[me.c.cls].res==='rage'?0:me.mres*.7; document.getElementById('deathWin').classList.add('hidden'); me.target=null; sparkle(me.x,me.y,'#fff3b0'); sendPresence(true); }
function gainXp(n){
  const c=me.c; if(c.lvl>=MAXLVL){ return; }
  c.xp+=n; chatLine(`You gain ${n} experience.`,'c-xp');
  while(c.lvl<MAXLVL && c.xp>=xpNeed(c.lvl)){ c.xp-=xpNeed(c.lvl); c.lvl++; recalc(); me.hp=me.mhp; if(CLS[c.cls].res==='mana') me.res=me.mres;
    toast(`Level ${c.lvl}!`); sfx('level'); setTimeout(()=>armorySync(true),500); if(c.lvl===3&&!c.mounts.length){ setTimeout(()=>toast('Mounts unlocked! Visit Hilde the Stable Master','small'),900); sysMsg('You can now ride! Hilde the Stable Master in Hearthmere sells mounts. Look for the golden horseshoe on your map.'); renderTracker(); } burst(me.x,me.y,'#ffd66a',40,200,{glow:true}); for(const ab of curAbils()) if(ab.lvl===c.lvl) { sysMsg(`New ability learned: ${ab.name} (key ${curAbils().indexOf(ab)+1})`); toast('New ability: '+ab.name,'small'); } sysMsg(`You have reached level ${c.lvl}. Your power grows.`); ring(me.x,me.y,'#ffd66a',90); }
  if(c.lvl>=MAXLVL) c.xp=0;
  persist();
}

/* ---------- items ---------- */
const BASES={weapon:['Longsword','Warstaff','Spellblade','Morningstar','Wand','Greataxe'],armor:['Jerkin','Robes','Hauberk','Brigandine','Vestments','Mantle'],trinket:['Charm','Signet','Talisman','Locket','Idol']};
const PRE=[['Worn','Rough','Plain','Dented'],['Sturdy','Keen','Hunter\'s','Tempered'],['Gleaming','Runed','Vaelborn','Moonlit'],['Emberforged','Wyrmscale','Cinderheart']];
const SUF=['of the Hollow','of Cinders','of the Mire','of Dawnlight','of the Wolf','of Embers'];
const LEGEND={
  warden:{name:'Dawnwarden, Oath of the Last Wall',desc:'Forged from the gate of a kingdom that never fell. +10% damage and threat.',pow:62,sta:58},
  mender:{name:'Solace, Staff of the Undying Sun',desc:'A shard of the first dawn burns in its crown. +10% healing and damage.',pow:58,sta:60},
  arcanist:{name:'Cinderheart, Focus of the Wyrm',desc:'The still-beating heart of an elder wyrm, bound in mithril. +10% spell damage.',pow:68,sta:48}};
function legendaryFor(cls){ const L=LEGEND[cls]||LEGEND.warden; return {id:rid(6),slot:'weapon',name:L.name,rar:4,pow:L.pow,sta:L.sta,lv:15,val:400,leg:cls,desc:L.desc}; }
// drop chances in % per rarity [common, uncommon, rare, epic, legendary]; the legendary is always for the looter's class
const BOSSLOOT={oldtusk:{n:1,p:[55,40,5,0,0]},fangmaw:{n:1,p:[0,55,40,5,0]},hking:{n:1,p:[0,20,65,15,0]},wyrm:{n:2,p:[0,0,60,38,2]},frostgiant:{n:2,p:[0,0,45,52,3]},lich:{n:2,p:[0,0,0,92,8]}};
function rollRar(p){ let r=Math.random()*100; for(let i=0;i<p.length;i++){ r-=p[i]; if(r<0) return i; } return p.findIndex(v=>v>0); }
function dropText(key){ const B=BOSSLOOT[key]; if(!B) return ''; return B.p.map((v,i)=>v?`${RAR[i]} ${v}%`:'').filter(Boolean).join(' · '); }
function genItem(lv,rar){ if(rar>=4) return legendaryFor(me?me.c.cls:'warden');
  const R=Math.random, slot=SLOTS[R()*3|0];
  const budget=(2.2+lv*1.7)*[1,1.45,2,2.8,3.8][rar];
  const pf=[.72,.25,.5][SLOTS.indexOf(slot)];
  const pow=Math.max(0,Math.round(budget*pf)), sta=Math.max(1,Math.round(budget*(1-pf)));
  let name=PRE[rar][R()*PRE[rar].length|0]+' '+BASES[slot][R()*BASES[slot].length|0]; if(rar>=2) name+=' '+SUF[R()*SUF.length|0];
  return {id:rid(6),slot,name,rar,pow,sta,lv,val:Math.max(1,Math.round(lv*[.5,1.4,3,7][rar]))};
}
function lootFor(m){
  const c=me.c, mt=m.t;
  const g0=mt.boss?20+Math.floor(Math.random()*12):mt.elite?6+Math.floor(Math.random()*6):Math.floor(Math.random()*(1+m.lv*.6))+(Math.random()<.5?1:0);
  let pots=0;
  const items=[];
  const BL=BOSSLOOT[mt.key];
  if(BL){ for(let k=0;k<BL.n;k++){ const r=rollRar(BL.p); const it=r===4?legendaryFor(c.cls):genItem(m.lv,r); items.push(it); if(r===4){ banner('LEGENDARY!',it.name,'win'); sfx('legend'); stat('legendary',1); chatLine(`A legendary weapon drops: [${it.name}]!`,'c-loot t4'); } } }
  else if(mt.boss){ items.push(genItem(m.lv,Math.random()<.3?3:2)); }
  else if(mt.elite){ items.push(genItem(m.lv,Math.random()<.5?2:1)); }
  else if(!mt.summon && Math.random()<.24){ const r=Math.random(); items.push(genItem(m.lv, r<.06?2:r<.36?1:0)); }
  for(const it of items) if(it.rar>=2) fx.push({k:'lootbeam',x:m.rx,y:m.ry,col:RARCOL[it.rar],t:now(),dur:it.rar===4?12:4});
  if(Math.random()<.08 && !mt.boss) pots=1;
  dropLoot(m,g0,items,pots); if(g0||items.length||pots){ const L=LOOTS[LOOTS.length-1]; if(L&&dist(me.x,me.y,L.x,L.y)<100&&!lootOpen) openLoot(L); }
}

/* ---------- death credit ---------- */
function onMobDeath(m){
  m.deathT=now(); m.dx=m.rx; m.dy=m.ry; deathBurst(m);
  if(!me) return; bossDied(m);
  if(me.target && me.target.kind==='m' && me.target.id===m.id){ me.target=null; me.auto=false; if(me.cast&&me.cast.ab.hostile) me.cast=null; }
  let credit = m.tag===MY_U;
  if(!credit && me.party && m.tag){ const o=othersByU.get(m.tag); if(o && o.pt===me.party && dist(o.x,o.y,me.x,me.y)<1000) credit=true; }
  if(!credit || me.dead) return;
  const diff=m.lv-me.c.lvl; const mult=diff<=-5?.1:diff<=-3?.45:diff>=3?1.3:1;
  const xp=m.t.key==='lich'?6000:m.t.key==='wyrm'?1600:m.t.boss?900:Math.round((14+11*m.lv)*mult*(m.t.elite?3:1)*(m.lv>=10?2.2:1));
  gainXp(xp); fct(m.rx,m.ry-30,'+'+xp+' xp','#c9a0f0');
  if(m.t.elite&&!m.t.boss) toast(`${m.t.name} defeated!`);
  lootFor(m);
  questEvent('kill',m.t.key,1); trackKill(m);
}

/* =====================================================================
   ABILITIES & COMBAT (local player)
   ===================================================================== */
function curAbils(){ return ABIL[me.c.cls]; }
function targetEnt(){
  const tg=me.target; if(!tg) return null;
  if(tg.kind==='m'){ const m=mobById[tg.id]; return m&&!m.dead?{kind:'m',e:m,x:m.rx,y:m.ry,hostile:true}:null; }
  if(tg.kind==='p'){ if(tg.id===MY_U) return {kind:'p',self:true,x:me.x,y:me.y,u:MY_U}; const o=othersByU.get(tg.id); return o?{kind:'p',e:o,x:o.rx,y:o.ry,u:o.u}:null; }
  if(tg.kind==='n'){ const n=NPCS.find(n=>n.id===tg.id); return n?{kind:'n',e:n,x:n.x,y:n.y}:null; }
  return null;
}
function err(msg){ const el=document.getElementById('errmsg'); el.textContent=msg; clearTimeout(err.t); err.t=setTimeout(()=>el.textContent='',1600); }
function useAbility(i){
  if(!me||me.dead) return; const ab=curAbils()[i]; if(!ab) return; const t=now();
  if(me.c.lvl<ab.lvl) return err(`Learned at level ${ab.lvl}`); if(me.mounted) dismount(); me.emote=null;
  if(me.cast) return err('Already casting');
  if(me.dash) return;
  if(!ab.noGcd && me.gcd>t) return;
  if((me.cds[ab.id]||0)>t) return err('Not ready yet');
  if(!gm.god&&me.res<costOf(ab)) return err(CLS[me.c.cls].res==='rage'?'Not enough rage':'Not enough mana');
  let tgt=null;
  if(ab.hostile){ const te=targetEnt(); if(!te||!te.hostile) return err('You have no target');
    const d=dist(me.x,me.y,te.x,te.y); if(d>ab.rng+te.e.t.r) return err('Out of range'); if(ab.minRng && d<ab.minRng) return err('Too close'); tgt=te; me.auto=true; }
  if(ab.friendly){ const te=targetEnt(); tgt=(te&&te.kind==='p'&&!(te.e&&te.e.d))?te:{kind:'p',self:true,x:me.x,y:me.y,u:MY_U};
    if(dist(me.x,me.y,tgt.x,tgt.y)>ab.rng) return err('Out of range'); }
  if(ab.charge && me.rootU>t) return err('You are rooted');
  if(!ab.noGcd) me.gcd=t+(gm.nocd?.25:1);
  flashSlot(i);
  if(ab.cast){ me.cast={ab,t0:t,dur:ab.cast,tgt:me.target?{...me.target}:null,tgtEnt:tgt}; return; }
  execAbility(ab,tgt);
}
function execAbility(ab,tgt){
  const t=now(); if(!gm.god) me.res-=costOf(ab); if(CLS[me.c.cls].res==='mana') me.lastSpend=t; if(ab.cd&&!gm.nocd) me.cds[ab.id]=t+ab.cd;
  const vis={holy:1,fire:2,arcane:3,wand:4}[ab.proj]||0;
  if(ab.hostile||ab.aoeDmg) me.lastCombat=t;
  if(ab.melee) me.swingT=t;
  const hitMob=(m,base,v,from)=>{ const c=Math.random()<.1; const d=Math.round(base*(.92+Math.random()*.16)*(c?1.7:1));
    if(from!==undefined) pushAct(0,m.id,d,v,from,0); else pushAct(0,m.id,d,v);
    fct(m.rx,m.ry-26,c?d+'!':d,c?'#ffb02e':'#ffe066',c); m.hit=t; if(c) shake(3); return d; };
  if(ab.dmg && tgt && tgt.kind==='m' && !ab.chain){ const m=tgt.e; if(m.dead) return;
    const d=hitMob(m,scaleV(ab.dmg),vis);
    if(ab.threatMul){ if(amHost) m.threat[MY_U]=(m.threat[MY_U]||0)+d*(ab.threatMul-1)*2.4; else pushAct(3,m.id,0,0); }
    visualAct({x:me.x,y:me.y,u:MY_U},[0,0,m.id,d,vis],true); if(ab.melee) FXP({k:'cut',m:m.id,dur:.32,x2:ab.id==='strike',col:'#ff7a4a'});
  }
  if(ab.charge && tgt){ FXP({k:'streak',sx:me.x,sy:me.y,ex:tgt.x,ey:tgt.y,dur:.5}); me.dash={sx:me.x,sy:me.y,m:tgt.e,t0:t,dur:.28}; pushAct(6,0,0,16,me.x,me.y); areaFx(16,me.x,me.y,0); me.res=Math.min(100,me.res+20); me.auto=true; }
  else if(ab.stun && tgt){ pushAct(2,tgt.e.id,ab.stun*1000,0); spark(tgt.x,tgt.y,'#fff3a0'); shake(3); pushAct(6,0,60,22,tgt.x,tgt.y); areaFx(22,tgt.x,tgt.y,60); }
  if(ab.taunt && tgt){ pushAct(3,tgt.e.id,0,7); fct(tgt.x,tgt.y-40,'!','#ff4a3a',true); ring(tgt.x,tgt.y,'#ff4a3a',40); pushAct(6,0,110,23,me.x,me.y); areaFx(23,me.x,me.y,110); FXP({k:'wave',x:tgt.x,y:tgt.y,r:45,col:'#ff4a3a',dur:.4,h:1}); }
  if(ab.buff==='bulwark'){ me.bulwark=t+ab.dur; ring(me.x,me.y,'#7fb2ff',60); burst(me.x,me.y,'#9fc4ff',16,90,{glow:true}); pushAct(6,0,60,24,me.x,me.y); areaFx(24,me.x,me.y,60); }
  if(ab.heal && tgt){ const c=Math.random()<.1; const h=Math.round(scaleV(ab.heal)*(.92+Math.random()*.16)*(c?1.5:1));
    if(tgt.u===MY_U) healMe(h); else { pushAct(1,tgt.u,h,5); fct(tgt.x,tgt.y-30,'+'+h+(c?'!':''),'#6dff7a',c); sparkle(tgt.x,tgt.y,'#9dffb0'); } }
  if(ab.hot && tgt){ const h=Math.round(scaleV(ab.hot));
    petals(tgt.x,tgt.y); if(tgt.u===MY_U){ me.hots=me.hots.filter(x=>x.src!==MY_U); me.hots.push({src:MY_U,amt:h,left:5,next:t+2}); sparkle(me.x,me.y,'#c6ffb0'); }
    else { pushAct(4,tgt.u,h,6); sparkle(tgt.x,tgt.y,'#c6ffb0'); } }
  if(ab.absorb && tgt){ const a=Math.round(scaleV(ab.absorb));
    if(tgt.u===MY_U){ me.absorb=a; me.absorbU=t+12; } else pushAct(7,tgt.u,a,0);
    ring(tgt.x,tgt.y,'#9fd8ff',36); burst(tgt.x,tgt.y,'#d8f0ff',14,70,{glow:true}); if(ab.id==='guardian'){ pushAct(6,0,0,26,tgt.x,tgt.y); FXP({k:'wings',x:tgt.x,y:tgt.y,dur:1.6,f:tgt.u===MY_U?me.face:0}); FXP({k:'dome',x:tgt.x,y:tgt.y,r:1,col:'#fff1b0',dur:1}); } else FXP({k:'dome',x:tgt.x,y:tgt.y,r:1.05,col:'#bfe8ff',dur:1.1}); }
  if(ab.aoeHeal){ const h=Math.round(scaleV(ab.aoeHeal)); healMe(h); pushAct(6,0,ab.radius,8,me.x,me.y); areaFx(8,me.x,me.y,ab.radius);
    for(const o of others.values()) if(!o.d && dist(o.x,o.y,me.x,me.y)<ab.radius){ pushAct(1,o.u,h,0); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } }
  if(ab.aoeDmg){ const atT=!!ab.area&&tgt; const cx=atT?tgt.x:me.x, cy=atT?tgt.y:me.y, R=ab.area||ab.radius, v=ab.vis||9;
    if(ab.id==='whirl'){ me.spinT=t; me.swingT=0; }
    pushAct(6,0,R,v,cx,cy); areaFx(v,cx,cy,R);
    const d0=scaleV(ab.aoeDmg);
    const apply=()=>{ if(!me||me.dead) return;
      for(const m of mobs) if(!m.dead && dist(m.rx,m.ry,cx,cy)<R+m.t.r){ hitMob(m,d0,0); if(ab.root) pushAct(5,m.id,ab.root*1000,0); }
      if(ab.aoeHealAlly){ const h=Math.round(scaleV(ab.aoeHealAlly)); if(dist(me.x,me.y,cx,cy)<R) healMe(h);
        for(const o of others.values()) if(!o.d&&dist(o.rx,o.ry,cx,cy)<R){ pushAct(1,o.u,h,0); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } } };
    if(ab.ticks){ for(let k=0;k<ab.ticks;k++) setTimeout(apply,k*700+250); } else if(v===13) setTimeout(apply,550); else apply(); }
  if(ab.chain && tgt){ let cur=tgt.e, from=0, base=scaleV(ab.dmg); const hit=new Set();
    for(let k=0;k<ab.chain && cur;k++){ hit.add(cur.id); hitMob(cur,base,11,from); lightningFx(from?mobById[from]:{rx:me.x,ry:me.y},cur);
      base*=.8; from=cur.id; let nx=null,nd=175; for(const m of mobs) if(!m.dead&&!hit.has(m.id)){ const dd=dist(m.rx,m.ry,cur.rx,cur.ry); if(dd<nd){nd=dd;nx=m} } cur=nx; } }
  if(ab.rallyHeal){ healMe(Math.round(me.mhp*ab.rallyHeal)); pushAct(6,0,ab.radius,20,me.x,me.y); areaFx(20,me.x,me.y,ab.radius); shake(3);
    for(const o of others.values()) if(!o.d&&dist(o.x,o.y,me.x,me.y)<ab.radius){ const h=Math.round(o.mhp*.15); pushAct(1,o.u,h,5); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } }
  if(ab.buff==='avatar'){ me.avatarU=t+ab.dur; areaFx(20,me.x,me.y,120); pushAct(6,0,120,20,me.x,me.y); shake(4); }
  if(ab.sanct){ me.sanct={x:me.x,y:me.y,until:t+8,next:t,r:ab.radius}; pushAct(6,0,ab.radius,27,me.x,me.y); SANCTS.push({x:me.x,y:me.y,r:ab.radius,until:t+8}); FXP({k:'wave',x:me.x,y:me.y,r:ab.radius,col:'#ffe27a',dur:.8}); }
  if(ab.blink){ const sx=me.x,sy=me.y; for(let s=ab.blink;s>0;s-=8){ const nx=me.x+Math.cos(me.face)*s, ny=me.y+Math.sin(me.face)*s; if(!blocked(nx,ny,11)){me.x=nx;me.y=ny;break} }
    me.rootU=0; ring(sx,sy,'#d6b3ff',40); ring(me.x,me.y,'#d6b3ff',40); burst(sx,sy,'#d6b3ff',18,120,{glow:true}); burst(me.x,me.y,'#f0e0ff',18,90,{glow:true});
    pushAct(6,0,40,17,sx,sy); FXP({k:'portal',x:sx,y:sy,dur:.7,f:me.face+1.57}); FXP({k:'portal',x:me.x,y:me.y,dur:.6,f:me.face+1.57}); FXP({k:'streak',sx,sy,ex:me.x,ey:me.y,col:'#d6b3ff',dur:.4}); }
}
function updateCast(){
  const c=me.cast; if(!c) return; const t=now();
  if(me.moving){ me.cast=null; castFail('Interrupted'); err('Interrupted'); return; }
  if(t-c.t0>=c.dur){ me.cast=null; if(c.node){ finishGather(c.node); return; } if(c.mount){ mountUp(); return; }
    let tgt=c.tgtEnt; const save=me.target; if(c.ab.hostile||c.ab.friendly){ me.target=c.tgt; const te=targetEnt(); me.target=save;
      if(c.ab.hostile){ if(!te||!te.hostile){ castFail('Target lost'); return err('Target lost'); } tgt=te; if(dist(me.x,me.y,te.x,te.y)>c.ab.rng+te.e.t.r+20){ castFail('Out of range'); return err('Out of range'); } }
      else { tgt=(te&&te.kind==='p')?te:{kind:'p',self:true,x:me.x,y:me.y,u:MY_U}; } }
    if(me.res<costOf(c.ab)) return err('Not enough mana');
    execAbility(c.ab,tgt);
  }
}
function updateAuto(dt){
  const te=targetEnt(); if(!me.auto||!te||!te.hostile||me.dead){ if(!te||!te.hostile) me.auto=false; return; }
  const a=CLS[me.c.cls].auto; me.autoT-=dt; if(me.cast||me.dash) return;
  if(me.autoT<=0 && dist(me.x,me.y,te.x,te.y)<=a.rng+te.e.t.r){ me.autoT=a.spd;
    const c=Math.random()<.08; const d=Math.round((a.dmg+a.dmgL*(me.c.lvl-1)+me.pow*.45)*(.9+Math.random()*.2)*(c?1.7:1));
    pushAct(0,te.e.id,d,a.proj?4:0); fct(te.x,te.y-26,c?d+'!':d,c?'#ffb02e':'#fff',c); te.e.hit=now(); me.lastCombat=now();
    if(!a.proj) me.swingT=now();
    if(CLS[me.c.cls].res==='rage') me.res=Math.min(100,me.res+10);
    visualAct({x:me.x,y:me.y,u:MY_U},[0,0,te.e.id,d,a.proj?4:0],true);
  }
}
function usePotion(){ if(!me||me.dead) return; const t=now(); if(me.c.pots<=0) return err('No potions left'); if(me.potCd>t) return err('Potion not ready');
  me.c.pots--; me.potCd=t+30; healMe(Math.round(me.mhp*.38)); persist(); }

/* =====================================================================
   EMBERFALL 3D ENGINE — WebGL2, no libraries
   ===================================================================== */
const cv=document.getElementById('c'), ov=document.getElementById('ov'), g=ov.getContext('2d');
const gl=cv.getContext('webgl2',{antialias:true,powerPreference:'high-performance'});
if(!gl){ document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99;background:#0b0806;color:#f3e6c8;font:20px sans-serif;text-align:center;padding:30px">Emberfall needs WebGL 2. Please open it in an up-to-date Chrome, Edge, Firefox or Safari.</div>'); throw new Error('WebGL2 unavailable'); }
let W=0,H=0,DPR=1;
const GFX=(function(){ const mob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&innerWidth<1100); let q=((typeof saves!=='undefined'&&saves.opts&&saves.opts.gfx)||'auto'); if(q==='auto') q=mob?'low':'high';
  const T={low:{rs:1,rmin:.6,sm:1024,grass:.6,gd:28},medium:{rs:1.25,rmin:.75,sm:2048,grass:.85,gd:38},high:{rs:1.5,rmin:.85,sm:2048,grass:1,gd:48},ultra:{rs:2,rmin:1,sm:4096,grass:1.15,gd:64}}; return Object.assign({q},T[q]||T.high); })();
let RSCALE=0, RSMAX=1; function resize(){ DPR=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; RSMAX=Math.max(.6,Math.min(DPR,GFX.rs)); if(!RSCALE||RSCALE>RSMAX) RSCALE=RSMAX; const rs=RSCALE; cv.width=Math.round(W*rs); cv.height=Math.round(H*rs); ov.width=Math.round(W*DPR); ov.height=Math.round(H*DPR); }
addEventListener('resize',resize); resize();
const NL=String.fromCharCode(10);
const C3cache={}; function C3(h){ if(Array.isArray(h)) return h; let c=C3cache[h]; if(c) return c; const n=parseInt(h.slice(1),16); c=[(n>>16)/255,(n>>8&255)/255,(n&255)/255]; C3cache[h]=c; return c; }
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};

/* ---------- matrices ---------- */
const M4={
  id(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m},
  mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o},
  persp(f,a,n,fr){const t=1/Math.tan(f/2),m=new Float32Array(16);m[0]=t/a;m[5]=t;m[10]=(fr+n)/(n-fr);m[11]=-1;m[14]=2*fr*n/(n-fr);return m},
  ortho(l,r,b,t,n,f){const m=new Float32Array(16);m[0]=2/(r-l);m[5]=2/(t-b);m[10]=-2/(f-n);m[12]=-(r+l)/(r-l);m[13]=-(t+b)/(t-b);m[14]=-(f+n)/(f-n);m[15]=1;return m},
  look(e,c,u){ let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2]; let l=Math.hypot(zx,zy,zz)||1; zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy, xy=u[2]*zx-u[0]*zz, xz=u[0]*zy-u[1]*zx; l=Math.hypot(xx,xy,xz)||1; xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx; const m=new Float32Array(16);
    m[0]=xx;m[1]=yx;m[2]=zx;m[4]=xy;m[5]=yy;m[6]=zy;m[8]=xz;m[9]=yz;m[10]=zz;
    m[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);m[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);m[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);m[15]=1;return m},
  inv(a){ const o=new Float32Array(16);
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
      b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if(!det) return M4.id(); det=1/det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det;o[1]=(a02*b10-a01*b11-a03*b09)*det;o[2]=(a31*b05-a32*b04+a33*b03)*det;o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;o[5]=(a00*b11-a02*b08+a03*b07)*det;o[6]=(a32*b02-a30*b05-a33*b01)*det;o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;o[9]=(a01*b08-a00*b10-a03*b06)*det;o[10]=(a30*b04-a31*b02+a33*b00)*det;o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det;o[13]=(a00*b09-a01*b07+a02*b06)*det;o[14]=(a31*b01-a30*b03-a32*b00)*det;o[15]=(a20*b03-a21*b01+a22*b00)*det; return o; }
};
/* matrix stack for rigs */
let CUR=M4.id(); const MST=[];
const mreset=()=>{ CUR=M4.id(); MST.length=0; };
const mpush=()=>MST.push(CUR.slice()), mpop=()=>{ CUR=MST.pop(); };
function mtr(x,y,z){ const m=CUR; for(let i=0;i<4;i++) m[12+i]+=m[i]*x+m[4+i]*y+m[8+i]*z; }
function mry(a){ const c=Math.cos(a),s=Math.sin(a),m=CUR; for(let i=0;i<4;i++){ const x=m[i],z=m[8+i]; m[i]=x*c-z*s; m[8+i]=x*s+z*c; } }
function mrx(a){ const c=Math.cos(a),s=Math.sin(a),m=CUR; for(let i=0;i<4;i++){ const y=m[4+i],z=m[8+i]; m[4+i]=y*c+z*s; m[8+i]=-y*s+z*c; } }
function mrz(a){ const c=Math.cos(a),s=Math.sin(a),m=CUR; for(let i=0;i<4;i++){ const x=m[i],y=m[4+i]; m[i]=x*c+y*s; m[4+i]=-x*s+y*c; } }
function msc(s){ const m=CUR; for(let i=0;i<12;i++) m[i]*=s; }

/* ---------- shaders ---------- */
const GLSL_NOISE=`
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm2(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }
vec3 tone(vec3 c){ c*=1.32; return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.); }
`;
const VS_LIT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec4 aCol;
#ifdef INST
layout(location=3) in vec4 iA; layout(location=4) in vec4 iB; layout(location=5) in vec3 iC;
#endif
uniform mat4 uVP; uniform mat4 uM; uniform mat4 uLVP; uniform vec3 uInvS2; uniform float uTime; uniform vec3 uCam; uniform float uGrassD;
out vec3 vW; out vec3 vN; out vec4 vC; out vec4 vS;
void main(){
  vec3 p=aPos, n=aNor; vec4 c=aCol; vec3 w;
#ifdef INST
  p*=iB.xyz; n/=iB.xyz; float s=sin(iA.w), k=cos(iA.w);
  p=vec3(p.x*k+p.z*s,p.y,-p.x*s+p.z*k); n=vec3(n.x*k+n.z*s,n.y,-n.x*s+n.z*k);
  float sw=iB.w*aPos.y*aPos.y; p.x+=sin(uTime*1.6+iA.x*.37+iA.z*.23)*sw; p.z+=cos(uTime*1.25+iA.z*.31+iA.x*.11)*sw*.7;
  if(uGrassD>0.){ float gd=length(iA.xz-uCam.xz); p*=smoothstep(uGrassD,uGrassD*.72,gd); }
  w=p+iA.xyz; c.rgb*=iC;
#else
  w=(uM*vec4(p,1.)).xyz; n=mat3(uM)*(n*uInvS2);
#endif
  vW=w; vN=n; vC=c;
#ifdef SHADOW
  gl_Position=uLVP*vec4(w,1.);
#else
  vS=uLVP*vec4(w,1.); gl_Position=uVP*vec4(w,1.);
#endif
}`;
const FS_SHADOW=`#version 300 es
precision highp float;
void main(){}`;
const FS_LIT=`#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec4 vC; in vec4 vS;
uniform vec3 uTint; uniform float uEmis; uniform float uAlpha; uniform float uTerrain; uniform float uSpec; uniform float uFol;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uFog; uniform vec3 uCam;
uniform float uFogD; uniform float uTime; uniform float uShOn; uniform float uHFog;
uniform int uNL; uniform vec4 uLP[16]; uniform vec3 uLC[16];
uniform int uND; uniform vec4 uDec[12]; uniform vec4 uDecC[12];
uniform highp sampler2D uShadow;
out vec4 o;
${GLSL_NOISE}
const vec2 PD[12]=vec2[12](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893),vec2(.507,.064),vec2(.896,.412),vec2(-.322,-.933),vec2(-.792,-.598));
float shadowF(){ vec3 p=vS.xyz/vS.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  vec2 ts=1./vec2(textureSize(uShadow,0)); float s=0.; for(int i=0;i<12;i++){ s+= (p.z-.0015 > texture(uShadow,p.xy+PD[i]*ts*1.8).r) ? 0. : 1.; } return s/12.; }
void main(){
  vec3 N=normalize(vN); if(!gl_FrontFacing&&uFol<2.5) N=-N;
  vec3 base=vC.rgb*uTint; float trans=0.;
  if(uFol>.5&&uFol<1.5&&vC.g>vC.r*1.12){ float l1=vn(vW.xz*3.1+vW.y*2.3), l2=vn(vW.xz*8.7-vW.y*5.1), l3=vn(vW.zx*19.+vW.y*13.);
    base*=.62+.42*l1+.28*l2+.12*l3; N=normalize(N+vec3(l2-.5,l3-.5,l1-.5)*.9); trans=.55; }
  else if(uFol>.5&&uFol<1.5&&vC.r>vC.b*1.3){ float bk=vn(vec2(atan(vW.x,vW.z)*3.,vW.y*9.)); base*=.75+.4*bk; }
  if(uFol>1.5&&uFol<2.5){ float r1=fbm2(vW.xz*1.7+vW.y*1.3), r2=vn(vW.xz*7.+vW.y*5.); base*=.7+.5*r1+.15*r2; N=normalize(N+vec3(r2-.5,0.,r1-.5)*.5); if(N.y>.55) base=mix(base,base*vec3(.75,.95,.6),smoothstep(.55,.85,N.y)*.5*step(uTerrain,.5)*step(base.b,base.g*1.1)); }
  if(uFol>2.5){ N=normalize(mix(N,vec3(0.,1.,0.),.5)); trans=.35; }
  if(uTerrain>.5){ float n=vn(vW.xz*2.7)*.5+vn(vW.xz*9.)*.3+vn(vW.xz*.55)*.2; float n2=vn(vW.xz*23.)*.6+vn(vW.xz*41.)*.4; base*=(.78+.44*n)*(.9+.2*n2); N=normalize(N+vec3(vn(vW.xz*17.)-.5,0.,vn(vW.zx*17.+3.)-.5)*.18);
    float sl=1.-N.y; vec3 rk=mix(vec3(.4,.37,.34),base*1.15,.45)*(.7+.45*vn(vW.xz*3.5+vW.y)); base=mix(base,rk,smoothstep(.3,.55,sl)); }
  float sh=uShOn>.5?shadowF():1.;
  float ndr=dot(N,uSunDir); float nd=max(ndr,0.);
  bool skin=abs(uSpec-.26)<.01;
  if(skin) nd=max((ndr+.4)/1.4,0.);
  vec3 amb=mix(uGnd,uSky,N.y*.5+.5)*(.82+.18*N.y);
  vec3 col=base*(amb+uSunCol*nd*sh);
  if(skin) col+=base*vec3(.32,.1,.05)*uSunCol*smoothstep(.4,-.2,ndr)*smoothstep(-.8,-.2,ndr)*.6*sh;
  if(trans>0.) col+=base*uSunCol*pow(max(dot(normalize(uCam-vW),-uSunDir),0.),3.)*trans*sh+base*uSunCol*max(-ndr,0.)*trans*.35*sh;
  vec3 V=normalize(uCam-vW); float spw=uTerrain>.5?.036:uSpec; col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),uSpec>.5?60.:24.)*spw*sh*(uSpec>.5?2.2:1.);
  if(uTerrain<.5&&uFol<.5){ float nv=max(dot(N,V),0.); float fr=pow(1.-nv,3.); col+=mix(uSky,uSunCol,.35)*fr*(.14+uSpec*.25)*(.4+.6*sh);
    if(abs(uSpec-.12)<.01) col+=base*amb*pow(1.-nv,2.)*.3;
    if(uSpec>.5) col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),220.)*1.6*sh;
    if(uSpec>.5){ vec3 Rf=reflect(-V,N); col+=base*mix(uGnd*.6,uSky*1.4,Rf.y*.5+.5)*.45; } }
  for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 L=uLP[i].xyz-vW; float d=length(L); float a=clamp(1.-d/uLP[i].w,0.,1.); a*=a;
    col+=base*uLC[i]*a*(max(dot(N,L/max(d,.001)),0.)*.75+.25); }
  col+=vC.rgb*uTint*vC.a+uTint*uEmis;
  if(uTerrain>.5){ for(int i=0;i<12;i++){ if(i>=uND) break; vec4 D=uDec[i]; vec4 Cc=uDecC[i]; float d=length(vW.xz-D.xy);
      if(Cc.a<0.){ col*=1.-(-Cc.a)*.75*smoothstep(D.z,D.z*.15,d); }
      else if(D.w<-1.5){ float rot=(-D.w-2.)*6.2831; vec2 q=vW.xz-D.xy; float an=atan(q.y,q.x); float a1=an+rot, a2=an-rot*1.5;
        float r1=smoothstep(.06,0.,abs(d-D.z)), r2=smoothstep(.045,0.,abs(d-D.z*.78)), r3=smoothstep(.04,0.,abs(d-D.z*.3));
        float band=step(D.z*.8,d)*step(d,D.z*.97); float gly=band*step(.5,fract(a1*2.865))*step(abs(fract(a1*11.46)-.5),.3);
        float hx=d*cos(mod(a2,1.0472)-.5236); float hex=smoothstep(.045,0.,abs(hx-D.z*.62))*step(d,D.z*.78);
        float mm=clamp(r1+r2*.8+r3*.6+gly*.75+hex*.7,0.,1.); col=mix(col,Cc.rgb*1.15,mm*Cc.a*.9); col+=Cc.rgb*mm*.45*Cc.a+Cc.rgb*.06*step(d,D.z)*Cc.a; }
      else if(D.w<0.){ float r=smoothstep(.1,0.,abs(d-D.z)); col=mix(col,Cc.rgb*1.5,r*Cc.a); }
      else { float ins=step(d,D.z); float edge=smoothstep(.16,0.,abs(d-D.z)); float fill=step(d,D.z*D.w); col=mix(col,Cc.rgb,ins*(.16+.3*fill)*Cc.a); col+=Cc.rgb*edge*.9*Cc.a; } } }
  float dd=length(vW-uCam); float f=1.-exp(-uFogD*uFogD*dd*dd); col=mix(col,uFog,clamp(f,0.,1.));
  float hf=uHFog*exp(-max(vW.y+.4,0.)*.55)*(1.-exp(-dd*.05)); col=mix(col,uFog*1.05+.02,clamp(hf,0.,.8));
  o=vec4(tone(col),uAlpha);
}`;
const VS_LIQ=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; uniform mat4 uVP; uniform float uLevel; out vec3 vW;
void main(){ vW=vec3(aPos.x,uLevel,aPos.z); gl_Position=uVP*vec4(vW,1.); }`;
const FS_LIQ=`#version 300 es
precision highp float;
in vec3 vW; uniform sampler2D uHeight; uniform float uMode; uniform float uTime; uniform float uLevel; uniform vec2 uMap;
uniform vec3 uCam; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uFog; uniform float uFogD;
uniform int uNL; uniform vec4 uLP[16]; uniform vec3 uLC[16];
out vec4 o;
${GLSL_NOISE}
void main(){
  vec2 hv=texture(uHeight,vW.xz/uMap).rg; float depth=uLevel-hv.r; if(depth<0.) discard;
  vec2 p=vW.xz; float t=uTime; vec3 col; float a=1.;
  if(uMode<.5){
    float h1=vn(p*1.2+vec2(t*.35,t*.21)), h2=vn(p*2.9-vec2(t*.27,t*.38)), h3=vn(p*1.6+vec2(-t*.22,t*.31));
    vec3 N=normalize(vec3((h1-.5)*.38+(h2-.5)*.2,1.,(h3-.5)*.38+(h2-.5)*.15));
    vec3 V=normalize(uCam-vW); float fres=pow(1.-max(dot(N,V),0.),3.)*.75+.1;
    vec3 deep=vec3(.02,.1,.17), shal=vec3(.1,.38,.42);
    col=mix(shal,deep,smoothstep(0.,1.3,depth))*(uSky*1.2+.15);
    col=mix(col,uSky*1.25+vec3(.04),fres);
    col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),140.)*1.8;
    for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 L=uLP[i].xyz-vW; float d=length(L); float la=clamp(1.-d/uLP[i].w,0.,1.); col+=uLC[i]*la*la*.25; }
    float foam=smoothstep(.22,0.,depth)*(.55+.45*vn(p*7.+t*.8)); col=mix(col,vec3(.85,.92,.95)*(uSky+.3),foam);
    a=clamp(smoothstep(0.,.6,depth)*.72+.22+foam,0.,1.);
  } else {
    if(hv.g<.3) discard;
    float n=vn(p*.55+vec2(t*.05,t*.03))*.55+vn(p*1.7-vec2(t*.09,0.))*.3+vn(p*5.+t*.25)*.15;
    float cr=smoothstep(.42,.58,n);
    col=mix(vec3(1.7,.38,.06),vec3(2.6,1.35,.35),cr);
    float crust=smoothstep(.6,.72,vn(p*1.05+vec2(t*.02,-t*.015)));
    col=mix(col,vec3(.13,.05,.03),crust*.88);
    col=mix(col,vec3(.11,.04,.02),smoothstep(.3,0.,depth));
  }
  float f=1.-exp(-uFogD*uFogD*dot(vW-uCam,vW-uCam)); col=mix(col,uFog,clamp(f,0.,1.)*(uMode<.5?1.:.6));
  o=vec4(tone(col),a);
}`;
const VS_SKY=`#version 300 es
layout(location=0) in vec2 aPos; out vec2 vP; void main(){ vP=aPos; gl_Position=vec4(aPos,.9999,1.); }`;
const FS_SKY=`#version 300 es
precision highp float;
in vec2 vP; uniform mat4 uInvVP; uniform vec3 uSunDir; uniform vec3 uRealSun; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; uniform float uCloud; uniform float uStorm; uniform float uFlash; uniform float uAurora;
out vec4 o;
${GLSL_NOISE}
void main(){
  vec4 a=uInvVP*vec4(vP,-1.,1.), b=uInvVP*vec4(vP,1.,1.); vec3 dir=normalize(b.xyz/b.w-a.xyz/a.w);
  float h=dir.y; vec3 col=mix(uHor,uZen,pow(clamp(h,0.,1.),.55)); if(h<0.) col=uHor*(1.+h*.6);
  float sd=dot(dir,uRealSun); col+=uSunCol*(pow(max(sd,0.),900.)*10.+pow(max(sd,0.),10.)*.22);
  if(uNight>0.){ vec3 q=floor(dir*260.); float s=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);
    col+=vec3(.9,.95,1.)*step(.9975,s)*uNight*smoothstep(0.,.25,h)*(.6+.4*sin(uTime*2.+s*50.));
    vec3 md=normalize(vec3(-uRealSun.x,abs(uRealSun.y)+.35,-uRealSun.z)); float m=dot(dir,md);
    col+=vec3(.85,.9,1.)*(smoothstep(.9993,.9996,m)*1.4+pow(max(m,0.),60.)*.12)*uNight; }
  if(h>0.){ vec2 cp=dir.xz/(h+.12)*1.4+vec2(uTime*.006,uTime*.002); float c=fbm2(cp); c=smoothstep(.66-uCloud*.4,.92-uCloud*.3,c)*smoothstep(0.,.18,h);
    vec3 cc=(mix(uHor*1.15,vec3(1.),.45)*(1.-uNight*.85)+uSunCol*.15)*(1.-uStorm*.6); col=mix(col,cc,c*(.7+uStorm*.25)); }
  if(uAurora>0.&&h>0.){ vec2 q=dir.xz/(h+.25); float a=0.; for(int k=0;k<3;k++){ float fk=float(k); float band=sin(q.x*1.3+fk*2.1+uTime*.06+vn(q*.7+fk)*3.5)*.5+.5; a+=smoothstep(.68,1.,band)*(.55+.45*vn(q*3.+vec2(uTime*.15,fk))); }
    col+=mix(vec3(.1,1.,.55),vec3(.6,.25,1.),clamp(q.y*.25+.5,0.,1.))*a*uAurora*smoothstep(.02,.3,h)*1.3; }
  col+=vec3(.8,.85,1.)*uFlash*.6;
  o=vec4(tone(col),1.);
}`;
const VS_PART=`#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uPS; out vec4 vC;
void main(){ vec4 p=uVP*vec4(aP.xyz,1.); gl_Position=p; gl_PointSize=clamp(aP.w*uPS/max(p.w,.1),1.,180.); vC=aC; }`;
const FS_PART=`#version 300 es
precision mediump float; in vec4 vC; out vec4 o;
void main(){ vec2 d=gl_PointCoord*2.-1.; float r=dot(d,d); if(r>1.) discard; o=vec4(vC.rgb,vC.a*pow(1.-r,1.6)); }`;

function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ const e=gl.getShaderInfoLog(s); console.error(e); throw new Error('Shader: '+e); } return s; }
function program(vs,fs,defs){ const pre=defs?('#define '+defs.join(NL+'#define ')+NL):'';
  const v=vs.replace('#version 300 es','#version 300 es'+NL+pre);
  const p=gl.createProgram(); gl.attachShader(p,compile(gl.VERTEX_SHADER,v)); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('Link: '+gl.getProgramInfoLog(p));
  const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){ const inf=gl.getActiveUniform(p,i); u[inf.name.replace(/\[0\]$/,'')]=gl.getUniformLocation(p,inf.name); }
  return {p,u}; }
const PL=program(VS_LIT,FS_LIT), PLI=program(VS_LIT,FS_LIT,['INST']), PS=program(VS_LIT,FS_SHADOW,['SHADOW']), PSI=program(VS_LIT,FS_SHADOW,['SHADOW','INST']);
const PQ=program(VS_LIQ,FS_LIQ), PSK=program(VS_SKY,FS_SKY), PP=program(VS_PART,FS_PART);

/* ---------- raw geometry ---------- */
const G0=()=>({p:[],n:[],c:[],i:[]});
function gPush(d,x,y,z,nx,ny,nz,col,e){ d.p.push(x,y,z); d.n.push(nx,ny,nz); d.c.push(col?col[0]:1,col?col[1]:1,col?col[2]:1,e||0); return d.p.length/3-1; }
function gBox(){ const d=G0(); const F=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,1]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[0,0,1],[1,0,0]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[1,0,0],[0,1,0]]];
  for(const [n,u,v] of F){ const b=d.p.length/3; for(const [a,c] of [[-1,-1],[1,-1],[1,1],[-1,1]]) gPush(d,n[0]*.5+u[0]*a*.5+v[0]*c*.5,n[1]*.5+u[1]*a*.5+v[1]*c*.5,n[2]*.5+u[2]*a*.5+v[2]*c*.5,n[0],n[1],n[2]); d.i.push(b,b+1,b+2,b,b+2,b+3); } return d; }
function gSphere(seg,ring,amp,seed){ seg=seg||14; ring=ring||9; const d=G0(); const R=mulberry32(seed||7); const off=[];
  for(let j=0;j<=ring;j++){ const th=j/ring*Math.PI; for(let i=0;i<=seg;i++){ const ph=i/seg*Math.PI*2; let x=Math.sin(th)*Math.cos(ph), y=Math.cos(th), z=Math.sin(th)*Math.sin(ph);
      let r=.5; if(amp){ const k=(i%seg)+'_'+j; r*=1+(off[k]??(off[k]=(R()-.5)*amp)); if(j===0||j===ring) r=.5; } gPush(d,x*r,y*r,z*r,x,y,z); } }
  for(let j=0;j<ring;j++)for(let i=0;i<seg;i++){ const a=j*(seg+1)+i, b=a+seg+1; d.i.push(a,a+1,b,b,a+1,b+1); } return d; }
function gCyl(seg,rt,rb,caps){ seg=seg||12; const d=G0(); const sl=(rb-rt);
  for(let j=0;j<=1;j++) for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2, r=j?rt:rb; const nx=Math.cos(a), nz=Math.sin(a); const l=Math.hypot(1,sl); gPush(d,nx*r,j,nz*r,nx/l,sl/l,nz/l); }
  for(let i=0;i<seg;i++){ const a=i, b=i+seg+1; d.i.push(a,b,a+1,b,b+1,a+1); }
  if(caps!==false) for(const [y,r,ny] of [[0,rb,-1],[1,rt,1]]){ if(r<=0) continue; const c=gPush(d,0,y,0,0,ny,0); for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2; gPush(d,Math.cos(a)*r,y,Math.sin(a)*r,0,ny,0); } for(let i=0;i<seg;i++) d.i.push(c,c+1+i,c+2+i); }
  return d; }
function gLimb(seg){ seg=seg||10; const d=G0(); const rings=[]; const cap=.16;
  for(let k=0;k<=4;k++){ const th=k/4*Math.PI/2; rings.push([Math.cos(th)*cap,Math.sin(th)*.5,Math.cos(th)]); }
  for(let k=4;k>=0;k--){ const th=k/4*Math.PI/2; rings.push([-1-Math.cos(th)*cap,Math.sin(th)*.5,-Math.cos(th)]); }
  for(let j=0;j<rings.length;j++){ const [y,r,ny]=rings[j]; for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2; const nx=Math.cos(a)*Math.sqrt(1-ny*ny), nz=Math.sin(a)*Math.sqrt(1-ny*ny); gPush(d,Math.cos(a)*r,y,Math.sin(a)*r,nx,ny,nz); } }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<seg;i++){ const a=j*(seg+1)+i, b=a+seg+1; d.i.push(a,a+1,b,b,a+1,b+1); } return d; }
function gPrism(){ const d=G0(); const V=[[-.5,0],[.5,0],[0,1]];
  for(let s=0;s<3;s++){ const [x0,y0]=V[s],[x1,y1]=V[(s+1)%3]; let nx=y1-y0, ny=-(x1-x0); const l=Math.hypot(nx,ny); nx/=l; ny/=l; if(s===0){nx=0;ny=-1}
    const b=d.p.length/3; gPush(d,x0,y0,-.5,nx,ny,0); gPush(d,x1,y1,-.5,nx,ny,0); gPush(d,x1,y1,.5,nx,ny,0); gPush(d,x0,y0,.5,nx,ny,0); d.i.push(b,b+1,b+2,b,b+2,b+3); }
  for(const z of [-.5,.5]){ const b=d.p.length/3; for(const [x,y] of V) gPush(d,x,y,z,0,0,Math.sign(z)); d.i.push(b,b+1,b+2); } return d; }
function gWing(){ const d=G0(); const P=[[0,0],[.55,.15],[.95,1.15],[.7,2.1],[.25,3.0],[-.25,2.35],[-.55,1.6],[-.85,.95],[-.6,.2]];
  const c=gPush(d,0,0,0,0,1,0); for(const [x,z] of P.slice(1)) gPush(d,x,0,z,0,1,0); for(let i=1;i<P.length-1;i++) d.i.push(c,i,i+1); return d; }
function gTuft(){ const d=G0(); for(let k=0;k<3;k++){ const a=k*Math.PI/3+.3, ca=Math.cos(a)*.07, sa=Math.sin(a)*.07, lean=(k-1)*.12;
  const b=d.p.length/3; gPush(d,-ca*1.6,0,-sa*1.6,0,1,0,[.62,.62,.62]); gPush(d,ca*1.6,0,sa*1.6,0,1,0,[.62,.62,.62]); gPush(d,lean,1,lean*.5,0,1,0,[1.25,1.25,1.2]); d.i.push(b,b+1,b+2); } return d; }
function gFlower(){ const d=G0(); const s=gSphere(6,4); for(const [ox,oz] of [[0,0],[.35,.1],[-.2,.3],[-.1,-.35]]){ const b=d.p.length/3;
  for(let i=0;i<s.p.length;i+=3){ gPush(d,s.p[i]*.32+ox,s.p[i+1]*.2+.55,s.p[i+2]*.32+oz,s.n[i],s.n[i+1],s.n[i+2],[1.3,1.3,1.3],.12); } for(const ix of s.i) d.i.push(b+ix); } return d; }
/* ---------- v14 smooth geometry ---------- */
function n3(x,y,z,s){ const h=(i,j,k)=>{ let n=(Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(k,2147483647)+Math.imul(s|0,1442695041))|0; n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; };
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z); let fx=x-xi,fy=y-yi,fz=z-zi; fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz); const L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(h(xi,yi,zi),h(xi+1,yi,zi),fx),L(h(xi,yi+1,zi),h(xi+1,yi+1,zi),fx),fy),L(L(h(xi,yi,zi+1),h(xi+1,yi,zi+1),fx),L(h(xi,yi+1,zi+1),h(xi+1,yi+1,zi+1),fx),fy),fz); }
/* smooth (welded) vertex normals; out: flip so normals point away from the origin axis */
function gNormals(d,out){ const n=new Float64Array(d.p.length), key=new Map(), id=new Int32Array(d.p.length/3);
  for(let v=0;v<d.p.length/3;v++){ const k=Math.round(d.p[v*3]*2e3)+','+Math.round(d.p[v*3+1]*2e3)+','+Math.round(d.p[v*3+2]*2e3); let q=key.get(k); if(q===undefined){ q=v; key.set(k,v); } id[v]=q; }
  for(let i=0;i<d.i.length;i+=3){ const a=d.i[i]*3,b=d.i[i+1]*3,c=d.i[i+2]*3; const ux=d.p[b]-d.p[a],uy=d.p[b+1]-d.p[a+1],uz=d.p[b+2]-d.p[a+2],vx=d.p[c]-d.p[a],vy=d.p[c+1]-d.p[a+1],vz=d.p[c+2]-d.p[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; for(const q of [d.i[i],d.i[i+1],d.i[i+2]]){ const r=id[q]*3; n[r]+=nx; n[r+1]+=ny; n[r+2]+=nz; } }
  for(let v=0;v<d.p.length/3;v++){ const r=id[v]*3; let x=n[r],y=n[r+1],z=n[r+2]; const l=Math.hypot(x,y,z)||1; x/=l; y/=l; z/=l;
    if(out){ const px=d.p[v*3],py=d.p[v*3+1]-(out.cy||0),pz=d.p[v*3+2]; if(x*px+y*py*(out.ys??1)+z*pz<0){ x=-x;y=-y;z=-z; } }
    d.n[v*3]=x; d.n[v*3+1]=y; d.n[v*3+2]=z; } return d; }
/* lumpy organic blob: smooth noise displacement instead of faceted jitter */
function gBlob(seg,ring,amp,seed,freq){ const d=gSphere(seg,ring); freq=freq||2;
  for(let v=0;v<d.p.length;v+=3){ const x=d.p[v],y=d.p[v+1],z=d.p[v+2]; const k=1+amp*((n3(x*freq*2+9,y*freq*2+3,z*freq*2+5,seed)-.5)*1.6+(n3(x*freq*5,y*freq*5,z*freq*5,seed+7)-.5)*.5); d.p[v]=x*k; d.p[v+1]=y*k; d.p[v+2]=z*k; }
  return gNormals(d,{}); }
/* rounded box: bevelled edges with smooth normals (replaces the hard cube on characters) */
function gRBox(r){ r=r||.18; const d=G0(); const S=[-.5,-.5+r*.12,-.5+r*.45,-.5+r,.5-r,.5-r*.45,.5-r*.12,.5]; const N=S.length;
  const F=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]]];
  const m=.5-r;
  for(const [nn,u,v] of F){ const b=d.p.length/3;
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){ const p=[0,1,2].map(k=>nn[k]*.5+u[k]*S[i]+v[k]*S[j]); const c=p.map(x=>Math.max(-m,Math.min(m,x))); let q=p.map((x,k)=>x-c[k]); let l=Math.hypot(q[0],q[1],q[2]); if(l<1e-6){ q=nn.slice(); l=1; }
      q=q.map(x=>x/l); gPush(d,c[0]+q[0]*r,c[1]+q[1]*r,c[2]+q[2]*r,q[0],q[1],q[2]); }
    for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){ const a=b+j*N+i; d.i.push(a,a+1,a+N+1,a,a+N+1,a+N); } }
  return d; }
/* pine tier: a cone whose hem droops into branch tips */
function gSkirt(seg,tips,seed){ const d=G0(); const R=mulberry32(seed||5); const rings=[[0,.5],[.18,.44],[.45,.3],[.75,.15],[1,0]];
  for(let j=0;j<rings.length;j++){ const [y,r]=rings[j]; for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2; const tip=.5+.5*Math.cos(a*tips); const w=j===0?(.72+.28*tip):j===1?(.85+.15*tip):1; const dy=j===0?-(1-tip)*.0-tip*.12:(j===1?-.04*tip:0);
      gPush(d,Math.cos(a)*r*w*(1+(R()-.5)*.06*(j<2)),y+dy,Math.sin(a)*r*w,Math.cos(a),.6,Math.sin(a)); } }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<seg;i++){ const a=j*(seg+1)+i, b=a+seg+1; d.i.push(a,b,a+1,b,b+1,a+1); }
  const c=gPush(d,0,-.02,0,0,-1,0); for(let i=0;i<seg;i++) d.i.push(c,i+1,i);
  return gNormals(d,{cy:.3,ys:.4}); }
/* grass tuft: thin, tapered, curving blades */
function gTuft2(){ const d=G0(); const R=mulberry32(31); const B=6;
  for(let k=0;k<B;k++){ const a=k/B*Math.PI*2+R()*.6, ca=Math.cos(a), sa=Math.sin(a), w=.05+R()*.025, h=.75+R()*.45, lean=.18+R()*.25, px=ca*.06, pz=sa*.06;
    const b=d.p.length/3; const tx=-sa, tz=ca; const segs=[[0,1],[.45,.62],[.8,.3],[1,0]];
    for(const [f,wk] of segs){ const bend=lean*f*f; const x=px+ca*bend, y=f*h, z=pz+sa*bend; const sh=.55+.75*f;
      gPush(d,x-tx*w*wk,y,z-tz*w*wk,ca*.3,1,sa*.3,[sh,sh,sh*.95]); gPush(d,x+tx*w*wk,y,z+tz*w*wk,ca*.3,1,sa*.3,[sh,sh,sh*.95]); }
    for(let s=0;s<3;s++){ const q=b+s*2; d.i.push(q,q+1,q+3,q,q+3,q+2); } }
  return d; }

/* merge transformed parts into one raw geometry (static scenery, trees) */
function gAdd(dst,src,x,y,z,ry,sx,sy,sz,col,e,rz,rx){ const b=dst.p.length/3; const cy=Math.cos(ry||0),sy2=Math.sin(ry||0), cz=Math.cos(rz||0),szz=Math.sin(rz||0), cx=Math.cos(rx||0), sxx=Math.sin(rx||0);
  const rot=(vx,vy,vz)=>{ let a=vx*cz-vy*szz, b2=vx*szz+vy*cz; vx=a; vy=b2; a=vy*cx-vz*sxx; b2=vy*sxx+vz*cx; vy=a; vz=b2; return [vx*cy+vz*sy2, vy, -vx*sy2+vz*cy]; };
  for(let i=0;i<src.p.length;i+=3){ const p=rot(src.p[i]*sx,src.p[i+1]*sy,src.p[i+2]*sz); let n=rot(src.n[i]/sx,src.n[i+1]/sy,src.n[i+2]/sz); const l=Math.hypot(n[0],n[1],n[2])||1;
    const j=i/3*4; dst.p.push(p[0]+x,p[1]+y,p[2]+z); dst.n.push(n[0]/l,n[1]/l,n[2]/l);
    dst.c.push(src.c[j]*(col?col[0]:1),src.c[j+1]*(col?col[1]:1),src.c[j+2]*(col?col[2]:1),e!==undefined?e:src.c[j+3]); }
  for(const ix of src.i) dst.i.push(b+ix); return dst; }
/* upload */
function mkVAO(d,inst){ const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf=(arr,loc,size)=>{ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,arr instanceof Float32Array?arr:new Float32Array(arr),gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0); };
  buf(d.p,0,3); buf(d.n,1,3); buf(d.c,2,4);
  let count=0; if(inst){ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inst),gl.STATIC_DRAW); count=inst.length/11;
    for(const [loc,size,off] of [[3,4,0],[4,4,16],[5,3,32]]){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,44,off); gl.vertexAttribDivisor(loc,1); } }
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(d.i),gl.STATIC_DRAW);
  gl.bindVertexArray(null); return {vao,n:d.i.length,count}; }
const GEO={box:mkVAO(gRBox(.2)),cube:mkVAO(gBox()),sph:mkVAO(gSphere(28,18)),lsph:mkVAO(gSphere(12,8)),cyl:mkVAO(gCyl(24,.5,.5)),lcyl:mkVAO(gCyl(10,.5,.5)),cone:mkVAO(gCyl(24,0,.5)),lcone:mkVAO(gCyl(10,0,.5)),limb:mkVAO(gLimb(20)),llimb:mkVAO(gLimb(8)),wing:mkVAO(gWing()),prism:mkVAO(gPrism()),frus:mkVAO(gCyl(26,.32,.5)),blob:mkVAO(gBlob(22,15,.22,5,1.6))};

/* =====================================================================
   3D WORLD
   ===================================================================== */
const HR=2, HN=MW*HR+1, HNZ=MH*HR+1, HG=new Float32Array(HN*HNZ), HLM=new Float32Array(HN*HNZ);
const WATER_Y=0, LAVA_Y=2.6;
const LAMPS=[[-6,-3],[6,-3],[-6,6],[6,6],[0,9],[-11,0],[11,0],[0,-12],[-2,14],[3,-15]].map(([dx,dy])=>({x:(TOWN.x+dx)*TS+16,y:(TOWN.y+dy)*TS+16})).filter(L=>!SOLID.has(tAt(Math.floor(L.x/TS),Math.floor(L.y/TS))));
const GC={17:[150,190,218],18:[200,208,222],0:[96,142,62],1:[60,100,46],4:[168,142,98],5:[214,192,140],6:[78,90,52],7:[140,137,126],9:[66,55,51],11:[146,138,120],14:[120,88,55],3:[120,104,78],10:[46,26,20]};
function groundT(t,tx,ty){ const z=zmap[clamp(ty,0,MH-1)*MW+clamp(tx,0,MW-1)];
  if(t===T.TREE||t===T.ROCK||t===T.PROP) return z==='ash'?T.ASH:z==='forest'?T.FOREST:z==='swamp'?T.SWAMP:z==='town'?T.COBBLE:z==='ruins'?T.RUIN:T.GRASS;
  if(t===T.HOUSE||t===T.FOUNT) return T.COBBLE; if(t===T.WALL) return T.RUIN; return t; }
function cellType(wx,wy){
  const tx=Math.floor(wx/TS),ty=Math.floor(wy/TS); const t=tAt(tx,ty);
  if(t===T.BRIDGE||t===T.HOUSE||t===T.WALL||t===T.FOUNT) return groundT(t,tx,ty);
  const ox=(vnoise(wx*.035,wy*.035,77)-.5)*22, oy=(vnoise(wx*.035,wy*.035,78)-.5)*22;
  const ux=Math.floor((wx+ox)/TS),uy=Math.floor((wy+oy)/TS); const t2=tAt(ux,uy);
  if(t2===T.BRIDGE) return groundT(t,tx,ty);
  return groundT(t2,ux,uy);
}
(function buildHeights(){
  const TT=new Float32Array(MW*MH);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ const i=ty*MW+tx, t=map[i], z=zmap[i]; const n=fbm(tx*.08,ty*.08,301), n2=fbm(tx*.22,ty*.22,302);
    let h; switch(z){ case 'town':h=.55;break; case 'meadow':h=.4+n*2.6;break; case 'forest':h=.6+n*3.2+n2*.7;break; case 'swamp':h=.2+n*.35;break; case 'ruins':h=.7+n*1.7;break; case 'lake':h=.35+n*.9;break; case 'frost':h=1.2+n*3.8+n2*.9;break; case 'crypt':h=2.2;break; case 'ash':h=3.1+n*1.5+n2*.6;break; default:h=.5; }
    const edge=Math.min(tx,ty,MW-1-tx,MH-1-ty);
    if(t===T.ICE) h=.22; else if(t===T.WATER) h=-1.5; else if(t===T.LAVA) h=1.4; else if(t===T.BRIDGE) h=z==='ash'?3.0:.4;
    else if(t===T.ROCK && (edge<3||(tx>=109&&tx<=115&&!(ty>=56&&ty<=62)))) h+=4.5+hash2(tx,ty,9)*4+(edge<2?3.5:0)+(edge<1?3:0);
    else if(t===T.COBBLE||t===T.HOUSE||t===T.FOUNT) h=.55;
    if(Math.hypot(tx-LAIR.x,ty-LAIR.y)<6.5 && t!==T.ROCK) h=3.0;
    TT[i]=h; }
  const B=new Float32Array(TT); for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){ let s=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) s+=TT[(ty+dy)*MW+tx+dx]*(dx||dy?1:4); B[ty*MW+tx]=s/12; }
  const LMt=new Float32Array(MW*MH); for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){ let l=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(map[(ty+dy)*MW+tx+dx]===T.LAVA) l=1; LMt[ty*MW+tx]=l; }
  const tt=(x,y)=>B[clamp(y,0,MH-1)*MW+clamp(x,0,MW-1)];
  for(let j=0;j<HNZ;j++)for(let i=0;i<HN;i++){ const X=i/HR, Z=j/HR; const fx=X-.5, fz=Z-.5; const x0=Math.floor(fx), z0=Math.floor(fz), ax=fx-x0, az=fz-z0;
    let h=lerp(lerp(tt(x0,z0),tt(x0+1,z0),ax),lerp(tt(x0,z0+1),tt(x0+1,z0+1),ax),az);
    const tx=clamp(Math.floor(X),0,MW-1), ty=clamp(Math.floor(Z),0,MH-1), t=map[ty*MW+tx], z=zmap[ty*MW+tx];
    if(i%2===1&&j%2===1){ if(t===T.WATER) h=Math.min(h,-.7); else if(t===T.LAVA) h=Math.min(h,LAVA_Y-.7); else if(z==='ash'&&t!==T.BRIDGE) h=Math.max(h,LAVA_Y+.15); else h=Math.max(h,.12); }
    if(z!=='town'&&z!=='crypt'&&t!==T.WATER&&t!==T.BRIDGE&&t!==T.HOUSE&&t!==T.ICE) h+=(vnoise(X*.9,Z*.9,55)-.5)*.32;
    HG[j*HN+i]=h; HLM[j*HN+i]=LMt[ty*MW+tx]; }
})();
function hgt(X,Z){ const fx=clamp(X*HR,0,HN-1.001), fz=clamp(Z*HR,0,HNZ-1.001); const i=Math.floor(fx), j=Math.floor(fz), a=fx-i, b=fz-j;
  return lerp(lerp(HG[j*HN+i],HG[j*HN+i+1],a),lerp(HG[(j+1)*HN+i],HG[(j+1)*HN+i+1],a),b); }
function groundY(px,py){ const X=px/TS, Z=py/TS; let h=hgt(X,Z); const t=tAt(Math.floor(X),Math.floor(Z)); if(t===T.BRIDGE) h=Math.max(h,zoneAtPx(px,py)==='ash'?3.12:.52); return h; }

/* ---------- terrain mesh ---------- */
const TERRAIN=(function(){ const d=G0(); const GCn={}; for(const k in GC) GCn[k]=GC[k].map(v=>v/255);
  for(let j=0;j<HNZ;j++)for(let i=0;i<HN;i++){ const X=i/HR, Z=j/HR; const h=HG[j*HN+i];
    const hl=HG[j*HN+Math.max(0,i-1)], hr=HG[j*HN+Math.min(HN-1,i+1)], hu=HG[Math.max(0,j-1)*HN+i], hd=HG[Math.min(HNZ-1,j+1)*HN+i];
    let nx=(hl-hr)*HR*.5, nz=(hu-hd)*HR*.5, ny=1; const l=Math.hypot(nx,ny,nz);
    const ct=cellType(X*TS+1,Z*TS+1); let c=(GCn[ct]||GCn[0]).slice(); const v=(fbm(X*.35,Z*.35,40)-.5)*.35;
    if(ct===T.GRASS||ct===T.FOREST){ const dry=fbm(X*.12,Z*.12,41); c=[c[0]*(1+dry*.25),c[1]*(1+dry*.08),c[2]]; }
    if(h<.15&&ct!==T.WATER&&ct!==T.BRIDGE&&ct!==T.COBBLE){ const w=clamp((.15-h)/.4,0,1); c=c.map((x,k)=>lerp(x,[.5,.45,.33][k],w)); }
    if(HLM[j*HN+i]>0&&ct===T.ASH) c=c.map(x=>x*.75);
    let av=0,cn=0; for(let dj=-3;dj<=3;dj+=3)for(let di=-3;di<=3;di+=3){ const ii=clamp(i+di,0,HN-1), jj=clamp(j+dj,0,HNZ-1); av+=HG[jj*HN+ii]; cn++; } const ao=clamp(1+(h-av/cn)*.32,.62,1.1);
    gPush(d,X,h,Z,nx/l,ny/l,nz/l,c.map(x=>x*(1+v)*ao),ct===T.ICE?.08:0); }
  for(let j=0;j<HNZ-1;j++)for(let i=0;i<HN-1;i++){ const a=j*HN+i, b=a+HN; d.i.push(a,b,a+1,b,b+1,a+1); }
  return mkVAO(d); })();
const HTEX=(function(){ const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex); const data=new Float32Array(HN*HNZ*2); for(let k=0;k<HN*HNZ;k++){ data[k*2]=HG[k]; data[k*2+1]=HLM[k]; }
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RG16F,HN,HNZ,0,gl.RG,gl.FLOAT,data); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return tex; })();
const PLANE=(function(){ const d=G0(); const S=MW+40; for(const [x,z] of [[-20,-20],[S,-20],[S,S],[-20,S]]) gPush(d,x,0,z,0,1,0); d.i.push(0,1,2,0,2,3); return mkVAO(d); })();
const LPLANE=(function(){ const d=G0(); for(const [x,z] of [[0,0],[MW,0],[MW,30],[0,30]]) gPush(d,x,0,z,0,1,0); d.i.push(0,1,2,0,2,3); return mkVAO(d); })();

/* ---------- static scenery ---------- */
const RB=gBox(), RS=gSphere(10,7), RC=gCyl(10,.5,.5), RCN=gCyl(10,0,.5), RP=gPrism(), RFR=gCyl(12,.36,.5), RBL=gSphere(8,6,.45,3);
const STAT_LIGHTS=[], CHIMNEYS=[], FOUNTAIN={x:TOWN.x+.5,z:TOWN.y+.5};
const STATIC=(function(){ const d=G0(); const R=mulberry32(4242);
  const wood=[.32,.21,.12], dark=[.2,.13,.08], stone=[.55,.53,.5], plaster=[.86,.8,.66], roof=[.55,.2,.13], iron=[.12,.11,.1];
  const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e);
  // houses
  for(const hs of houses){ const x0=hs.x, z0=hs.y, w=hs.w, h=hs.h, cx=x0+w/2, cz=z0+h/2, y0=.55;
    box(cx,y0+.15,cz,w+.1,.3,h+.1,stone);
    box(cx,y0+.3+1.05,cz,w-.2,2.1,h-.2,plaster);
    for(const fz of [z0+.1,z0+h-.1]){ for(let x=x0+.1;x<=x0+w-.05;x+=Math.max(1,(w-.2)/Math.round(w/1.3))) box(x,y0+1.35,fz,.14,2.1,.14,dark); box(cx,y0+1.35,fz,w-.2,.14,.14,dark); box(cx,y0+2.35,fz,w-.2,.16,.16,dark); }
    for(const fx of [x0+.1,x0+w-.1]) box(fx,y0+1.35,cz,.14,2.1,h-.2,dark);
    gAdd(d,RP,cx,y0+2.4,cz,Math.PI/2,h+.8,1.7,w+.7,roof);
    box(cx,y0+4.12,cz,w+.75,.14,.22,[.4,.14,.1]);
    box(x0+w-1.1,y0+3.6,z0+.8,.55,1.9,.55,[.45,.42,.4]); box(x0+w-1.1,y0+4.6,z0+.8,.7,.15,.7,[.3,.28,.26]); CHIMNEYS.push({x:x0+w-1.1,y:y0+4.8,z:z0+.8});
    box(cx,y0+1.05,z0+h-.06,.95,1.5,.12,wood); box(cx,y0+1.85,z0+h-.04,1.15,.14,.16,dark); box(cx+.3,y0+1.0,z0+h+.02,.08,.08,.06,[.8,.65,.3]);
    for(const [wx,wz] of [[x0+1.1,z0+h-.08],[x0+w-1.1,z0+h-.08],[x0+1.1,z0+.08],[x0+w-1.1,z0+.08]]){ box(wx,y0+1.55,wz,.7,.6,.08,[1,.72,.38],0,1.6); box(wx,y0+1.55,wz+(wz>cz?.03:-.03),.08,.6,.1,dark); box(wx,y0+1.2,wz+(wz>cz?.12:-.12),.85,.14,.22,[.4,.26,.14]);
      for(let k=0;k<3;k++) gAdd(d,RS,wx-.25+k*.25,y0+1.33,wz+(wz>cz?.12:-.12),0,.16,.14,.16,[[.9,.3,.4],[.95,.85,.3],[.8,.5,.9]][k]);
      STAT_LIGHTS.push({x:wx,y:y0+1.5,z:wz+(wz>cz?.6:-.6),r:3.2,c:[1,.62,.3],night:true}); }
    for(let k=0;k<3;k++){ const bx=x0-.35+R()*.2, bz=z0+.5+k*.7; if(R()<.6) gAdd(d,RFR,bx,y0,bz,0,.5,.75,.5,[.42,.28,.15]); else box(bx,y0+.3,bz,.6,.6,.6,[.5,.36,.2],R()); } }
  // fountain
  { const fx=FOUNTAIN.x, fz=FOUNTAIN.z, y0=.55; gAdd(d,RC,fx,y0,fz,0,3.0,.55,3.0,stone); gAdd(d,RC,fx,y0+.5,fz,0,2.62,.06,2.62,[.2,.45,.6],.15);
    gAdd(d,RC,fx,y0,fz,0,.55,1.4,.55,stone); gAdd(d,RFR,fx,y0+1.35,fz,0,1.2,.3,1.2,stone); gAdd(d,RS,fx,y0+1.85,fz,0,.35,.35,.35,[.85,.68,.3]); gAdd(d,RC,fx,y0+1.58,fz,0,1.0,.05,1.0,[.25,.5,.65],.2); }
  // lamps
  for(const L of LAMPS){ const x=L.x/TS, z=L.y/TS, y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.12,2.7,.12,iron); gAdd(d,RC,x,y0,z,0,.28,.18,.28,iron);
    box(x,y0+2.9,z,.32,.42,.32,[1,.62,.25],0,1.3); box(x,y0+3.16,z,.42,.08,.42,iron); gAdd(d,RCN,x,y0+3.2,z,0,.36,.28,.36,iron);
    STAT_LIGHTS.push({x,y:y0+2.9,z,r:9,c:[1.2,.75,.38],night:true,lamp:true}); }
  // market stall (Mira) & notice board (Oriel)
  { const mx=NPCS[1].x/TS+.3, mz=NPCS[1].y/TS-1.3, y0=.55;
    for(const [ox,oz] of [[-1.3,-.6],[1.3,-.6],[-1.3,.6],[1.3,.6]]) box(mx+ox,y0+1.2,mz+oz,.12,2.4,.12,wood);
    for(let k=0;k<6;k++) box(mx-1.25+k*.5,y0+2.45,mz,.5,.08,1.5,k%2?[.85,.82,.72]:[.6,.12,.12],0);
    box(mx,y0+.55,mz+.55,2.6,.12,.5,wood); box(mx,y0+.3,mz+.55,2.5,.5,.4,[.4,.27,.15]);
    for(let k=0;k<5;k++) gAdd(d,RS,mx-1+k*.5,y0+.7,mz+.55,0,.22,.22,.22,[[.9,.2,.2],[.95,.7,.2],[.4,.8,.3],[.9,.5,.1],[.6,.3,.7]][k]);
    gAdd(d,RFR,mx+1.8,y0,mz+.2,0,.6,.85,.6,[.42,.28,.15]); box(mx-1.9,y0+.3,mz,.6,.6,.6,[.5,.36,.2],.4); box(mx-1.85,y0+.85,mz+.1,.45,.45,.45,[.55,.4,.22],.9); }
  { const nx=NPCS[0].x/TS-1.4, nz=NPCS[0].y/TS-.9, y0=.55; box(nx-.6,y0+.9,nz,.12,1.8,.12,wood); box(nx+.6,y0+.9,nz,.12,1.8,.12,wood); box(nx,y0+1.35,nz,1.5,.9,.08,[.45,.3,.17]);
    for(let k=0;k<4;k++) box(nx-.45+k*.3,y0+1.35+(k%2)*.15,nz+.05,.22,.28,.02,[.92,.88,.78],(k-1.5)*.1); }
  // ruins
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ if(map[ty*MW+tx]!==T.WALL) continue; const h=1.1+hash2(tx,ty,4)*1.7, x=tx+.5, z=ty+.5, y0=hgt(x,z);
    box(x,y0+h/2-.2,z,1.02,h,1.02,[.4+hash2(tx,ty,5)*.07,.39,.36]); if(hash2(tx,ty,6)<.35) box(x+.3,y0+h-.05,z-.2,.5,.35,.5,[.5,.48,.44],hash2(tx,ty,7));
    if(hash2(tx,ty,8)<.3){ box(x+(hash2(tx,ty,9)-.5)*2.2,y0+.18,z+(hash2(tx,ty,10)-.5)*2.2,.6,.36,.5,[.5,.48,.44],hash2(tx,ty,11)*3); }
    if(hash2(tx,ty,12)<.25) gAdd(d,RS,x,y0+h-.1,z,0,1.1,.25,1.1,[.3,.45,.22]); }
  { const kx=88.5, kz=40.5, y0=hgt(kx,kz); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; const x=kx+Math.cos(a)*4.6, z=kz+Math.sin(a)*4.6; const broken=k%3===1; const hh=broken?1.6+hash2(k,1,1)*1.2:4.2;
      gAdd(d,RC,x,y0,z,0,.7,hh,.7,[.5,.48,.44]); gAdd(d,RC,x,y0,z,0,.95,.3,.95,[.5,.48,.45]); if(!broken) gAdd(d,RB,x,y0+hh+.15,z,a,1.1,.3,1.1,[.55,.53,.5]); else gAdd(d,RC,x+.9,y0+.35,z+.4,a,.7,1.4,.7,[.6,.58,.53],0,Math.PI/2); }
    box(kx,y0+.25,kz-3.4,3.2,.5,1.6,[.45,.43,.4]); box(kx,y0+1.0,kz-3.6,1.5,1.0,1.0,[.4,.38,.36]); box(kx,y0+2.3,kz-4.0,1.6,2.6,.3,[.4,.38,.36]);
    for(const s of [-1,1]) box(kx+s*.7,y0+1.6,kz-3.6,.2,.6,1.0,[.4,.38,.36]); box(kx,y0+1.52,kz-3.55,1.3,.06,.9,[.4,.08,.15]);
    for(const s of [-1,1]) { gAdd(d,RC,kx+s*2.2,y0,kz-2.6,0,.25,1.3,.25,iron); box(kx+s*2.2,y0+1.4,kz-2.6,.3,.3,.3,[.4,.9,1],0,1.8); STAT_LIGHTS.push({x:kx+s*2.2,y:y0+1.5,z:kz-2.6,r:6,c:[.4,.8,1.1]}); } }
  // bridges
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ if(map[ty*MW+tx]!==T.BRIDGE) continue; const ash=zmap[ty*MW+tx]==='ash'; const yb=ash?3.0:.4;
    const ew=(tAt(tx-1,ty)===T.BRIDGE||tAt(tx-1,ty)===T.PATH)&&(tAt(tx+1,ty)===T.BRIDGE||tAt(tx+1,ty)===T.PATH);
    for(let k=0;k<4;k++){ const o=-.375+k*.25; if(ew) box(tx+.5+o,yb+.05,ty+.5,.22,.1,1.05,ash?[.3,.27,.25]:[.42,.29,.17],0); else box(tx+.5,yb+.05,ty+.5+o,1.05,.1,.22,ash?[.3,.27,.25]:[.42,.29,.17],0); } }
  // campfires
  for(const [cx,cz] of [[48,66],[33,56],[70,70],[62,30]]){ if(SOLID.has(tAt(cx,cz))) continue; const x=cx+.5,z=cz+.5,y0=hgt(x,z);
    for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; gAdd(d,RBL,x+Math.cos(a)*.55,y0+.08,z+Math.sin(a)*.55,0,.3,.22,.3,[.45,.43,.4]); }
    for(let k=0;k<3;k++) gAdd(d,RC,x,y0+.12,z,k*1.05,.12,.8,.12,[.3,.2,.12],0,Math.PI/2.4);
    gAdd(d,RS,x,y0+.1,z,0,.5,.18,.5,[1,.45,.1],2.5); STAT_LIGHTS.push({x,y:y0+.6,z,r:8,c:[1.4,.6,.2],fire:true}); }
  addLandmarks(d);
  return mkVAO(d); })();

/* ---------- instanced vegetation & rocks ---------- */
function treeGeo(kind){ const d=G0(); const R=mulberry32(kind*77+1);
  if(kind===2){ gAdd(d,RFR,0,0,0,0,.3,1.4,.3,[.3,.2,.12]); for(let k=0;k<7;k++){ const SK=gSkirt(16,9+k%3,k+3); gAdd(d,SK,0,.65+k*.5,0,R()*3,2.0-k*.25,1.0,2.0-k*.25,[.07,.18,.11]); gAdd(d,SK,0,.86+k*.5,0,R()*3,1.62-k*.22,.62,1.62-k*.22,[.9,.94,1]); } gAdd(d,gSkirt(14,5,2),0,4.1,0,0,.5,.8,.5,[.92,.95,1]); }
  else if(kind===1){ gAdd(d,RFR,0,0,0,0,.3,1.5,.3,[.3,.2,.12]); for(let k=0;k<8;k++){ const sh=.85+R()*.3; gAdd(d,gSkirt(18,9+k%4,k+11),0,.62+k*.48,0,R()*3,2.05-k*.23,.95,2.05-k*.23,[(.07+k*.01)*sh,(.2+k*.022)*sh,.1*sh]); } gAdd(d,gSkirt(14,5,9),0,4.3,0,0,.45,.8,.45,[.1,.28,.13]); }
  else { gAdd(d,RFR,0,0,0,0,.42,2.0,.42,[.34,.24,.15]); gAdd(d,RC,.25,1.5,0,0,.16,1.0,.16,[.34,.24,.15],0,-.7); gAdd(d,RC,-.2,1.6,.1,0,.14,.9,.14,[.34,.24,.15],0,.8);
    const bl=[[0,2.9,0,1.9],[.8,2.5,.3,1.3],[-.75,2.6,-.2,1.35],[.1,3.6,-.15,1.4],[-.3,2.4,.75,1.2],[.35,2.5,-.8,1.2]];
    for(const [x,y,z,s] of bl){ const sh=.85+R()*.3; gAdd(d,gBlob(14,10,.32,Math.floor(R()*999),1.5),x,y,z,R()*3,s*1.05,s*.88,s*1.05,[.2*sh,.4*sh,.15*sh]); }
    for(let k=0;k<9;k++){ const a=R()*6.28, r=.9+R()*.7, sh=.9+R()*.3; gAdd(d,gBlob(10,7,.3,Math.floor(R()*999),2),Math.cos(a)*r,2.3+R()*1.3,Math.sin(a)*r,R()*3,.75,.62,.75,[.22*sh,.43*sh,.16*sh]); } }
  for(let i=0;i<d.p.length/3;i++){ const k=.58+.42*clamp(d.p[i*3+1]/4.2,0,1); d.c[i*4]*=k; d.c[i*4+1]*=k; d.c[i*4+2]*=k; } return d; }
function chunkInst(geo,arr,cs){ const by=new Map(); for(let i=0;i<arr.length;i+=11){ const k=Math.floor(arr[i]/cs)*1000+Math.floor(arr[i+2]/cs); let a=by.get(k); if(!a){ a=[]; by.set(k,a); } for(let j=0;j<11;j++) a.push(arr[i+j]); }
  const chunks=[]; for(const [k,a] of by){ const v=mkVAO(geo,a); chunks.push({cx:(Math.floor(k/1000)+.5)*cs,cz:(k%1000+.5)*cs,vao:v.vao,n:v.n,count:v.count}); } return {chunks,count:arr.length/11,n:0}; }
const ROCKG=gBlob(18,12,.6,11,1.1);
const INST=(function(){ const R=mulberry32(9090); const trees=[[],[],[]], rocks=[], grass=[], flowers=[];
  const push=(arr,x,y,z,ry,sx,sy,sz,sw,c)=>arr.push(x,y,z,ry,sx,sy,sz,sw,c[0],c[1],c[2]);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ const t=map[ty*MW+tx], z=zmap[ty*MW+tx];
    if(t===T.TREE){ const x=tx+.5+(R()-.5)*.5, zz=ty+.5+(R()-.5)*.5, y=hgt(x,zz)-.05; const pine=(z==='forest'&&R()<.55);
      const s=.75+R()*.55; const tint=pine?[.85+R()*.25,.9+R()*.2,.85+R()*.15]:z==='swamp'?[.7,.85,.8]:z==='forest'?[.8+R()*.2,.85+R()*.2,.8]:[.85+R()*.25,.95+R()*.15,.85]; push(trees[z==='frost'?2:pine?1:0],x,y,zz,R()*6.28,s,s*(.9+R()*.3),s,.004,tint); }
    else if(t===T.ROCK){ const edge=Math.min(tx,ty,MW-1-tx,MH-1-ty), ridge=tx>=109&&tx<=115; if((edge<3||ridge)&&R()>.28) continue; const x=tx+.5, zz=ty+.5, y=hgt(x,zz);
      const s=(edge<3||ridge)?2+R()*2.2:.9+R()*.7; const c=z==='frost'?[.92,.97,1.1]:z==='ash'?[.42,.36,.34]:[.95+R()*.1,.95,.9]; push(rocks,x,y-.15,zz,R()*6.28,s*1.15,s*(.7+R()*.4),s,0,c); } }
  for(let j=0;j<MH*3;j++)for(let i=0;i<MW*3;i++){ const X=(i+R())/3, Z=(j+R())/3; const px=X*TS, py=Z*TS; const t=tAt(Math.floor(X),Math.floor(Z)); if(SOLID.has(t)&&t!==T.TREE) continue;
    const ct=cellType(px,py); const p=(ct===T.GRASS?.55:ct===T.FOREST?.3:ct===T.SWAMP?.32:0)*GFX.grass; if(R()>p) continue; const y=hgt(X,Z); if(y<.05) continue;
    const s=.35+R()*.4; const dry=fbm(X*.12,Z*.12,41); const c=ct===T.SWAMP?[.42,.5,.25]:ct===T.FOREST?[.22,.42,.16]:[.36+dry*.25,.6+dry*.1,.2];
    push(grass,X,y,Z,R()*6.28,s*1.3,s*(ct===T.SWAMP?.95:.55),s*1.3,.12,c);
    if(ct===T.GRASS&&R()<.035) push(flowers,X+.1,y,Z,R()*6.28,.3,.4+R()*.2,.3,.03,[[1,.85,.3],[.95,.5,.7],[1,1,1],[.7,.55,1],[1,.45,.3]][Math.floor(R()*5)]);
    if(ct===T.FOREST&&R()<.02) push(flowers,X,y,Z,R()*6.28,.5,.3,.5,0,[.9,.25,.2]); }
  return {snow:mkVAO(treeGeo(2),trees[2]),broad:mkVAO(treeGeo(0),trees[0]), pine:mkVAO(treeGeo(1),trees[1]), rocks:mkVAO(ROCKG,rocks), grass:chunkInst(GFX.q==='low'?gTuft():gTuft2(),grass,12), flowers:chunkInst(gFlower(),flowers,12)}; })();

/* ---------- shadow map ---------- */
const SM_SIZE=GFX.sm; const SM=(function(){ const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,SM_SIZE,SM_SIZE,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
  const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,tex,0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); return {tex,fb}; })();
/* particles buffer */
const PMAX=3000; const PBUF=new Float32Array(PMAX*8); const PVAO=(function(){ const vao=gl.createVertexArray(); gl.bindVertexArray(vao); const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,PBUF.byteLength,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,4,gl.FLOAT,false,32,0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,16); gl.bindVertexArray(null); return {vao,b}; })();
const SKYVAO=(function(){ const vao=gl.createVertexArray(); gl.bindVertexArray(vao); const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null); return vao; })();
/* minimap base */
const miniBase=document.createElement('canvas'); miniBase.width=MW; miniBase.height=MH;
{ const c=miniBase.getContext('2d'); const id=c.createImageData(MW,MH);
  const MC={0:[93,140,60],1:[52,92,44],2:[34,74,34],3:[45,106,146],4:[179,152,100],5:[212,189,134],6:[74,87,51],7:[138,136,125],8:[87,84,77],9:[70,59,54],10:[216,80,26],11:[154,144,124],12:[140,59,46],13:[43,39,36],14:[138,98,57],15:[58,127,174]};
  for(let i=0;i<MW*MH;i++){const col=MC[map[i]]||[0,0,0]; id.data.set([...col,255],i*4)} c.putImageData(id,0,0); }

/* =====================================================================
   ACTORS — procedural rigs with animation
   ===================================================================== */
const cmds=[], tcmds=[], L3=[]; let LOD_FAR=false, LOD_MID=false, CAST_SH=true;
const METALS=new WeakSet(), SKINSET=new WeakSet();
function P(geo,sx,sy,sz,col,emis,ox,oy,oz,alpha){ const mxs=Math.max(Math.abs(sx),Math.abs(sy),Math.abs(sz)); if(LOD_MID&&mxs<.075) return; if(LOD_FAR){ if(mxs<.16) return; geo=geo===GEO.box?GEO.cube:geo===GEO.sph?GEO.lsph:geo===GEO.limb?GEO.llimb:geo===GEO.cyl?GEO.lcyl:geo===GEO.cone?GEO.lcone:geo; } else if(GFX.q==='low'){ if(Math.abs(sx)<.05&&Math.abs(sy)<.05&&Math.abs(sz)<.05) return; geo=geo===GEO.sph?GEO.lsph:geo===GEO.limb?GEO.llimb:geo; } const m=CUR.slice(); if(ox||oy||oz) for(let i=0;i<4;i++) m[12+i]+=m[i]*(ox||0)+m[4+i]*(oy||0)+m[8+i]*(oz||0);
  for(let i=0;i<4;i++){ m[i]*=sx; m[4+i]*=sy; m[8+i]*=sz; }
  const c={g:geo,m,c:col,e:emis||0,inv:[1/(sx*sx),1/(sy*sy),1/(sz*sz)],a:alpha??1,sh:CAST_SH&&mxs>.06,sp:METALS.has(col)?.95:SKINSET.has(col)?.26:.12}; (c.a<1?tcmds:cmds).push(c); }
const addLight=(x,y,z,r,c)=>L3.push({x,y,z,r,c});
const SKIN=['#f1c8a5','#e0b08a','#c68e66','#9a6644','#6e4630'].map(C3); SKIN.forEach(x=>SKINSET.add(x));
const hashU=u=>{ let h=0; for(const ch of String(u)) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h); };
const LOOK={
  warden:{torso:[.62,.66,.72],legs:[.3,.32,.38],arms:[.6,.64,.7],boots:[.22,.18,.15],cape:[.15,.26,.55],trim:[.82,.66,.3],tabard:[.17,.3,.62],head:'helm',metal:[.72,.75,.82],pauld:[.7,.74,.8],weapon:'sword',off:'shield'},
  mender:{torso:[.94,.91,.83],legs:[.88,.84,.74],arms:[.94,.91,.83],boots:[.4,.3,.2],cape:[.96,.93,.85],trim:[.88,.7,.3],robe:[.94,.91,.83],head:'hood',hood:[.96,.93,.85],weapon:'staff',orb:[1,.88,.45]},
  arcanist:{torso:[.36,.2,.56],legs:[.24,.14,.4],arms:[.36,.2,.56],boots:[.2,.14,.2],cape:[.26,.12,.44],trim:[.88,.72,.36],robe:[.33,.18,.52],head:'hat',hat:[.22,.12,.4],weapon:'wand',orbs:true},
  thornling:{scale:1.25,skin:[.36,.26,.15],torso:[.38,.27,.15],legs:[.3,.22,.12],arms:[.34,.24,.13],boots:[.26,.18,.1],head:'leafy',leaf:[.3,.56,.22],eyes:[1,.65,.15],hunch:.3,longArms:true},
  bogwitch:{scale:.95,skin:[.5,.62,.38],robe:[.18,.28,.16],torso:[.18,.28,.16],arms:[.2,.3,.18],legs:[.15,.2,.12],boots:[.1,.1,.08],head:'witch',hat:[.1,.14,.09],hunch:.35,weapon:'lantern',eyes:[.8,1,.4]},
  sentinel:{skel:true,bone:[.86,.83,.74],head:'skull',eyes:[.45,.95,1],weapon:'rustsword',off:'rustshield',metal:[.5,.44,.38],scale:1.05},
  hking:{skel:true,bone:[.92,.88,.78],head:'crown',eyes:[.45,.95,1],cape:[.22,.05,.12],pauld:[.86,.68,.3],weapon:'greatsword',metal:[.8,.84,.9],scale:1.75},
  cultist:{robe:[.46,.08,.12],torso:[.46,.08,.12],arms:[.42,.07,.1],legs:[.2,.05,.06],boots:[.1,.05,.05],head:'hood',hood:[.24,.04,.07],skin:[.22,.16,.15],trim:[.86,.68,.3],weapon:'flames',eyes:[1,.5,.1]},
  magma:{scale:1.45,rock:true,torso:[.2,.14,.11],arms:[.23,.16,.12],legs:[.2,.14,.11],boots:[.18,.12,.1],skin:[.24,.16,.12],head:'rock',core:[1,.42,.08],eyes:[1,.6,.1],hunch:.25},
  oriel:{torso:[.78,.62,.3],legs:[.3,.24,.22],arms:[.75,.6,.3],boots:[.22,.16,.12],cape:[.6,.1,.1],trim:[.9,.75,.35],tabard:[.62,.1,.12],head:'plume',metal:[.8,.65,.32],pauld:[.84,.68,.32],weapon:'spear'},
  mira:{robe:[.3,.46,.3],torso:[.3,.46,.3],arms:[.32,.48,.32],legs:[.25,.3,.2],boots:[.3,.2,.12],head:'hoodopen',hood:[.36,.52,.36],trim:[.8,.6,.3],pack:true},
};
const BRIGHT=c=>c.map(x=>Math.min(1,x*1.4+.15));
const HAIR=[[.18,.12,.08],[.45,.28,.14],[.75,.55,.25],[.1,.08,.07],[.6,.25,.1],[.85,.82,.78]];
Object.assign(LOOK,{
  hakon:{torso:[.42,.32,.24],legs:[.3,.24,.2],arms:[.45,.36,.28],boots:[.55,.5,.45],cape:[.85,.84,.8],trim:[.7,.6,.4],head:'horned',metal:[.62,.64,.68],pauld:[.82,.8,.76],fur:true,weapon:'axe',beard:[.75,.5,.25]},
  yeti:{scale:1.9,torso:[.86,.89,.93],legs:[.8,.84,.9],arms:[.86,.89,.93],boots:[.55,.6,.7],skin:[.45,.6,.8],head:'yeti',hunch:.35,longArms:true,fur:true},
  frostgiant:{scale:2.7,torso:[.5,.62,.76],legs:[.45,.36,.28],arms:[.52,.64,.78],boots:[.4,.32,.25],skin:[.52,.66,.82],head:'giant',cape:[.5,.42,.34],pauld:[.82,.84,.8],fur:true,weapon:'club',trim:[.4,.32,.25],eyes:[.5,.9,1]},
  cryptmage:{robe:[.1,.08,.14],torso:[.1,.08,.14],arms:[.12,.1,.16],legs:[.1,.08,.12],boots:[.08,.06,.08],head:'skullhood',hood:[.07,.06,.1],skin:[.88,.85,.75],trim:[.5,.35,.7],weapon:'skullstaff',eyes:[.5,1,.4]},
  thrall:{skel:true,bone:[.7,.66,.58],head:'skull',eyes:[.5,1,.4],weapon:'rustsword'},
  deathguard:{skel:true,bone:[.74,.71,.64],head:'skullhelm',eyes:[.6,1,.4],weapon:'greatsword',off:'rustshield',metal:[.34,.34,.38],pauld:[.34,.34,.38],cape:[.12,.12,.15],scale:1.3},
});
function emitTip(col,x,y,z){ const m=CUR; const X=m[0]*x+m[4]*y+m[8]*z+m[12], Y=m[1]*x+m[5]*y+m[9]*z+m[13], Z=m[2]*x+m[6]*y+m[10]*z+m[14]; P3(X,Y,Z,0,0,0,.28,.1,col,{glow:true,drag:.9}); }
function drawHumanoid(o){
  const L=o.L, t=now(), sc=(L.scale||1)*(o.sc||1)*(o.big||1); const mv=o.mv||0, ph=o.walk||0;
  const skin=L.skin||o.skin||SKIN[0]; const bone=L.bone; if(L.metal) METALS.add(L.metal); if(L.pauld) METALS.add(L.pauld); if(L.trim) METALS.add(L.trim); const hitE=o.hit?.9:0;
  const EM=o.emote&&o.emote.k, sitting=EM==='sit', kneel=EM==='kneel';
  const emL=sitting?-.5:kneel?-.4:EM==='dance'?Math.abs(Math.sin(t*6))*.1:EM==='cheer'?Math.abs(Math.sin(t*5))*.22:0;
  mreset(); const bob=Math.abs(Math.cos(ph))*.07*mv+Math.sin(t*2.1+o.x)*.008;
  mtr(o.x,o.y+(o.lift||0)+emL+bob*sc,o.z); mry(-o.face-(EM==='dance'?Math.sin(t*2.5)*.9:0)); msc(sc);
  if(o.dead>=0){ const k=Math.min(1,o.dead/.6); mrz(-k*1.45); mtr(0,k*.12,0); }
  const legA=Math.sin(ph)*.75*mv, armA=Math.sin(ph)*.6*mv;
  const limbW=bone?.075:(L.rock?.2:.15), legCol=bone||L.legs, armCol=bone||L.arms, boots=L.boots||legCol;
  for(const s of [-1,1]){ mpush(); mtr(0,.93,s*.115); let a=(s>0?legA:-legA); if(o.ride){ mrx(-s*.5); a=1.2; } else if(sitting) a=1.5; else if(kneel) a=s>0?1.4:-.1; else if(o.swim) a=Math.sin(t*5+s*2)*.45; mrz(a);
    P(GEO.limb,limbW*1.12,.45,limbW*1.15,legCol,hitE); if(!bone&&!L.robe){ P(GEO.sph,limbW*1.5,limbW*2.3,limbW*1.5,legCol,hitE,.02,-.15,0); } mtr(0,-.45,0); P(GEO.sph,limbW*1.08,limbW*1.08,limbW*1.08,bone||(L.metal&&!bone?L.metal:legCol),hitE);
    if(L.metal&&!bone) P(GEO.sph,.17,.15,.17,L.metal,hitE,.03,0,0);
    let knee=Math.max(0,Math.cos(ph+(s>0?0:Math.PI)))*.95*mv+(L.hunch||0)*.25; if(o.ride) knee=1.5; else if(sitting) knee=.1; else if(kneel) knee=s>0?1.5:1.6; mrz(-knee);
    P(GEO.limb,limbW*.92,.42,limbW*.92,bone?legCol:boots,hitE); if(!bone){ P(GEO.sph,limbW*1.22,limbW*1.9,limbW*1.2,boots,hitE,-.035,-.12,0); P(GEO.frus,limbW*1.7,.1,limbW*1.7,L.fur?[.85,.84,.8]:boots.map(v=>v*1.15),hitE,0,-.08,0); }
    mtr(0,-.43,0); mrz(knee-a*.6);
    if(bone){ P(GEO.box,.26,.06,.12,boots,hitE,.06,-.05,0); for(let k=-1;k<=1;k++) P(GEO.sph,.08,.04,.035,boots,hitE,.18,-.06,k*.035); }
    else { P(GEO.box,.27,.11,.15,boots,hitE,.04,-.03,0); P(GEO.sph,.16,.11,.15,boots,hitE,.15,-.035,0); P(GEO.box,.32,.035,.165,boots.map(v=>v*.55),hitE,.06,-.085,0); P(GEO.sph,.13,.13,.15,boots,hitE,-.06,.01,0); } mpop(); }
  if(L.robe){ mpush(); mtr(0,.96,0); mrz(Math.sin(ph)*.05*mv); P(GEO.frus,.62,.92,.7,L.robe,hitE,0,-.92,0);
    for(let k=0;k<12;k++){ const a=k/12*6.283+.26; mpush(); mtr(Math.cos(a)*.155,-.02,Math.sin(a)*.17); mry(-a); mrz(.16+Math.sin(ph+k)*.04*mv); P(GEO.limb,.075,.8,.065,L.robe.map(v=>v*(k%2?.86:1.04)),hitE); mpop(); } P(GEO.cyl,.64,.07,.68,L.trim||L.robe,hitE,0,-.9,0); P(GEO.cyl,.645,.025,.685,L.trim||L.robe,hitE+.1,0,-.78,0);
    if(L.det==='a') for(let k=0;k<4;k++) P(GEO.box,.02,.06,.06,L.gem||[.82,.62,1],2.2+Math.sin(t*3+k)*.6,.25+k*.02,-.15-k*.18,0);
    if(L.det==='m'){ P(GEO.box,.03,.8,.16,L.trim,hitE+.08,.27,-.45,0); P(GEO.sph,.02,.1,.1,[1,.86,.4],1.2,.29,-.3,0); }
    P(GEO.box,.04,.82,.12,L.trim||L.robe,hitE,.3,-.45,0); mpop(); }
  mpush(); mtr(0,.94,0); mrz(-.1*mv-(L.hunch||0)-(EM==='bow'?.8:0)-(o.ride?.12:0)-(o.swim?.25:0));
  if(bone){ P(GEO.sph,.2,.14,.34,bone,hitE,0,.0,0); for(const s of [-1,1]) P(GEO.sph,.08,.08,.08,bone,hitE,0,-.04,s*.13); for(let k=0;k<8;k++) P(GEO.sph,.075,.06,.075,bone,hitE,-.05,.08+k*.075,0); for(const s of [-1,1]){ mpush(); mtr(.06,.62,s*.12); mrx(s*1.35); P(GEO.limb,.035,.15,.035,bone,hitE); mpop(); }
    for(let k=0;k<5;k++){ const w=.42-Math.abs(k-1.5)*.05; P(GEO.box,.05,.035,w,bone,hitE,.1,.2+k*.075,0); P(GEO.box,.22,.035,.035,bone,hitE,0,.2+k*.075,w/2-.02); P(GEO.box,.22,.035,.035,bone,hitE,0,.2+k*.075,-w/2+.02); }
    P(GEO.box,.06,.3,.06,bone,hitE,.13,.3,0); if(L.metal){ P(GEO.sph,.34,.36,.5,L.metal,hitE,.02,.44,0); P(GEO.box,.04,.3,.05,L.metal.map(v=>v*1.2),hitE+.1,.19,.44,0); } }
  else { const tor=L.torso; P(GEO.sph,.34,.27,.43,L.legs||tor,hitE,0,.04,0); if(L.robe){ P(GEO.sph,.35,.66,.48,tor,hitE,0,.35,0); P(GEO.sph,.3,.3,.5,tor,hitE,-.01,.55,0); } else { P(GEO.sph,.3,.4,.38,tor,hitE,0,.2,0); P(GEO.sph,.37,.44,.52,tor,hitE,.01,.42,0); }
    if(!L.robe) for(const s of [-1,1]) P(GEO.sph,.2,.17,.23,tor,hitE,.08,.5,s*.1); P(GEO.sph,.27,.17,L.robe?.52:.58,tor,hitE,-.03,.6,0); P(GEO.cyl,.2,.07,.22,tor.map(v=>v*.9),hitE,0,.62,0);
    if(L.metal){ const mt=L.metal; P(GEO.sph,.4,.44,.54,mt,hitE,.025,.43,0); P(GEO.sph,.33,.32,.42,mt,hitE,.03,.2,0); for(let k=0;k<3;k++) P(GEO.sph,.3-k*.01,.06,.4-k*.01,mt.map(v=>v*.88),hitE,.035,.08+k*.075,0);
      P(GEO.box,.03,.32,.045,L.trim||mt,hitE+.1,.225,.44,0); P(GEO.cyl,.25,.08,.28,mt,hitE,0,.62,0); P(GEO.cyl,.26,.022,.29,L.trim||mt,hitE+.08,0,.69,0); }
    if(L.fur){ for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; P(GEO.blob,.2,.18,.2,k%2?[.86,.85,.8]:[.78,.76,.72],hitE,Math.cos(a)*.17,.62+Math.sin(k*1.7)*.03,Math.sin(a)*.25); } for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; P(GEO.blob,.13,.2,.13,L.torso.map(v=>v*.92),hitE,Math.cos(a)*.18,.25+Math.sin(k)*.05,Math.sin(a)*.24); } }
    if(L.rock){ P(GEO.blob,.42,.4,.4,L.torso,hitE,.12,.42,.14); P(GEO.blob,.38,.36,.38,L.torso,hitE,-.05,.52,-.16); for(const s of [-1,1]){ P(GEO.blob,.36,.32,.34,L.arms,hitE,-.02,.7,s*.3); P(GEO.blob,.18,.16,.18,L.torso,hitE,.0,.86,s*.3); } for(let k=0;k<5;k++) P(GEO.box,.02,.16,.03,L.core,1.8+Math.sin(t*4+k)*.6,.25,.2+k*.1,(k-2)*.07); P(GEO.sph,.2,.2,.2,L.core,2.2+Math.sin(t*4)*.6,.17,.4,0); addLight(o.x,o.y+1.2*sc,o.z,6,[1.2,.5,.1]); }
    P(GEO.cyl,.39,.08,.54,L.trim?L.trim.map(v=>v*.5):[.25,.16,.08],hitE,0,.1,0); P(GEO.box,.05,.09,.09,[.92,.76,.32],hitE+.15,.2,.14,0); P(GEO.box,.12,.14,.1,[.35,.22,.12],hitE,.1,.08,.22);
    if(L.tabard){ const tx=L.metal?.24:.215; P(GEO.box,.03,.6,.24,L.tabard,hitE,tx,.2,0); P(GEO.box,.032,.025,.25,L.trim||[.9,.75,.3],hitE+.1,tx,-.09,0); P(GEO.sph,.03,.13,.13,L.trim||[.9,.75,.3],hitE+.25,tx+.012,.32,0); }
    if(L.tassets&&L.metal) for(const s of [-1,1]){ P(GEO.box,.2,.26,.15,L.metal,hitE,.06,-.1,s*.17); P(GEO.box,.21,.04,.16,L.trim||L.metal,hitE+.1,.06,-.22,s*.17); }
    if(L.gearX) gearExtras(L,o,t,hitE);
    if(L.gem) P(GEO.sph,.07,.07,.05,L.gem,2.4,.21,.12,0);
    if(L.det==='w'){ P(GEO.frus,.5,.3,.56,[.46,.49,.55],hitE,0,-.3,0); for(let k=0;k<5;k++) P(GEO.sph,.04,.04,.04,L.trim,hitE+.2,.19,.1,-.2+k*.1);
      P(GEO.box,.07,.52,.09,[.24,.15,.08],hitE,-.06,-.12,-.29); P(GEO.box,.08,.06,.1,L.trim,hitE+.15,-.06,.15,-.29);
      mpush(); mtr(.215,.34,0); mrx(.785); P(GEO.box,.02,.13,.13,L.crest||L.trim,hitE+.5,0,0,0); P(GEO.box,.025,.07,.07,L.trim,hitE+.4,0,0,0); mpop(); }
    if(L.det==='m'){ P(GEO.sph,.44,.24,.6,L.cape,hitE,-.01,.6,0); P(GEO.cyl,.45,.03,.61,L.trim,hitE+.1,-.01,.53,0);
      for(const s of [-1,1]) P(GEO.box,.03,.66,.07,L.trim,hitE+.12,.19,.22,s*.1);
      mpush(); mtr(.205,.42,0); P(GEO.sph,.04,.11,.11,[1,.86,.4],1.4); for(let k=0;k<8;k++){ const a=k/8*6.283; P(GEO.box,.02,.03,.08,[1,.8,.35],1.2,0,Math.sin(a)*.09,Math.cos(a)*.09); } mpop();
      P(GEO.box,.16,.2,.07,[.5,.15,.12],hitE,.02,-.02,.29); P(GEO.box,.14,.18,.02,[.95,.92,.8],hitE,.02,-.02,.33); P(GEO.cyl,.02,.25,.02,L.trim,hitE,.06,-.2,.29); }
    if(L.det==='a'){ P(GEO.cyl,.3,.12,.42,L.cape,hitE,-.04,.7,0); for(const s of [-1,1]){ mpush(); mtr(-.06,.82,s*.17); mrx(s*.25); P(GEO.box,.18,.26,.03,L.cape,hitE,0,0,0); P(GEO.box,.19,.03,.035,L.trim,hitE+.1,0,.13,0); mpop(); }
      mpush(); mtr(.19,.35,0); mrx(.62); P(GEO.box,.025,.78,.07,L.trim,hitE+.1,0,0,0); for(let k=0;k<3;k++) P(GEO.sph,.035,.035,.035,L.gem||[.8,.6,1],2.4,.01,-.25+k*.25,0); mpop();
      P(GEO.box,.1,.12,.09,[.32,.2,.12],hitE,.1,0,.23); P(GEO.cyl,.04,.2,.04,[.92,.88,.72],hitE,.05,.05,-.24); }
    if(L.rune){ const pu=1.5+Math.sin(t*3+o.x)*.6; P(GEO.box,.03,.2,.04,L.rune,pu,.22,.42,0); P(GEO.box,.03,.04,.17,L.rune,pu,.22,.47,0); if(Math.random()<.05) burst3(o.x,o.y+1.2*sc,o.z,L.aura,1,.4,{glow:true,up:1}); } }
  if(L.pack) P(GEO.box,.28,.42,.36,[.45,.3,.16],hitE,-.3,.42,0);
  if(L.cape){ mpush(); mtr(-.17,.62,0); const fl=.06+mv*.55+(o.ride?.3:0); for(let k=0;k<3;k++){ mrz(-(k?fl*.35:fl)-Math.sin(t*3+o.x+k*.9)*.045*(k+1)); P(GEO.box,.04,.36,.47-k*.02,L.cape,hitE,0,-.17,0); if(k===0&&L.det){ mpush(); mtr(-.025,-.16,0); mrx(.785); P(GEO.box,.02,.15,.15,L.trim,hitE+.2,0,0,0); P(GEO.box,.025,.08,.08,L.crest||L.gem||L.cape,hitE+.6,0,0,0); mpop(); } if(k===2&&L.det) P(GEO.box,.045,.05,.46,L.trim,hitE+.1,0,-.33,0); mtr(0,-.34,0); }
    mpop(); if(L.cape&&!bone) P(GEO.cyl,.2,.06,.46,L.cape.map(v=>v*.8),hitE,-.08,.66,0); }
  if(L.pauld) for(const s of [-1,1]){ mpush(); mtr(0,.63,s*.3); mrx(-s*.32); const pd=L.pauld;
    P(GEO.sph,.31,.24,.3,pd,hitE,0,.03,0); P(GEO.sph,.3,.15,.31,pd.map(v=>v*.93),hitE,0,-.05,s*.02); P(GEO.sph,.28,.13,.29,pd.map(v=>v*.86),hitE,0,-.11,s*.035);
    P(GEO.sph,.315,.035,.305,L.trim||pd,hitE+.08,0,-.02,0); P(GEO.sph,.295,.03,.3,L.trim||pd,hitE+.08,0,-.08,s*.02);
    if(L.spikes) for(let k=-1;k<=1;k++) P(GEO.cone,.05,.13-Math.abs(k)*.03,.05,L.metal||pd,hitE,k*.08,.12,s*.03);
    if(L.gem) P(GEO.sph,.05,.05,.05,L.gem,2.2,.13,.04,s*.02); if(L.rune) P(GEO.sph,.3,.025,.3,L.rune,1.6+Math.sin(t*3)*.5,0,-.13,s*.035); mpop(); }
  if(L.iceSpikes) for(const s of [-1,1]) for(let k=0;k<3;k++){ mpush(); mtr(-.06+k*.09,.72,s*(.3+k*.03)); mrx(-s*(.35+k*.3)); P(GEO.cone,.09,.42-k*.09,.09,[.75,.92,1],.9); mpop(); }
  // head
  mpush(); mtr(0,.72,0); mrz(L.hunch?L.hunch*.8:0); if(o.dead<0) mry(Math.sin(t*.6+o.x*1.7)*.16*(1-mv)); mrz(Math.sin(t*1.8+o.x)*.015); if(!bone&&L.head!=='rock') P(GEO.cyl,.11,.1,.11,skin,hitE,0,0,0);
  const eyeC=L.eyes, eyeE=eyeC?2.4:0;
  const face=(fx)=>{ const iris=o.eyeCol||[.28,.45,.62], lip=skin.map((v,i)=>v*[.86,.62,.6][i]), brow=o.hair||[.2,.13,.08];
    P(GEO.sph,.21,.16,.215,skin,hitE,.035,.04,0); P(GEO.sph,.085,.07,.09,skin,hitE,.1,.02,0);
    for(const s of [-1,1]){ P(GEO.sph,.09,.065,.075,skin,hitE,.075,.11,s*.075);
      P(GEO.sph,.046,.04,.044,[.96,.95,.92],0,.108,.178,s*.056); P(GEO.sph,.024,.028,.026,eyeC||iris,eyeE,.126,.178,s*.056); if(!eyeC){ P(GEO.sph,.012,.015,.013,[.02,.02,.02],0,.136,.178,s*.056); P(GEO.sph,.006,.006,.006,[1,1,1],1.2,.14,.184,s*.05); }
      P(GEO.sph,.052,.022,.05,skin,hitE,.11,.199,s*.056); mpush(); mtr(.124,.222,s*.058); mrx(s*.18); P(GEO.box,.032,.017,.075,brow,0); mpop();
      P(GEO.sph,.04,.075,.03,skin,hitE,-.005,.15,s*.135); P(GEO.sph,.022,.045,.014,skin.map(v=>v*.82),hitE,.0,.15,s*.147); }
    P(GEO.box,.04,.075,.036,skin,hitE,.126,.15,0); P(GEO.sph,.05,.045,.052,skin,hitE,.142,.115,0); for(const s of [-1,1]) P(GEO.sph,.03,.028,.025,skin,hitE,.13,.108,s*.022);
    P(GEO.sph,.026,.016,.07,lip,hitE,.125,.074,0); P(GEO.sph,.026,.018,.06,lip.map(v=>v*1.05),hitE,.12,.058,0); };
  if(L.head==='skull'||L.head==='crown'||L.head==='skullhelm'){ P(GEO.sph,.25,.27,.24,bone,hitE,.01,.15,0); P(GEO.box,.12,.07,.16,bone,hitE,.08,.03,0);
    mpush(); mtr(.03,.03,0); mrz(-Math.max(0,Math.sin(t*3+o.x))*.25); P(GEO.box,.12,.04,.15,bone,hitE,.06,-.03,0); mpop();
    for(const s of [-1,1]){ P(GEO.sph,.07,.07,.07,[.03,.03,.03],0,.1,.17,s*.055); P(GEO.sph,.04,.04,.04,eyeC,eyeE+1,.13,.17,s*.055); }
    if(eyeC&&Math.random()<.08) burst3(o.x,o.y+1.75*sc,o.z,'#'+eyeC.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''),1,.2,{glow:true,up:.8});
    if(L.head==='crown'){ P(GEO.cyl,.29,.06,.29,[.9,.72,.25],.5,0,.26,0); for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; P(GEO.cone,.06,.16,.06,[.95,.78,.3],.6,Math.cos(a)*.12,.32,Math.sin(a)*.12); } P(GEO.sph,.05,.05,.05,[.45,.95,1],2.5,.14,.29,0); }
    if(L.head==='skullhelm'){ P(GEO.sph,.3,.24,.29,L.metal,hitE,-.02,.22,0); P(GEO.box,.05,.06,.3,L.metal,hitE,.12,.27,0); for(const s of [-1,1]){ mpush(); mtr(-.02,.3,s*.14); mrx(-s*.6); P(GEO.cone,.07,.3,.07,[.85,.82,.72],hitE); mpop(); } } }
  else if(L.head==='rock'){ P(GEO.blob,.36,.3,.34,L.skin,hitE,0,.1,0); P(GEO.blob,.16,.1,.3,L.skin,hitE,.1,.2,0); for(const s of [-1,1]) P(GEO.sph,.06,.04,.06,eyeC,eyeE,.15,.12,s*.07); }
  else if(L.head==='yeti'){ P(GEO.sph,.42,.44,.42,L.torso,hitE,-.02,.16,0); P(GEO.sph,.2,.24,.28,L.skin,hitE,.13,.12,0); for(const s of [-1,1]){ P(GEO.sph,.05,.05,.05,[.1,.2,.5],1.2,.21,.2,s*.07); P(GEO.cone,.05,.12,.05,[.95,.95,.9],0,.2,.0,s*.08); } P(GEO.box,.03,.04,.16,[.15,.2,.35],0,.22,.06,0); for(const s of [-1,1]){ mpush(); mtr(-.06,.34,s*.22); mrx(-s*.85); mrz(.4); P(GEO.cone,.13,.46,.13,[.42,.34,.26],hitE); mtr(0,.4,0); mrx(s*.5); P(GEO.cone,.07,.22,.07,[.3,.24,.18],hitE); mpop(); } }
  else if(L.head==='giant'){ P(GEO.sph,.3,.32,.29,skin,hitE,0,.15,0); for(const s of [-1,1]){ P(GEO.sph,.05,.045,.04,[.85,.95,1],0,.12,.19,s*.06); P(GEO.sph,.028,.028,.028,eyeC,eyeE,.14,.19,s*.06); }
    for(let k=0;k<7;k++){ const a=(k/6-.5)*1.6; P(GEO.cone,.05,.24+.08*Math.cos(a*2),.05,[.82,.94,1],.35,.1+Math.cos(a)*.05,-.05,Math.sin(a)*.12); } P(GEO.sph,.3,.12,.3,[.88,.92,.98],hitE,-.02,.28,0);
    for(const s of [-1,1]) P(GEO.limb,.06,.3,.06,[.75,.8,.85],hitE,-.08,.15,s*.13); }
  else { P(GEO.sph,.27,.3,.26,skin,hitE,0,.15,0); if(L.head!=='helm') face();
    switch(L.head){
      case 'helm': { const hm=L.metal; P(GEO.sph,.34,.36,.33,hm,hitE,-.01,.17,0); P(GEO.box,.12,.3,.27,hm,hitE,.095,.12,0); P(GEO.box,.03,.3,.035,L.trim||hm,hitE+.1,.155,.14,0); P(GEO.box,.025,.028,.22,[.03,.03,.04],0,.158,.2,0); for(let k=0;k<3;k++) for(const q of [-1,1]) P(GEO.sph,.012,.012,.012,[.03,.03,.04],0,.157,.08-k*.035,q*.06); P(GEO.cyl,.345,.035,.335,L.trim,hitE+.1,-.01,.27,0); P(GEO.cyl,.28,.06,.3,hm.map(v=>v*.9),hitE,-.01,-.04,0); P(GEO.cone,.06,.14,.06,L.trim,.2,0,.34,0); }
        for(const s of [-1,1]) for(let k=0;k<3;k++) P(GEO.sph,.025,.025,.025,L.trim,hitE+.2,-.05+k*.08,.21,s*.165); P(GEO.box,.012,.01,.2,L.crest?[.4,.7,1]:[.03,.03,.04],L.crest?1.6:0,.165,.2,0);
        if(L.crest) for(let k=0;k<6;k++) P(GEO.box,.07,.09+Math.sin(k*.6)*.05,.05,L.crest,hitE+.15,-.17+k*.065,.38-Math.abs(k-2.5)*.02,0); break;
      case 'plume': P(GEO.sph,.31,.31,.3,L.metal,hitE,-.01,.18,0); P(GEO.box,.04,.05,.26,[.08,.08,.1],0,.14,.17,0); P(GEO.sph,.14,.3,.06,[.75,.1,.1],hitE,-.08,.42,0); break;
      case 'horned': P(GEO.sph,.31,.28,.3,L.metal,hitE,-.01,.2,0); P(GEO.box,.05,.16,.04,L.metal,hitE,.15,.12,0); for(const s of [-1,1]){ mpush(); mtr(-.02,.25,s*.15); mrx(-s*1.0); mrz(.3); P(GEO.cone,.08,.32,.08,[.92,.88,.78],hitE); mpop(); }
        P(GEO.sph,.18,.22,.22,L.beard||[.6,.4,.2],hitE,.1,.0,0); break;
      case 'hood': P(GEO.sph,.33,.35,.33,L.hood,hitE,-.06,.18,0); for(let k=0;k<11;k++){ const a=(k/10)*Math.PI; P(GEO.sph,.07,.07,.07,L.hood.map(v=>v*.92),hitE,.06,.13+Math.sin(a)*.17,Math.cos(a)*.15); } P(GEO.cone,.2,.2,.2,L.hood,hitE,-.14,.3,0); P(GEO.sph,.3,.12,.4,L.hood,hitE,-.04,-.04,0);
        if(L.det==='m'){ for(let k=0;k<9;k++){ const a=k/8*Math.PI; P(GEO.sph,.045,.045,.045,L.trim,hitE+.15,.13,.13+Math.sin(a)*.17,Math.cos(a)*.15); } P(GEO.sph,.045,.045,.03,[1,.9,.5],2.4,.15,.29,0); } break;
      case 'skullhood': P(GEO.sph,.34,.35,.33,L.hood,hitE,-.04,.17,0); P(GEO.sph,.2,.24,.22,L.skin,hitE,.06,.13,0); for(const s of [-1,1]){ P(GEO.sph,.05,.05,.04,[0,0,0],0,.15,.16,s*.05); P(GEO.sph,.025,.025,.025,eyeC,3,.17,.16,s*.05); } P(GEO.cone,.2,.24,.2,L.hood,hitE,-.12,.32,0); break;
      case 'hoodopen': P(GEO.sph,.33,.33,.31,L.hood,hitE,-.06,.18,0); break;
      case 'hat': P(GEO.sph,.28,.2,.28,o.hair||[.2,.13,.08],hitE,-.06,.14,0); P(GEO.cyl,.64,.03,.64,L.hat,hitE,0,.25,0); mpush(); mtr(0,.26,0); mrz(-.25+Math.sin(t*1.5)*.04); P(GEO.cone,.32,.32,.32,L.hat,hitE,0,0,0); mtr(0,.3,0); mrz(-.5); P(GEO.cone,.16,.3,.16,L.hat,hitE,0,0,0); P(GEO.sph,.05,.05,.05,[1,.9,.5],2,0,.3,0); mpop(); P(GEO.cyl,.34,.05,.34,L.trim,hitE+.1,0,.26,0); P(GEO.sph,.24,.16,.24,[.85,.85,.85],hitE,.06,.0,0); if(L.det==='a'){ P(GEO.sph,.06,.06,.04,L.gem||[.8,.55,1],2.6,.17,.27,0); for(let k=0;k<5;k++){ const a=k/5*6.283+.3; P(GEO.sph,.025,.025,.025,[1,.95,.7],2.2,Math.cos(a)*.28,.27,Math.sin(a)*.28); } } break;
      case 'witch': P(GEO.sph,.3,.2,.3,[.15,.15,.15],hitE,-.03,.25,0); P(GEO.cyl,.6,.03,.6,L.hat,hitE,0,.28,0); mpush(); mtr(0,.29,0); mrz(-.5); P(GEO.cone,.3,.6,.3,L.hat,hitE,0,0,0); mpop(); P(GEO.sph,.05,.09,.05,skin,hitE,.17,.08,0); break;
      case 'leafy': for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; P(GEO.blob,.26,.22,.26,L.leaf,hitE,Math.cos(a)*.12-.03,.3+Math.sin(k)*.05,Math.sin(a)*.13); } P(GEO.blob,.32,.28,.32,BRIGHT(L.leaf),hitE,0,.42,0); break;
      case 'bald': P(GEO.sph,.2,.22,.24,[.4,.24,.12],hitE,.1,.02,0); P(GEO.box,.08,.05,.14,[.4,.24,.12],hitE,.12,.1,0); break;
      case 'hair': P(GEO.sph,.3,.24,.3,L.hair,hitE,-.03,.22,0); P(GEO.sph,.22,.36,.27,L.hair,hitE,-.1,.08,0); break;
      case 'cap': P(GEO.cyl,.44,.03,.44,L.hat,hitE,0,.27,0); P(GEO.sph,.3,.22,.3,L.hat,hitE,0,.27,0); break;
      default: if(o.hair){ P(GEO.sph,.29,.22,.29,o.hair,hitE,-.03,.22,0); P(GEO.sph,.2,.26,.26,o.hair,hitE,-.1,.12,0); }
    } }
  mpop();
  // arms
  const sw=o.swing??-1;
  for(const s of [-1,1]){ mpush(); mtr(0,.62,s*.3);
    let a=s>0?-armA:armA, spread=.12, elbow=.25+(L.hunch||0)*.5;
    if(o.cast){ a=1.25+Math.sin(t*6)*.05; spread=.35; elbow=.15; }
    else if(!(s>0&&sw>=0)){ if(o.ride){a=.6;elbow=.9;spread=.05;} else if(o.swim){ a=1.3+Math.sin(t*4+s)*.6; spread=.7; elbow=.3; } else if(EM==='dance'){ a=(s>0?2.6:1.2)+Math.sin(t*6+s)*.5; spread=.5; } else if(EM==='wave'&&s>0){ a=2.9; spread=.55+Math.sin(t*9)*.25; elbow=.5; } else if(EM==='cheer'){ a=3.0; spread=.35; elbow=.1; } else if(sitting){ a=.35; spread=.3; } else if(EM==='bow'&&s>0){ a=.9; elbow=1.2; } }
    if(s>0&&sw>=0){ a=sw<.3?lerp(.4,2.9,sw/.3):lerp(2.9,.6,(sw-.3)/.7); elbow=.1; }
    if(L.longArms) a+=.15; if(L.weapon==='lantern'&&s>0&&sw<0&&!o.cast) a=.6;
    mrz(a); mrx(-s*spread);
    const ua=L.longArms?.42:.31, la=L.longArms?.4:.29;
    if(!bone&&!L.pauld) P(GEO.sph,limbW*(L.robe?1.2:1.45),limbW*(L.robe?1.25:1.5),limbW*(L.robe?1.2:1.45),armCol,hitE,0,-.03,0); P(GEO.limb,limbW*.95,ua,limbW*.95,armCol,hitE); if(!bone&&!L.robe) P(GEO.sph,limbW*1.15,limbW*1.85,limbW*1.1,armCol,hitE,.02,-ua*.5,0); mtr(0,-ua,0); P(GEO.sph,limbW*.95,limbW*.95,limbW*.95,bone?armCol:(L.metal||armCol),hitE); mrz(elbow);
    const fa=bone?armCol:(L.metal||armCol); P(GEO.limb,limbW*.8,la,limbW*.8,fa,hitE); if(!bone){ P(GEO.sph,limbW*1.08,limbW*1.7,limbW*1.05,fa,hitE,0,-la*.28,0); if(L.metal) P(GEO.frus,limbW*1.45,.13,limbW*1.45,L.metal.map(v=>v*1.05),hitE,0,-la+.0,0); else P(GEO.cyl,limbW*1.12,.06,limbW*1.12,L.trim||armCol,hitE,0,-la+.05,0); }
    if(L.robe&&!bone){ P(GEO.frus,limbW*2.5,.3,limbW*2.5,armCol,hitE,0,-la-.03,0); P(GEO.cyl,limbW*2.52,.035,limbW*2.52,L.trim||armCol,hitE+.1,0,-la-.03,0); }
    mtr(0,-la-.04,0);
    const hand=bone||(L.rock?L.arms:(L.gloves||(L.metal?L.metal.map(v=>v*.8):skin)));
    drawHand(hand,hitE,s,!!bone);
    if(o.cast){ P(GEO.sph,.17,.17,.17,o.castCol,2.6); if(Math.random()<.3) emitTip('#ffffff',0,0,0); }
    if(s>0) drawWeapon(L,o,t); else drawOff(L,o,t);
    mpop(); }
  if(L.orbs){ for(let k=0;k<2;k++){ const a=t*2.2+k*Math.PI; const ox=Math.cos(a)*.55, oz=Math.sin(a)*.55, oy=1.25+Math.sin(t*3+k)*.12;
      P(GEO.sph,.13,.13,.13,k?[.85,.6,1]:[.55,.85,1],2.6,ox,oy,oz); if(Math.random()<.15) emitTip(k?'#d6b3ff':'#9fd8ff',ox,oy,oz); } }
  mpop();
}
function drawHand(c,e,s,bony){ const w=bony?.55:1;
  P(GEO.box,.1*w+.02,.11,.07*w+.01,c,e,.02,-.01,0);
  for(let k=0;k<4;k++){ const z=(k-1.5)*.023*s; mpush(); mtr(.055,-.055,z); mrz(.9); P(GEO.limb,.024*w+.004,.045,.024*w+.004,c,e); mtr(0,-.045,0); mrz(1.1); P(GEO.limb,.022*w+.003,.04,.022*w+.003,c,e); mpop(); }
  mpush(); mtr(.04,-.0,-s*.045); mrx(s*.7); mrz(.5); P(GEO.limb,.028*w+.004,.05,.028*w+.004,c,e); mtr(0,-.05,0); mrz(.5); P(GEO.limb,.025*w+.003,.04,.025*w+.003,c,e); mpop(); }
function drawWeapon(L,o,t){
  const w=L.weapon; const rar=o.wr||0; const glow=rar>=4?[1,.55,.12]:rar>=3?[.75,.38,1]:rar>=2?[.3,.55,1]:null; const gHex=rar>=4?'#ff8a1a':rar>=3?'#b45cff':'#3d8bff'; if(rar>=4&&Math.random()<.35) emitTip(Math.random()<.5?'#ff8a1a':'#ffd36a',.2+Math.random()*.6,.1,0); const swinging=(o.swing??-1)>=0;
  if(drawGearWeapon(w,L,o,t)) return;
  switch(w){
    case 'sword': P(GEO.cyl,.05,.22,.05,[.3,.2,.12],0,0,-.1,0); P(GEO.box,.06,.06,.34,L.trim,.15,0,.1,0); P(GEO.sph,.06,.06,.06,L.trim,.2,0,-.12,0);
      P(GEO.box,.86,.085,.03,glow||[.86,.89,.93],glow?1.4:.18,.49,.12,0); P(GEO.box,.7,.02,.035,glow||[.6,.62,.66],glow?1:.05,.45,.12,0); P(GEO.cone,.065,.13,.03,glow||[.86,.89,.93],glow?1.4:.18,.93,.12,0);
      if(swinging) for(let k=0;k<3;k++) emitTip(glow?gHex:'#e8f0ff',.3+k*.3,.12,0); if(glow&&Math.random()<.25) emitTip(gHex,.3+Math.random()*.6,.12,0); break;
    case 'rustsword': P(GEO.box,.7,.07,.03,[.5,.42,.35],0,.4,0,0); P(GEO.box,.06,.05,.22,[.35,.3,.25],0,.03,0,0); break;
    case 'greatsword': P(GEO.box,1.45,.13,.04,[.75,.8,.9],.3,.78,0,0); P(GEO.box,1.2,.03,.05,[.45,.95,1],.9,.7,0,0); P(GEO.box,.08,.08,.46,[.9,.72,.25],.25,.04,0,0); P(GEO.sph,.08,.08,.08,[.45,.95,1],2.4,-.08,0,0);
      if(swinging) for(let k=0;k<4;k++) emitTip('#9fe8ff',.4+k*.32,0,0); break;
    case 'staff': P(GEO.cyl,.06,1.75,.06,[.42,.28,.14],0,0,-.55,0); P(GEO.sph,.2,.2,.2,o.cast?[1,1,.7]:(glow||L.orb),o.cast?3.4:2.2,0,1.28,0);
      for(let k=0;k<3;k++){ const a=k*2.1+t; P(GEO.cone,.04,.22,.04,L.trim,.3,Math.cos(a)*.1,1.12,Math.sin(a)*.1); } P(GEO.cyl,.22,.05,.22,L.trim,.2,0,1.1,0);
      addLight(o.x,o.y+1.9,o.z,o.cast?7:4.5,[1,.85,.5]); if(Math.random()<.12) emitTip('#fff3b0',0,1.28,0); break;
    case 'crystal': { const cc=glow||[.78,.5,1]; P(GEO.cyl,.05,1.75,.05,[.16,.1,.2],0,0,-.55,0); for(const h of [-.25,.45,1.0]) P(GEO.cyl,.075,.05,.075,[.82,.84,.92],.3,0,h,0);
      for(let k=0;k<3;k++){ const a=k*2.094; mpush(); mtr(Math.cos(a)*.07,1.08,Math.sin(a)*.07); mrz(Math.cos(a)*.45); mrx(-Math.sin(a)*.45); P(GEO.cone,.035,.3,.035,[.82,.84,.92],.4); mpop(); }
      mpush(); mtr(0,1.42+Math.sin(t*2.5)*.05,0); mry(t*1.6); const ce=o.cast?4.2:2.6; P(GEO.cone,.15,.28,.15,cc,ce,0,0,0); mrx(Math.PI); P(GEO.cone,.15,.2,.15,cc,ce,0,0,0); mpop();
      for(let k=0;k<3;k++){ const a=t*3+k*2.094; P(GEO.sph,.04,.04,.04,[1,1,1],3,Math.cos(a)*.24,1.42+Math.sin(t*4+k)*.08,Math.sin(a)*.24); }
      addLight(o.x,o.y+2,o.z,o.cast?7:4,cc.map(v=>v*1.2)); if(Math.random()<.15) emitTip(glow?gHex:'#d6b3ff',0,1.42,0); break; }
    case 'wand': P(GEO.cyl,.04,.42,.04,[.2,.1,.25],0,0,-.05,0); P(GEO.sph,.08,.08,.08,glow||[.85,.6,1],2.4,0,.4,0); if(Math.random()<.1) emitTip(glow?gHex:'#d6b3ff',0,.4,0); break;
    case 'lantern': P(GEO.cyl,.05,1.5,.05,[.25,.18,.1],0,0,-.45,0); P(GEO.box,.16,.22,.16,[.7,1,.4],2.4,.12,1.0,0); addLight(o.x,o.y+1.5,o.z,6,[.5,1,.3]); break;
    case 'flames': { const f=1+Math.sin(t*14+o.x)*.15; P(GEO.sph,.2*f,.24*f,.2*f,[1,.55,.12],2.8,0,.05,0); addLight(o.x,o.y+1.2,o.z,5,[1.3,.5,.1]); if(Math.random()<.3) emitTip('#ff8a2a',0,.1,0); break; }
    case 'spear': P(GEO.cyl,.05,2.3,.05,[.35,.24,.14],0,0,-.8,0); P(GEO.cone,.09,.35,.04,[.85,.88,.92],.2,0,1.5,0); P(GEO.box,.04,.2,.1,[.7,.1,.1],0,0,1.38,0); break;
    case 'hammer': P(GEO.cyl,.05,.6,.05,[.35,.24,.14],0,0,-.15,0); P(GEO.box,.22,.16,.32,[.32,.32,.36],.1,0,.45,0); break;
    case 'bow': P(GEO.box,.05,1.25,.05,[.42,.27,.12],0,.06,0,0); P(GEO.box,.012,1.15,.012,[.9,.9,.85],0,-.04,0,0); break;
    case 'staffplain': P(GEO.cyl,.06,1.6,.06,[.4,.28,.14],0,0,-.5,0); P(GEO.sph,.12,.12,.12,[.35,.5,.25],0,0,1.12,0); break;
    case 'book': P(GEO.box,.24,.07,.32,[.45,.15,.12],0,.06,0,0); P(GEO.box,.22,.03,.3,[.95,.92,.8],.2,.06,.05,0); break;
    case 'rod': P(GEO.cyl,.025,2.2,.025,[.45,.32,.18],0,0,-.3,0); break;
    case 'axe': P(GEO.cyl,.05,1.1,.05,[.35,.24,.14],0,0,-.3,0); P(GEO.box,.32,.36,.04,[.75,.78,.84],.15,.14,.66,0); break;
    case 'club': P(GEO.cyl,.1,1.0,.1,[.4,.3,.2],0,0,-.2,0); P(GEO.cone,.36,.9,.36,[.75,.9,1],.5,0,.85,0,.9); P(GEO.sph,.38,.4,.38,[.75,.9,1],.5,0,.85,0); if(Math.random()<.2) emitTip('#cfefff',0,1.2,0); break;
    case 'skullstaff': P(GEO.cyl,.05,1.8,.05,[.2,.16,.12],0,0,-.6,0); P(GEO.sph,.18,.2,.18,[.88,.85,.75],0,0,1.3,0); P(GEO.sph,.12,.12,.12,[.5,1,.4],2.6,.06,1.3,0); addLight(o.x,o.y+1.9,o.z,5,[.5,1.1,.4]); if(Math.random()<.2) emitTip('#9dff6a',0,1.3,0); break;
  } }
function drawLich(m,X,gy,Z,swing,dd,hit,sc){ const t=now(), e=hit?.9:0; const y=gy+.6+Math.sin(t*1.3)*.15; const S=sc*1.6;
  mreset(); mtr(X,y,Z); mry(-(m.face||0)); msc(S); if(dd>=0){ mrx(Math.min(1,dd)*1.2); mtr(0,-Math.min(1,dd*.5),0); }
  P(GEO.frus,.95,1.6,.95,[.08,.1,.18],e,0,0,0); P(GEO.cyl,.98,.08,.98,[.45,.8,1],1.1,0,0,0); P(GEO.box,.05,1.2,.2,[.45,.8,1],1,.47,.6,0);
  P(GEO.sph,.62,.85,.62,[.1,.12,.22],e,0,1.75,0); P(GEO.cyl,.75,.16,.75,[.2,.25,.4],e,0,2.05,0);
  for(const s of [-1,1]){ P(GEO.sph,.34,.26,.34,[.5,.85,1],.8,0,2.1,s*.38); P(GEO.cone,.08,.38,.08,[.7,.95,1],1.4,0,2.25,s*.45); }
  mpush(); mtr(0,2.35,0); P(GEO.sph,.32,.35,.31,[.88,.86,.8],e,.02,.15,0); for(const s of [-1,1]){ P(GEO.sph,.08,.08,.07,[0,0,0],0,.13,.18,s*.07); P(GEO.sph,.045,.045,.045,[.5,.95,1],3.5,.16,.18,s*.07); }
    P(GEO.box,.12,.06,.18,[.85,.82,.75],e,.12,.02,0); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; P(GEO.cone,.06,.32+(k%2)*.18,.06,[.65,.95,1],1.8,Math.cos(a)*.17,.3,Math.sin(a)*.17); } mpop();
  const sw=swing>=0?Math.sin(swing*Math.PI):0;
  for(const s of [-1,1]){ mpush(); mtr(0,1.95,s*.42); mrz(s>0?.9+sw*1.2:.4+Math.sin(t*2)*.2); mrx(-s*.25); P(GEO.limb,.12,.55,.12,[.82,.8,.74],e); mtr(0,-.55,0); mrz(.4); P(GEO.limb,.1,.5,.1,[.82,.8,.74],e); mtr(0,-.55,0);
    if(s>0){ P(GEO.cyl,.06,2.4,.06,[.15,.12,.2],0,0,-.9,0); P(GEO.sph,.3,.3,.3,[.5,.9,1],3,0,1.55,0); for(let k=0;k<4;k++){ const a=k*1.57+t; P(GEO.cone,.05,.4,.05,[.6,.9,1],1.5,Math.cos(a)*.18,1.35,Math.sin(a)*.18); } }
    else P(GEO.sph,.2,.2,.2,[.4,.8,1],2.5,0,0,0); mpop(); }
  for(let k=0;k<7;k++){ const a=t*.9+k*.8976; P(GEO.box,.05,.24,.12,[.6,.95,1],2.8,Math.cos(a)*.6,3.2+Math.sin(t*2+k)*.06,Math.sin(a)*.6,.85); }
  for(let k=0;k<12;k++){ const a=k/12*6.283; mpush(); mtr(Math.cos(a)*.44,-.1-(k%3)*.06+Math.sin(t*2+k)*.03,Math.sin(a)*.44); mry(-a); mrz(Math.sin(t*1.5+k)*.12); P(GEO.box,.04,.34+(k%3)*.12,.24,[.07,.09,.16],e); mpop(); }
  for(let k=0;k<3;k++){ const a=t*1.4+k*2.09; P(GEO.cone,.14,.42,.14,[.55,.9,1],2.4,Math.cos(a)*1.3,1.6+Math.sin(t*2+k)*.3,Math.sin(a)*1.3); }
  addLight(X,y+2.5,Z,16,m.enr?[1.4,.4,1.2]:[.4,.9,1.5]);
  if(Math.random()<.7) P3(X+(Math.random()-.5)*2.5,gy+.2,Z+(Math.random()-.5)*2.5,(Math.random()-.5)*.3,.3+Math.random()*.4,(Math.random()-.5)*.3,2,.5,'#bfe8ff',{big:true,drag:.99});
  if(Math.random()<.4) burst3(X,y+3,Z,m.enr?'#c77dff':'#9fe8ff',1,.6,{glow:true});
}

function drawOff(L,o,t){
  if(L.off==='shield'){ P(GEO.box,.5,.62,.07,L.tabard||[.17,.3,.62],0,.08,-.05,-.1); P(GEO.box,.56,.68,.04,L.trim,.1,.08,-.05,-.13); P(GEO.box,.08,.48,.02,L.trim,.3,.08,-.05,-.063); P(GEO.box,.4,.08,.02,L.trim,.3,.08,.04,-.063);
    for(const [a,b] of [[-.19,-.25],[.35,-.25],[-.19,.21],[.35,.21]]) P(GEO.sph,.04,.04,.03,L.trim,.3,a,b,-.06); P(GEO.sph,.13,.13,.07,L.trim,.3,.08,.04,-.05); P(GEO.sph,.06,.06,.04,L.crest||L.gem||[.5,.7,1],1.8,.08,.04,-.02); }
  else if(L.off==='rustshield'){ P(GEO.cyl,.5,.06,.5,[.4,.33,.26],0,.05,0,-.1); }
  else if(L.weapon==='flames'){ const f=1+Math.sin(t*13)*.15; P(GEO.sph,.18*f,.22*f,.18*f,[1,.55,.12],2.6,0,.05,0); }
}
/* quadrupeds */
const QLOOK={
  boar:{col:[.5,.33,.22],dark:[.28,.18,.11],tusk:[.95,.92,.82],len:1,hgt:.42,ears:true,tusks:true,bristle:true,eyes:[.1,.05,.02]},
  oldtusk:{col:[.36,.23,.15],dark:[.2,.13,.08],tusk:[1,.85,.45],len:1,hgt:.42,ears:true,tusks:true,bristle:true,scale:1.65,eyes:[1,.3,.1],eyeE:2},
  wolf:{col:[.42,.44,.5],dark:[.25,.26,.3],len:1.1,hgt:.7,ears:true,tail:true,muzzle:true,eyes:[1,.85,.3],eyeE:1.2},
  fangmaw:{col:[.14,.14,.17],dark:[.06,.06,.08],len:1.1,hgt:.7,ears:true,tail:true,muzzle:true,mane:true,scale:1.55,eyes:[1,.15,.1],eyeE:2.4},
};
function drawQuad(o){
  const Q=o.Q, t=now(), sc=(Q.scale||1)*(o.sc||1), mv=o.mv||0, ph=o.walk||0, e=o.hit?.9:0;
  const col=Q.col, dark=Q.dark, belly=col.map(v=>Math.min(1,v*1.25+.1)), L=Q.len, H=Q.hgt;
  const canine=!!Q.muzzle, boar=!!Q.tusks, deer=!!Q.antlers, bunny=!!Q.longEars;
  mreset(); mtr(o.x,o.y+Math.abs(Math.sin(ph*1.2))*.04*mv,o.z); mry(-o.face); msc(sc);
  if(o.dead>=0){ const k=Math.min(1,o.dead/.6); mrx(k*1.5); mtr(0,k*.1,0); }
  const lunge=o.swing>=0?Math.sin(o.swing*Math.PI)*.35:0; mtr(lunge,0,0);
  const br=1+Math.sin(t*2.3+o.x)*.018, by=H+.12, bw=boar?1.12:deer?.82:1;
  /* legs: shoulder/elbow/paw in front, stifle/hock/paw behind */
  for(const [lx,lz,off,front] of [[.34,.16,0,1],[.34,-.16,Math.PI,1],[-.33,.16,Math.PI,0],[-.33,-.16,0,0]]){
    mpush(); mtr(lx*L,H+.04,lz*bw); const sw=Math.sin(ph*1.2+off)*.6*mv, lift=Math.max(0,Math.sin(ph*1.2+off))*mv;
    mrz(sw);
    if(front){ P(GEO.sph,.17,.26,.14,col,e,0,-.06,0); P(GEO.limb,.16*bw,H*.48,.17*bw,col,e); mtr(0,-H*.48,0); P(GEO.sph,.12,.12,.12,col,e); mrz(-lift*.8); P(GEO.limb,.1,H*.42,.1,deer?col:dark,e); mtr(0,-H*.42,0); mrz(lift*.6-sw); }
    else { mrz(.32); P(GEO.limb,.21*bw,H*.4,.21*bw,col,e); mtr(0,-H*.4,0); P(GEO.sph,.13,.13,.13,col,e); mrz(-.85-lift*.5); P(GEO.limb,.1,H*.34,.1,deer?col:dark,e); mtr(0,-H*.34,0); P(GEO.sph,.085,.085,.085,deer?col:dark,e); mrz(.53+lift*.3-sw); P(GEO.limb,.075,H*.2,.075,dark,e); mtr(0,-H*.2,0); }
    if(boar||deer){ P(GEO.box,.1,.07,.09,[.12,.1,.08],0,.02,-.03,0); P(GEO.box,.03,.06,.1,[.06,.05,.04],0,.07,-.03,0); }
    else { P(GEO.sph,.15,.08,.12,dark,e,.04,-.03,0); for(let k=-1;k<=1;k++) P(GEO.sph,.05,.045,.04,dark.map(v=>v*.8),e,.1,-.04,k*.035); }
    mpop(); }
  /* body: ribcage, haunch, belly and shoulder blades so the silhouette reads as an animal, not a capsule */
  P(GEO.sph,L*.64*br,.52*br,.46*bw,col,e,L*.2,by+.06,0);
  P(GEO.sph,L*.52,.46,.42*bw,col,e,-L*.29,by+.04,0);
  P(GEO.sph,L*.84,.38,.36*bw,col,e,-L*.03,by+.02,0);
  P(GEO.sph,L*.62,.2,.3*bw,belly,e,L*.08,by-.14,0);
  P(GEO.sph,L*.66,.13,.22*bw,dark,e,-L*.02,by+.2,0);
  for(const s of [-1,1]){ P(GEO.sph,.26,.3,.1,col,e,L*.3,by+.04,s*.15*bw); P(GEO.sph,.3,.34,.1,col,e,-L*.31,by+.01,s*.15*bw); }
  if(boar){ P(GEO.sph,L*.55,.4,.46,dark,e,L*.18,by+.25,0); for(let k=0;k<11;k++){ const x=L*(.42-k*.075); mpush(); mtr(x,by+.3+Math.sin(k*.5)*.03,0); mrz(.35); P(GEO.cone,.07,.24-Math.abs(k-4)*.012,.05,dark,e); mpop(); } }
  if(Q.mane||canine){ const mc=Q.mane?dark:col, big=Q.mane?1.15:.7; for(let k=0;k<9;k++){ const a=(k/8-.5)*2.9; P(GEO.blob,.3*big,.26*big,.2*big,k%2?mc:mc.map(v=>v*.9),e,L*.4-Math.abs(a)*.05,by+.16+Math.cos(a)*.17*big,Math.sin(a)*.24*bw*big); }
    for(let k=0;k<4;k++) P(GEO.blob,.2,.12,.16,dark,e,L*(.1-k*.12),by+.24,0); }
  /* tail */
  mpush(); mtr(-L*.6,by+.14,0);
  if(canine){ mrz(-.75-mv*.35); for(let k=0;k<5;k++){ mrx(Math.sin(t*5+o.x-k*.6)*.1*(1+mv)); const r=k<2?.1+k*.03:.17-(k-2)*.035; P(GEO.limb,r,.13,r*1.08,k>3&&Q.mane?dark:col,e); mtr(0,-.13,0); mrz(.1-mv*.15); } P(GEO.cone,.12,.16,.12,Q.mane?dark:col,e,0,0,0); }
  else if(boar){ for(let k=0;k<5;k++){ mrx(.9); mrz(-.4); P(GEO.sph,.05,.05,.05,dark,e); mtr(-.05,0,0); } }
  else if(bunny){ P(GEO.sph,.2,.2,.2,[.95,.93,.9],e,.02,.02,0); }
  else { mrz(-.4); P(GEO.sph,.16,.1,.1,col,e); P(GEO.sph,.08,.1,.09,[.95,.92,.88],e,-.04,-.02,0); }
  mpop();
  /* neck and head */
  const look=o.swing>=0?-Math.sin(o.swing*Math.PI)*.4:Math.sin(t*1.3+o.x)*.06;
  mpush(); mtr(L*.52,by+.1,0); mrz(look);
  if(canine){ P(GEO.sph,.44,.5,.38,col,e,.1,.12,0); mtr(.28,.3,0); }
  else if(boar){ P(GEO.sph,.46,.48,.5,col,e,.06,.04,0); mtr(.26,.02,0); }
  else if(deer){ mpush(); mrz(-.6); P(GEO.limb,.2,.5,.18,col,e); mpop(); P(GEO.sph,.3,.4,.26,col,e,.1,.15,0); mtr(.26,.5,0); }
  else { P(GEO.sph,.3,.34,.3,col,e,.06,.08,0); mtr(.16,.18,0); }
  if(canine){ const jw=o.swing>=0?Math.sin(o.swing*Math.PI)*.6:.06+Math.max(0,Math.sin(t*1.7+o.x))*.06;
    P(GEO.sph,.4,.34,.34,col,e,0,0,0); P(GEO.sph,.26,.22,.38,col,e,.07,-.07,0); P(GEO.sph,.2,.12,.3,dark,e,-.02,.12,0);
    mpush(); mtr(.14,-.02,0); mrz(-Math.PI/2+.05); P(GEO.frus,.24,.36,.21,col,e); P(GEO.frus,.13,.34,.1,dark,e,-.065,0,0); mpop();
    P(GEO.sph,.09,.07,.1,[.05,.04,.04],.15,.5,-.015,0); P(GEO.sph,.03,.02,.03,[.9,.9,.9],.6,.52,.0,.02);
    mpush(); mtr(.13,-.11,0); mrz(-jw); mpush(); mrz(-Math.PI/2); P(GEO.frus,.16,.32,.14,belly,e); mpop(); P(GEO.sph,.2,.03,.1,[.6,.15,.18],0,.18,.04,0);
      for(const s of [-1,1]){ for(let k=0;k<3;k++){ mpush(); mtr(.12+k*.07,.06,s*.05); P(GEO.cone,.022,.06,.022,[.96,.94,.86],0); mpop(); } } mpop();
    for(const s of [-1,1]){ mpush(); mtr(.33,-.035,s*.07); mrx(Math.PI); P(GEO.cone,.03,.1,.03,[.96,.94,.86],0); mpop(); }
    for(const s of [-1,1]){ P(GEO.sph,.08,.06,.07,[.02,.02,.02],0,.17,.06,s*.11); P(GEO.sph,.05,.045,.045,Q.eyes,(Q.eyeE||0)+.2,.2,.065,s*.115); P(GEO.box,.12,.04,.08,dark,e,.16,.11,s*.1);
      mpush(); mtr(-.06,.15,s*.12); mrx(-s*.25); mrz(-.15); P(GEO.cone,.16,.28,.07,col,e); P(GEO.cone,.09,.18,.03,[.55,.35,.35],0,.012,.02,0); mpop(); } }
  else if(boar){ const jw=o.swing>=0?Math.sin(o.swing*Math.PI)*.35:0;
    P(GEO.sph,.5,.44,.46,col,e,0,0,0); P(GEO.sph,.36,.2,.4,dark,e,-.04,.18,0);
    mpush(); mtr(.14,-.06,0); mrz(-Math.PI/2+.25); P(GEO.frus,.32,.3,.3,col,e); mpop();
    mpush(); mtr(.43,-.15,0); mrz(-Math.PI/2+.25); P(GEO.cyl,.19,.05,.17,[.72,.48,.44],e); P(GEO.cyl,.2,.012,.18,[.5,.3,.28],e,0,.05,0); mpop();
    for(const s of [-1,1]) P(GEO.sph,.035,.035,.03,[.15,.06,.05],0,.46,-.15,s*.04);
    mpush(); mtr(.2,-.22,0); mrz(-jw); P(GEO.box,.28,.07,.22,dark,e,.06,0,0); mpop();
    for(const s of [-1,1]){ mpush(); mtr(.3,-.2,s*.13); mrz(-.4); mrx(-s*.35); P(GEO.cone,.06,.16,.06,Q.tusk,Q.eyeE?.3:0); mtr(0,.15,0); mrz(-.7); P(GEO.cone,.045,.14,.045,Q.tusk,Q.eyeE?.3:0); mpop();
      P(GEO.sph,.05,.045,.045,Q.eyes,Q.eyeE||0,.2,.07,s*.17); P(GEO.box,.1,.035,.07,dark,e,.18,.11,s*.16);
      mpush(); mtr(-.1,.16,s*.18); mrx(-s*1.05); mrz(.35); P(GEO.cone,.15,.24,.06,dark,e); mpop(); } }
  else if(deer){ P(GEO.sph,.3,.26,.24,col,e,0,0,0); mpush(); mtr(.08,-.03,0); mrz(-Math.PI/2+.2); P(GEO.frus,.18,.28,.16,col,e); mpop();
    P(GEO.sph,.08,.06,.08,[.08,.06,.05],.1,.34,-.08,0); P(GEO.sph,.14,.06,.12,belly,e,.2,-.1,0);
    for(const s of [-1,1]){ P(GEO.sph,.05,.05,.04,Q.eyes,0,.08,.05,s*.11); mpush(); mtr(-.06,.1,s*.1); mrx(-s*1.1); P(GEO.sph,.08,.18,.04,col,e,0,.1,0); mpop();
      mpush(); mtr(-.04,.12,s*.06); mrx(-s*.45); mrz(-.3); P(GEO.limb,.04,.4,.04,[.85,.78,.6],0); mtr(0,-.18,0); mpush(); mrz(.9); P(GEO.limb,.03,.18,.03,[.85,.78,.6],0); mpop(); mtr(0,-.22,0); mrz(-.5); P(GEO.limb,.03,.2,.03,[.85,.78,.6],0); mpush(); mrz(1); P(GEO.limb,.025,.12,.025,[.85,.78,.6],0); mpop(); mpop(); } }
  else { P(GEO.sph,.32,.3,.28,col,e,0,0,0); P(GEO.sph,.14,.1,.16,belly,e,.12,-.06,0); P(GEO.sph,.04,.03,.04,[.6,.35,.35],0,.18,-.02,0);
    for(const s of [-1,1]){ P(GEO.sph,.05,.05,.04,Q.eyes,0,.1,.05,s*.1); if(bunny){ mpush(); mtr(-.06,.1,s*.06); mrx(-s*.2); mrz(-.25); P(GEO.sph,.1,.55,.05,col,e,0,.26,0); P(GEO.sph,.06,.42,.02,[.85,.65,.62],0,.01,.26,s*.01); mpop(); } } }
  mpop();
}
function drawMob3(m,dead){
  const t=now(), mt=m.t; const X=(dead?m.dx:m.rx)/TS, Z=(dead?m.dy:m.ry)/TS; const gy=groundY(dead?m.dx:m.rx,dead?m.dy:m.ry);
  const mv=clamp(m.mvS||0,0,1), ph=m.walkP||0, hit=t-m.hit<.1 && !dead;
  if(!dead){ const hh=(MOBH[mt.key]||1.6); const Xs=m.rx/TS, Zs=m.ry/TS, gs=groundY(m.rx,m.ry);
    if(m.stunU>t){ for(let k=0;k<3;k++){ const a=t*5+k*2.09; mreset(); mtr(Xs+Math.cos(a)*.38,gs+hh+.15,Zs+Math.sin(a)*.38); mry(t*6); P(GEO.box,.13,.13,.03,[1,.9,.3],2.8); mrz(.785); P(GEO.box,.13,.13,.03,[1,.9,.3],2.8); } }
    if(m.rootU>t){ const Rr=(mt.r||14)/TS*1.15+.25; for(let k=0;k<8;k++){ const a=k/8*6.283+m.id; mreset(); mtr(Xs+Math.cos(a)*Rr,gs-.05,Zs+Math.sin(a)*Rr); mrz(Math.cos(a)*.4); mrx(-Math.sin(a)*.4); P(GEO.cone,.22,.55+(k%2)*.3,.22,[.72,.9,1],.9,0,0,0,.85); } } }
  const sw=(t-(m.swingT||0))/.35; const swing=sw>=0&&sw<1?sw:-1; const dd=dead?t-m.deathT:-1;
  let sc=1; if(m.spawnT&&t-m.spawnT<.6) sc=.3+.7*(t-m.spawnT)/.6;
  const base={x:X,y:gy,z:Z,face:m.face||0,mv,walk:ph,swing,dead:dd,hit,sc};
  if(dead && dd>.9) base.y-=(dd-.9)*1.2;
  if(LOOK[mt.key]){ drawHumanoid({...base,L:LOOK[mt.key]}); if(mt.key==='hking'&&dd<0){ mreset(); mtr(X,gy+3.35+Math.sin(t*2)*.06,Z); mry(t*.8); P(GEO.cyl,.75,.05,.75,[.5,.95,1],2.4,0,0,0,.7); for(let k=0;k<8;k++){ const an=k/8*6.283; P(GEO.cone,.07,.28+(k%2)*.16,.07,[.6,1,1],3,Math.cos(an)*.36,.03,Math.sin(an)*.36,.8); } for(let k=0;k<2;k++){ const an=t*2+k*3.14+Math.random(); P3(X+Math.cos(an)*1.3,gy+Math.random()*2.6,Z+Math.sin(an)*1.3,0,.8,0,.8,.15,'#7ef0ff',{glow:true}); } addLight(X,gy+2.5,Z,9,[.4,.9,1.2]); } }
  else if(QLOOK[mt.key]) drawQuad({...base,Q:QLOOK[mt.key]});
  else switch(mt.key){
    case 'moth': { const fl=Math.sin(t*18+m.id); mreset(); mtr(X,gy+1.4+Math.sin(t*2+m.id)*.2,Z); mry(-(m.face||0)); msc(sc*(dead?Math.max(.1,1-dd):1));
      P(GEO.limb,.14,.5,.14,[.35,.3,.4],hit?.9:0,.25,0,0); mpush(); mrz(Math.PI/2); mpop();
      for(const s of [-1,1]){ mpush(); mtr(0,0,s*.05); mrx(s*(.25+fl*.7)); P(GEO.sph,.55,.03,.75,[.85,.78,1],.5,0,0,s*.38); P(GEO.sph,.12,.035,.12,[.4,.2,.6],.3,-.05,0,s*.42); mpop(); }
      for(const s of [-1,1]) P(GEO.cyl,.015,.3,.015,[.8,.7,1],.4,.25,.05,s*.05);
      addLight(X,gy+1.4,Z,4,[.6,.5,1]); if(Math.random()<.15) burst3(X,gy+1.3,Z,'#e8d8ff',1,.3,{glow:true}); break; }
    case 'lurker': { mreset(); mtr(X,gy,Z); mry(-(m.face||0)); msc(sc*1.1); if(dead) mtr(0,-Math.min(.6,dd*.6),0); const e=hit?.9:0;
      for(let k=0;k<6;k++){ mpush(); const a=k/6*Math.PI*2; mtr(Math.cos(a)*.45,.3,Math.sin(a)*.45); mry(-a); for(let s=0;s<3;s++){ mrz(-.6+Math.sin(t*3+k+s)*.35); P(GEO.limb,.14-s*.03,.35,.14-s*.03,[.22,.36,.2],e); mtr(0,-.33,0); } mpop(); }
      P(GEO.sph,1.25,.75,1.2,[.3,.48,.27],e,0,.5,0); P(GEO.sph,1.0,.45,.95,[.42,.6,.32],e,0,.65,0);
      for(const [ox,oz] of [[.45,-.2],[.5,0],[.45,.2]]){ P(GEO.sph,.14,.14,.14,[1,.95,.4],1.5,ox,.75,oz); P(GEO.sph,.06,.06,.06,[0,0,0],0,ox+.06,.76,oz); }
      P(GEO.box,.12,.06,.5,[.1,.05,.05],0,.58,.55,0); break; }
    case 'wraith': case 'icewraith': { const ice=mt.key==='icewraith'; const c1=ice?[.6,.82,1]:[.42,.32,.7], c2=ice?[.5,.72,.95]:[.35,.25,.6], c3=ice?[.25,.4,.6]:[.2,.12,.35];
      mreset(); mtr(X,gy+.5+Math.sin(t*2+m.id)*.15,Z); mry(-(m.face||0)); msc(sc*(ice?1.15:1)); const al=dead?Math.max(0,.75-dd):.75;
      P(GEO.frus,.7,-1.2,.7,c1,.45,0,1.4,0,al); P(GEO.sph,.5,.6,.5,c2,.35,0,1.35,0,al); P(GEO.sph,.36,.4,.36,c3,.3,0,1.85,0,al); P(GEO.sph,.3,.32,.28,[.04,.02,.08],0,.06,1.82,0,al);
      if(ice) for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; P(GEO.cone,.07,.3,.07,[.8,.95,1],1.4,Math.cos(a)*.15-.05,2.05,Math.sin(a)*.15); }
      for(const s of [-1,1]){ P(GEO.sph,.05,.05,.05,ice?[.7,.95,1]:[.9,.85,1],3,.16,1.86,s*.06); mpush(); mtr(0,1.55,s*.28); mrz(1.0+Math.sin(t*3+s)*.3); P(GEO.limb,.09,.5,.09,c1,.5,0,0,0,al); mpop(); }
      addLight(X,gy+1.8,Z,4,ice?[.5,.8,1.2]:[.6,.4,1]); if(Math.random()<.2) burst3(X,gy+.8,Z,ice?'#bfe8ff':'#a98aff',1,.2,{glow:true}); break; }
    case 'lich': drawLich(m,X,gy,Z,swing,dd,hit,sc); break;
    case 'emberling': { const f=1+Math.sin(t*20+m.id)*.12; const y=gy+.9+Math.sin(t*3+m.id)*.15; mreset(); mtr(X,y,Z); msc(sc*(dead?Math.max(.05,1-dd*1.5):1));
      P(GEO.sph,.7*f,.8*f,.7*f,[1,.35,.05],2.4,0,0,0); P(GEO.sph,.5,.6,.5,[1,.65,.15],3,0,.08,0); P(GEO.cone,.4,.6,.4,[1,.8,.3],3,0,.25,0);
      for(const s of [-1,1]) P(GEO.sph,.08,.1,.08,[.15,.03,0],0,.28,.1,s*.12);
      addLight(X,y,Z,6,[1.4,.6,.15]); if(Math.random()<.5) burst3(X,y+.3,Z,'#ffb03a',1,.4,{glow:true,up:1.5}); break; }
    case 'wyrm': drawWyrm(m,X,gy,Z,mv,ph,swing,dd,hit,sc); break;
  }
}
function drawWyrm(m,X,gy,Z,mv,ph,swing,dd,hit,sc){
  const t=now(), e=hit?.9:0, col=m.enr?[.85,.22,.1]:[.75,.3,.12], dark=[.3,.1,.05], belly=[1,.6,.2];
  mreset(); mtr(X,gy,Z); mry(-(m.face||0)); msc(sc*1.05); if(dd>=0){ mrx(Math.min(1,dd/.8)*1.3); mtr(0,-Math.min(1.2,dd*.5),0); }
  for(const [lx,lz,off] of [[1.1,.8,0],[1.1,-.8,Math.PI],[-1.0,.85,Math.PI],[-1.0,-.85,0]]){ mpush(); mtr(lx,1.6,lz); mrz(Math.sin(ph*.8+off)*.5*mv); P(GEO.limb,.45,.8,.45,col,e); mtr(0,-.8,0); mrz(-.4); P(GEO.limb,.36,.75,.36,dark,e); mtr(0,-.78,0); P(GEO.box,.5,.16,.42,dark,e,.15,0,0); for(let k=-1;k<=1;k++){ mpush(); mtr(.38,-.02,k*.14); mrz(-Math.PI/2+.3); P(GEO.cone,.07,.22,.07,[.92,.88,.78],0); mpop(); } mpop(); }
  P(GEO.sph,3.4,1.75,2.0,col,e,0,2.15,0);
  P(GEO.sph,2.7,.6,1.3,belly,1.4+Math.sin(t*4)*.5+(m.enr?1:0),0,1.62,0);
  for(let k=0;k<12;k++){ P(GEO.sph,.5,.16,.62,[.55,.2,.08],e,-1.6+k*.3,1.42,0); } for(let k=0;k<7;k++){ P(GEO.cone,.22,.5,.22,dark,e,-1.3+k*.45,2.95-Math.abs(k-3)*.05,0); P(GEO.cone,.08,.18,.08,[1,.55,.15],1.8+Math.sin(t*4+k)*.6+(m.enr?1:0),-1.3+k*.45,3.38-Math.abs(k-3)*.05,0); }
  // tail
  mpush(); mtr(-1.6,2.0,0); for(let k=0;k<16;k++){ mry(Math.sin(t*2.2-k*.4)*.1); mrz(-.065); const r=.76-k*.042; P(GEO.sph,.62,r,r,col,e,-.2,0,0); P(GEO.sph,.5,r*.55,r*.8,[.55,.2,.08],e,-.2,-r*.32,0); if(k%2===0) P(GEO.cone,.1,.3-k*.012,.08,dark,e,-.2,r*.42,0); mtr(-.24,0,0); } mpush(); mrz(Math.PI/2); P(GEO.cone,.5,1.1,.1,[.9,.45,.12],1.4,0,0,0); mpop(); for(const s of [-1,1]){ mpush(); mrx(s*1.1); mrz(Math.PI/2+.4); P(GEO.cone,.25,.6,.06,dark,e,0,0,0); mpop(); } mpop();
  // wings
  const flap=Math.sin(t*2.6)*.45+(mv>.3?Math.sin(t*6)*.3:0);
  for(const s of [-1,1]){ mpush(); mtr(.2,2.9,s*.7); mrx(-s*(.12+flap*.55)); P(GEO.wing,2.3,1,2.3*s,[.42,.1,.05],.35,0,0,0); P(GEO.wing,2.0,1,2.0*s,[.75,.25,.08],.6,.1,.02,0); for(const [px,pz,ln] of [[.95,1.15,1.1],[.7,2.1,1.25],[.25,3,1.35],[-.55,1.6,1.1]]){ mpush(); const a=Math.atan2(pz*2.3*s,px*2.3); mry(-a); mrz(Math.PI/2); P(GEO.limb,.07,Math.hypot(px,pz)*2.3*.75,.07,dark,e); mpop(); } mpush(); mtr(.9,0,0); mrx(-s*Math.PI/2); P(GEO.limb,.16,2.6,.16,dark,e); mpop(); mpush(); mrx(-s*Math.PI/2); mry(.5); P(GEO.limb,.1,2.4,.1,dark,e); mpop(); mpop(); }
  // neck & head
  const breath=m.chanT&&now()-m.chanT<1.6; const jaw=swing>=0?Math.sin(swing*Math.PI)*.5:breath?.6:.08;
  mpush(); mtr(1.5,2.5,0); for(let k=0;k<5;k++){ mrz(.22+(swing>=0?-Math.sin(swing*Math.PI)*.12:0)); P(GEO.sph,.8,.75-k*.06,.75-k*.06,k%2?col:dark,e,.3,0,0); mtr(.35,0,0); }
  mrz(-1.2); P(GEO.sph,1.1,.7,.8,col,e,.35,0,0); P(GEO.box,.8,.25,.5,col,e,.85,.05,0);
  mpush(); mtr(.4,-.18,0); mrz(-jaw); P(GEO.box,.9,.15,.45,dark,e,.4,0,0); for(let k=0;k<4;k++) for(const s of [-1,1]) P(GEO.cone,.04,.1,.04,[.95,.92,.82],0,.2+k*.18,.08,s*.18); mpop();
  for(const s of [-1,1]){ mpush(); mtr(.05,.3,s*.25); mrz(2.3); mrx(-s*.3); P(GEO.cone,.14,.7,.14,[.2,.08,.04],e); mtr(0,.55,0); mrz(-.6); P(GEO.cone,.08,.45,.08,[.16,.06,.03],e); mpop(); P(GEO.sph,.18,.12,.14,dark,e,.5,.22,s*.2); P(GEO.cone,.05,.16,.05,[.2,.08,.04],e,.7,.2,s*.12); for(let k=0;k<3;k++){ mpush(); mtr(-.1-k*.18,.28-k*.03,s*(.2+k*.06)); mrz(2.5); mrx(-s*.7); P(GEO.cone,.07,.34-k*.06,.07,[.25,.1,.05],e); mpop(); } P(GEO.sph,.12,.08,.1,[1,.95,.5],3,.62,.18,s*.25); }
  if(breath||m.enr){ P(GEO.sph,.25,.2,.25,[1,.6,.1],3,1.25,-.05,0); }
  mpop();
  addLight(X,gy+2,Z,14,m.enr?[1.6,.4,.1]:[1.4,.6,.2]);
  if(Math.random()<.4) burst3(X+(Math.random()-.5)*3,gy+2.5,Z+(Math.random()-.5)*2,'#ff8a2a',1,.3,{glow:true,up:1.2});
  mreset(); mtr(X,gy,Z); mry(-(m.face||0)); msc(sc*1.05); for(let k=0;k<10;k++){ const a=k*1.3; P(GEO.box,.5,.05,.07,[1,.45,.1],2+Math.sin(t*3+k)*.8,-1.4+k*.3,2.98+Math.sin(a)*.05,Math.sin(a*2.3)*.5); }
  if(Math.random()<.25) P3(X+Math.cos(m.face||0)*4.4,gy+3.7,Z+Math.sin(m.face||0)*4.4,0,.7,0,1.4,.35,'#4a3e3a',{big:true});
}

/* =====================================================================
   FX & PARTICLES (3D)
   ===================================================================== */
const fx=[], texts=[], parts=[], tels=[], scorches=[];
let shakeMag=0, hurtFlash=0, curDark=0;
function shake(n){ if(typeof OPT!=='undefined'&&!OPT.shake) return; shakeMag=Math.max(shakeMag,n); }
function P3(x,y,z,vx,vy,vz,life,size,col,o){ if(parts.length>=PMAX) parts.shift(); o=o||{};
  parts.push({x,y,z,vx,vy,vz,life,max:life,size,c:C3(col),glow:!!o.glow,drag:o.drag??.97,grav:o.grav??0,shrink:o.shrink??true,big:!!o.big,fl:!!o.fl}); }
function burst3(X,Y,Z,col,n,spd,o){ o=o||{}; for(let i=0;i<n;i++){ const a=Math.random()*6.283, b=Math.random()*2-1, s=spd*(.3+Math.random()*.7), q=Math.sqrt(1-b*b);
  P3(X,Y,Z,Math.cos(a)*q*s,Math.abs(b)*s*.8+(o.up||0)*(.5+Math.random()*.5),Math.sin(a)*q*s,o.life||(.4+Math.random()*.6),o.size||(.06+Math.random()*.08),col,o); } }
const ph3=(px,py,h)=>[px/TS,groundY(px,py)+(h??1),py/TS];
function part(px,py,vx,vy,life,size,col,o){ o=o||{}; const [X,Y,Z]=ph3(px,py,o.h); P3(X,Y,Z,vx/TS,o.vh||0,vy/TS,life,size*.035,col,o); }
function burst(px,py,col,n,spd,o){ const [X,Y,Z]=ph3(px,py,o&&o.h); burst3(X,Y,Z,col,n,spd/TS*1.2,{...(o||{}),up:o&&o.up?o.up/TS:0,grav:o&&o.grav?-o.grav/TS:-1.5}); }
function fct(x,y,txt,col,big){ const px=x, py=y+28; texts.push({X:px/TS+(Math.random()-.5)*.4,Y:groundY(px,py)+2.1,Z:py/TS,txt:String(txt),col,t:now(),big}); }
function ring(x,y,col,r){ const [X,Y,Z]=ph3(x,y,.4); const R=r/TS; const n=Math.min(60,12+R*8); for(let i=0;i<n;i++){ const a=i/n*6.283; P3(X+Math.cos(a)*R*.3,Y,Z+Math.sin(a)*R*.3,Math.cos(a)*R*1.6,.4,Math.sin(a)*R*1.6,.5,.14,col,{glow:true,drag:.9}); } }
function spark(x,y,col){ const [X,Y,Z]=ph3(x,y,1); burst3(X,Y,Z,col,10,3,{glow:true,grav:-6}); }
function sparkle(x,y,col){ const [X,Y,Z]=ph3(x,y,.05); for(let i=0;i<26;i++){ const k=i/26, an=k*Math.PI*4+(i%2)*Math.PI, r=.55; P3(X+Math.cos(an)*r,Y+k*1.9,Z+Math.sin(an)*r,-Math.sin(an)*1.3,1.1+k*.7,Math.cos(an)*1.3,.9+k*.4,.1,col,{glow:true,drag:.95}); }
  for(let i=0;i<8;i++) P3(X+(Math.random()-.5)*.8,Y+Math.random()*1.6,Z+(Math.random()-.5)*.8,0,1.5,0,1.1,.16,'#ffffff',{glow:true,drag:.97}); ring(x,y,col,26); }
function proj(from,toFn,kind){ fx.push({k:'proj',x:from.x,y:from.y,to:toFn,kind,t:now(),dur:.32+Math.random()*.06}); }
const PCOL={1:'#ffe88a',2:'#ff8a2a',3:'#d58cff',4:'#c0e8ff',5:'#9dffb0',6:'#c6ffb0',7:'#ff4a3a',10:'#ff6a1a',14:'#8cff4a',15:'#a8e8ff',16:'#b06aff'};
const TELCOL={1:'#ffb23a',2:'#ff3b2a',3:'#ff7a1a',4:'#ff5a1a',5:'#c13bff',6:'#7ef0ff',7:'#a35cff'};
function addTel(a){ tels.push({x:+a[1],y:+a[2],r:+a[3],dur:Math.max(.2,(+a[4]||1000)/1000),kind:a[5]|0,t0:now()}); }
function areaFx(v,x,y,r){
  const [X,Y,Z]=ph3(x,y,.2); const R=r/TS;
  if(v===8){ FXP({k:'wave',x,y,r,col:'#ffe27a',dur:.7}); FXP({k:'dome',x,y,r:1.3,col:'#fff1b0',dur:.8}); ring(x,y,'#ffe9a0',r); for(let i=0;i<40;i++){ const a=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(a)*d,Y,Z+Math.sin(a)*d,0,1.5+Math.random(),0,1.1,.1,'#ffe9a0',{glow:true}); } }
  else if(v===9){ ring(x,y,'#a8e4ff',r); for(let i=0;i<50;i++){ const a=Math.random()*6.283; P3(X,Y+.3,Z,Math.cos(a)*R*2.4,Math.random()*1.5,Math.sin(a)*R*2.4,.55,.12,'#d8f4ff',{glow:true,drag:.9}); } fx.push({k:'ice',x,y,r,t:now(),dur:1.2}); }
  else if(v===10){ fx.push({k:'whirl',x,y,r,t:now(),dur:.5}); FXP({k:'wave',x,y,r:r*1.1,col:'#dfe8ff',dur:.45}); }
  else if(v===12){ fx.push({k:'pillar',x,y,r,t:now(),dur:1.1}); }
  else if(v===13){ fx.push({k:'meteor',x,y,r,t:now(),dur:.55}); }
  else if(v===16){ burst3(X,Y,Z,'#c8b48a',16,3,{grav:-4}); FXP({k:'wave',x,y,r:50,col:'#ffd9a0',dur:.35}); }
  else if(v===22){ FXP({k:'wave',x,y,r:Math.max(40,r),col:'#ffe27a',dur:.4,tall:.6}); burst3(X,Y+1.2,Z,'#fff3a0',18,3,{glow:true}); }
  else if(v===23){ FXP({k:'wave',x,y,r:r,col:'#ff4a3a',dur:.5,h:.6}); FXP({k:'wave',x,y,r:r*.6,col:'#ff9a5a',dur:.35,h:1.2}); }
  else if(v===24){ FXP({k:'dome',x,y,r:1.15,col:'#7fb2ff',dur:1.2}); }
  else if(v===26){ FXP({k:'wings',x,y,dur:1.6,f:0}); FXP({k:'dome',x,y,r:1,col:'#fff1b0',dur:1}); }
  else if(v===27){ SANCTS.push({x,y,r,until:now()+8}); }
  else if(v===18){ fx.push({k:'blizzard',x,y,r,t:now(),dur:2.3}); }
  else if(v===19){ fx.push({k:'phoenix',x,y,r,t:now(),dur:1.0}); burst3(X,Y+.5,Z,'#ff8a2a',70,R*3,{glow:true,up:2}); shake(5); }
  else if(v===20){ FXP({k:'wave',x,y,r,col:'#ffb84a',dur:.6,tall:1.4}); FXP({k:'wave',x,y,r:r*.55,col:'#fff1b0',dur:.45}); ring(x,y,'#ffb84a',r); burst3(X,Y+1,Z,'#ffd36a',40,3,{glow:true,up:1.5}); }
  else if(v===21){ for(let i=0;i<24;i++){ const a=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(a)*d,Y,Z+Math.sin(a)*d,0,1+Math.random(),0,1,.1,'#ffe9a0',{glow:true}); } }
  else if(v===17){ burst3(X,Y+.8,Z,'#d6b3ff',24,3.5,{glow:true}); FXP({k:'portal',x,y,dur:.7}); }
}
const FXP=(o)=>{ o.t=now(); fx.push(o); };
function petals(x,y){ const [X,Y,Z]=ph3(x,y,.2); for(let i=0;i<18;i++){ const a=Math.random()*6.283; P3(X+Math.cos(a)*.5,Y+Math.random()*1.8,Z+Math.sin(a)*.5,Math.cos(a)*.6,.6+Math.random()*.6,Math.sin(a)*.6,1.4,.11,i%3?'#ff9ad0':'#c6ffb0',{glow:true,drag:.96}); } }
const SANCTS=[];
function lightningFx(a,b){ if(!a||!b) return; fx.push({k:'bolt',ax:a.rx,ay:a.ry,b,t:now(),dur:.35}); const [X,Y,Z]=ph3(b.rx,b.ry,1); burst3(X,Y,Z,'#bfe4ff',14,4,{glow:true}); }
function deathBurst(m){ const col=m.t.key==='magma'||m.t.key==='emberling'?'#ff6a1a':m.t.col; const [X,Y,Z]=ph3(m.rx,m.ry,.8);
  burst3(X,Y,Z,col,26,3.5,{grav:-7}); for(let i=0;i<10;i++) P3(X+(Math.random()-.5)*.6,Y,Z+(Math.random()-.5)*.6,0,1+Math.random(),0,1.4,.08,'#fff6d8',{glow:true,drag:.98});
  if(m.t.boss||m.t.elite){ shake(9); ring(m.rx,m.ry,'#ffd34a',150); burst3(X,Y+1,Z,'#ffd34a',60,7,{glow:true}); } }
function footDust(x,y){ const z=tAt(Math.floor(x/TS),Math.floor(y/TS)); const col=z===T.PATH||z===T.SAND?'#c9b48a':z===T.ASH?'#6a5c56':z===T.SWAMP?'#5d6b44':z===T.BRIDGE?'#8a6a48':null; if(!col) return;
  const [X,Y,Z]=ph3(x,y,.05); for(let i=0;i<2;i++) P3(X+(Math.random()-.5)*.3,Y,Z+(Math.random()-.5)*.3,(Math.random()-.5)*.5,.35+Math.random()*.3,(Math.random()-.5)*.5,.6,.12,col,{drag:.93,big:true}); }
function entPos(kind,id){ if(kind==='m'){const m=mobById[id];return m?{x:m.rx,y:m.ry}:null}
  if(id===MY_U) return me?{x:me.x,y:me.y}:null; const o=othersByU.get(id); return o?{x:o.rx,y:o.ry}:null; }
function visualAct(src,a,mine){
  const kind=a[1],tgt=a[2],amt=a[3]|0,vis=a[4]|0;
  if(kind===0){
    if(vis===11){ if(!mine){ const from=a[5]?mobById[a[5]]:{rx:src.x,ry:src.y}; const m=mobById[tgt]; if(m&&from) lightningFx(from,m); } }
    else if(vis>=1&&vis<=4) proj(src,()=>entPos('m',tgt),vis);
    else { const p=entPos('m',tgt); if(p) spark(p.x,p.y,'#fff4d0'); }
    if(!mine){ const m=mobById[tgt]; if(m) m.hit=now(); } }
  if(kind===1 && vis===5){ const p=entPos('p',tgt); if(p) sparkle(p.x,p.y,'#9dffb0'); }
  if(kind===4){ const p=entPos('p',tgt); if(p){ sparkle(p.x,p.y,'#c6ffb0'); petals(p.x,p.y); } }
  if(kind===7){ const p=entPos('p',tgt); if(p){ ring(p.x,p.y,'#9fd8ff',36); FXP({k:'dome',x:p.x,y:p.y,r:1.05,col:'#bfe8ff',dur:1.1}); } }
  if(kind===6 && !mine){ const x=a.length>5?a[5]:src.x, y=a.length>5?a[6]:src.y; areaFx(vis,x,y,amt); }
  if(kind===3 && vis===7){ const p=entPos('m',tgt); if(p) fct(p.x,p.y-40,'!','#ff4a3a',true); }
}
function visualMobHit(m,u,vis,self){
  if(!m) return; const p=entPos('p',u); m.swingT=now();
  if(vis===2||vis===14||vis===6||vis===15||vis===16) proj({x:m.rx,y:m.ry},()=>entPos('p',u),vis===2?10:vis===15?15:vis===16?16:14);
  else if(vis===8){ if(p) fx.push({k:'beam',m,u,t:now(),dur:.6}); }
  else if(vis===5){ if(p){ const [X,Y,Z]=ph3(p.x,p.y,.1); burst3(X,Y,Z,'#5d8a2a',18,2,{grav:-3}); fx.push({k:'vines',u,t:now(),dur:2}); } }
  else if(vis===7){ if(p) spark(p.x,p.y,'#ffb03a'); }
  else if(p){ spark(p.x,p.y,vis===3?'#ff9a3a':'#ff9a7a'); if(vis===3&&self) shake(5); }
}
function ambient(dt){
  const t=now(); const cx=CAM.tx, cz=CAM.tz; const z=me?zoneAtPx(me.x,me.y):'town'; const dk=curDark; const rate=n=>Math.random()<n*dt;
  const rp=(r)=>{ const a=Math.random()*6.283, d=Math.random()*r; const X=cx+Math.cos(a)*d, Z=cz+Math.sin(a)*d; return [X,hgt(X,Z),Z]; };
  if((z==='meadow'||z==='forest'||z==='lake'||z==='town')&&dk>.25&&rate(30*dk)){ const [X,Y,Z]=rp(18); P3(X,Y+.4+Math.random()*1.8,Z,(Math.random()-.5)*.4,(Math.random()-.5)*.3,(Math.random()-.5)*.4,4,.07,'#d9ff7a',{glow:true,drag:1,shrink:false,fl:true}); }
  if(z==='ash'){ if(rate(45)){ const [X,Y,Z]=rp(20); P3(X,Y,Z,(Math.random()-.5)*.6,1.5+Math.random()*1.5,(Math.random()-.5)*.6,3.5,.06,Math.random()<.5?'#ff7a1a':'#ffb03a',{glow:true,drag:1}); }
    if(rate(25)){ const [X,Y,Z]=rp(20); P3(X,Y+8,Z,.3,-.6,.2,9,.05,'#9a908a',{drag:1,shrink:false}); } }
  if((z==='frost')&&rate(46)){ const [X,Y,Z]=rp(20); P3(X,Y+7,Z,.25+Math.sin(t*.3)*.25,-.9,.12,9,.05,'#ffffff',{drag:1,shrink:false}); }
  if(z==='crypt'&&rate(6)){ const [X,Y,Z]=rp(14); P3(X,Y+.2,Z,.1,.03,.1,6,1.3,'#5a6a8a',{big:true,drag:1,shrink:false}); }
  if(z==='swamp'&&rate(9)){ const [X,Y,Z]=rp(20); P3(X,Y+.3,Z,.2,.02,.1,7,1.4+Math.random(),'#a6b89a',{big:true,drag:1,shrink:false}); }
  if(z==='ruins'&&rate(5)){ const [X,Y,Z]=rp(18); P3(X,Y+.3,Z,.1,.02,.1,7,1.2,'#9a9ab8',{big:true,drag:1,shrink:false}); }
  if(z==='forest'&&rate(10)){ const [X,Y,Z]=rp(16); P3(X,Y+6,Z,.4+Math.random()*.3,-.7,.2,9,.07,Math.random()<.5?'#d79a3a':'#8fbf4a',{drag:1,shrink:false}); }
  if((z==='meadow'||z==='lake')&&dk<.3&&rate(6)){ const [X,Y,Z]=rp(14); P3(X,Y+.5+Math.random()*2,Z,.3,.05,.1,5,.035,'#ffffff',{glow:true,drag:1,shrink:false}); }
  if(Math.hypot(cx-TOWN.x,cz-TOWN.y)<40){ for(const c of CHIMNEYS) if(rate(1.5)) P3(c.x,c.y,c.z,.15+Math.random()*.1,.6+Math.random()*.3,.05,5,.5,'#8a8580',{big:true,drag:.998,shrink:false});
    if(rate(14)){ const a=Math.random()*6.283; P3(FOUNTAIN.x+Math.cos(a)*.15,2.6,FOUNTAIN.z+Math.sin(a)*.15,Math.cos(a)*.7,1.6,Math.sin(a)*.7,.9,.07,'#cfe8ff',{grav:-6,drag:.99}); } }
  for(const L of STAT_LIGHTS) if(L.fire&&Math.hypot(L.x-cx,L.z-cz)<30&&rate(10)) P3(L.x+(Math.random()-.5)*.3,L.y-.3,L.z+(Math.random()-.5)*.3,(Math.random()-.5)*.2,1.2+Math.random(),(Math.random()-.5)*.2,1,.12,L.ghost?'#7affa0':(Math.random()<.5?'#ff8a2a':'#ffd36a'),{glow:true});
}
function updateParticles(dt){ for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.life-=dt; if(p.life<=0){parts.splice(i,1);continue}
  const dr=Math.pow(p.drag,dt*60); p.vx*=dr; p.vz*=dr; p.vy=p.vy*dr+p.grav*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; } }

/* =====================================================================
   CAMERA & SKY
   ===================================================================== */
const CAM={yaw:-Math.PI/2,pitch:.38,dist:8.5,tx:TOWN.x,ty:2,tz:TOWN.y+6,ex:0,ey:0,ez:0};
let VP=M4.id(), INVVP=M4.id(), LVP=M4.id();
const SKY={};
function computeSky(dt){ dt=dt||.016;
  const ph=(((Date.now()/1000+(gm.tOff||0))%600+600)%600)/600, a=ph*Math.PI*2, el=Math.cos(a);
  const sd=[Math.sin(a)*.85,el,.42], l=Math.hypot(...sd); const sun=sd.map(v=>v/l);
  const dayK=clamp((el+.12)/.45,0,1), duskK=clamp(1-Math.abs(el-.03)/.22,0,1)*(1-clamp((el-.3)/.3,0,1));
  const sunI=clamp((el+.05)/.2,0,1), moonI=clamp((-el+.05)/.25,0,1);
  const moon=[-sun[0],Math.abs(sun[1])*.8+.3,-sun[2]]; const ml=Math.hypot(...moon);
  SKY.dir=sunI>=moonI?sun:moon.map(v=>v/ml); SKY.realSun=sun;
  const dayCol=[1.12,1.05,.94], duskCol=[1.5,.72,.38];
  SKY.sunCol=sunI>=moonI?dayCol.map((v,i)=>lerp(v,duskCol[i],duskK)*sunI):[.2,.26,.42].map(v=>v*moonI);
  SKY.sky=[0,1,2].map(i=>lerp([.07,.09,.17][i],[.36,.42,.52][i],dayK)+[.25,.1,0][i]*duskK*.5);
  SKY.gnd=[0,1,2].map(i=>lerp([.03,.035,.06][i],[.27,.24,.19][i],dayK));
  SKY.zen=[0,1,2].map(i=>lerp([.01,.015,.05][i],[.2,.4,.78][i],dayK));
  let hor=[0,1,2].map(i=>lerp([.04,.05,.11][i],[.66,.78,.9][i],dayK)); hor=hor.map((v,i)=>lerp(v,[.95,.52,.32][i],duskK*.75));
  SKY.night=1-dayK; SKY.fogD=.017;
  const zn=me?zoneAtPx(me.x,me.y):'town'; const zf={frost:[[.8,.86,.95],.026],crypt:[[.1,.12,.2],.04],ash:[[.36,.14,.08],.034],swamp:[[.32,.4,.32],.036],forest:[[.3,.38,.3],.024],ruins:[[.4,.42,.5],.023]}[zn];
  SKY.zf=SKY.zf||{c:hor.slice(),d:.017,k:0}; const tk=zf?1:0; SKY.zf.k=lerp(SKY.zf.k,tk,Math.min(1,dt*1.2)); if(zf){ SKY.zf.c=zf[0]; SKY.zf.d=zf[1]; }
  const k=SKY.zf.k; const brightness=.35+.65*dayK;
  SKY.fog=hor.map((v,i)=>lerp(v,SKY.zf.c[i]*brightness,k*.85)); SKY.hor=SKY.fog; SKY.fogD=lerp(.017,SKY.zf.d,k);
  if(zn==='ash'){ const q=k; SKY.sky=SKY.sky.map((v,i)=>lerp(v,[.42,.2,.13][i]*brightness+.04,.55*q)); SKY.zen=SKY.zen.map((v,i)=>lerp(v,[.16,.07,.05][i],.8*q)); SKY.sunCol=SKY.sunCol.map((v,i)=>v*lerp(1,[1,.78,.62][i],q)); }
  const WX=weatherNow(); const wet=WX.kind>=2?WX.k:0, cl=WX.kind>=1?WX.k:0; SKY.cloud=.45+.22*cl+.3*wet; SKY.storm=WX.kind===3?WX.k:wet*.45;
  const dm=1-.45*wet-.12*cl; SKY.sunCol=SKY.sunCol.map(v=>v*dm); SKY.sky=SKY.sky.map(v=>v*(1-.2*wet)); SKY.zen=SKY.zen.map(v=>v*(1-.5*wet));
  SKY.fog=SKY.fog.map((v,i)=>lerp(v,[.42,.45,.5][i]*(.3+.7*dayK),wet*.6)); SKY.hor=SKY.fog; SKY.fogD+=.012*wet;
  if(flash>0){ SKY.sky=SKY.sky.map(v=>v+flash*.8); SKY.fog=SKY.fog.map(v=>v+flash*.25); SKY.hor=SKY.fog; }
  if(zn==='crypt'){ SKY.sunCol=SKY.sunCol.map(v=>v*.3); SKY.sky=SKY.sky.map(v=>v*.42); SKY.gnd=SKY.gnd.map(v=>v*.45); }
  SKY.aurora=(zn==='frost'||zn==='crypt')?(1-dayK):0; SKY.hfog=({swamp:.7,lake:.4,forest:.28,frost:.18,crypt:.5}[zn]||.15)+duskK*.25+wet*.3;
  curDark=1-dayK;
}

/* =====================================================================
   RENDER
   ===================================================================== */
function setFrameUniforms(pr,shadow){ const u=pr.u; gl.useProgram(pr.p);
  gl.uniformMatrix4fv(u.uVP,false,VP); gl.uniformMatrix4fv(u.uLVP,false,LVP); gl.uniform1f(u.uTime,now());
  if(shadow) return;
  gl.uniform3fv(u.uSunDir,SKY.dir); gl.uniform3fv(u.uSunCol,SKY.sunCol); gl.uniform3fv(u.uSky,SKY.sky); gl.uniform3fv(u.uGnd,SKY.gnd); gl.uniform3fv(u.uFog,SKY.fog);
  gl.uniform3f(u.uCam,CAM.ex,CAM.ey,CAM.ez); gl.uniform1f(u.uFogD,SKY.fogD); gl.uniform1f(u.uHFog,SKY.hfog||0); gl.uniform1f(u.uShOn,1);
  gl.uniform1i(u.uNL,LSEL.n); gl.uniform4fv(u.uLP,LSEL.p); gl.uniform3fv(u.uLC,LSEL.c);
  gl.uniform1i(u.uND,DEC.n); gl.uniform4fv(u.uDec,DEC.d); gl.uniform4fv(u.uDecC,DEC.c);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,SM.tex); gl.uniform1i(u.uShadow,0);
  gl.uniform3f(u.uTint,1,1,1); gl.uniform1f(u.uEmis,0); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uTerrain,0); gl.uniform3f(u.uInvS2,1,1,1); if(u.uSpec) gl.uniform1f(u.uSpec,.12); if(u.uFol) gl.uniform1f(u.uFol,0); }
const LSEL={n:0,p:new Float32Array(64),c:new Float32Array(48)}, DEC={n:0,d:new Float32Array(48),c:new Float32Array(48)};
const IDM=M4.id();
function drawCmd(pr,c){ const u=pr.u; gl.uniformMatrix4fv(u.uM,false,c.m); gl.uniform3fv(u.uInvS2,c.inv); if(u.uTint){ gl.uniform3fv(u.uTint,c.c); gl.uniform1f(u.uEmis,c.e); gl.uniform1f(u.uAlpha,c.a); if(u.uSpec) gl.uniform1f(u.uSpec,c.sp); }
  gl.bindVertexArray(c.g.vao); gl.drawElements(gl.TRIANGLES,c.g.n,gl.UNSIGNED_INT,0); }
function drawStatic(pr,terrain){ const u=pr.u; if(u.uSpec) gl.uniform1f(u.uSpec,.12); gl.uniformMatrix4fv(u.uM,false,IDM); gl.uniform3f(u.uInvS2,1,1,1);
  if(terrain!==false){ if(u.uTerrain) gl.uniform1f(u.uTerrain,1); gl.bindVertexArray(TERRAIN.vao); gl.drawElements(gl.TRIANGLES,TERRAIN.n,gl.UNSIGNED_INT,0); if(u.uTerrain) gl.uniform1f(u.uTerrain,0); }
  gl.bindVertexArray(STATIC.vao); gl.drawElements(gl.TRIANGLES,STATIC.n,gl.UNSIGNED_INT,0); }
function drawInst(pr,shadow){ if(pr.u.uSpec) gl.uniform1f(pr.u.uSpec,.08); for(const k of shadow?['broad','pine','snow','rocks']:['broad','pine','snow','rocks','grass','flowers']){ const I=INST[k]; if(!I.count) continue; if(pr.u.uFol) gl.uniform1f(pr.u.uFol,k==='rocks'?2:k==='grass'?3:k==='flowers'?0:1);
    if(I.chunks){ const D=GFX.gd; if(pr.u.uGrassD) gl.uniform1f(pr.u.uGrassD,D); for(const c of I.chunks){ const dx=c.cx-CAM.tx, dz=c.cz-CAM.tz; if(dx*dx+dz*dz>(D+9)*(D+9)) continue; gl.bindVertexArray(c.vao); gl.drawElementsInstanced(gl.TRIANGLES,c.n,gl.UNSIGNED_INT,0,c.count); } if(pr.u.uGrassD) gl.uniform1f(pr.u.uGrassD,0); continue; }
    gl.bindVertexArray(I.vao); gl.drawElementsInstanced(gl.TRIANGLES,I.n,gl.UNSIGNED_INT,0,I.count); } }
function updateCamera(dt){
  if(me){ const gy=standY(me.x,me.y)+(me.jumpH||0)+(me.mounted?.75:0); CAM.tx=lerp(CAM.tx,me.x/TS,.35); CAM.tz=lerp(CAM.tz,me.y/TS,.35); CAM.ty=lerp(CAM.ty,gy+1.55,.25); }
  else { const t=now(); CAM.yaw=-Math.PI/2+Math.sin(t*.05)*.6; CAM.tx=TOWN.x+.5+Math.sin(t*.05)*3; CAM.tz=TOWN.y+5; CAM.ty=2.2; CAM.pitch=.3; CAM.dist=16; }
  const cp=Math.cos(CAM.pitch), sp=Math.sin(CAM.pitch); let d=CAM.dist;
  let ex=CAM.tx-Math.cos(CAM.yaw)*cp*d, ez=CAM.tz-Math.sin(CAM.yaw)*cp*d, ey=CAM.ty+sp*d;
  for(let k=0;k<8;k++){ const gh=hgt(ex,ez)+.45; if(ey>=gh) break; d*=.85; ex=CAM.tx-Math.cos(CAM.yaw)*cp*d; ez=CAM.tz-Math.sin(CAM.yaw)*cp*d; ey=CAM.ty+sp*d; }
  ey=Math.max(ey,hgt(ex,ez)+.45);
  const sh=shakeMag*.04; CAM.ex=ex+(Math.random()-.5)*sh; CAM.ey=ey+(Math.random()-.5)*sh; CAM.ez=ez+(Math.random()-.5)*sh;
}
function toScreen(X,Y,Z){ const v=VP; const x=v[0]*X+v[4]*Y+v[8]*Z+v[12], y=v[1]*X+v[5]*Y+v[9]*Z+v[13], w=v[3]*X+v[7]*Y+v[11]*Z+v[15]; if(w<.2) return null; return [(x/w*.5+.5)*W,(.5-y/w*.5)*H,w]; }
function animState(o,dt,x,y,moving,scale){ const ox=o._ax??x, oy=o._ay??y; const dm=Math.hypot(x-ox,y-oy); o._ax=x; o._ay=y; o.walkP=(o.walkP||0)+dm/TS*3.6/(scale||1);
  o.mvS=lerp(o.mvS||0,(moving||dm>.3)?1:0,Math.min(1,dt*10)); }
LOOK.warden.spikes=true; LOOK.warden.tassets=true; LOOK.warden.det='w'; LOOK.warden.crest=[.15,.3,.75]; LOOK.mender.det='m'; LOOK.arcanist.det='a'; LOOK.arcanist.weapon='crystal'; if(LOOK.frostgiant) LOOK.frostgiant.iceSpikes=true;
/* ---------- v14: equipped gear changes how a hero looks ---------- */
const GEAR_METAL=[[.5,.49,.48],[.66,.68,.72],[.8,.84,.92],[.34,.33,.42],[.94,.78,.36]];
const GEAR_TRIM=[[.42,.33,.22],[.62,.56,.46],[.84,.68,.32],[.92,.76,.42],[1,.86,.46]];
const GEAR_TH={fire:[.72,.2,.07],mire:[.24,.42,.2],dawn:[.92,.8,.45],wolf:[.46,.41,.36],ghost:[.34,.52,.68],arcane:[.42,.24,.72]};
const GEAR_GLOW={fire:[1,.48,.1],mire:[.5,1,.3],dawn:[1,.88,.45],wolf:[.8,.88,1],ghost:[.5,.95,1],arcane:[.8,.5,1]};
const RAR_GLOW=[[.7,.7,.7],[.3,1,.2],[.3,.6,1],[.75,.4,1],[1,.55,.12]];
/* compact description of an item's looks, sent to other players: base|rarity|theme|upgrade */
function gearVis(it){ if(!it) return ''; const n=String(it.name||''); const base=it.leg?'L'+it.leg:(BASES[it.slot]||[]).find(b=>n.includes(b))||'';
  const th=/Cinder|Ember|Wyrm/.test(n)?'fire':/Mire/.test(n)?'mire':/Dawn/.test(n)?'dawn':/Wolf/.test(n)?'wolf':/Hollow|Moonlit/.test(n)?'ghost':/Runed|Vaelborn/.test(n)?'arcane':'';
  return base+'|'+(it.rar|0)+'|'+th+'|'+(it.up|0); }
function myGearVis(){ const e=me.c.eq; return [gearVis(e.weapon),gearVis(e.armor),gearVis(e.trinket)]; }
function parseGV(a){ if(!Array.isArray(a)) return null; return a.slice(0,3).map(s=>typeof s==='string'?s.slice(0,40):''); }
const LOOKV={};
function playerLook(cls,u,gv){ const B=LOOK[cls]||LOOK.warden; if(!gv||!(gv[0]||gv[1]||gv[2])) return B; const key=cls+'#'+gv.join('#'); if(LOOKV[key]) return LOOKV[key];
  const L={...B}; const cc=C3(CLS[cls].col);
  const sp=s=>{ const [b,r,th,up]=String(s||'').split('|'); return b?{b,r:Math.max(0,Math.min(4,r|0)),th:th||'',up:up|0}:null; };
  const W=sp(gv[0]), A=sp(gv[1]), T=sp(gv[2]);
  if(A){ const tc=GEAR_TH[A.th]||cc.map(v=>v*.62), metal=GEAR_METAL[A.r], trim=GEAR_TRIM[A.r], cloth=tc.map(v=>Math.min(1,v*(.85+A.r*.06))), dark=cloth.map(v=>v*.55), leather=[.42,.28,.15].map(v=>v*(1+A.r*.05));
    const clear={metal:null,pauld:null,tabard:null,robe:null,tassets:false,chain:false,straps:false,stole:false,mantle:null,fur:false,spikes:false,rune:null};
    switch(A.b){
      case 'Jerkin': Object.assign(L,clear,{torso:leather,arms:leather.map(v=>v*.92),legs:[.3,.22,.14],boots:[.24,.15,.09],pauld:A.r>=1?leather.map(v=>v*.75):null,straps:true,strapC:[.2,.13,.07],head:L.head==='helm'||L.head==='plume'?'cap':L.head,hat:leather.map(v=>v*.8)}); break;
      case 'Hauberk': Object.assign(L,clear,{torso:metal.map(v=>v*.82),arms:metal.map(v=>v*.78),legs:dark,metal:metal.map(v=>v*.9),pauld:A.r>=2?metal:null,tabard:cloth,chain:true,boots:[.22,.18,.15]}); break;
      case 'Brigandine': Object.assign(L,clear,{torso:metal,arms:metal,legs:dark,metal,pauld:metal,tabard:cloth,tassets:true,boots:metal.map(v=>v*.7)}); break;
      case 'Robes': Object.assign(L,clear,{head:L.head==='helm'||L.head==='plume'?'hood':L.head,torso:cloth,arms:cloth,legs:dark,robe:cloth,boots:[.3,.22,.14]}); break;
      case 'Vestments': Object.assign(L,clear,{head:L.head==='helm'||L.head==='plume'?'hood':L.head,torso:[.93,.91,.85],arms:[.93,.91,.85],legs:dark,robe:[.93,.91,.85],stole:true,stoleC:cloth,boots:[.4,.3,.2]}); break;
      case 'Mantle': Object.assign(L,clear,{head:L.head==='helm'||L.head==='plume'?'hood':L.head,torso:cloth,arms:cloth,legs:dark,robe:cloth,mantle:dark.map(v=>Math.min(1,v*1.4)),cape:dark,boots:[.25,.18,.12]}); break; }
    L.trim=trim; L.hood=cloth.map(v=>v*.9); if(L.head==='hat') L.hat=dark; if(L.head==='helm'&&!L.metal) L.metal=metal;
    if(A.r>=2&&!L.cape) L.cape=tc.map(v=>v*.7); if(A.r>=2) L.gem=GEAR_GLOW[A.th]||cc; L.crest=GEAR_GLOW[A.th]||cc.map(v=>v*.85);
    if(A.r>=3){ L.rune=GEAR_GLOW[A.th]||cc; L.spikes=!!L.pauld; const rg=L.rune; L.aura='#'+rg.map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).join(''); }  if(L.metal) METALS.add(L.metal); if(L.pauld) METALS.add(L.pauld); }
  if(W){ const map={Longsword:'sword',Warstaff:'staff',Spellblade:'spellblade',Morningstar:'morningstar',Wand:'wand',Greataxe:'greataxe',Lwarden:'dawnwarden',Lmender:'solace',Larcanist:'cinderheart'};
    L.weapon=map[W.b]||L.weapon; L.wcol=GEAR_METAL[W.r]; L.wglow=GEAR_GLOW[W.th]||(W.r>=2?RAR_GLOW[W.r]:null); L.wup=W.up;
    if(['greataxe','staff','solace'].includes(L.weapon)&&L.off==='shield') L.off=null;
    else if(cls==='warden'&&!L.off&&['sword','spellblade','morningstar','dawnwarden'].includes(L.weapon)) L.off='shield';
    if(L.orbs&&L.weapon!=='wand'&&L.weapon!=='cinderheart') L.orbs=L.weapon==='spellblade'; }
  if(T) L.trink={k:T.b,c:GEAR_GLOW[T.th]||RAR_GLOW[T.r],r:T.r};
  L.gearX=!!(L.straps||L.chain||L.mantle||L.stole||L.trink);
  return LOOKV[key]=L; }
/* extra clothing and trinkets, drawn in the torso's frame (x = forward, y = up from the hips) */
function gearExtras(L,o,t,e){
  if(L.straps){ for(const s of [-1,1]){ mpush(); mtr(.2,.36,0); mrx(s*.6); P(GEO.box,.03,.66,.07,L.strapC,e); mpop(); } P(GEO.sph,.045,.06,.06,L.trim,e+.2,.215,.36,0); for(const s of [-1,1]) P(GEO.box,.14,.12,.06,L.strapC.map(v=>v*1.3),e,.1,.06,s*.22); }
  if(L.chain){ P(GEO.frus,.6,.36,.64,L.metal,e,0,-.3,0); for(let k=0;k<3;k++) P(GEO.cyl,.6-k*.04,.012,.64-k*.04,L.metal.map(v=>v*.7),e,0,-.24+k*.11,0); }
  if(L.stole) for(const s of [-1,1]){ P(GEO.box,.03,.74,.075,L.stoleC,e,.205,.24,s*.09); P(GEO.box,.032,.05,.08,L.trim,e+.15,.207,-.1,s*.09); }
  if(L.mantle){ P(GEO.sph,.52,.24,.68,L.mantle,e,-.02,.62,0); P(GEO.cyl,.52,.03,.69,L.trim,e+.1,-.02,.55,0); for(const s of [-1,1]) P(GEO.sph,.08,.08,.08,L.trim,e+.25,.18,.62,s*.16); }
  const T=L.trink; if(!T) return; const g=T.c, ge=1.4+T.r*.3+Math.sin(t*3+o.x)*.4, gold=L.trim||[.85,.7,.32];
  switch(T.k){
    case 'Talisman': mpush(); mtr(.215,.44,0); mrz(-Math.PI/2); P(GEO.cyl,.17,.03,.17,gold,e+.2); P(GEO.cyl,.1,.035,.1,g,ge); mpop(); for(let k=0;k<7;k++){ const a=(k/6-.5)*2.2; P(GEO.sph,.02,.02,.02,gold,e,.13+Math.cos(a)*.06,.66-Math.cos(a)*.15,Math.sin(a)*.14); } break;
    case 'Locket': for(let k=0;k<11;k++){ const a=(k/10-.5)*2.6; P(GEO.sph,.018,.018,.018,gold,e+.2,.1+Math.cos(a)*.1,.67-Math.cos(a)*.17,Math.sin(a)*.15); }
      mpush(); mtr(.205,.47,0); P(GEO.sph,.04,.07,.07,gold,e+.2); P(GEO.sph,.03,.045,.045,g,ge,.012,0,0); mpop(); break;
    case 'Charm': mpush(); mtr(.16,.06,-.2); mrz(Math.sin(t*2+o.x)*.15); P(GEO.cyl,.012,.14,.012,[.3,.2,.1],e,0,-.14,0); mtr(0,-.2,0); P(GEO.cone,.06,.1,.06,g,ge,0,0,0); mrx(Math.PI); P(GEO.cone,.06,.08,.06,g,ge,0,0,0); mpop(); break;
    case 'Signet': P(GEO.sph,.05,.08,.08,gold,e+.2,.24,.12,0); P(GEO.sph,.03,.05,.05,g,ge+.6,.27,.12,0); break;
    case 'Idol': { const a=t*1.4+o.x, ox=Math.cos(a)*.5-.1, oz=Math.sin(a)*.5, oy=1.0+Math.sin(t*2.2)*.08; P(GEO.sph,.1,.13,.1,gold,e+.3,ox,oy,oz); P(GEO.sph,.08,.08,.08,gold,e+.3,ox,oy+.12,oz); P(GEO.sph,.05,.05,.05,g,ge+.6,ox+.05,oy+.13,oz); if(Math.random()<.06) emitTip('#ffe6a0',ox,oy,oz); break; } }
}
/* weapons from the BASES list and the three legendaries */
function drawGearWeapon(w,L,o,t){ const c=L.wcol||[.75,.78,.84], gl=L.wglow, ge=gl?1.3+(L.wup||0)*.12:0, gHex=gl?'#'+gl.map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).join(''):'#ffffff', swinging=(o.swing??-1)>=0;
  switch(w){
    case 'spellblade': P(GEO.cyl,.045,.22,.045,[.22,.14,.3],0,0,-.1,0); for(const s of [-1,1]){ mpush(); mtr(0,.1,s*.06); mrx(s*1.9); P(GEO.cone,.04,.16,.03,L.trim||c,.25); mpop(); } P(GEO.sph,.05,.05,.05,gl||[.7,.5,1],2.2,0,.1,0);
      P(GEO.box,.8,.07,.024,c,.2,.48,.12,0); P(GEO.box,.68,.016,.03,gl||[.75,.55,1],2+ge,.44,.12,0); P(GEO.cone,.05,.16,.024,c,.2,.92,.12,0);
      if(swinging||Math.random()<.2) emitTip(gHex,.3+Math.random()*.6,.12,0); return true;
    case 'morningstar': P(GEO.cyl,.05,.72,.05,[.32,.22,.13],0,0,-.2,0); P(GEO.cyl,.065,.06,.065,L.trim||c,.2,0,-.22,0); P(GEO.cyl,.06,.14,.06,c,.1,0,.36,0);
      P(GEO.sph,.26,.26,.26,c,ge*.5,0,.62,0); for(let k=0;k<10;k++){ const a=k*2.4, b=Math.acos(1-2*(k+.5)/10); mpush(); mtr(0,.62,0); mry(a); mrz(b); P(GEO.cone,.06,.18,.06,c,.15,0,.1,0); mpop(); }
      if(gl) addLight(o.x,o.y+1.6,o.z,3,gl); return true;
    case 'greataxe': P(GEO.cyl,.055,1.65,.055,[.3,.2,.12],0,0,-.55,0); for(let k=0;k<4;k++) P(GEO.cyl,.065,.035,.065,[.2,.13,.08],0,0,-.4+k*.12,0);
      for(const s of [-1,1]){ mpush(); mtr(s*.2,.82,0); P(GEO.sph,.42,.52,.035,c,ge*.4); P(GEO.sph,.36,.46,.04,c.map(v=>v*.75),0,-s*.04,0,0); if(gl) P(GEO.sph,.04,.46,.04,gl,ge,s*.2,0,0); mpop(); } P(GEO.cone,.06,.22,.06,c,.15,0,1.05,0);
      if(swinging) for(let k=0;k<3;k++) emitTip(gHex,.2,.8+k*.1,0); return true;
    case 'dawnwarden': { const gd=[1,.84,.42]; P(GEO.cyl,.055,.3,.055,[.35,.2,.1],0,0,-.16,0); P(GEO.sph,.07,.07,.07,gd,1.2,0,-.18,0);
      mpush(); mtr(0,.12,0); mrz(-Math.PI/2); P(GEO.cyl,.26,.04,.26,gd,1); P(GEO.cyl,.14,.05,.14,[1,.95,.7],3,0,-.005,0); mpop(); for(let k=0;k<8;k++){ const a=k/8*6.283+t*.6; P(GEO.box,.02,.06,.03,gd,2.2,.02,.12+Math.cos(a)*.2,Math.sin(a)*.2); }
      P(GEO.box,1.25,.11,.035,[1,.97,.88],1.1,.72,.12,0); P(GEO.box,1.1,.03,.04,[1,.82,.35],3,.66,.12,0); P(GEO.cone,.08,.2,.035,[1,.97,.88],1.1,1.37,.12,0);
      addLight(o.x,o.y+1.3,o.z,6,[1.4,1.1,.5]); if(Math.random()<.4) emitTip(Math.random()<.5?'#ffe28a':'#fff6d0',.3+Math.random()*1,.12,0); return true; }
    case 'solace': { const gd=[1,.86,.45]; P(GEO.cyl,.06,1.9,.06,[.94,.9,.8],.3,0,-.6,0); for(const h of [-.3,.4,.95]) P(GEO.cyl,.08,.05,.08,gd,.8,0,h,0);
      mpush(); mtr(0,1.55,0); mry(t*.8); for(let k=0;k<14;k++){ const a=k/14*6.283; P(GEO.sph,.05,.05,.05,gd,1.6,Math.cos(a)*.26,Math.sin(a)*.26,0); } mpop();
      P(GEO.sph,.15,.15,.15,[1,.95,.6],o.cast?4.5:3.2,0,1.55,0); for(let k=0;k<6;k++){ const a=k/6*6.283+t; P(GEO.box,.02,.12,.02,[1,.92,.6],2.5,0,1.55+Math.sin(a)*.4,Math.cos(a)*.4); }
      addLight(o.x,o.y+2.3,o.z,o.cast?9:6,[1.4,1.2,.6]); if(Math.random()<.3) emitTip('#fff3b0',0,1.55,0); return true; }
    case 'cinderheart': { const pu=1+Math.max(0,Math.sin(t*5))*.18; P(GEO.cyl,.035,.4,.035,[.75,.8,.9],.3,0,-.05,0);
      mpush(); mtr(0,.55,0); for(let k=0;k<4;k++){ mpush(); mry(k*Math.PI/2+t*.5); mtr(.15,0,0); P(GEO.limb,.022,.24,.022,[.85,.9,1],.5,0,.18,0); mpop(); }
        P(GEO.sph,.15*pu,.17*pu,.15*pu,[1,.25,.08],3.4,0,0,0); P(GEO.sph,.08,.08,.08,[1,.8,.3],4.5,0,0,0); mpop();
      for(let k=0;k<4;k++){ const a=t*3+k*1.57; P(GEO.sph,.035,.035,.035,[1,.6,.15],3.5,Math.cos(a)*.3,.55+Math.sin(t*4+k)*.1,Math.sin(a)*.3); }
      addLight(o.x,o.y+1.5,o.z,6,[1.6,.5,.15]); if(Math.random()<.35) emitTip('#ff7a2a',0,.55,0); return true; }
  }
  return false; }

function buildScene(dt){
  const t=now(); cmds.length=0; tcmds.length=0; L3.length=0;
  const near=(px,py,r)=>{ const d=Math.hypot(px/TS-CAM.tx,py/TS-CAM.tz); LOD_FAR=d>(GFX.q==='ultra'?26:20); LOD_MID=d>(GFX.q==='low'?3:GFX.q==='ultra'?12:8); CAST_SH=d<30; return d<r; };
  for(const n of NPCS){ if(!near(n.x,n.y,70)) continue; drawHumanoid({x:n.x/TS,y:groundY(n.x,n.y),z:n.y/TS,face:n.face??Math.PI/2,emote:n.emote,mv:0,walk:0,dead:-1,L:LOOK[n.id]||LOOK.oriel,skin:SKIN[n.id==='mira'?1:2]}); }
  drawExtras(near,t);
  for(const m of mobs){
    if(m.dead){ if(m.deathT&&t-m.deathT<1.6&&near(m.dx,m.dy,70)) drawMob3(m,true); continue; }
    animState(m,dt,m.rx,m.ry,false,m.t.boss?2:1);
    if(!near(m.rx,m.ry,m.t.boss?70:55)) continue; drawMob3(m,false);
    if(m.t.light&&!LOOK[m.t.key]&&m.t.key!=='wyrm'&&m.t.key!=='emberling'&&m.t.key!=='moth'&&m.t.key!=='wraith') addLight(m.rx/TS,groundY(m.rx,m.ry)+1.4,m.ry/TS,5,C3(m.t.light)); }
  const drawP=(o,isMe)=>{ const x=isMe?me.x:o.rx, y=isMe?me.y:o.ry; const cls=isMe?me.c.cls:o.c, u=isMe?MY_U:o.u; const dead=isMe?me.dead:o.d;
    const st=isMe?me:o; animState(st,dt,x,y,isMe?me.moving:o.moving);
    if(dead&&!st.deadAt) st.deadAt=t; if(!dead) st.deadAt=0;
    const sw=(t-(st.swingT||0))/.32; const spin=st.spinT&&t-st.spinT<.5; const castCol=C3(CLS[cls].col);
    const mt=dead?0:((isMe?me.mounted:o.mt)||0); const swim=!mt&&!onDock(x,y)&&isWaterAt(x,y)&&hgt(x/TS,y/TS)<-.4;
    const Y0=standY(x,y)+(isMe?(me.jumpH||0):0), face=isMe?me.face:o.f, emo=isMe?me.emote:o.emote;
    if(mt) drawHorse({x:x/TS,y:Y0,z:y/TS,face,mv:st.mvS||0,walk:st.walkP||0,m:mt});
    drawHumanoid({x:x/TS,y:Y0,z:y/TS,face:face+(spin?(t-st.spinT)*26:0),mv:mt?0:(st.mvS||0),walk:st.walkP||0,swing:sw>=0&&sw<1?sw:-1,lift:mt?.72:0,ride:!!mt,swim,emote:emo,
      cast:isMe?!!me.cast:!!(o.b&4),castCol,dead:dead?t-st.deadAt:-1,L:playerLook(cls,u,isMe?myGearVis():o.gv),skin:SKIN[hashU(u)%SKIN.length],hair:HAIR[hashU(u)%HAIR.length],big:(isMe?me.avatarU>t:(o.b&64))?1.25:1,wr:isMe?(me.c.eq.weapon?me.c.eq.weapon.rar:0):(o.wr||0)});
    { const au=isMe?(gm.aura&&isGM):o.au; if(au&&!dead) drawAura(x/TS,Y0,y/TS,t,'#ffb03a');
      const cb=isMe?cosBits():(o.cs|0); if(!dead&&(cb&2)&&!au) drawAura(x/TS,Y0,y/TS,t,'#ff7ad9'); if(!dead&&(cb&1)) drawCosWings(x/TS,Y0+(mt?.72:0),y/TS,face,t); }
    if(isMe&&me.dash&&Math.random()<.9){ P3(x/TS+(Math.random()-.5)*.4,Y0+.3+Math.random()*1.4,y/TS+(Math.random()-.5)*.4,0,.2,0,.45,.18,'#ffd9a0',{glow:true,drag:.9}); }
    if(!dead&&!mt&&cls==='warden'&&sw>=0&&sw<.8){ const pr=Math.min(1,sw/.35), al=sw<.4?1:1-(sw-.4)/.4; const N=9; const big=(isMe?me.avatarU>t:(o.b&64))?1.3:1;
      for(let k=0;k<N;k++){ const q=k/(N-1); if(q>pr) break; const an=face+1.2-2.4*q, R=1.1*big; const px=x/TS+Math.cos(an)*R, pz=y/TS+Math.sin(an)*R, py=Y0+(1.5-.7*q)*big;
        mreset(); mtr(px,py,pz); mry(-Math.atan2(Math.cos(an),-Math.sin(an))); mrz(.35); P(GEO.box,.46*big,.14,.05,[1,.92,.75],5,0,0,0,al*(.5+.5*q)); P(GEO.box,.5*big,.28,.02,[1,.7,.4],2.5,0,0,0,al*.35*q); }
      if(sw<.05&&Math.random()<.5){ const an=face; burst3(x/TS+Math.cos(an)*1.1,Y0+1.1,y/TS+Math.sin(an)*1.1,'#ffe0b0',4,1.5,{glow:true}); } }
    const b=isMe?((me.bulwark>t?1:0)|(me.absorb>0&&me.absorbU>t?8:0)):o.b; const X=x/TS, Y=Y0+(mt?.72:0), Z=y/TS;
    if(b&1){ mreset(); mtr(X,Y+1,Z); mry(t); P(GEO.sph,1.6,2.2,1.6,[.5,.7,1],1.2,0,0,0,.18); }
    if(b&8){ mreset(); mtr(X,Y+1,Z); P(GEO.sph,1.5,2.1,1.5,[.75,.9,1],1.4,0,0,0,.2); }
    if(isMe?me.cast:(o.b&4)) addLight(X,Y+1.4,Z,5,castCol);
    if(isMe?me.avatarU>t:(o.b&64)){ addLight(X,Y+1.5,Z,7,[1.3,1.1,.5]); if(Math.random()<.4) burst3(X,Y+1,Z,'#ffd34a',1,.8,{glow:true,up:1}); }
    if(curDark>.4) addLight(X,Y+2.2,Z,isMe?7:5,[.55,.48,.38].map(v=>v*curDark)); };
  for(const o of others.values()) if(seenO(o)&&near(o.rx,o.ry,60)) drawP(o,false);
  if(me){ LOD_FAR=false; LOD_MID=false; CAST_SH=true; drawP(null,true); }
  LOD_FAR=false; LOD_MID=false; CAST_SH=false;
  // fx geometry
  for(let i=fx.length-1;i>=0;i--){ const e=fx[i]; const a=(t-e.t)/e.dur; if(a<0) continue;
    if(a>1){ if(e.k==='proj'){ const p=e.to(); if(p){ const [X,Y,Z]=ph3(p.x,p.y,1.1); burst3(X,Y,Z,PCOL[e.kind]||'#fff',e.kind===4?8:24,e.kind===4?2:4.5,{glow:true}); if(e.kind!==4) ring(p.x,p.y,PCOL[e.kind]||'#fff',40);
        if(e.kind===1) fx.push({k:'pillar',x:p.x,y:p.y,r:22,t:now(),dur:.55}); else if(e.kind===2){ scorches.push({x:p.x,y:p.y,r:22,t:now()}); burst3(X,Y,Z,'#ffd36a',14,2.5,{glow:true,up:2}); } else if(e.kind===3) FXP({k:'wave',x:p.x,y:p.y,r:45,col:'#d58cff',dur:.35,h:.8}); else if(e.kind===15||e.kind===16) FXP({k:'wave',x:p.x,y:p.y,r:35,col:PCOL[e.kind],dur:.35,h:.8}); } }
      if(e.k==='meteor'){ const [X,Y,Z]=ph3(e.x,e.y,.3); burst3(X,Y,Z,'#ff8a2a',70,8,{glow:true,up:2}); burst3(X,Y,Z,'#5a4c46',30,5,{grav:-9}); ring(e.x,e.y,'#ffb03a',e.r*1.2); scorches.push({x:e.x,y:e.y,r:e.r*.8,t:now()}); shake(9); }
      fx.splice(i,1); continue; }
    switch(e.k){
      case 'proj': { const p=e.to(); if(!p){ fx.splice(i,1); break; } const [X0,Y0,Z0]=ph3(e.x,e.y,1.35), [X1,Y1,Z1]=ph3(p.x,p.y,1.1);
        const X=lerp(X0,X1,a), Z=lerp(Z0,Z1,a), Y=lerp(Y0,Y1,a)+Math.sin(a*Math.PI)*.5; const col=C3(PCOL[e.kind]||'#fff'); const s=e.kind===4?.14:(e.kind===2||e.kind===10)?.32:.24;
        for(let k=1;k<=(e.kind===4?3:6);k++){ const q=a-k*.04; if(q<0) break; const ss=s*(1-k*.13); mreset(); mtr(lerp(X0,X1,q),lerp(Y0,Y1,q)+Math.sin(q*Math.PI)*.5,lerp(Z0,Z1,q)); P(GEO.sph,ss,ss,ss,col,3,0,0,0,.55*(1-k/7)); }
        if(e.kind===3) for(let k=0;k<2;k++){ const an=t*16+k*3.14; mreset(); mtr(X,Y,Z); P(GEO.sph,.06,.06,.06,[1,.85,1],4,Math.cos(an)*s*1.7,Math.sin(an)*s*1.7,Math.sin(an+1)*s); }
        mreset(); mtr(X,Y,Z); mry(t*9); P(GEO.sph,s*.5,s*.5,s*.5,[1,1,1],5); P(GEO.sph,s,s*(e.kind===2?1.25+Math.sin(t*30)*.12:1),s,col,3.5); for(let k=0;k<(e.kind===4?1:3);k++) P3(X,Y,Z,(Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6,.35,s*.5,PCOL[e.kind]||'#fff',{glow:true,drag:.9});
        addLight(X,Y,Z,5,col); break; }
      case 'bolt': { const b=e.b; const [X0,Y0,Z0]=ph3(e.ax,e.ay,1.3), [X1,Y1,Z1]=ph3(b.rx,b.ry,1.1); let px=X0,py=Y0,pz=Z0;
        for(let k=1;k<=7;k++){ const q=k/7; const nx=lerp(X0,X1,q)+(k<7?(Math.random()-.5)*.6:0), ny=lerp(Y0,Y1,q)+(k<7?(Math.random()-.5)*.6:0), nz=lerp(Z0,Z1,q)+(k<7?(Math.random()-.5)*.6:0);
          const dx=nx-px,dy=ny-py,dz=nz-pz, L=Math.hypot(dx,dy,dz)||.01; mreset(); mtr((px+nx)/2,(py+ny)/2,(pz+nz)/2); mry(-Math.atan2(dz,dx)); mrz(Math.asin(clamp(dy/L,-1,1)));
          P(GEO.box,L,.06,.06,[.75,.9,1],5); px=nx;py=ny;pz=nz; } addLight(X1,Y1,Z1,8,[.6,.8,1.4]); break; }
      case 'beam': { const p=entPos('p',e.u); if(!p) break; const [X0,Y0,Z0]=ph3(p.x,p.y,1.1), [X1,Y1,Z1]=ph3(e.m.rx,e.m.ry,1.6); const dx=X1-X0,dy=Y1-Y0,dz=Z1-Z0,L=Math.hypot(dx,dy,dz)||.01;
        mreset(); mtr((X0+X1)/2,(Y0+Y1)/2,(Z0+Z1)/2); mry(-Math.atan2(dz,dx)); mrz(Math.asin(clamp(dy/L,-1,1))); P(GEO.box,L,.12,.12,[.7,.5,1],3,0,0,0,.6*(1-a)); break; }
      case 'whirl': { const [X,Y,Z]=ph3(e.x,e.y,.9); for(let k=0;k<8;k++){ const an=a*14+k*.785; P3(X+Math.cos(an)*e.r/TS*.8,Y+Math.random()*.4,Z+Math.sin(an)*e.r/TS*.8,-Math.sin(an)*4,0,Math.cos(an)*4,.25,.09,'#e8f0ff',{glow:true,drag:.9}); } break; }
      case 'pillar': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=Math.sin(a*Math.PI); mreset(); mtr(X,Y,Z); P(GEO.cyl,e.r/TS*1.1,14,e.r/TS*1.1,[1,.92,.6],3.5,0,0,0,.35*al); P(GEO.cyl,e.r/TS*.5,14,e.r/TS*.5,[1,1,.85],4,0,0,0,.5*al);
        for(let k=0;k<4;k++) P3(X+(Math.random()-.5)*e.r/TS*2,Y,Z+(Math.random()-.5)*e.r/TS*2,0,3+Math.random()*3,0,.9,.12,'#fff3b0',{glow:true}); addLight(X,Y+2,Z,14*al,[1.6,1.4,.8]); break; }
      case 'meteor': { const [X1,Y1,Z1]=ph3(e.x,e.y,0); const X=X1-5*(1-a*a), Y=Y1+16*(1-a*a), Z=Z1-2*(1-a*a); mreset(); mtr(X,Y,Z); mry(t*4); P(GEO.sph,1.1,1.1,1.1,[.35,.2,.15],0); P(GEO.sph,1.3,1.3,1.3,[1,.45,.1],2.5,0,0,0,.6);
        for(let k=0;k<6;k++) P3(X+(Math.random()-.5)*.8,Y+(Math.random()-.5)*.8,Z+(Math.random()-.5)*.8,(Math.random()-.5),1,(Math.random()-.5),.6,.35,Math.random()<.5?'#ff8a2a':'#ffd36a',{glow:true});
        addLight(X,Y,Z,16,[1.8,.8,.2]); break; }
      case 'blizzard': { const [X,Y,Z]=ph3(e.x,e.y,0); const R=e.r/TS; for(let k=0;k<10;k++){ const an=Math.random()*6.283,d=Math.sqrt(Math.random())*R; P3(X+Math.cos(an)*d-1.2,Y+7,Z+Math.sin(an)*d,1.5,-10,0,.75,.1,'#e8f8ff',{glow:true,drag:1}); }
        if(Math.random()<.4){ const an=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(an)*d,Y+.2,Z+Math.sin(an)*d,0,.1,0,2,1.2,'#cfe8ff',{big:true}); } addLight(X,Y+2,Z,R*2.2,[.6,.85,1.3]); break; }
      case 'phoenix': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=1-a; const R=e.r/TS*(.3+.9*a);
        for(let k=0;k<16;k++){ const an=k/16*6.283; P3(X+Math.cos(an)*R,Y+.3,Z+Math.sin(an)*R,Math.cos(an)*.5,1.5,Math.sin(an)*.5,.5,.25,k%2?'#ff8a2a':'#ffd36a',{glow:true}); }
        mreset(); mtr(X,Y+1.6+a*3,Z); const fw=Math.sin(t*14)*.4; for(const s of [-1,1]){ mpush(); mrx(-s*(.3+fw)); P(GEO.wing,1.5,1,1.5*s,[1,.55,.12],3.5,0,0,0,.85*al); mpop(); } P(GEO.sph,.5,.5,.9,[1,.75,.3],3.5,0,0,0,al); P(GEO.cone,.3,.8,.3,[1,.5,.1],3,-.6,0,0,al);
        addLight(X,Y+2,Z,16*al,[1.8,.8,.2]); break; }
      case 'wave': { const [X,Y,Z]=ph3(e.x,e.y,.12); const R=e.r/TS*(.12+.88*Math.sqrt(a)), al=1-a, c=C3(e.col), n=30;
        for(let k=0;k<n;k++){ const an=k/n*6.283; mreset(); mtr(X+Math.cos(an)*R,Y+(e.h||0)+Math.sin(a*3.14)*.15,Z+Math.sin(an)*R); mry(-an); P(GEO.box,.14,.06+.3*al*(e.tall||1),R*6.283/n*1.08,c,3.2,0,0,0,al*.85); }
        addLight(X,Y+.6,Z,Math.max(.1,R*1.6*al),c); break; }
      case 'dome': { const p=e.u?entPos('p',e.u):e; if(!p) break; const [X,Y,Z]=ph3(p.x,p.y,0); const c=C3(e.col); const R=(e.r||1.1)*(a<.2?a/.2:1), al=a<.2?1:1-(a-.2)/.8;
        mreset(); mtr(X,Y+1,Z); mry(t*.8); P(GEO.sph,R*2,R*2.1,R*2,c,1.1,0,0,0,.2*al); P(GEO.sph,R*2.08,R*2.18,R*2.08,[1,1,1],1.2,0,0,0,.06*al);
        for(let k=0;k<6;k++){ const an=k/6*6.283; P(GEO.box,.03,R*1.5,.03,c,2,Math.cos(an)*R*.98,0,Math.sin(an)*R*.98,.3*al); }
        P(GEO.cyl,R*2.1,.05,R*2.1,c,3,0,-.95,0,.6*al); addLight(X,Y+1,Z,5*al,c); break; }
      case 'wings': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=a<.15?a/.15:1-(a-.15)/.85; const sp=Math.min(1,a*3); const fw=Math.sin(t*5)*.15;
        mreset(); mtr(X,Y+1.35+a*.5,Z); mry(-(e.f||0)); for(const s of [-1,1]){ mpush(); mtr(-.3,0,s*.12); mrx(-s*(1.2-sp*.9+fw)); P(GEO.wing,.8,.7,.8*s,[1,.95,.8],1.3,0,0,0,.5*al); P(GEO.wing,.55,.7,.55*s,[1,.82,.4],1.8,.05,.03,0,.45*al); mpop(); }
        P(GEO.cyl,.5,.04,.5,[1,.9,.5],2.5,-.05,.8,0,.8*al); addLight(X,Y+2,Z,5*al,[1.2,1,.6]); if(Math.random()<.5) P3(X+(Math.random()-.5),Y+1.5,Z+(Math.random()-.5),0,-.6,0,1,.12,'#fff3c0',{glow:true}); break; }
      case 'portal': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=1-a, R=.85*(1-a*.5); const c=C3(e.col||'#d6b3ff');
        for(let k=0;k<16;k++){ const an=k/16*6.283+t*6; const yy=Y+1.1+Math.sin(an)*R*1.3; mreset(); mtr(X+Math.cos(an)*R*Math.cos(e.f||0),yy,Z+Math.cos(an)*R*Math.sin(e.f||0)); P(GEO.sph,.12*al+.03,.12*al+.03,.12*al+.03,c,3.5); }
        mreset(); mtr(X,Y+1.1,Z); P(GEO.sph,.5*al,1.3*al,.5*al,c,2.5,0,0,0,.35*al); addLight(X,Y+1.1,Z,6*al,c); break; }
      case 'streak': { const [X0,Y0,Z0]=ph3(e.sx,e.sy,1), [X1,Y1,Z1]=ph3(e.ex,e.ey,1); const dx=X1-X0,dz=Z1-Z0,L=Math.hypot(dx,dz)||.01, al=1-a;
        for(const [h,w] of [[-.35,.05],[0,.1],[.4,.05]]){ mreset(); mtr((X0+X1)/2,(Y0+Y1)/2+h,(Z0+Z1)/2); mry(-Math.atan2(dz,dx)); P(GEO.box,L*(1-a*.3),w*al+.01,.5*al,C3(e.col||'#ffd9a0'),3,L*a*.15,0,0,.55*al); } break; }
      case 'cut': { const m=mobById[e.m]; if(!m) break; const h=(MOBH[m.t.key]||1.6); const [X,Y,Z]=ph3(m.rx,m.ry,h*.55); const sc=(.6+a*.6)*Math.max(1,m.t.r/16), al=1-a*a;
        mreset(); mtr(X,Y,Z); mry(-Math.atan2(Math.cos(CAM.yaw),-Math.sin(CAM.yaw))); mtr(0,0,0); mrz(.75); P(GEO.box,1.3*sc,.07,.03,[1,.95,.85],5,0,0,0,al); P(GEO.box,1.4*sc,.2,.02,C3(e.col||'#ff6a4a'),3,0,0,0,.45*al);
        if(e.x2){ mrz(-1.5); P(GEO.box,1.3*sc,.07,.03,[1,.95,.85],5,0,0,0,al); P(GEO.box,1.4*sc,.2,.02,C3(e.col||'#ff6a4a'),3,0,0,0,.45*al); } break; }
      case 'lootbeam': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=Math.sin(a*Math.PI); mreset(); mtr(X,Y,Z); P(GEO.cyl,.35,10,.35,C3(e.col),3,0,0,0,.45*al); addLight(X,Y+1,Z,6*al,C3(e.col)); break; }
      case 'ice': { const [X,Y,Z]=ph3(e.x,e.y,0); const al=1-a; for(let k=0;k<10;k++){ const an=k/10*6.283; mreset(); mtr(X+Math.cos(an)*e.r/TS*.75,Y,Z+Math.sin(an)*e.r/TS*.75); mrx(.3*Math.sin(an*3)); P(GEO.cone,.35,1.1*al+.1,.35,[.75,.92,1],1.2,0,0,0,.75); } break; }
      case 'vines': { const p=entPos('p',e.u); if(!p) break; const [X,Y,Z]=ph3(p.x,p.y,0); for(let k=0;k<6;k++){ const an=k/6*6.283; mreset(); mtr(X+Math.cos(an)*.35,Y,Z+Math.sin(an)*.35); mrz(-.3*Math.cos(an)); mrx(.3*Math.sin(an)); P(GEO.limb,.08,-.9*(1-a*.5),.08,[.3,.45,.15],0); } break; }
    } }
  // lights: static, lava, dynamic
  const nightK=curDark;
  for(const L of STAT_LIGHTS){ const k=L.night?(.25+nightK*.95):1; if(Math.hypot(L.x-CAM.tx,L.z-CAM.tz)<45) L3.push({x:L.x,y:L.y,z:L.z,r:L.r*(L.lamp?(.6+nightK*.6):1)*(L.fire?(.9+Math.sin(t*12+L.x)*.1):1),c:L.c.map(v=>v*k)}); }
  if(me&&zoneAtPx(me.x,me.y)==='ash'){ const tx0=Math.floor(CAM.tx)-24, tz0=Math.floor(CAM.tz)-24; for(let tz=tz0;tz<tz0+48;tz+=3)for(let tx=tx0;tx<tx0+48;tx+=3){ if(tAt(tx,tz)===T.LAVA) L3.push({x:tx+.5,y:LAVA_Y+.6,z:tz+.5,r:7,c:[1.3,.45,.1]}); } }
  L3.sort((a,b)=>Math.hypot(a.x-CAM.tx,a.z-CAM.tz)-a.r*.3-(Math.hypot(b.x-CAM.tx,b.z-CAM.tz)-b.r*.3));
  LSEL.n=Math.min(16,L3.length); for(let i=0;i<LSEL.n;i++){ const L=L3[i]; LSEL.p.set([L.x,L.y,L.z,L.r],i*4); LSEL.c.set(L.c,i*3); }
  // decals
  const D=[]; for(let i=SANCTS.length-1;i>=0;i--){ const S=SANCTS[i]; if(t>S.until){ SANCTS.splice(i,1); continue; } const fade=Math.min(1,(S.until-t)/.6); D.push([S.x/TS,S.y/TS,S.r/TS,-2-((t*.06)%1),1,.85,.4,fade]);
    if(Math.random()<.6){ const an=Math.random()*6.283, dd=Math.sqrt(Math.random())*S.r; const [X,Y,Z]=ph3(S.x+Math.cos(an)*dd,S.y+Math.sin(an)*dd,0); P3(X,Y,Z,0,1.2+Math.random(),0,1.6,.12,Math.random()<.5?'#fff3b0':'#ffd34a',{glow:true}); }
    if(Math.random()<.08){ const [X,Y,Z]=ph3(S.x,S.y,0); addLight(X,Y+1,Z,S.r/TS*1.4,[1.2,1,.5]); } }
  if(me){ const te=targetEnt(); if(te){ const col=te.kind==='m'?'#ff3b30':te.kind==='n'?'#ffd34a':'#4cff63'; D.push([te.x/TS,te.y/TS,te.kind==='m'?(te.e.t.r/TS*(te.e.t.boss?2.2:1.4)+.35):.6,-1,...C3(col),1]); } }
  { const cst=[]; if(me&&me.cast&&!me.cast.node&&!me.cast.mount&&!me.dead) cst.push([me.x,me.y,me.c.cls]); for(const o of others.values()) if((o.b&4)&&!o.d&&Math.hypot(o.rx/TS-CAM.tx,o.ry/TS-CAM.tz)<40) cst.push([o.rx,o.ry,o.c]);
    for(const [x,y,c] of cst.slice(0,4)) D.push([x/TS,y/TS,1.5,-2-((t*.22)%1),...C3(CLS[c].col),1]); }
  for(let i=tels.length-1;i>=0;i--){ const e=tels[i]; const p=(t-e.t0)/e.dur; if(p>=1){ tels.splice(i,1); telImpact(e); continue; } D.push([e.x/TS,e.y/TS,e.r/TS,Math.max(.01,p),...C3(TELCOL[e.kind]||'#ff3b2a'),1]);
    if(e.kind===4){ const [X,Y,Z]=ph3(e.x,e.y,0); const fy=Y+(1-p)*14, fx2=X-(1-p)*4; mreset(); mtr(fx2,fy,Z); P(GEO.sph,.5,.5,.5,[1,.6,.2],3); P3(fx2,fy,Z,0,.5,0,.4,.3,'#ff8a2a',{glow:true}); addLight(fx2,fy,Z,6,[1.5,.6,.2]); } }
  for(let i=scorches.length-1;i>=0;i--){ const s=scorches[i]; const a=(t-s.t)/6; if(a>1){scorches.splice(i,1);continue} D.push([s.x/TS,s.y/TS,s.r/TS,0,0,0,0,-(1-a)]); }
  DEC.n=Math.min(12,D.length); for(let i=0;i<DEC.n;i++){ DEC.d.set(D[i].slice(0,4),i*4); DEC.c.set(D[i].slice(4,8),i*4); }
}
function telImpact(e){ const col=TELCOL[e.kind]||'#ff3b2a'; const [X,Y,Z]=ph3(e.x,e.y,.3); const R=e.r/TS;
  ring(e.x,e.y,col,e.r); burst3(X,Y,Z,col,e.kind===5?24:44,R*2.5,{glow:true,up:1});
  if(e.kind===3||e.kind===4){ scorches.push({x:e.x,y:e.y,r:e.r*.85,t:now()}); for(let i=0;i<20;i++) P3(X+(Math.random()-.5)*R*1.6,Y,Z+(Math.random()-.5)*R*1.6,0,1.5+Math.random()*2,0,1.1,.2,'#ffb03a',{glow:true}); }
  if(e.kind===1||e.kind===2) burst3(X,Y,Z,'#8a7a60',24,R*2,{grav:-9});
  if(me&&dist(me.x,me.y,e.x,e.y)<e.r+40) shake(e.kind===5?3:7); }

/* =====================================================================
   POST-PROCESSING: MSAA scene -> bloom -> colour grade
   ===================================================================== */
const VS_POST=`#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;
const FS_BRIGHT=`#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uPx; uniform float uTh; out vec4 o;
void main(){ vec3 c=vec3(0.); for(int i=0;i<4;i++){ vec2 off=vec2(float(i%2)-.5,float(i/2)-.5)*uPx*2.; vec3 s=texture(uTex,vUV+off).rgb; float l=max(s.r,max(s.g,s.b)); c+=s*smoothstep(uTh,uTh+.2,l); } o=vec4(c*.25,1.); }`;
const FS_BLUR=`#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ vec3 c=texture(uTex,vUV).rgb*.227; c+=(texture(uTex,vUV+uDir*1.385).rgb+texture(uTex,vUV-uDir*1.385).rgb)*.316; c+=(texture(uTex,vUV+uDir*3.23).rgb+texture(uTex,vUV-uDir*3.23).rgb)*.07; o=vec4(c,1.); }`;
const FS_COMP=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uBK; uniform float uSat; uniform float uCon; uniform vec3 uTint; uniform vec2 uPx; uniform float uSharp; out vec4 o;
vec3 fxaa(vec2 uv){ vec3 nw=texture(uScene,uv+vec2(-1.,-1.)*uPx).rgb, ne=texture(uScene,uv+vec2(1.,-1.)*uPx).rgb, sw=texture(uScene,uv+vec2(-1.,1.)*uPx).rgb, se=texture(uScene,uv+vec2(1.,1.)*uPx).rgb, m=texture(uScene,uv).rgb;
  vec3 L=vec3(.299,.587,.114); float a=dot(nw,L), b=dot(ne,L), c=dot(sw,L), d=dot(se,L), e=dot(m,L); float mn=min(e,min(min(a,b),min(c,d))), mx=max(e,max(max(a,b),max(c,d)));
  if(mx-mn<max(.04,mx*.1)) return m+(m-(nw+ne+sw+se)*.25)*uSharp;
  vec2 dir=vec2(-((a+b)-(c+d)),((a+c)-(b+d))); float dr=max((a+b+c+d)*.03125,1./128.); dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+dr),-8.,8.)*uPx;
  vec3 A=.5*(texture(uScene,uv+dir*(-1./6.)).rgb+texture(uScene,uv+dir*(1./6.)).rgb); vec3 B=A*.5+.25*(texture(uScene,uv-dir*.5).rgb+texture(uScene,uv+dir*.5).rgb);
  float lb=dot(B,L); return (lb<mn||lb>mx)?A:B; }
void main(){ vec3 c=fxaa(vUV); vec3 b=texture(uBloom,vUV).rgb; c+=b*uBK; c=c+b*b*uBK*.4;
  float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uSat); c=(c-.5)*uCon+.5; c*=uTint; c+=vec3(.012,.008,.02)*(1.-l);
  vec2 d=vUV-.5; c*=1.-dot(d,d)*.35; o=vec4(c,1.); }`;
let PBR=null,PBL=null,PCO=null; const POST={ok:true,w:0,h:0};
function mkTex(w,h){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v); return t; }
function mkFb(tex){ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0); return f; }
function ensurePost(){ const w=cv.width,h=cv.height; if(POST.w===w&&POST.h===h) return POST.ok;
  try{ if(!PBR){ PBR=program(VS_POST,FS_BRIGHT); PBL=program(VS_POST,FS_BLUR); PCO=program(VS_POST,FS_COMP); }
    for(const k of ['ms','rfb','afb','bfb']) if(POST[k]) gl.deleteFramebuffer(POST[k]); for(const k of ['crb','drb']) if(POST[k]) gl.deleteRenderbuffer(POST[k]); for(const k of ['rt','at','bt']) if(POST[k]) gl.deleteTexture(POST[k]);
    const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
    POST.ms=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,POST.ms);
    POST.crb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,POST.crb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,POST.crb);
    POST.drb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,POST.drb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,POST.drb);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('ms fbo');
    POST.rt=mkTex(w,h); POST.rfb=mkFb(POST.rt); POST.qw=Math.max(1,w>>2); POST.qh=Math.max(1,h>>2);
    POST.at=mkTex(POST.qw,POST.qh); POST.afb=mkFb(POST.at); POST.bt=mkTex(POST.qw,POST.qh); POST.bfb=mkFb(POST.bt);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); POST.w=w; POST.h=h; POST.ok=true; }
  catch(e){ console.warn('post disabled',e); POST.ok=false; POST.w=w; POST.h=h; gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
  return POST.ok; }
function fsTri(){ gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES,0,3); }
function postProcess(){ const w=POST.w,h=POST.h; gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,POST.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,POST.rfb); gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,POST.afb); gl.viewport(0,0,POST.qw,POST.qh); gl.useProgram(PBR.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,POST.rt);
  gl.uniform1i(PBR.u.uTex,0); gl.uniform2f(PBR.u.uPx,1/w,1/h); gl.uniform1f(PBR.u.uTh,.87); fsTri();
  gl.useProgram(PBL.p); gl.uniform1i(PBL.u.uTex,0);
  for(let k=0;k<2;k++){ gl.bindFramebuffer(gl.FRAMEBUFFER,POST.bfb); gl.bindTexture(gl.TEXTURE_2D,POST.at); gl.uniform2f(PBL.u.uDir,(1+k)/POST.qw,0); fsTri();
    gl.bindFramebuffer(gl.FRAMEBUFFER,POST.afb); gl.bindTexture(gl.TEXTURE_2D,POST.bt); gl.uniform2f(PBL.u.uDir,0,(1+k)/POST.qh); fsTri(); }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,w,h); gl.useProgram(PCO.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,POST.rt); gl.uniform1i(PCO.u.uScene,0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,POST.at); gl.uniform1i(PCO.u.uBloom,1);
  const z=me?zoneAtPx(me.x,me.y):'town'; const tint=z==='frost'?[.96,1,1.06]:z==='ash'?[1.06,.98,.92]:z==='crypt'?[.94,.97,1.08]:z==='swamp'?[.97,1.02,.96]:[1.02,1,.97];
  gl.uniform2f(PCO.u.uPx,1/w,1/h); gl.uniform1f(PCO.u.uSharp,RSCALE<.99?.35:.12); gl.uniform1f(PCO.u.uBK,.42+curDark*.45); gl.uniform1f(PCO.u.uSat,1.12); gl.uniform1f(PCO.u.uCon,1.06); gl.uniform3fv(PCO.u.uTint,tint); fsTri();
  gl.activeTexture(gl.TEXTURE0); gl.enable(gl.DEPTH_TEST); }

function render(dt){
  dt=dt||.016; const t=now();
  computeSky(dt); updateCamera(dt); buildScene(dt);
  const asp=W/H; const proj=M4.persp(55*Math.PI/180,asp,.1,260); const view=M4.look([CAM.ex,CAM.ey,CAM.ez],[CAM.tx,CAM.ty,CAM.tz],[0,1,0]);
  VP=M4.mul(proj,view); INVVP=M4.inv(VP);
  const ld=SKY.dir; const lc=[CAM.tx,CAM.ty,CAM.tz]; const le=[lc[0]+ld[0]*70,lc[1]+ld[1]*70,lc[2]+ld[2]*70];
  LVP=M4.mul(M4.ortho(-34,34,-34,34,1,170),M4.look(le,lc,Math.abs(ld[1])>.97?[0,0,1]:[0,1,0]));
  // shadow pass
  gl.bindFramebuffer(gl.FRAMEBUFFER,SM.fb); gl.viewport(0,0,SM_SIZE,SM_SIZE); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2,4);
  setFrameUniforms(PS,true); drawStatic(PS,true); for(const c of cmds) if(c.sh) drawCmd(PS,c);
  setFrameUniforms(PSI,true); drawInst(PSI,true);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  // main pass
  const usePost=ensurePost(); gl.bindFramebuffer(gl.FRAMEBUFFER,usePost?POST.ms:null); gl.viewport(0,0,cv.width,cv.height); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(PSK.p); gl.uniformMatrix4fv(PSK.u.uInvVP,false,INVVP); gl.uniform3fv(PSK.u.uSunDir,SKY.dir); gl.uniform3fv(PSK.u.uRealSun,SKY.realSun); gl.uniform3fv(PSK.u.uZen,SKY.zen); gl.uniform3fv(PSK.u.uHor,SKY.hor);
  gl.uniform3fv(PSK.u.uSunCol,SKY.realSun[1]>-.05?SKY.sunCol:[0,0,0]); gl.uniform1f(PSK.u.uNight,SKY.night); gl.uniform1f(PSK.u.uCloud,SKY.cloud||.45); gl.uniform1f(PSK.u.uStorm,SKY.storm||0); gl.uniform1f(PSK.u.uFlash,flash); gl.uniform1f(PSK.u.uAurora,SKY.aurora||0); gl.uniform1f(PSK.u.uTime,t);
  gl.depthMask(false); gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES,0,3); gl.depthMask(true);
  setFrameUniforms(PL,false); drawStatic(PL); for(const c of cmds) drawCmd(PL,c);
  setFrameUniforms(PLI,false); drawInst(PLI,false); if(PLI.u.uFol) gl.uniform1f(PLI.u.uFol,0);
  // liquids
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.useProgram(PQ.p); const q=PQ.u; gl.uniformMatrix4fv(q.uVP,false,VP); gl.uniform1f(q.uTime,t); gl.uniform2f(q.uMap,HN/HR,HNZ/HR); gl.uniform3f(q.uCam,CAM.ex,CAM.ey,CAM.ez);
  gl.uniform3fv(q.uSunDir,SKY.dir); gl.uniform3fv(q.uSunCol,SKY.sunCol); gl.uniform3fv(q.uSky,SKY.sky); gl.uniform3fv(q.uFog,SKY.fog); gl.uniform1f(q.uFogD,SKY.fogD);
  gl.uniform1i(q.uNL,LSEL.n); gl.uniform4fv(q.uLP,LSEL.p); gl.uniform3fv(q.uLC,LSEL.c);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,HTEX); gl.uniform1i(q.uHeight,1);
  gl.uniform1f(q.uMode,0); gl.uniform1f(q.uLevel,WATER_Y); gl.bindVertexArray(PLANE.vao); gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0);
  gl.uniform1f(q.uMode,1); gl.uniform1f(q.uLevel,LAVA_Y); gl.bindVertexArray(LPLANE.vao); gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0);
  gl.activeTexture(gl.TEXTURE0);
  // transparent
  if(tcmds.length){ setFrameUniforms(PL,false); for(const c of tcmds){ if(c.e>=1) gl.blendFunc(gl.SRC_ALPHA,gl.ONE); else gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); drawCmd(PL,c); } }
  // particles
  let ng=0; const order=[]; for(const p of parts) if(!p.glow) order.push(p); const nAlpha=order.length; for(const p of parts) if(p.glow) order.push(p);
  const nn=Math.min(PMAX,order.length); for(let i=0;i<nn;i++){ const p=order[i]; const a=p.life/p.max; const s=p.shrink?p.size*(.3+.7*a):p.size; const fl=p.fl?.4+.6*Math.abs(Math.sin(t*5+p.x*3)):1;
    const al=p.big?.28*Math.sin(Math.PI*a):Math.min(1,a*2.2)*fl; const o=i*8; PBUF[o]=p.x;PBUF[o+1]=p.y;PBUF[o+2]=p.z;PBUF[o+3]=s*2; PBUF[o+4]=p.c[0]*(p.glow?1.4:1)*(p.big?(.35+.65*(1-curDark)):1);PBUF[o+5]=p.c[1]*(p.glow?1.4:1)*(p.big?(.35+.65*(1-curDark)):1);PBUF[o+6]=p.c[2]*(p.glow?1.4:1)*(p.big?(.35+.65*(1-curDark)):1);PBUF[o+7]=al; }
  if(nn){ gl.useProgram(PP.p); gl.uniformMatrix4fv(PP.u.uVP,false,VP); gl.uniform1f(PP.u.uPS,cv.height/(2*Math.tan(55*Math.PI/360)));
    gl.bindBuffer(gl.ARRAY_BUFFER,PVAO.b); gl.bufferSubData(gl.ARRAY_BUFFER,0,PBUF.subarray(0,nn*8)); gl.bindVertexArray(PVAO.vao);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); if(Math.min(nn,nAlpha)) gl.drawArrays(gl.POINTS,0,Math.min(nn,nAlpha));
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE); if(nn>nAlpha) gl.drawArrays(gl.POINTS,nAlpha,nn-nAlpha); }
  gl.depthMask(true); gl.disable(gl.BLEND); if(usePost) postProcess(); gl.bindVertexArray(null);
  drawOverlay(t);
}

/* =====================================================================
   2D OVERLAY: nameplates, combat text, bubbles, screen fx
   ===================================================================== */
function drawShoe(g,x,y,sc,a){ g.save(); g.globalAlpha=a??1; g.translate(x,y); g.scale(sc,sc); g.lineCap='round'; g.shadowColor='#ffcf6a'; g.shadowBlur=12;
  g.beginPath(); g.arc(0,0,9,Math.PI*.78,Math.PI*2.22); g.lineWidth=9; g.strokeStyle='#000'; g.stroke(); g.lineWidth=5.5; g.strokeStyle='#ffd34a'; g.stroke(); g.shadowBlur=0;
  g.lineWidth=1.6; g.strokeStyle='#fff3c0'; g.beginPath(); g.arc(0,0,8,Math.PI*1.1,Math.PI*1.6); g.stroke();
  g.fillStyle='#5a3a0a'; for(const an of [.95,1.25,1.75,2.05]){ g.beginPath(); g.arc(Math.cos(an*Math.PI)*9,Math.sin(an*Math.PI)*9,1.1,0,7); g.fill(); } g.restore(); }
function plate(x,y,name,col,hpF,showHp,sub,wide,alpha,subCol,hostile){
  g.globalAlpha=alpha; g.font='700 13px "Alegreya Sans",sans-serif'; g.textAlign='center'; g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.85)';
  g.strokeText(name,x,y); g.fillStyle=col; g.fillText(name,x,y);
  if(sub){ g.font='600 11px "Alegreya Sans",sans-serif'; g.strokeText(sub,x,y-14); g.fillStyle=subCol||'#e8d9a8'; g.fillText(sub,x,y-14); }
  if(showHp){ const w=wide?84:50; g.fillStyle='rgba(0,0,0,.78)'; g.fillRect(x-w/2-1,y+4,w+2,7); const hf=clamp(hpF,0,1);
    const gr=g.createLinearGradient(0,y+5,0,y+10); const c=['#7ef08a','#2a9a38']; gr.addColorStop(0,c[0]); gr.addColorStop(1,c[1]); g.fillStyle=gr; g.fillRect(x-w/2,y+5,w*hf,5); }
  g.globalAlpha=1; }
function bubble(x,y,txt){ g.font='500 13px "Alegreya Sans",sans-serif'; const w=Math.min(220,g.measureText(txt).width+16); g.fillStyle='rgba(250,244,228,.95)';
  const bx=x-w/2, by=y-30; g.beginPath(); if(g.roundRect) g.roundRect(bx,by,w,22,8); else g.rect(bx,by,w,22); g.fill(); g.beginPath(); g.moveTo(x-5,by+22); g.lineTo(x,by+29); g.lineTo(x+5,by+22); g.fill();
  g.fillStyle='#2a1d10'; g.textAlign='center'; let s=txt; while(g.measureText(s).width>w-14 && s.length>3) s=s.slice(0,-2); if(s!==txt) s+='…'; g.fillText(s,x,by+15); }
const MOBH={boar:1.1,moth:2.2,oldtusk:1.7,wolf:1.3,thornling:2.6,fangmaw:1.9,lurker:1.6,bogwitch:2.1,sentinel:2.2,wraith:2.6,hking:3.6,cultist:2.2,magma:3.0,wyrm:6.2,emberling:1.9,frostwolf:1.5,yeti:3.7,icewraith:2.6,frostgiant:5.8,cryptmage:2.2,deathguard:3.0,lich:5.6,thrall:2.1};
function drawOverlay(t){
  g.setTransform(DPR,0,0,DPR,0,0); g.clearRect(0,0,W,H);
  const items=[];
  for(const n of NPCS){ const Y=groundY(n.x,n.y)+2.15; const s=toScreen(n.x/TS,Y,n.y/TS); if(s&&s[2]<45) items.push({w:s[2],d:()=>{ const a=clamp(1.4-s[2]/40,0,1);
    let mark=npcMark(n);
    if(mark==='$'&&n.id==='hilde'){ drawShoe(g,s[0],s[1]-48+Math.sin(t*3)*4,1.3,a); mark=''; }
    if(mark){ g.save(); g.globalAlpha=a; g.font='900 30px Cinzel,serif'; g.textAlign='center'; g.shadowColor=mark==='$'?'#9fe07a':'#ffd34a'; g.shadowBlur=16; g.lineWidth=4; g.strokeStyle='#000'; const yy=s[1]-40+Math.sin(t*3)*4; g.strokeText(mark,s[0],yy); g.fillStyle=mark==='$'?'#9fe07a':'#ffd34a'; g.fillText(mark,s[0],yy); g.restore(); }
    plate(s[0],s[1],n.name,'#ffe680',1,false,'<'+n.title+'>',false,a); if(n.bubbleT>t) bubble(s[0],s[1]-24,n.bubble); }}); }
  for(const m of mobs){ if(m.dead) continue; const X=m.rx/TS, Z=m.ry/TS; if(Math.hypot(X-CAM.tx,Z-CAM.tz)>(m.t.boss?40:24)&&!(me&&me.target&&me.target.id===m.id)) continue; const s=toScreen(X,groundY(m.rx,m.ry)+(MOBH[m.t.key]||1.6)*(m.t.key==='hking'?1:1),Z); if(!s) continue;
    items.push({w:s[2],d:()=>{ const mt=m.t; const a=clamp(1.6-s[2]/24,0,1); const te=me&&me.target&&me.target.kind==='m'&&me.target.id===m.id; const diff=me?m.lv-me.c.lvl:0;
      const tagged=m.tag&&m.tag!==MY_U&&!(me&&me.party&&othersByU.get(m.tag)&&othersByU.get(m.tag).pt===me.party);
      plate(s[0],s[1],mt.name,tagged?'#a0a0a0':m.tgt===MY_U?'#ff6a5a':mt.boss||mt.elite?'#ffd34a':diff>=3?'#ff8a6a':'#f0d8a0',m.hp/m.mhp,te||m.hp<m.mhp,(mt.boss?'☠ Boss · ':mt.elite?'★ Elite · ':'')+'Lv '+m.lv,mt.boss||mt.elite,te?1:a,null,true);
      if(m.flags&2||m.stunU>t){ g.fillStyle='#ffe66a'; g.font='14px sans-serif'; for(let i=0;i<3;i++){ const an=t*4+i*2.1; g.fillText('✦',s[0]+Math.cos(an)*14,s[1]-30+Math.sin(an)*4); } }
      if(m.flags&4||m.rootU>t){ g.fillStyle='#bfe8ff'; g.font='16px sans-serif'; g.fillText('❄',s[0]+40,s[1]-2); } if(m.bubbleT>t) bubble(s[0],s[1]-30,m.bubble); }}); }
  const pl=(x,y,name,hpF,isMe,dead,party,bub,mtd,cls,isgm,cast,title)=>{ const s=toScreen(x/TS,standY(x,y)+2.15+(mtd?.8:0)+(isMe?(me.jumpH||0):0),y/TS); if(!s) return;
    items.push({w:s[2],d:()=>{ const a=isMe?1:clamp(1.6-s[2]/55,0,1); plate(s[0],s[1],name+(dead?' (spirit)':''),CLS[cls]?CLS[cls].col:'#ffffff',hpF,!isMe,isgm?'<GM>':title?'<'+title+'>':party?'<Party>':'',false,a,isgm?'#ff9a3a':title?'#ffd36a':'#8fc8ff'); if(bub) bubble(s[0],s[1]-12,bub);
      if(cast){ const p=clamp(cast.p0/100+(t-cast.t0)/cast.dur,0,1); if(p<1){ g.globalAlpha=a; g.fillStyle='rgba(0,0,0,.8)'; g.fillRect(s[0]-36,s[1]+13,72,9); const gr=g.createLinearGradient(s[0]-35,0,s[0]+35,0); gr.addColorStop(0,'#b8761a'); gr.addColorStop(1,'#ffe27a'); g.fillStyle=gr; g.fillRect(s[0]-35,s[1]+14,70*p,7); g.font='700 10px "Alegreya Sans",sans-serif'; g.textAlign='center'; g.lineWidth=3; g.strokeStyle='#000'; g.strokeText(cast.nm,s[0],s[1]+32); g.fillStyle='#ffe9a0'; g.fillText(cast.nm,s[0],s[1]+32); g.globalAlpha=1; } } }}); };
  for(const o of others.values()) if(seenO(o)) pl(o.rx,o.ry,o.n+(o.iv?' (invisible)':''),o.hp/o.mhp,false,o.d,!!(o.pt&&me&&o.pt===me.party),o.bubbleT>t?o.bubble:'',o.mt,o.c,o.gm&&isGM,o.cast,o.ti);
  if(me) pl(me.x,me.y,me.c.name,me.hp/me.mhp,true,me.dead,false,me.bubbleT>t?me.bubble:'',me.mounted,me.c.cls,isGM,null,myTitle());
  items.sort((a,b)=>b.w-a.w); if(OPT.names) for(const it of items) it.d();
  for(let i=texts.length-1;i>=0;i--){ const f=texts[i]; const a=(t-f.t)/1.3; if(a>1){texts.splice(i,1);continue} const s=toScreen(f.X,f.Y+a*1.4,f.Z); if(!s) continue;
    const pop=a<.12?1+(.12-a)*4:1; g.globalAlpha=1-a*a; g.font=`700 ${Math.round((f.big?22:16)*pop)}px "Alegreya Sans",sans-serif`; g.textAlign='center'; g.lineWidth=3; g.strokeStyle='#000';
    g.strokeText(f.txt,s[0],s[1]); g.fillStyle=f.col; g.fillText(f.txt,s[0],s[1]); g.globalAlpha=1; }
  if(me&&!me.cast&&nearLoot()){ const L=nearLoot(); const s2=toScreen(L.x/TS,groundY(L.x,L.y)+1.1,L.y/TS); if(s2) plate(s2[0],s2[1],'F · Loot '+L.name,'#ffe9a0',1,false,'',false,1); }
  else if(me&&!me.cast){ const nd=nearNode(); if(nd){ const s2=toScreen(nd.x/TS,groundY(nd.x,nd.y)+1.1,nd.y/TS); if(s2) plate(s2[0],s2[1],`F · ${MATS[nd.mat].kind==='herb'?'Gather':'Mine'} ${MATS[nd.mat].name}`,'#ffe9a0',1,false,'',false,1); } }
  drawWeatherOverlay(t);
  const vg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.4,W/2,H/2,Math.max(W,H)*.78); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.2)'); g.fillStyle=vg; g.fillRect(0,0,W,H);
  if(me&&!me.dead){ const low=me.hp/me.mhp<.3?.25+.15*Math.sin(t*6):0; const hf=Math.max(hurtFlash*.5,low);
    if(hf>0){ const rg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.7); rg.addColorStop(0,'rgba(200,0,0,0)'); rg.addColorStop(1,`rgba(200,0,0,${hf})`); g.fillStyle=rg; g.fillRect(0,0,W,H); } }
  if(me&&me.dead){ g.fillStyle='rgba(60,70,90,.45)'; g.fillRect(0,0,W,H); }
}

/* =====================================================================
   MOUSE: orbit camera, zoom, click to target
   ===================================================================== */
const MOUSE={down:-1,x:0,y:0,sx:0,sy:0,drag:false,right:false};
cv.addEventListener('mousedown',e=>{ MOUSE.both=(e.buttons&3)===3; if(MOUSE.down>=0) return; MOUSE.down=e.button; MOUSE.sx=MOUSE.x=e.clientX; MOUSE.sy=MOUSE.y=e.clientY; MOUSE.drag=false; MOUSE.right=e.button===2; if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); });
addEventListener('mousemove',e=>{ MOUSE.both=(e.buttons&3)===3; if(MOUSE.down<0) return; const dx=e.clientX-MOUSE.x, dy=e.clientY-MOUSE.y; MOUSE.x=e.clientX; MOUSE.y=e.clientY;
  if(Math.hypot(e.clientX-MOUSE.sx,e.clientY-MOUSE.sy)>4) MOUSE.drag=true;
  if(MOUSE.drag&&me){ CAM.yaw+=dx*.0065*OPT.sens; CAM.pitch=clamp(CAM.pitch+dy*.005*OPT.sens*(OPT.invertY?-1:1),-.15,1.35); if(MOUSE.right) me.face=CAM.yaw; } });
addEventListener('mouseup',e=>{ MOUSE.both=(e.buttons&3)===3; if(e.buttons&3) return; if(MOUSE.down<0) return; const wasDrag=MOUSE.drag, btn=MOUSE.down; MOUSE.down=-1; MOUSE.right=false; if(!wasDrag&&me) pickAt(e.clientX,e.clientY,btn); });
cv.addEventListener('wheel',e=>{ e.preventDefault(); CAM.dist=clamp(CAM.dist*(1+e.deltaY*.0012),3,OPT.camMax); },{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());
function pickAt(mx,my,btn){ let best=null,bd=60;
  for(const n of NODES){ if(n.resp>now()) continue; const s2=toScreen(n.x/TS,groundY(n.x,n.y)+.4,n.y/TS); if(s2&&Math.hypot(s2[0]-mx,s2[1]-my)<32){ if(dist(me.x,me.y,n.x,n.y)<95) startGather(n); else err('Too far away'); return; } }
  const test=(X,Y,Z,cand,rad)=>{ const s=toScreen(X,Y,Z); if(!s) return; const d=Math.hypot(s[0]-mx,s[1]-my); const lim=Math.max(22,rad*600/s[2]); if(d<lim&&d<bd){ bd=d; best=cand; } };
  for(const m of mobs){ if(m.dead) continue; const h=(MOBH[m.t.key]||1.6); test(m.rx/TS,groundY(m.rx,m.ry)+h*.5,m.ry/TS,{kind:'m',id:m.id},h*.35); }
  for(const o of others.values()) if(seenO(o)) test(o.rx/TS,groundY(o.rx,o.ry)+1,o.ry/TS,{kind:'p',id:o.u},.5);
  test(me.x/TS,groundY(me.x,me.y)+1,me.y/TS,{kind:'p',id:MY_U},.4);
  for(const n of NPCS) test(n.x/TS,groundY(n.x,n.y)+1,n.y/TS,{kind:'n',id:n.id},.5);
  if(best){ me.target=best; const n=best.kind==='n'?NPCS.find(q=>q.id===best.id):null; if(n&&dist(me.x,me.y,n.x,n.y)<110) talk(n); if(btn===2&&best.kind==='m') me.auto=true; }
  else if(btn===0){ me.target=null; me.auto=false; } }

/* =====================================================================
   OPEN WORLD 3D: landmarks, mounts, wildlife, nodes, weather
   ===================================================================== */
Object.assign(LOOK,{
  doran:{torso:[.42,.28,.18],legs:[.25,.2,.16],arms:[.78,.58,.45],boots:[.18,.12,.08],trim:[.3,.2,.12],tabard:[.32,.2,.12],head:'bald',weapon:'hammer',gloves:[.2,.14,.1]},
  hilde:{torso:[.55,.38,.22],legs:[.3,.24,.18],arms:[.55,.38,.22],boots:[.25,.16,.1],trim:[.75,.6,.3],head:'hair',hair:[.85,.62,.3],weapon:'none'},
  sylas:{torso:[.24,.38,.2],legs:[.25,.22,.16],arms:[.24,.38,.2],boots:[.22,.16,.1],cape:[.18,.32,.16],trim:[.55,.4,.2],head:'hood',hood:[.2,.34,.18],weapon:'bow'},
  marla:{robe:[.4,.32,.22],torso:[.4,.32,.22],arms:[.42,.34,.24],legs:[.3,.25,.18],boots:[.2,.15,.1],head:'hoodopen',hood:[.48,.4,.28],hunch:.25,weapon:'staffplain',skin:[.85,.72,.62]},
  ithren:{robe:[.22,.3,.55],torso:[.22,.3,.55],arms:[.22,.3,.55],legs:[.2,.22,.35],boots:[.2,.15,.12],trim:[.85,.75,.4],head:'hair',hair:[.82,.82,.85],weapon:'book'},
  vok:{torso:[.55,.2,.18],legs:[.3,.28,.3],arms:[.6,.62,.66],boots:[.2,.16,.14],cape:[.5,.12,.1],trim:[.8,.65,.3],tabard:[.55,.12,.1],head:'helm',metal:[.6,.62,.66],pauld:[.6,.62,.66],weapon:'spear',off:'shield'},
  bram:{torso:[.3,.42,.55],legs:[.35,.3,.22],arms:[.3,.42,.55],boots:[.25,.18,.12],trim:[.4,.3,.2],head:'cap',hat:[.65,.55,.3],weapon:'rod'},
});
Object.assign(QLOOK,{
  frostwolf:{col:[.84,.88,.94],dark:[.55,.6,.72],len:1.15,hgt:.75,ears:true,tail:true,muzzle:true,mane:true,eyes:[.4,.85,1],eyeE:2.6,scale:1.15},
  deer:{col:[.56,.38,.22],dark:[.36,.24,.14],len:1.0,hgt:.85,ears:true,antlers:true,eyes:[.05,.03,.02],scale:1},
  rabbit:{col:[.62,.52,.42],dark:[.5,.4,.32],len:.9,hgt:.32,longEars:true,eyes:[.05,.03,.02],scale:.42},
});
/* ---------- static landmarks ---------- */
function addLandmarks(d){ const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e);
  const wood=[.34,.22,.12], dark=[.2,.13,.08], canvas=[.82,.76,.62]; const PO=id=>POIS.find(p=>p.id===id);
  { const p=PO('windmill'), x=p.x+.5, z=p.y+.5, y0=Math.min(hgt(x-1.5,z),hgt(x+1.5,z),hgt(x,z-1.5),hgt(x,z+1.5))-.1;
    gAdd(d,RFR,x,y0,z,0,3.4,5.4,3.4,[.8,.76,.68]); gAdd(d,RC,x,y0,z,0,3.5,.5,3.5,[.5,.48,.44]); gAdd(d,RCN,x,y0+5.3,z,0,2.8,2.0,2.8,[.42,.2,.12]);
    box(x,y0+.9,z+1.62,.9,1.7,.2,wood); for(const [wy,wz] of [[2.6,1.5],[3.9,1.35]]) box(x,y0+wy,z+wz,.55,.6,.12,[1,.75,.4],0,1.1);
    for(let k=0;k<3;k++) gAdd(d,RFR,x-2.2+k*.4,hgt(x-2.2,z+1.5),z+1.6+k*.2,0,.5,.6,.5,[.75,.65,.4]);
    WINDMILL.x=x; WINDMILL.y=y0+4.8; WINDMILL.z=z+1.85; STAT_LIGHTS.push({x,y:y0+3,z:z+2.4,r:6,c:[1,.62,.3],night:true}); }
  { const p=PO('watchtower'), x=p.x+.5, z=p.y+.5, y0=hgt(x,z);
    for(const [ox,oz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) gAdd(d,RC,x+ox,y0-.5,z+oz,0,.3,6.6,.3,wood);
    for(const h of [1.8,3.6]) for(const s of [-1,1]){ box(x+s,y0+h,z,.12,.12,2.1,dark); box(x,y0+h,z+s,2.1,.12,.12,dark); }
    box(x,y0+5.0,z,2.8,.22,2.8,wood); for(const s of [-1,1]){ box(x+s*1.3,y0+5.55,z,.1,.9,2.8,dark); box(x,y0+5.55,z+s*1.3,2.8,.9,.1,dark); }
    for(const [ox,oz] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]]) gAdd(d,RC,x+ox,y0+5,z+oz,0,.12,1.9,.12,dark);
    gAdd(d,RP,x,y0+6.8,z,0,3.3,1.6,3.3,[.4,.24,.13]);
    for(let k=0;k<10;k++) box(x+1.55,y0+.35+k*.48,z,.06,.06,.6,wood); box(x+1.55,y0+2.5,z-.3,.07,5,.07,wood); box(x+1.55,y0+2.5,z+.3,.07,5,.07,wood);
    gAdd(d,RFR,x,y0+5.1,z,0,.8,.4,.8,[.25,.24,.22]); gAdd(d,RS,x,y0+5.5,z,0,.55,.3,.55,[1,.5,.12],2.2); STAT_LIGHTS.push({x,y:y0+6,z,r:11,c:[1.4,.6,.2],fire:true}); }
  { const p=PO('hollow'), x=p.x, z=p.y, y0=Math.max(hgt(x,z),.05);
    for(const [ox,oz] of [[-.85,-.85],[.85,-.85],[-.85,.85],[.85,.85]]) gAdd(d,RC,x+ox,y0-.8,z+oz,0,.22,1.9,.22,dark);
    box(x,y0+1.95,z,2.1,1.6,2.1,[.3,.23,.16],.15); gAdd(d,RCN,x,y0+2.7,z,.3,3.2,2.4,3.2,[.2,.26,.15],0,.12);
    box(x+1.05,y0+1.75,z+.1,.1,1.1,.6,[.12,.08,.05],.15); box(x-.45,y0+2.1,z+1.07,.45,.35,.06,[.6,1,.4],.15,1.3); box(x+.4,y0+2.1,z+1.07,.35,.35,.06,[.6,1,.4],.15,1.3);
    for(let k=0;k<5;k++) box(x+1.4+k*.2,y0+.9-k*.2,z+.1,.25,.06,.6,wood);
    const cx=x+2.8, cz=z+1.3, cy=hgt(cx,cz); gAdd(d,RS,cx,cy+.45,cz,0,1.15,.9,1.15,[.1,.1,.1]); gAdd(d,RC,cx,cy+.73,cz,0,.92,.05,.92,[.4,1,.3],1.6);
    for(let k=0;k<3;k++){ const a=k*2.1; gAdd(d,RC,cx+Math.cos(a)*.5,cy,cz+Math.sin(a)*.5,0,.07,.4,.07,dark); }
    CAULDRON.x=cx; CAULDRON.y=cy+.8; CAULDRON.z=cz; STAT_LIGHTS.push({x:cx,y:cy+1.1,z:cz,r:6,c:[.5,1.2,.3]});
    for(const [ox,oz] of [[-2.4,1.6],[1.9,-2.3],[-1.7,-2.5],[3.4,-.6]]){ const px=x+ox,pz=z+oz,py=hgt(px,pz); gAdd(d,RC,px,py-.2,pz,0,.11,1.9,.11,dark); gAdd(d,RS,px,py+1.8,pz,0,.3,.33,.28,[.9,.87,.78]); } }
  { const p=PO('archive'), x=p.x+.5, z=p.y+.5, y0=hgt(x,z);
    for(const s of [-1,1]){ box(x+s*2,y0+2.1,z,1,4.6,1,[.46,.44,.4]); gAdd(d,RB,x+s*2,y0+.2,z,0,1.3,.4,1.3,[.4,.38,.35]); }
    box(x,y0+4.6,z,5.4,.9,1.3,[.48,.46,.42]); box(x,y0+5.15,z,1.4,.4,1.3,[.42,.4,.37]);
    for(let k=0;k<5;k++) box(x,y0-.05-k*.3,z+1+k*.75,3,.3,.75,[.4,.38,.35]);
    box(x-3.4,y0+1,z-1,.5,2,1.7,wood,.1); box(x+3.3,y0+.6,z-1.4,.5,1.3,1.6,wood,.5); for(let k=0;k<6;k++) box(x-3.15,y0+.4+k*.3,z-1.5+(k%3)*.4,.12,.25,.18,[[.6,.15,.15],[.2,.3,.55],[.5,.4,.2]][k%3]);
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; gAdd(d,RCN,x+Math.cos(a)*1.3,y0-.2,z-1.8+Math.sin(a)*.8,0,.32,1.1+(k%3)*.5,.32,[.45,.85,1],1.5,(k-2.5)*.12); }
    STAT_LIGHTS.push({x,y:y0+1,z:z-1.8,r:8,c:[.4,.8,1.4]}); }
  if(DOCK.x0){ const z=DOCK.z+.5; for(let i=0;i<=DOCK.x1-DOCK.x0;i++){ const x=DOCK.x0+i+.5; box(x,.36,z,1.0,.12,1.7,i%2?wood:[.38,.25,.14]); if(i%2===0) for(const s of [-1,1]) gAdd(d,RC,x,-1.6,z+s*.8,0,.18,2.3,.18,dark); }
    gAdd(d,RC,DOCK.x0+.5,.4,z-.85,0,.1,1.8,.1,dark); box(DOCK.x0+.5,2.25,z-.85,.25,.35,.25,[1,.65,.3],0,1.4); STAT_LIGHTS.push({x:DOCK.x0+.5,y:2.3,z:z-.85,r:8,c:[1.2,.7,.35],night:true,lamp:true});
    const bx=DOCK.x1+1.2, bz=z+1.6; box(bx,.12,bz,2.8,.45,1.1,[.4,.26,.14],.3); box(bx,.32,bz,2.5,.08,.85,[.3,.2,.1],.3); gAdd(d,RC,bx,.2,bz,0,.07,2.2,.07,dark);
    for(let k=0;k<3;k++) gAdd(d,RFR,DOCK.x0+1.5+k*.7,.42,z+.55,0,.45,.6,.45,[.42,.28,.15]); }
  { const p=PO('gate'), x=p.x+.5, z=p.y+.5;
    for(const s of [-1,1]){ const px=x+s*2, py=hgt(px,z); box(px,py+2.7,z,1.1,5.4,1.1,[.13,.09,.16]); gAdd(d,RCN,px,py+5.4,z,.4,.9,.6,.9,[.18,.12,.2]);
      gAdd(d,RFR,px,py+5.45,z,0,1.2,.45,1.2,[.22,.2,.2]); gAdd(d,RS,px,py+5.95,z,0,.75,.45,.75,[1,.45,.1],2.4); STAT_LIGHTS.push({x:px,y:py+6.3,z,r:12,c:[1.5,.6,.2],fire:true}); }
    const py=hgt(x,z); box(x,py+4.9,z,4.2,.25,.25,[.15,.1,.08]); box(x,py+3.95,z+.05,1.6,1.7,.05,[.55,.1,.1]); box(x,py+3.95,z+.08,.6,.6,.03,[.9,.7,.3],0,.3); }
  const camp=(id,ox,oz)=>{ const n=NPCS.find(q=>q.id===id); if(!n) return; const x=n.x/TS, z=n.y/TS;
    const tx=x-1.8, tz=z-1.4, ty=hgt(tx,tz); gAdd(d,RP,tx,ty-.05,tz,.5,2.2,1.6,2.8,canvas); box(tx+Math.cos(.5)*1.4,ty+.55,tz-Math.sin(.5)*1.4,.6,1.1,.05,[.2,.15,.1],.5);
    const fx=x+(ox||1.6), fz=z+(oz||1.0), fy=hgt(fx,fz); for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; gAdd(d,RBL,fx+Math.cos(a)*.55,fy+.08,fz+Math.sin(a)*.55,0,.3,.22,.3,[.45,.43,.4]); }
    for(let k=0;k<3;k++) gAdd(d,RC,fx,fy+.12,fz,k*1.05,.12,.8,.12,[.3,.2,.12],0,Math.PI/2.4); gAdd(d,RS,fx,fy+.1,fz,0,.5,.18,.5,[1,.45,.1],2.5);
    STAT_LIGHTS.push({x:fx,y:fy+.6,z:fz,r:8,c:[1.4,.6,.2],fire:true}); for(let k=0;k<2;k++) box(fx+(k?-1:1)*1.2,fy+.2,fz+.5,.9,.3,.35,[.35,.22,.12],k); };
  camp('sylas'); camp('marla',-1.4,1.6); camp('ithren',1.6,-1.2); camp('vok',1.8,1.2); camp('bram',-1.2,-1.6);
  camp('hakon',1.8,1.4);
  for(const [x,z] of [[132,10],[148,10],[132,22],[148,22],[136,23],[144,23],[140,9]]){ const y0=hgt(x+.5,z+.5); gAdd(d,RC,x+.5,y0,z+.5,0,.22,1.6,.22,[.15,.14,.16]); gAdd(d,RFR,x+.5,y0+1.6,z+.5,0,.7,.3,.7,[.2,.2,.22]); gAdd(d,RS,x+.5,y0+1.9,z+.5,0,.45,.3,.45,[.5,1,.6],2.4); STAT_LIGHTS.push({x:x+.5,y:y0+2.3,z:z+.5,r:9,c:[.4,1.1,.6],fire:true,ghost:true}); }
  { const y0=hgt(140.5,11.5); gAdd(d,RC,140.5,y0,11.5,0,5.4,.3,5.4,[.18,.18,.22]); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; gAdd(d,RB,140.5+Math.cos(a)*2.3,y0+.32,11.5+Math.sin(a)*2.3,-a,.7,.05,.25,[.4,.8,1],1.8); } STAT_LIGHTS.push({x:140.5,y:y0+.6,z:11.5,r:7,c:[.4,.8,1.3]}); }
  { const x=112.5, z=59.5, y0=hgt(x,z); for(const s of [-1,1]) gAdd(d,RB,x,y0+1.6,z+s*2.8,0,.9,3.2,.9,[.5,.48,.46]); gAdd(d,RB,x,y0+3.35,z,0,1.0,.4,6.6,[.45,.43,.4]); gAdd(d,RB,x+.52,y0+2.6,z,0,.06,.9,1.6,[.25,.35,.6]); }
  { const x=142, z=74.5, y0=hgt(x,z); for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; gAdd(d,RCN,x+Math.cos(a)*2,y0-.2,z+Math.sin(a)*2,a,.6,2.2+(k%2),.6,[.7,.9,1],.9); } STAT_LIGHTS.push({x,y:y0+1,z,r:6,c:[.4,.8,1.2]}); }
  { const n=NPCS.find(q=>q.id==='doran'); if(n){ const x=n.x/TS, z=n.y/TS-1.3, y0=.55; box(x,y0+.45,z,.9,.9,.6,[.2,.2,.22]); box(x,y0+.95,z,1.2,.2,.45,[.25,.25,.28]);
    box(x+1.6,y0+.6,z,1.2,1.2,1.2,[.45,.42,.4]); box(x+1.6,y0+.7,z+.61,.6,.45,.05,[1,.5,.1],0,2); STAT_LIGHTS.push({x:x+1.6,y:y0+1,z:z+1,r:6,c:[1.4,.55,.15],fire:true});
    for(const s of [-1,1]) gAdd(d,RC,x+s*1.8+.6,y0,z-.9,0,.12,2.4,.12,wood); box(x+.6,y0+2.4,z-.9,4,.12,.12,wood); } }
  { const n=NPCS.find(q=>q.id==='hilde'); if(n){ const x=n.x/TS+1.5, z=n.y/TS, y0=hgt(x,z); for(let k=0;k<4;k++) gAdd(d,RC,x+k*1.1,y0,z+1.4,0,.12,1.1,.12,wood); for(const h of [.5,.95]) box(x+1.65,y0+h,z+1.4,3.5,.1,.08,wood);
    box(x+1.6,y0+.35,z-.6,1.4,.7,.5,[.42,.28,.15]); box(x+1.6,y0+.72,z-.6,1.2,.05,.4,[.75,.68,.3]);
    for(const [px,pz] of [[x-.1,z-1.5],[x+3.4,z-1.5],[x-.1,z+1.0],[x+3.4,z+1.0]]) gAdd(d,RC,px,hgt(px,pz),pz,0,.16,2.6,.16,dark);
    gAdd(d,RP,x+1.65,y0+2.55,z-.25,Math.PI/2,3.0,1.0,4.1,[.5,.24,.14]); box(x+1.65,y0+2.55,z-.25,4.0,.12,3.0,wood);
    for(const [hx,hz,hy] of [[x+.4,z-1.1,0],[x+.95,z-1.1,0],[x+.65,z-1.1,.48]]) gAdd(d,RC,hx,y0+hy,hz,0,.5,.48,.5,[.86,.72,.36]);
    gAdd(d,RC,x-.55,y0,z-1.3,0,.1,1.9,.1,dark); box(x-.55,y0+1.75,z-1.3,.08,.55,.9,wood); box(x-.5,y0+1.75,z-1.3,.04,.42,.42,[.95,.78,.3],0,.6);
    STABLE.x=x; STABLE.z=z; STABLE.y=y0; STAT_LIGHTS.push({x:x+1.6,y:y0+2.1,z:z-.3,r:6,c:[1,.7,.35],night:true,lamp:true}); } }
}
/* ---------- mount ---------- */
function drawHorse(o){ const M=MOUNTS[o.m]||MOUNTS[1]; if(M.celestial) return drawCelestial(o); const t=now(), mv=o.mv||0, ph=(o.walk||0)*.55; const dark=M.col.map(v=>v*.7);
  mreset(); mtr(o.x,o.y+Math.abs(Math.sin(ph))*.14*mv,o.z); mry(-o.face); mrz(Math.sin(ph*2)*.05*mv);
  for(const [lx,lz,off] of [[.62,.22,0],[.62,-.22,Math.PI],[-.6,.22,Math.PI*.5],[-.6,-.22,Math.PI*1.5]]){ mpush(); mtr(lx,1.05,lz); mrz(Math.sin(ph+off)*.85*mv);
    P(GEO.limb,.19,.55,.19,M.col); mtr(0,-.55,0); mrz(-Math.max(0,Math.sin(ph+off))*1.0*mv); P(GEO.limb,.13,.45,.13,dark); mtr(0,-.48,0); P(GEO.box,.18,.08,.18,[.08,.06,.05]); mpop(); }
  P(GEO.sph,1.85,.85,.8,M.col,0,0,1.3,0); P(GEO.sph,1.2,.5,.6,M.col.map(v=>v*1.15),0,0,1.15,0);
  P(GEO.box,.62,.14,.85,[.32,.17,.08],0,0,1.7,0); P(GEO.box,.75,.05,.95,M.armor?[.55,.08,.1]:M.elk?[.75,.6,.25]:[.2,.3,.55],0,0,1.64,0);
  if(M.armor){ P(GEO.sph,1.1,.7,.85,[.55,.58,.65],.1,.55,1.35,0); }
  mpush(); mtr(-.92,1.5,0); mrz(-.4-mv*.5+Math.sin(t*3)*.08); P(GEO.limb,.18,.85,.18,M.mane); mpop();
  mpush(); mtr(.72,1.55,0); mrz(Math.PI-.62+Math.sin(ph)*.05*mv); P(GEO.limb,.36,.8,.36,M.col); P(GEO.box,.08,.8,.08,M.mane,0,-.4,0); mtr(0,-.82,0); mrz(-(Math.PI-.62)-.45);
    P(GEO.box,.62,.3,.28,M.col,0,.22,0,0); P(GEO.box,.26,.24,.25,dark,0,.52,-.04,0); for(const s of [-1,1]){ P(GEO.cone,.08,.2,.06,M.col,0,-.05,.18,s*.1); P(GEO.sph,.06,.06,.06,[.05,.03,.02],0,.22,.06,s*.14); }
    if(M.elk) for(const s of [-1,1]){ mpush(); mtr(-.05,.18,s*.1); mrx(Math.PI-s*.55); P(GEO.limb,.06,.7,.06,[.92,.86,.7],M.elk?.25:0); mtr(0,-.45,0); mrz(.9); P(GEO.limb,.05,.35,.05,[.92,.86,.7],.25); mpop(); }
    mpop();
  if(M.elk){ addLight(o.x,o.y+1.8,o.z,4,[1,.6,.3]); if(Math.random()<.2) burst3(o.x+(Math.random()-.5),o.y+.3,o.z+(Math.random()-.5),'#ffb03a',1,.4,{glow:true,up:1}); }
}
/* ---------- dynamic world pieces ---------- */
function drawExtras(near,t){
  drawLootBags(near,t);
  if(STABLE.x&&near(STABLE.x*TS,STABLE.z*TS,60)){ const hs=[[1.0,2.9,.3,1],[2.6,3.3,2.6,2]]; for(const [dx,dz,f,m] of hs){ const X=STABLE.x+dx, Z=STABLE.z+dz; drawHorse({x:X,y:hgt(X,Z),z:Z,face:f+Math.sin(t*.3+dx)*.25,mv:0,walk:0,m}); } }
  if(WINDMILL.x&&near(WINDMILL.x*TS,WINDMILL.z*TS,70)){ mreset(); mtr(WINDMILL.x,WINDMILL.y,WINDMILL.z); P(GEO.sph,.5,.5,.5,[.3,.2,.12]); mrz(t*.7);
    for(let k=0;k<4;k++){ mpush(); mrz(k*Math.PI/2); P(GEO.box,.16,3.4,.12,[.34,.22,.12],0,0,1.7,0); P(GEO.box,.95,2.7,.04,[.86,.8,.66],0,.55,2.0,.03); mpop(); } }
  if(CAULDRON.x&&near(CAULDRON.x*TS,CAULDRON.z*TS,40)&&Math.random()<.3) P3(CAULDRON.x+(Math.random()-.5)*.6,CAULDRON.y,CAULDRON.z+(Math.random()-.5)*.6,0,.6,0,1.2,.18,'#8cff4a',{glow:true});
  for(const n of NODES){ if(n.resp>t||!near(n.x,n.y,40)) continue; const M=MATS[n.mat]; const X=n.x/TS, Z=n.y/TS, y=groundY(n.x,n.y); const col=C3(M.col); const pulse=.6+.4*Math.sin(t*3+n.id);
    mreset(); mtr(X,y,Z); mry(n.id);
    if(M.kind==='herb'){ for(let k=0;k<6;k++){ const a=k/6*Math.PI*2, r=.18+(k%2)*.12; P(GEO.cyl,.04,.42,.04,[.25,.5,.2],0,Math.cos(a)*r,0,Math.sin(a)*r); P(GEO.sph,.2,.15,.2,col,.6*pulse,Math.cos(a)*r,.44,Math.sin(a)*r); } P(GEO.sph,.5,.18,.5,[.2,.4,.15],0,0,.05,0); }
    else { P(GEO.sph,1.1,.7,.95,[.42,.4,.38],0,0,.2,0); for(let k=0;k<4;k++){ const a=k/4*Math.PI*2+.4; mpush(); mtr(Math.cos(a)*.25,.35,Math.sin(a)*.25); mrz(Math.cos(a)*.6); mrx(Math.sin(a)*.6); P(GEO.cone,.16,.42,.16,col,.8*pulse); mpop(); } }
    addLight(X,y+.6,Z,3,col.map(v=>v*.8)); if(Math.random()<.06) P3(X+(Math.random()-.5)*.5,y+.5,Z+(Math.random()-.5)*.5,0,.6,0,1,.06,M.col,{glow:true}); }
  for(const c of CRITTERS){
    if(c.k==='flock'){ if(Math.hypot(c.cx-CAM.tx,c.cz-CAM.tz)>90) continue; for(let i=0;i<c.n;i++){ const a=c.ph+t*c.sp+i*.55, r=c.r+Math.sin(i*1.7+t*.3)*2; const X=c.cx+Math.cos(a)*r, Z=c.cz+Math.sin(a)*r, Y=c.h+Math.sin(t*.8+i)*1.2+hgt(c.cx,c.cz);
        mreset(); mtr(X,Y,Z); mry(-(a+Math.PI/2)); const fl=Math.sin(t*12+i*2); P(GEO.sph,.38,.14,.14,[.12,.1,.1]); for(const s of [-1,1]){ mpush(); mrx(s*fl*.7); P(GEO.box,.22,.03,.5,[.15,.12,.12],0,0,0,s*.27); mpop(); } } continue; }
    if(!near(c.x,c.y,50)) continue; const X=c.x/TS, Z=c.y/TS, y=groundY(c.x,c.y);
    if(c.k==='frog'){ const hop=c.mv>.3?Math.abs(Math.sin(c.walkP*1.2))*.25:0; mreset(); mtr(X,y+hop,Z); mry(-c.face); msc(.32); P(GEO.sph,.9,.5,.75,[.3,.55,.22],0,0,.3,0); P(GEO.sph,.6,.3,.55,[.75,.8,.45],0,.05,.18,0);
      for(const s of [-1,1]){ P(GEO.sph,.22,.22,.22,[.35,.6,.25],0,.3,.55,s*.2); P(GEO.sph,.1,.1,.1,[0,0,0],0,.4,.58,s*.22); P(GEO.limb,.15,.45,.15,[.28,.5,.2],0,-.35,.3,s*.38); } continue; }
    drawQuad({x:X,y:y+(c.k==='rabbit'&&c.mv>.3?Math.abs(Math.sin(c.walkP*1.4))*.2:0),z:Z,face:c.face,mv:c.mv,walk:c.walkP,swing:-1,dead:-1,hit:false,sc:1,Q:QLOOK[c.k]}); }
}
/* ---------- weather overlay ---------- */
function drawWeatherOverlay(t){ const WX=weatherNow(); const wet=WX.kind>=2?WX.k:0; if(me&&zoneAtPx(me.x,me.y)==='ash') return;
  const snowy=me&&zoneAtPx(me.x,me.y)==='frost';
  if(wet>0){ g.fillStyle=`rgba(30,42,60,${.16*wet})`; g.fillRect(0,0,W,H); const n=Math.floor((WX.kind===3?800:480)*wet); g.strokeStyle=snowy?`rgba(245,250,255,${.7*wet})`:`rgba(205,220,240,${.5*wet})`; g.lineWidth=snowy?3:1.6; g.lineCap='round'; g.beginPath(); const wind=WX.kind===3?.35:.15;
    for(let i=0;i<n;i++){ const x=Math.random()*(W+100)-50, y=Math.random()*H, l=snowy?2:(18+Math.random()*22); g.moveTo(x,y); g.lineTo(x-wind*l,y+l); } g.stroke(); }
  if(flash>0){ g.fillStyle=`rgba(220,230,255,${flash*.35})`; g.fillRect(0,0,W,H); } }

/* =====================================================================
   UI
   ===================================================================== */
const $=id=>document.getElementById(id);
function chatLine(text,cls,prefix,nm){ const d=document.createElement('div'); d.className=cls||'c-say';
  if(nm){ d.append(prefix||''); if(nm.gm){ const g=document.createElement('span'); g.className='gmtag'; g.textContent='<GM> '; d.append(g); } const b=document.createElement('span'); b.className='cname'; b.style.color=nm.col; b.textContent='['+nm.n+']'; d.append(b,': '+text); }
  else d.textContent=(prefix||'')+text; const log=$('chatlog'); log.appendChild(d);
  while(log.children.length>120) log.firstChild.remove(); log.scrollTop=log.scrollHeight; }
const sysMsg=(t,c)=>chatLine(t,c||'c-sys');
function toast(text,cls){ const d=document.createElement('div'); d.textContent=text; if(cls) d.className=cls; $('toast').appendChild(d); setTimeout(()=>d.remove(),3000); }
function zoneBanner(z){ const Z=ZONES[z]; const el=$('zoneBanner'); el.innerHTML=''; const d=document.createElement('div'); d.textContent=Z.name; const s=document.createElement('small'); s.textContent=Z.sub||''; d.appendChild(s); el.appendChild(d); }
function buildBar(){
  const bar=$('bar'); bar.innerHTML=''; const col=CLS[me.c.cls].col;
  curAbils().forEach((ab,i)=>{ const s=document.createElement('div'); s.className='slot';
    s.style.background=`radial-gradient(circle at 35% 30%,${shade(col,.18)},${shade(col,-.62)})`;
    s.innerHTML=`<span class="k">${i+1}</span><span class="ic">${abilIcon(ab)}</span><div class="cd"></div><div class="cdt"></div><div class="lock">🔒<br>Lv ${ab.lvl}</div>`;
    s.onclick=()=>useAbility(i);
    s.onmouseenter=e=>showTip(e,`<div class="nm">${ab.name}</div><div style="color:var(--dim);font-size:13px">${ab.cost?costLabel(ab):'No cost'}${ab.cast?' · '+ab.cast+'s cast':' · Instant'}${ab.cd?' · '+ab.cd+'s cooldown':''}${ab.rng?' · '+ab.rng+' yd':''}</div><div>${ab.desc}</div>${me.c.lvl<ab.lvl?`<div style="color:#ff7a6a">Learned at level ${ab.lvl}</div>`:''}`);
    s.onmouseleave=hideTip; bar.appendChild(s); });
  const p=document.createElement('div'); p.className='slot'; p.style.background='radial-gradient(circle at 35% 30%,#ff8a8a,#5a0f12)'; p.innerHTML=`<span class="k">Q</span><span class="ic">${iconSVG('potion')}</span><span class="cnt" id="potCnt"></span><div class="cd"></div><div class="cdt"></div>`;
  p.onclick=usePotion; p.onmouseenter=e=>showTip(e,'<div class="nm">Healing Draught</div><div>Restores 38% of your health. 30s cooldown. Buy more from Mira.</div>'); p.onmouseleave=hideTip; bar.appendChild(p);
  $('pPort').textContent=CLS[me.c.cls].glyph; $('pPort').style.background=`radial-gradient(circle at 35% 30%,${shade(col,.2)},${shade(col,-.55)})`;
  $('pResBar').className='bar '+(CLS[me.c.cls].res==='rage'?'rage':'mana'); $('castbar').style.setProperty('--cc',shade(col,.25)); $('castbar').style.setProperty('--cc2',shade(col,-.45)); $('pPort').style.borderColor=col; $('pPort').style.boxShadow=`inset 0 0 12px rgba(0,0,0,.7),0 0 10px ${col}`;
}
const costLabel=ab=>costOf(ab)+(CLS[me.c.cls].res==='rage'?' rage':' mana');
function flashSlot(i){ const s=$('bar').children[i]; if(!s) return; s.classList.add('flash'); setTimeout(()=>s.classList.remove('flash'),150); }
function updateBar(){
  const t=now(); const slots=$('bar').children; const te=targetEnt(); const ab6=curAbils();
  ab6.forEach((ab,i)=>{ const s=slots[i]; if(!s) return; const cdEnd=Math.max(me.cds[ab.id]||0, ab.noGcd?0:me.gcd); const tot=(me.cds[ab.id]||0)>t?ab.cd:1;
    const rem=cdEnd-t; s.children[2].style.height=rem>0?(Math.min(1,rem/tot)*100)+'%':'0'; s.children[3].textContent=rem>1.5?Math.ceil(rem):'';
    s.classList.toggle('locked',me.c.lvl<ab.lvl);
    s.classList.toggle('nores',me.res<costOf(ab));
    s.classList.toggle('oor',!!(ab.hostile&&te&&te.hostile&&dist(me.x,me.y,te.x,te.y)>ab.rng+te.e.t.r)); });
  const p=slots[ab6.length]; if(p){ const rem=me.potCd-t; p.children[3].style.height=rem>0?(rem/30*100)+'%':'0'; p.children[4].textContent=rem>1?Math.ceil(rem):''; $('potCnt').textContent=me.c.pots; }
}
let uiTick=0;
function updateUI(){
  const c=me.c, t=now();
  $('pName').textContent=c.name; $('pLvl').textContent=c.lvl;
  if(gm.god&&!me.dead){ me.hp=me.mhp; me.res=me.mres; me.dots=[]; }
  { const f=me.hp/me.mhp; const hb=$('pHpBar'); hb.classList.toggle('low',f<.25); hb.classList.remove('mid'); const ab=me.absorb>0&&me.absorbU>t?me.absorb:0; $('pAbs').style.left=(f*100)+'%'; $('pAbs').style.width=Math.min(100-f*100,ab/me.mhp*100)+'%'; }
  $('pHp').style.width=(me.hp/me.mhp*100)+'%'; $('pHpT').textContent=`${Math.ceil(me.hp)} / ${me.mhp}`;
  $('pRes').style.width=(me.res/me.mres*100)+'%'; $('pResT').textContent=`${Math.floor(me.res)} / ${me.mres}`;
  const te=targetEnt(); const tf=$('tframe');
  if(te){ tf.classList.remove('hidden'); let name,lvl,hp,mhp,tag,col,glyph;
    if(te.kind==='m'){ const m=te.e; name=m.t.name; lvl=m.lv; hp=m.hp; mhp=m.mhp; col=m.t.col; glyph=m.t.boss?'☠':'⚔';
      const tg=m.tgt===MY_U?'Targeting you':m.tgt?('Targeting '+(othersByU.get(m.tgt)?.n||'someone')):'';
      tag=(m.t.boss?'Boss · ':'')+(m.tag&&m.tag!==MY_U?'Tagged by '+(othersByU.get(m.tag)?.n||'another')+' · ':'')+tg; tf.classList.remove('friendly'); }
    else if(te.kind==='p'){ if(te.self){name=c.name;lvl=c.lvl;hp=me.hp;mhp=me.mhp;col=CLS[c.cls].col;glyph=CLS[c.cls].glyph;tag='You'} else { const o=te.e; name=o.n;lvl=o.l;hp=o.hp;mhp=o.mhp;col=CLS[o.c].col;glyph=CLS[o.c].glyph;tag=CLS[o.c].name+(o.pt?' · Party: '+o.pt:'')+(o.d?' · Dead':'');} tf.classList.add('friendly'); }
    else { const n=te.e; name=n.name; lvl='—'; hp=1;mhp=1; col=n.col; glyph='☺'; tag='<'+n.title+'> Press F to talk'; tf.classList.add('friendly'); }
    { const ta=$('tActs'); const key=te.kind==='p'&&!te.self?te.u+'|'+(te.e.pt===me.party&&me.party?1:0):''; if(ta.dataset.k!==key){ ta.dataset.k=key; ta.innerHTML=''; if(key){ const o=te.e; if(!(me.party&&o.pt===me.party)){ const b=document.createElement('button'); b.className='gold'; b.textContent='Invite to party'; b.onclick=()=>inviteTo(o); ta.appendChild(b); } else if(amLeader()){ const b=document.createElement('button'); b.textContent='Remove from party'; b.onclick=()=>kickMember(o); ta.appendChild(b); } } } }
    $('tName').textContent=name; $('tName').style.color=te.kind==='p'?col:te.kind==='m'?(m=>m.t.boss?'#ff7a3a':m.t.elite?'#ffd56a':'#ff6a5a')(te.e):'#ffe9a0'; $('tHp').parentElement.classList.toggle('low',clamp(hp/mhp,0,1)<.3&&te.kind!=='n'); $('tLvl').textContent=lvl; $('tHp').style.width=(clamp(hp/mhp,0,1)*100)+'%'; $('tHpT').textContent=te.kind==='n'?'':`${Math.ceil(hp)} / ${mhp}`; $('tTag').textContent=tag;
    $('tPort').textContent=glyph; $('tPort').style.background=`radial-gradient(circle at 35% 30%,${shade(col,.2)},${shade(col,-.55)})`;
  } else tf.classList.add('hidden');
  // xp
  const need=xpNeed(c.lvl); $('xpbar').firstElementChild.style.width=c.lvl>=MAXLVL?'100%':(c.xp/need*100)+'%'; $('xpbar').lastElementChild.textContent=c.lvl>=MAXLVL?'Max level':`XP ${c.xp} / ${need}`;
  // cast bar
  updateCastbar(t); updateBoss(t); updateQuestArrow(); lavaCheck(t); updateNPCs(Math.min(.1,t-(updateUI.lt||t)),t); updateUI.lt=t;
  if(lootOpen&&dist(me.x,me.y,lootOpen.x,lootOpen.y)>170){ lootOpen=null; renderLoot(); }
  if(pendInv&&t>pendInv.until) answerInvite(false);
  if(!$('partyWin').classList.contains('hidden')&&(uiTick++%30===0)) renderPartyWin();
  // party frames
  const pf=$('party'); const mem=partyMembers();
  const sig=mem.map(o=>o.u+o.n+o.l+(o.pl?1:0)).join('|')+me.party;
  if(pf.dataset.sig!==sig){ pf.dataset.sig=sig; pf.innerHTML=''; if(me.party){ const h=document.createElement('div'); h.style.cssText='font-family:Cinzel;font-size:12px;color:var(--gold);text-shadow:0 1px 2px #000'; h.textContent='Party: '+me.party; pf.appendChild(h); }
    for(const o of mem){ const d=document.createElement('div'); d.className='pmember panel'; d.dataset.u=o.u; d.innerHTML='<div class="uname"><span></span><span class="lvl"></span></div><div class="bar hp small"><i></i></div>';
      d.querySelector('.uname span').textContent=(o.pl?'♛ ':'')+o.n; d.querySelector('.uname span').style.color=CLS[o.c].col; d.querySelector('.lvl').textContent=CLS[o.c].glyph+' '+o.l; d.onclick=()=>{me.target={kind:'p',id:o.u}}; pf.appendChild(d); } }
  for(const d of pf.querySelectorAll('.pmember')){ const o=othersByU.get(d.dataset.u); if(!o) continue; d.querySelector('i').style.width=(clamp(o.hp/o.mhp,0,1)*100)+'%'; d.classList.toggle('dead',o.d); d.classList.toggle('far',dist(o.rx,o.ry,me.x,me.y)>1200); }
  // zone
  const z=zoneAtPx(me.x,me.y); if(z!==me.zone){ if(me.zone) zoneBanner(z); me.zone=z; } $('zoneName').textContent=ZONES[z].name;
  if(!$('whoWin').classList.contains('hidden')) renderWho();
}
function renderTracker(){
  const el=$('tracker'); const qs=activeQuests();
  const mh=me.c.lvl>=3&&!me.c.mounts.length?'<div class="obj" style="margin-top:6px;color:#ffd34a">🐎 Mounts unlocked! Visit <b>Hilde the Stable Master</b> in Hearthmere (golden horseshoe on your map).</div>':'';
  if(!qs.length){ el.innerHTML=mh+'<h3>Quests</h3><div class="obj">Look for <b style="color:#ffd34a">!</b> above people\'s heads. Captain Oriel in Hearthmere always has work.</div><div class="obj" style="margin-top:4px;color:var(--dim);font-size:12px">M map · L quest log · R mount</div>'; return; }
  el.innerHTML='<h3>Quests <span style="color:var(--dim);font-size:11px">(L)</span></h3>'+(me.c.lvl>=3&&!me.c.mounts.length?`<div style="margin-top:6px;color:#ffd34a;font-size:13px">🐎 You can buy a mount! Visit <b>Hilde the Stable Master</b> in Hearthmere (look for the golden horseshoe).</div>`:'')+qs.slice(0,6).map(q=>{ const s=me.c.qs[q.id];
    return `<div style="margin-top:6px"><div style="font-weight:700;color:#f3e6c8">${esc(q.title)}</div><div class="${s.st==='done'?'done':'obj'}" style="font-size:13px">${s.st==='done'?'✔ Return to '+esc(npcName(q.giver)):esc(objText(q,s))}</div></div>`; }).join('')+(qs.length>6?`<div class="obj" style="margin-top:4px">+${qs.length-6} more…</div>`:''); }
function renderBuffs(){ const el=$('buffs'); if(!el||!me) return; let h=''; for(const k in me.c.buffs){ const ms=me.c.buffs[k]-Date.now(); if(ms<=0) continue; h+=`<div class="buff" title="${BUFFNAME[k][0]}">${BUFFNAME[k][1]}<span>${Math.ceil(ms/60000)}m</span></div>`; }
  if(me.mounted) h+=`<div class="buff" title="Mounted">🐎<span>R</span></div>`; el.innerHTML=h; }
function showTip(e,html){ const tp=$('tip'); tp.innerHTML=html; tp.classList.remove('hidden'); const r=e.currentTarget.getBoundingClientRect();
  tp.style.left=Math.min(innerWidth-270,r.left)+'px'; tp.style.top=Math.max(8,r.top-tp.offsetHeight-8)+'px'; }
function hideTip(){ $('tip').classList.add('hidden'); }
const upMul=it=>1+.15*(it.up||0);
function itemTip(it,cmp){ const P=Math.round(it.pow*upMul(it)), S=Math.round(it.sta*upMul(it));
  let h=`<div class="nm t${it.rar}">${esc(it.name)}${it.up?' +'+it.up:''}</div><div style="color:var(--dim);font-size:13px">${RAR[it.rar]} ${it.slot} · Item level ${it.lv}</div><div>+${P} Power<br>+${S} Stamina</div>${it.desc?`<div class="t4" style="font-size:13px;font-style:italic;margin-top:3px">${esc(it.desc)}</div>`:''}<div style="color:var(--gold);font-size:13px">Sells for ${it.val} gold</div>`;
  if(cmp){ const cur=me.c.eq[it.slot]; const dp=P-(cur?Math.round(cur.pow*upMul(cur)):0), ds=S-(cur?Math.round(cur.sta*upMul(cur)):0); h+=`<div style="font-size:13px;margin-top:4px">If equipped: <span style="color:${dp>=0?'#6f6':'#f66'}">${dp>=0?'+':''}${dp} pow</span>, <span style="color:${ds>=0?'#6f6':'#f66'}">${ds>=0?'+':''}${ds} sta</span></div><div style="font-size:12px;color:var(--dim)">${shopOpen?'Click to sell':'Click to equip · drag to move, sell or destroy'}</div>`; }
  return h; }
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let shopOpen=false;
function renderInv(){
  if(!me) return; const c=me.c;
  const eq=$('eqSlots'); eq.innerHTML='';
  for(const s of SLOTS){ const it=c.eq[s]; const d=document.createElement('div'); d.className='islot '+(it?'r'+it.rar:''); d.innerHTML=it?itemSVG(it):`<span class="eqempty">${SLOTICON[s]}</span>`;
    if(it){ d.onmouseenter=e=>showTip(e,itemTip(it)); d.onmouseleave=hideTip; d.onclick=()=>{ if(c.inv.length>=18) return err('Bags are full'); c.inv.push(it); c.eq[s]=null; recalc(); renderInv(); hideTip(); persist(); }; }
    d.ondragover=e=>{ if(dragI<0) return; const it2=c.inv[dragI]; if(it2&&it2.slot===s){ e.preventDefault(); d.classList.add('over'); } }; d.ondragleave=()=>d.classList.remove('over');
    d.ondrop=e=>{ e.preventDefault(); d.classList.remove('over'); const it2=c.inv[dragI]; if(it2&&it2.slot===s){ dragOk=true; equipItem(it2); } };
    const row=document.createElement('div'); row.className='eqrow'; const inf=document.createElement('div'); inf.className='eqinfo'; inf.innerHTML=`<div class="eqs">${s}</div><div class="eqn ${it?'t'+it.rar:''}">${it?esc(it.name)+(it.up?' +'+it.up:''):'<span style="color:var(--dim)">Empty</span>'}</div>`; row.append(d,inf); eq.appendChild(row); }
  renderChar(); if(0) $('statBox').innerHTML=`<div class="title" style="font-size:15px;color:var(--gold)">${esc(c.name)}</div><div>Level ${c.lvl} ${CLS[c.cls].name}</div><div>Health ${me.mhp}</div><div>Power ${me.pow}</div><div>Stamina ${me.sta}</div><div style="color:var(--dim);font-size:12px">Places found ${c.disc.length}/${POIS.length}</div>`;
  const bag=$('bag'); bag.innerHTML='';
  for(let i=0;i<18;i++){ const it=c.inv[i]; const d=document.createElement('div'); d.className='islot '+(it?'r'+it.rar:''); if(it) d.innerHTML=itemSVG(it); d.dataset.i=i;
    if(it){ d.onmouseenter=e=>showTip(e,itemTip(it,true)); d.onmouseleave=hideTip; d.draggable=true;
      d.ondragstart=e=>{ hideTip(); dragI=i; dragOk=false; e.dataTransfer.setData('text/plain','bag:'+i); e.dataTransfer.effectAllowed='move'; setTimeout(()=>d.classList.add('drag'),0); };
      d.ondragend=e=>{ d.classList.remove('drag'); const w=$('invWin').getBoundingClientRect(); const out=e.clientX<w.left||e.clientX>w.right||e.clientY<w.top||e.clientY>w.bottom;
        if(!dragOk&&out&&(e.clientX||e.clientY)) askDestroy(it); dragI=-1; };
      d.oncontextmenu=e=>{ e.preventDefault(); hideTip(); itemMenu(e,it,i); };
      d.onclick=()=>{ if(shopOpen) sellItem(it); else equipItem(it); hideTip(); }; }
    d.ondragover=e=>{ if(dragI<0) return; e.preventDefault(); d.classList.add('over'); }; d.ondragleave=()=>d.classList.remove('over');
    d.ondrop=e=>{ e.preventDefault(); d.classList.remove('over'); if(dragI<0) return; dragOk=true; moveItem(dragI,i); };
    bag.appendChild(d); }
  $('bagCount').textContent=`Bags ${c.inv.length}/18`;
  const mats=Object.keys(MATS).filter(k=>c.mats[k]).map(k=>`<span class="mat" title="${MATS[k].name}">${MATS[k].icon} ${c.mats[k]}</span>`).join('');
  $('gold').innerHTML=`<div>Gold: ${c.gold} · Healing Draughts: ${c.pots}</div><div style="margin-top:6px;color:#e8dcc1">${mats||'<span style="color:var(--dim)">No materials yet. Look for glowing herbs and ore veins and press F.</span>'}</div>`;
}
let dragI=-1, dragOk=false;
function moveItem(from,to){ const c=me.c; if(from===to) return; const it=c.inv[from]; if(!it) return; if(to>=c.inv.length){ c.inv.splice(from,1); c.inv.push(it); } else { c.inv[from]=c.inv[to]; c.inv[to]=it; } renderInv(); persist(); }
function equipItem(it){ setTimeout(()=>armorySync(true),500); const c=me.c; const i=c.inv.indexOf(it); if(i<0) return; const cur=c.eq[it.slot]; c.eq[it.slot]=it; c.inv.splice(i,1); if(cur) c.inv.splice(i,0,cur); chatLine(`Equipped [${it.name}].`,'c-loot t'+it.rar); recalc(); renderInv(); persist(); sendPresence(true); }
function sellItem(it){ const c=me.c; const i=c.inv.indexOf(it); if(i<0) return; if(it.rar>=3&&!it._sellOk){ return askConfirm(`Sell <b class="t${it.rar}">${esc(it.name)}</b> for ${it.val} gold?`,'Sell',()=>{ it._sellOk=1; sellItem(it); }); }
  c.inv.splice(i,1); c.gold+=it.val; coinFx(it.val); chatLine(`Sold [${it.name}] for ${it.val} gold.`,'c-loot'); renderInv(); persist(); }
function destroyItem(it){ const c=me.c; const i=c.inv.indexOf(it); if(i<0) return; c.inv.splice(i,1); chatLine(`Destroyed [${it.name}].`,'c-err'); renderInv(); persist(); }
function askDestroy(it){ askConfirm(`Destroy <b class="t${it.rar}">${esc(it.name)}</b>? This cannot be undone.`,'Destroy',()=>destroyItem(it),true); }
function askConfirm(html,label,fn,danger){ const p=$('confirmPop'); p.innerHTML=`<div>${html}</div><div class="btns"><button id="cfNo">Cancel</button><button id="cfYes" class="${danger?'':'gold'}" style="${danger?'background:#8a1a10;color:#fff':''}">${label}</button></div>`; p.classList.remove('hidden');
  $('cfNo').onclick=()=>p.classList.add('hidden'); $('cfYes').onclick=()=>{ p.classList.add('hidden'); fn(); }; }
function itemMenu(e,it,i){ const m=$('ctxMenu'); m.innerHTML=''; const add=(t,fn,cls)=>{ const d=document.createElement('div'); d.textContent=t; if(cls) d.className=cls; d.onclick=()=>{ m.classList.add('hidden'); fn(); }; m.appendChild(d); };
  add('Equip',()=>equipItem(it)); add(`Sell for ${it.val} gold`,()=>sellItem(it)); add('Destroy',()=>askDestroy(it),'dang');
  m.style.left=Math.min(innerWidth-180,e.clientX)+'px'; m.style.top=Math.min(innerHeight-130,e.clientY)+'px'; m.classList.remove('hidden');
  setTimeout(()=>addEventListener('mousedown',function h(ev){ if(!m.contains(ev.target)){ m.classList.add('hidden'); removeEventListener('mousedown',h); } }),0); }
function initBagZones(){ for(const [id,fn] of [['dzSell',sellItem],['dzTrash',askDestroy]]){ const z=$(id);
    z.ondragover=e=>{ if(dragI<0) return; e.preventDefault(); z.classList.add('over'); }; z.ondragleave=()=>z.classList.remove('over');
    z.ondrop=e=>{ e.preventDefault(); z.classList.remove('over'); const it=me&&me.c.inv[dragI]; if(it){ dragOk=true; fn(it); } }; }
  $('bagSort').onclick=()=>{ const c=me.c; c.inv.sort((a,b)=>b.rar-a.rar||SLOTS.indexOf(a.slot)-SLOTS.indexOf(b.slot)||b.pow+b.sta-a.pow-a.sta); renderInv(); persist(); }; }
function toggleWin(id,force){ const w=$(id); const show=force??w.classList.contains('hidden'); w.classList.toggle('hidden',!show); if(id==='whoWin'&&show) renderWho(); if(id==='invWin'&&show) renderInv(); if(id==='mapWin'&&show) drawWorldMap(); if(id==='charWin'&&show){ renderInv(); renderChar(); } if(id==='soundWin'&&show) renderSound(); if(id==='partyWin'&&show) renderPartyWin(); if(id==='qlogWin'&&show) renderQlog(); if(id==='invWin'&&!show&&shopOpen){shopOpen=false;$('dlg').classList.add('hidden')} }
function renderWho(){ const l=$('whoList'); const rows=[{n:me.c.name,c:me.c.cls,l:me.c.lvl,z:zoneAtPx(me.x,me.y),pt:me.party,you:1},...[...others.values()].filter(seenO).map(o=>({n:o.n,c:o.c,l:o.l,z:o.z,pt:o.pt,u:o.u}))];
  const sig=JSON.stringify(rows); if(l.dataset.sig===sig) return; l.dataset.sig=sig; l.innerHTML='';
  for(const r of rows){ const d=document.createElement('div'); d.className='whorow'; const a=document.createElement('span'); a.textContent=`${CLS[r.c].glyph} ${r.n}${r.you?' (you)':''}`; a.style.color=CLS[r.c].col;
    const b=document.createElement('span'); b.style.color='var(--dim)'; b.textContent=`Lv ${r.l} · ${ZONES[r.z]?.name||''}${r.pt?' · '+r.pt:''}`; d.append(a,b); if(!r.you&&!(me.party&&r.pt===me.party)){ const ib=document.createElement('button'); ib.textContent='Invite'; ib.style.cssText='padding:1px 8px;font-size:11px;margin-left:6px'; ib.onclick=()=>inviteTo(othersByU.get(r.u)); d.appendChild(ib); } l.appendChild(d); }
  if(netState==='solo'){ const d=document.createElement('div'); d.style.cssText='margin-top:8px;color:var(--dim);font-size:13px'; d.textContent=SOLO_WHY(); l.appendChild(d); } }
function renderQlog(){ const el=$('qlogList'); const qs=activeQuests(); if(!qs.length){ el.innerHTML='<p style="color:var(--dim)">No active quests.</p>'; return; }
  el.innerHTML=qs.map(q=>{ const s=me.c.qs[q.id]; return `<div class="qlog"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(q.title)}</b><span style="color:var(--dim);font-size:12px">${esc(npcName(q.giver))}</span></div>
    <div style="font-size:13px;color:#d9c9a6;margin:3px 0">${esc(q.text)}</div><div class="${s.st==='done'?'done':'obj'}" style="font-size:13px">${s.st==='done'?'✔ Return to '+esc(npcName(q.giver)):esc(objText(q,s))}</div>
    <button class="abandon" data-q="${q.id}">Abandon</button></div>`; }).join('');
  el.querySelectorAll('.abandon').forEach(b=>b.onclick=()=>{ abandonQuest(b.dataset.q); renderQlog(); }); }
function dlg(html){ const d=$('dlg'); d.innerHTML='<button class="close" id="dlgX">×</button>'+html; d.classList.remove('hidden'); $('dlgX').onclick=closeDlg; }
function closeDlg(){ $('dlg').classList.add('hidden'); if(shopOpen){shopOpen=false; renderInv();} }
function talk(n){
  if(!n) return; if(dist(me.x,me.y,n.x,n.y)>120) return err('Too far away'); shopOpen=false;
  const lines=[]; for(const q of QUESTS){ if(q.giver!==n.id) continue; const s=me.c.qs[q.id];
    if(s&&s.st==='done') lines.push(['?',q]); else if(qAvail(q)) lines.push(['!',q]); else if(s&&s.st==='active') lines.push(['…',q]); }
  let h=`<div class="nhead">${npcPortrait(n)}<div><h2>${esc(n.name)}</h2><small>&lt;${esc(n.title)}&gt;</small></div></div><p id="npcTxt"></p>`; n.emote={k:'wave',t0:now()}; n.emoteU=now()+2;
  h+=lines.map((l,i)=>`<div class="qline" data-i="${i}"><span class="qm ${l[0]==='…'?'dim':''}">${l[0]}</span> ${esc(l[1].title)} <span style="color:var(--dim);font-size:12px">(Lv ${l[1].lvl||1})</span></div>`).join('');
  const svc={mira:[['shop','Browse goods'],['alch','Alchemy']],doran:[['smith','Upgrade gear']],hilde:[['stable','Mounts']]}[n.id]||[];
  if(!lines.length&&!svc.length) h+='<p style="color:var(--dim)">"Nothing for you right now. Come back when you\'ve grown stronger."</p>';
  h+=`<div class="btns" style="margin-top:12px">${svc.map(s=>`<button data-s="${s[0]}">${s[1]}</button>`).join('')}<button id="byeB">Goodbye</button></div>`;
  dlg(h); typeText($('npcTxt'),(NPCGREET[n.id]||'"Well met, traveller."').replace(/<[^>]*>/g,'')); $('byeB').onclick=closeDlg;
  document.querySelectorAll('#dlg .qline').forEach(el=>el.onclick=()=>questDlg(n,lines[+el.dataset.i][1]));
  document.querySelectorAll('#dlg [data-s]').forEach(b=>b.onclick=()=>({shop:openShop,alch:()=>openAlchemy(n),smith:()=>openSmith(n),stable:()=>openStable(n)})[b.dataset.s]());
}
function questDlg(n,q){ const s=me.c.qs[q.id]; const rw=`${q.xp} xp · ${q.gold} gold${q.epic?' · an epic item':q.item?' · a '+RAR[q.item].toLowerCase()+' item':''}`;
  let h=`<h2>${esc(q.title)}</h2><p>${esc(q.text)}</p><div class="reward"><b>Objective:</b> ${esc(objText(q,s))}<br><b>Rewards:</b> <span class="rw-xp">${q.xp} XP</span> · <span class="rw-g">${q.gold} gold</span>${q.epic?' · <span class="t3">Epic item</span>':q.item?` · <span class="t${q.item}">${RAR[q.item]} item</span>`:''}</div><div class="btns" style="margin-top:12px"><button id="qBack">Back</button>`;
  if(!s) h+='<button id="qGo" class="gold">Accept quest</button>'; else if(s.st==='done') h+='<button id="qGo" class="gold">Complete quest</button>'; h+='</div>';
  dlg(h); $('qBack').onclick=()=>talk(n); if($('qGo')) $('qGo').onclick=()=>{ if(!s) acceptQuest(q); else completeQuest(q); talk(n); }; }
function openShop(){ shopOpen=true; const c=me.c;
  dlg(`<h2>Mira the Peddler</h2><p>"Potions and trinkets. And I'll take any loot you don't want. Click items in your bags to sell them."</p>
    <div class="shoprow"><span>🧪 Healing Draught <span style="color:var(--dim)">(you have ${c.pots})</span></span><button id="buyP">Buy · 2 gold</button></div>
    <div class="shoprow"><span>🧪×5 Bundle of Draughts</span><button id="buyP5">Buy · 9 gold</button></div>
    <div class="shoprow"><span>Sell all common (grey) items</span><button id="sellJ">Sell</button></div>
    <div style="margin-top:10px;color:var(--gold)">Your gold: ${c.gold}</div><div class="btns" style="margin-top:10px"><button id="bk">Back</button></div>`);
  const buy=(n,cost)=>{ if(c.gold<cost) return err('Not enough gold'); c.gold-=cost; c.pots+=n; persist(); renderInv(); openShop(); };
  $('buyP').onclick=()=>buy(1,2); $('buyP5').onclick=()=>buy(5,9); $('bk').onclick=()=>talk(NPCS.find(x=>x.id==='mira'));
  $('sellJ').onclick=()=>{ let g2=0; c.inv=c.inv.filter(it=>{ if(it.rar===0){g2+=it.val;return false} return true}); c.gold+=g2; if(g2) chatLine(`Sold common items for ${g2} gold.`,'c-loot'); persist(); renderInv(); openShop(); };
  toggleWin('invWin',true); shopOpen=true; renderInv(); }
const needTxt=need=>Object.entries(need).map(([k,v])=>`<span style="color:${(me.c.mats[k]||0)>=v?'#9fd18b':'#ff8a7a'}">${MATS[k].icon} ${MATS[k].name} ${me.c.mats[k]||0}/${v}</span>`).join(' · ');
function openAlchemy(n){ const c=me.c;
  dlg(`<h2>Alchemy</h2><p>"Bring me what the land gives, and I'll bottle it."</p>${RECIPES.map(r=>{ const ok=Object.entries(r.need).every(([k,v])=>(c.mats[k]||0)>=v);
    return `<div class="shoprow"><span><b>${r.name}</b><br><span style="font-size:13px;color:var(--dim)">${r.desc}</span><br><span style="font-size:13px">${needTxt(r.need)}</span></span><button data-r="${r.id}" ${ok?'':'disabled'}>Brew</button></div>`; }).join('')}
    <div class="btns" style="margin-top:10px"><button id="bk">Back</button></div>`);
  $('bk').onclick=()=>talk(n);
  document.querySelectorAll('#dlg [data-r]').forEach(b=>b.onclick=()=>{ const r=RECIPES.find(x=>x.id===b.dataset.r); for(const [k,v] of Object.entries(r.need)) c.mats[k]-=v;
    if(r.give==='pots'){ c.pots+=2; chatLine('You brew 2 Healing Draughts.','c-loot'); } else { c.buffs[r.buff]=Date.now()+600000; chatLine(`You drink the ${r.name}.`,'c-loot'); sparkle(me.x,me.y,'#ffd34a'); recalc(); renderBuffs(); }
    persist(); renderInv(); openAlchemy(n); }); }
function upCost(it){ const k=it.up||0; if(k>=7) return null; const mat=k<2?'copper':k<4?'iron':k<5?'obsidian':'mithril'; return {gold:5*(k+1)+it.lv,mat,n:k<2?2+k:k<4?k:3}; }
function openSmith(n){ const c=me.c;
  dlg(`<h2>Doran's Forge</h2><p>"Each upgrade adds 15% to an item's power and stamina. Up to +7 (mithril from Frostpeak for the last two)."</p>${SLOTS.map(s=>{ const it=c.eq[s]; if(!it) return `<div class="shoprow"><span style="color:var(--dim)">No ${s} equipped</span></div>`;
    const cost=upCost(it); const ok=cost&&c.gold>=cost.gold&&(c.mats[cost.mat]||0)>=cost.n;
    return `<div class="shoprow"><span><b class="t${it.rar}">${esc(it.name)}${it.up?' +'+it.up:''}</b><br><span style="font-size:13px">${cost?`${cost.gold} gold · ${needTxt({[cost.mat]:cost.n})}`:'Fully upgraded'}</span></span><button data-u="${s}" ${ok?'':'disabled'}>Upgrade</button></div>`; }).join('')}
    <div class="btns" style="margin-top:10px"><button id="bk">Back</button></div>`);
  $('bk').onclick=()=>talk(n);
  document.querySelectorAll('#dlg [data-u]').forEach(b=>b.onclick=()=>{ const it=c.eq[b.dataset.u]; const cost=upCost(it); c.gold-=cost.gold; c.mats[cost.mat]-=cost.n; it.up=(it.up||0)+1;
    chatLine(`Doran hammers your ${it.name} to +${it.up}.`,'c-loot'); const [X,Y,Z]=ph3(n.x,n.y,1); burst3(X,Y,Z,'#ffb03a',30,3,{glow:true}); recalc(); persist(); renderInv(); openSmith(n); }); }
function openStable(n){ const c=me.c;
  dlg(`<h2>Hilde's Stable</h2><p>"Press R to call your mount, and R again to hop off. They don't like fighting or deep water."</p>${MOUNTS.slice(1).map((m,i)=>{ const id=i+1, own=c.mounts.includes(id);
    return `<div class="shoprow"><span><b>${m.name}</b><br><span style="font-size:13px;color:var(--dim)">+${Math.round((m.speed-1)*100)}% speed · requires level ${m.lvl}</span></span>${own?`<button data-sel="${id}" ${c.mount===id?'disabled':''}>${c.mount===id?'Riding':'Choose'}</button>`:`<button data-buy="${id}" ${c.gold>=m.cost&&c.lvl>=m.lvl?'':'disabled'}>Buy · ${m.cost} gold</button>`}</div>`; }).join('')}
    <div style="margin-top:10px;color:var(--gold)">Your gold: ${c.gold}</div><div class="btns" style="margin-top:10px"><button id="bk">Back</button></div>`);
  $('bk').onclick=()=>talk(n);
  document.querySelectorAll('#dlg [data-buy]').forEach(b=>b.onclick=()=>{ const id=+b.dataset.buy, m=MOUNTS[id]; c.gold-=m.cost; c.mounts.push(id); c.mount=id; toast('New mount: '+m.name,'small'); sysMsg(`You bought the ${m.name}. Press R to ride.`); persist(); renderInv(); openStable(n); });
  document.querySelectorAll('#dlg [data-sel]').forEach(b=>b.onclick=()=>{ c.mount=+b.dataset.sel; if(me.mounted) me.mounted=c.mount; persist(); openStable(n); }); }

/* ---------- world map ---------- */
let mapBase=null; const MAPS=5;
const ZCENT={}; (function(){ const acc={}; for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ const z=zmap[y*MW+x]; (acc[z]=acc[z]||[0,0,0]); acc[z][0]+=x; acc[z][1]+=y; acc[z][2]++; } for(const z in acc) ZCENT[z]=[acc[z][0]/acc[z][2],acc[z][1]/acc[z][2]]; ZCENT.ash=[56,18]; ZCENT.lake=[90,93]; })();
setInterval(drawWorldMap,500);
function drawMini(){
  const mc=document.getElementById('miniC'), c=mc.getContext('2d'); const S=mc.width; c.clearRect(0,0,S,S);
  c.save(); c.beginPath(); c.arc(S/2,S/2,S/2,0,7); c.clip(); const scale=S/MW*1.6*(OPT.miniZ||1); const ox=S/2-(me.x/TS)*scale, oy=S/2-(me.y/TS)*scale;
  if(!mapBase) mapBase=buildMapBase(); c.imageSmoothingEnabled=true; c.drawImage(mapBase,ox,oy,MW*scale,MH*scale);
  const dot=(x,y,col,r)=>{c.fillStyle=col;c.beginPath();c.arc(ox+x/TS*scale,oy+y/TS*scale,r,0,7);c.fill()};
  const t=now(); for(const n of NODES) if(n.resp<t&&dist(n.x,n.y,me.x,me.y)<1100) dot(n.x,n.y,MATS[n.mat].kind==='herb'?'#9dff6a':'#ffb05a',3.2);
  for(const m of mobs) if(!m.dead){ if(m.t.boss){ c.font='bold 22px sans-serif'; c.textAlign='center'; c.fillStyle='#ff5a2a'; c.fillText('☠',ox+m.rx/TS*scale,oy+m.ry/TS*scale+7);} else if(dist(m.rx,m.ry,me.x,me.y)<900) dot(m.rx,m.ry,m.t.elite?'#ffb03a':'#e8453a',m.t.elite?4.5:3); }
  for(const n of NPCS){ const mk=npcMark(n); dot(n.x,n.y,'#ffd34a',4); if(n.id==='hilde'&&mk==='$') drawShoe(c,ox+n.x/TS*scale,oy+n.y/TS*scale-8,.75,1); if(mk==='!'||mk==='?'){ c.font='900 20px Cinzel,serif'; c.textAlign='center'; c.lineWidth=3; c.strokeStyle='#000'; c.strokeText(mk,ox+n.x/TS*scale,oy+n.y/TS*scale-4); c.fillStyle='#ffd34a'; c.fillText(mk,ox+n.x/TS*scale,oy+n.y/TS*scale-4); } }
  for(const bm of mobs) if((bm.t.boss||bm.t.elite)&&!bm.t.summon) mapIcon(c,bm.dead?'bossdead':bm.t.boss?'boss':'elite',ox+(bm.dead?bm.sx:bm.rx)/TS*scale,oy+(bm.dead?bm.sy:bm.ry)/TS*scale,null,.75);
  for(const o of others.values()) if(seenO(o)) dot(o.rx,o.ry,o.pt&&o.pt===me.party?'#6fb6ff':CLS[o.c].col,5);
  c.restore();
  c.save(); c.translate(S/2,S/2); c.rotate(me.face+Math.PI/2); c.fillStyle='#fff'; c.strokeStyle='#000'; c.lineWidth=2; c.beginPath(); c.moveTo(0,-9); c.lineTo(6,7); c.lineTo(0,3); c.lineTo(-6,7); c.closePath(); c.stroke(); c.fill(); c.restore();
  c.save(); c.translate(S/2,S/2); c.rotate(CAM.yaw+Math.PI/2); c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=2; c.beginPath(); c.moveTo(0,0); c.lineTo(-40,-70); c.moveTo(0,0); c.lineTo(40,-70); c.stroke(); c.restore();
}

/* =====================================================================
   OPEN WORLD SYSTEMS
   ===================================================================== */
const buffOn=k=>!!(me&&me.c.buffs&&me.c.buffs[k]>Date.now());
const QBYID={}; for(const q of QUESTS) QBYID[q.id]=q;
const npcName=id=>(NPCS.find(n=>n.id===id)||{}).name||'someone';
function migrateChar(c){ c.qs=c.qs||{}; c.mats=c.mats||{}; c.mounts=c.mounts||[]; c.mount=c.mount||0; c.disc=c.disc||[]; c.buffs=c.buffs||{};
  if(c.q&&!c.migrated){ const order=['boar','wolf','lurker','sentinel','hking','cultist','wyrm']; for(let i=0;i<Math.min(c.q.i,order.length);i++) c.qs[order[i]]={st:'complete',c:0,p:[]};
    const cur=order[c.q.i]; if(cur&&c.q.st&&c.q.st!=='avail') c.qs[cur]={st:c.q.st,c:c.q.c||0,p:[]}; } c.migrated=1; }
function qAvail(q){ const qs=me.c.qs; if(qs[q.id]) return false; if(q.pre&&(!qs[q.pre]||qs[q.pre].st!=='complete')) return false; return (q.lvl||1)<=me.c.lvl+1; }
function npcMark(n){ if(!me) return n.id==='mira'||n.id==='doran'||n.id==='hilde'?'$':''; let m='';
  for(const q of QUESTS){ if(q.giver!==n.id) continue; const s=me.c.qs[q.id]; if(s&&s.st==='done') return '?'; if(qAvail(q)) m='!'; }
  if(m) return m; return n.id==='mira'||n.id==='doran'||n.id==='hilde'?'$':''; }
const activeQuests=()=>QUESTS.filter(q=>me.c.qs[q.id]&&me.c.qs[q.id].st!=='complete');
function objText(q,s){ s=s||{c:0,p:[]};
  if(q.type==='kill'){ const mt=MOBT.find(m=>m.key===q.mob); return q.n>1?`${mt.name}s slain: ${s.c}/${q.n}`:`Defeat ${mt.name}: ${s.c}/1`; }
  if(q.type==='gather') return `${MATS[q.mat].name} gathered: ${s.c}/${q.n}`;
  return `Places found: ${s.c}/${q.n} (${q.pois.map(id=>POIS.find(p=>p.id===id).name).join(', ')})`; }
function acceptQuest(q){ if(activeQuests().length>=8) return err('Your quest log is full'); me.c.qs[q.id]={st:'active',c:0,p:[]}; sysMsg(`Quest accepted: ${q.title}`); banner('Quest Accepted',q.title); sfx('accept');
  if(q.type==='explore') for(const id of q.pois) if(me.c.disc.includes(id)) questEvent('explore',id,1);
  renderTracker(); persist(); }
function questEvent(type,key,amt){ let any=false;
  for(const q of QUESTS){ const s=me.c.qs[q.id]; if(!s||s.st!=='active'||q.type!==type) continue; let ch=false;
    if(type==='kill'&&q.mob===key){ s.c=Math.min(q.n,s.c+amt); ch=true; }
    else if(type==='gather'&&q.mat===key){ s.c=Math.min(q.n,s.c+amt); ch=true; }
    else if(type==='explore'&&q.pois.includes(key)&&!s.p.includes(key)){ s.p.push(key); s.c=s.p.length; ch=true; }
    if(ch){ any=true; if(s.c>=q.n){ s.st='done'; qProg(objText(q,s),false); qProg(`${q.title} — objectives complete!`,true); sysMsg(`${q.title}: return to ${npcName(q.giver)}.`); } else qProg(objText(q,s)); } }
  if(any){ renderTracker(); persist(); } }
function completeQuest(q){ const s=me.c.qs[q.id]; if(!s||s.st!=='done') return; s.st='complete'; me.c.gold+=q.gold; sfx('quest'); banner('Quest Complete!',`${q.title} · +${q.xp} XP · +${q.gold} gold`,'win'); coinFx(q.gold);
  gainXp(q.xp); const items=[]; if(q.epic) items.push(genItem(Math.max(10,me.c.lvl),3)); if(q.item) items.push(genItem(Math.max(me.c.lvl,q.lvl),q.item));
  for(const it of items){ if(me.c.inv.length<18){ me.c.inv.push(it); chatLine(`You receive: [${it.name}]`,'c-loot t'+it.rar); } }
  sysMsg(`You receive ${q.gold} gold.`,'c-loot'); renderTracker(); renderInv(); persist(); }
function abandonQuest(id){ delete me.c.qs[id]; renderTracker(); persist(); }

/* ---------- gathering ---------- */
function nearNode(){ let best=null,bd=90; const t=now(); for(const n of NODES){ if(n.resp>t) continue; const d=dist(me.x,me.y,n.x,n.y); if(d<bd){bd=d;best=n} } return best; }
function startGather(n){ if(!me||me.dead||me.cast) return; if(me.mounted) dismount(); me.emote=null;
  me.cast={ab:{id:'gather',name:(MATS[n.mat].kind==='herb'?'Gathering ':'Mining ')+MATS[n.mat].name},t0:now(),dur:1.6,node:n}; }
function finishGather(n){ if(n.resp>now()) return; const M=MATS[n.mat]; const amt=1+(Math.random()<.35?1:0); me.c.mats[n.mat]=(me.c.mats[n.mat]||0)+amt; n.resp=now()+75;
  chatLine(`You gather ${amt} ${M.name}.`,'c-loot'); const [X,Y,Z]=ph3(n.x,n.y,.4); burst3(X,Y,Z,M.col,22,2.5,{glow:true,up:1.5});
  gainXp(8+4*me.c.lvl); questEvent('gather',n.mat,amt); stat('gathered',amt); renderInv(); persist(); }

/* ---------- mounts ---------- */
function isWaterAt(px,py){ return tAt(Math.floor(px/TS),Math.floor(py/TS))===T.WATER; }
function onDock(px,py){ const X=px/TS, Z=py/TS; return DOCK.x0&&X>=DOCK.x0&&X<=DOCK.x1+.5&&Z>=DOCK.z-.4&&Z<=DOCK.z+1.4; }
function standY(px,py){ if(onDock(px,py)) return .47; if(isWaterAt(px,py)) return Math.max(hgt(px/TS,py/TS),-1.12); return groundY(px,py); }
const isSwimming=()=>me&&!onDock(me.x,me.y)&&isWaterAt(me.x,me.y)&&hgt(me.x/TS,me.y/TS)<-.4;
function blockedP(x,y,r){ const f=(px,py)=>{ const t=tAt(Math.floor(px/TS),Math.floor(py/TS)); return t!==T.WATER&&t!==T.LAVA&&SOLID.has(t); }; return f(x-r,y-r)||f(x+r,y-r)||f(x-r,y+r)||f(x+r,y+r); }
function movePlayer(e,dx,dy,r){ if(e===me&&gm.fly){ e.x=clamp(e.x+dx,20,MW*TS-20); e.y=clamp(e.y+dy,20,MH*TS-20); return; } if(!blockedP(e.x+dx,e.y,r)) e.x+=dx; if(!blockedP(e.x,e.y+dy,r)) e.y+=dy; }
function toggleMount(){ if(!me||me.dead) return; if(me.mounted){ dismount(); return; }
  if(!me.c.mount) return err(me.c.mounts.length?'Pick a mount at the stable':'You have no mount. Visit Hilde the Stable Master in Hearthmere');
  if(inCombat()) return err("You can't mount in combat"); if(isSwimming()) return err("You can't mount while swimming"); if(me.cast) return;
  me.emote=null; me.cast={ab:{id:'mount',name:'Summon '+MOUNTS[me.c.mount].name},t0:now(),dur:1.5,mount:true}; }
function mountUp(){ me.mounted=me.c.mount; const [X,Y,Z]=ph3(me.x,me.y,.6); burst3(X,Y,Z,'#fff3b0',34,3,{glow:true}); sendPresence(true); }
function dismount(){ if(!me||!me.mounted) return; me.mounted=0; const [X,Y,Z]=ph3(me.x,me.y,.4); burst3(X,Y,Z,'#c8b48a',16,2,{grav:-4}); sendPresence(true); }

/* ---------- emotes ---------- */
function doEmote(k){ if(!me||me.dead||!EMOTES[k]) return; if(me.mounted&&k!=='wave'&&k!=='cheer') dismount(); me.emote={k,t0:now()}; chatLine(`${me.c.name} ${EMOTES[k]}`,'c-say'); sendPresence(true); }

/* ---------- discovery ---------- */
function checkDiscover(){ for(const p of POIS){ if(Math.hypot(me.x/TS-p.x,me.y/TS-p.y)>=p.r) continue;
  if(!me.c.disc.includes(p.id)){ me.c.disc.push(p.id); const xp=30+20*me.c.lvl; toast('Discovered: '+p.name); sysMsg(`Discovered ${p.name}. (+${xp} xp)`,'c-xp'); gainXp(xp); persist(); }
  questEvent('explore',p.id,1); } }

/* ---------- weather ---------- */
function weatherNow(){ if(typeof gm!=='undefined'&&gm.wx!==null) return {kind:gm.wx,k:gm.wx?1:0}; const P=420000, n=Date.now(); const seg=Math.floor(n/P), ph=(n%P)/P; const h=hash2(seg,7,99); const kind=h<.46?0:h<.64?1:h<.88?2:3; return {kind,k:kind?clamp(Math.min(ph,1-ph)/.04,0,1):0}; }
let flash=0, boltT=0, lastWx=-1;

/* ---------- critters ---------- */
function updateCritters(dt){ for(const c of CRITTERS){ if(c.k==='flock') continue; if(Math.hypot(c.x/TS-CAM.tx,c.y/TS-CAM.tz)>70) continue; c.t-=dt; const ox=c.x, oy=c.y;
  let th=null; if(me&&!me.dead&&dist(me.x,me.y,c.x,c.y)<(c.k==='frog'?80:c.k==='rabbit'?150:210)) th={x:me.x,y:me.y};
  for(const o of others.values()) if(dist(o.rx,o.ry,c.x,c.y)<140) th={x:o.rx,y:o.ry};
  const spd={deer:62,rabbit:50,frog:26}[c.k];
  if(th){ const a=Math.atan2(c.y-th.y,c.x-th.x)+(Math.sin(now()+c.sx)*.4); c.face=a; moveEnt(c,Math.cos(a)*spd*2.7*dt,Math.sin(a)*spd*2.7*dt,8); c.st=2; c.t=1.2; }
  else if(c.t<=0){ if(c.st){ c.st=0; c.t=2+Math.random()*5; } else { c.st=1; c.t=1.5+Math.random()*3; c.face=dist(c.x,c.y,c.sx,c.sy)>420?Math.atan2(c.sy-c.y,c.sx-c.x):Math.random()*6.28; } }
  else if(c.st===1) moveEnt(c,Math.cos(c.face)*spd*dt,Math.sin(c.face)*spd*dt,8);
  const dm=dist(ox,oy,c.x,c.y); c.walkP+=dm/TS*3.6; c.mv=lerp(c.mv,dm>.15?1:0,Math.min(1,dt*8)); } }

/* ---------- per-frame world tick ---------- */
let discT=0, buffT=0;
function worldTick(dt){
  const t=now(); updateCritters(dt);
  const WX=weatherNow(); const shownWx=WX.kind>=2&&WX.k<.35?Math.min(1,lastWx<0?WX.kind:lastWx):WX.kind; if(shownWx!==lastWx){ if(lastWx>=0&&me){ const fz=zoneAtPx(me.x,me.y)==='frost'; const msg=['The skies clear.','Clouds roll in.',fz?'Snow begins to fall.':'It begins to rain.',fz?'A blizzard sweeps in!':'A storm breaks overhead!'][shownWx]; sysMsg(msg); } lastWx=shownWx; }
  if(WX.kind===3&&WX.k>.5&&me&&zoneAtPx(me.x,me.y)!=='ash'){ boltT-=dt; if(boltT<=0){ boltT=6+Math.random()*12; flash=1; setTimeout(()=>shake(2.5),500+Math.random()*900); } }
  flash=Math.max(0,flash-dt*2.8);
  if(!me) return;
  if(me.sanct&&!me.dead){ const S=me.sanct; if(t>S.until) me.sanct=null; else if(t>=S.next){ S.next+=1; const h=Math.round(scaleV([10,3.2])); if(dist(me.x,me.y,S.x,S.y)<S.r) healMe(h); for(const o of others.values()) if(!o.d&&dist(o.x,o.y,S.x,S.y)<S.r) pushAct(1,o.u,h,0); pushAct(6,0,S.r,21,S.x,S.y); areaFx(21,S.x,S.y,S.r); } }
  discT-=dt; if(discT<=0){ discT=.5; checkDiscover(); }
  buffT-=dt; if(buffT<=0){ buffT=1; let ch=false; for(const k in me.c.buffs){ if(me.c.buffs[k]&&me.c.buffs[k]<=Date.now()){ delete me.c.buffs[k]; ch=true; sysMsg(`${BUFFNAME[k][0]} has worn off.`); } } if(ch){ recalc(); persist(); } renderBuffs(); }
  if(me.mounted&&isSwimming()) dismount();
  if(me.moving&&me.emote) { me.emote=null; sendPresence(true); }
  if(isSwimming()&&me.moving&&Math.random()<dt*10){ P3(me.x/TS+(Math.random()-.5)*.6,WATER_Y+.03,me.y/TS+(Math.random()-.5)*.6,0,.15,0,.9,.25,'#e8f4ff',{big:true,drag:.95}); }
  const wet=(WX.kind>=2?WX.k:0); if(wet>0&&zoneAtPx(me.x,me.y)!=='ash'){ const fz=zoneAtPx(me.x,me.y)==='frost'; for(let i=0;i<Math.floor(wet*(WX.kind===3?60:35));i++){ const X=CAM.tx+(Math.random()-.5)*30, Z=CAM.tz+(Math.random()-.5)*30; P3(X,hgt(X,Z)+6+Math.random()*6,Z,fz?(Math.random()-.5)*.6:-.6,fz?-2.2:-16,fz?(Math.random()-.5)*.6:0,fz?3:.55,fz?.07:.045,fz?'#ffffff':'#c8d8ee',{drag:1}); } for(let i=0;i<Math.floor(wet*40*dt*10);i++){ const X=CAM.tx+(Math.random()-.5)*24, Z=CAM.tz+(Math.random()-.5)*24; const y=hgt(X,Z); P3(X,Math.max(y,WATER_Y)+.05,Z,0,.6,0,.25,.05,'#cfe2ff',{drag:.9}); } }
}

function partyDlg(){
  dlg(`<h2>Party</h2><p>Players who join the same party name share kill credit, quest progress and party chat. Tell your friends the name.</p>
    <div class="row" style="display:flex;gap:8px"><input id="ptIn" maxlength="20" placeholder="party name" style="flex:1" value="${esc(me.party||'')}"><button id="ptJoin">Join</button></div>
    <div class="btns" style="margin-top:12px">${me.party?'<button id="ptLeave">Leave party</button>':''}<button id="ptRand">Make one for me</button></div>`);
  $('ptJoin').onclick=()=>{ joinParty($('ptIn').value); closeDlg(); };
  $('ptRand').onclick=()=>{ joinParty(['ember','ash','oak','wolf','dawn','mire'][Math.random()*6|0]+'-'+rid(3)); closeDlg(); };
  if(me.party) $('ptLeave').onclick=()=>{ joinParty(''); closeDlg(); };
  setTimeout(()=>$('ptIn')&&$('ptIn').focus(),30);
}
function joinParty(name,quiet){ name=clean(name).trim().toLowerCase().replace(/[^a-z0-9 _-]/g,'').slice(0,20);
  const had=me.party; me.party=name; if(name) stat('partied',1); if(!name) me.lead=0; else if(!quiet&&!partyMembers().length) me.lead=1; saves.party=name; saveAll(saves); if(quiet){ sendPresence(true); renderPartyWin(); return; } if(!name&&had) banner('You left the party'); if(name) sysMsg(`You joined the party "${name}". Friends can type /party ${name} to join.`); else sysMsg('You left your party.'); sendPresence(true); }
function sendChat(raw){
  let txt=clean(raw).trim(); if(!txt) return;
  if(txt[0]==='/'){ const [cmd,...rest]=txt.slice(1).split(' '); const arg=rest.join(' ').trim();
    if(cmd==='p'||cmd==='party'&&!arg){ if(cmd==='party') return partyDlg(); if(!me.party) return sysMsg('You are not in a party. Use /party name','c-err'); return sayChat(arg,1); }
    if(cmd==='invite'||cmd==='inv') return arg?inviteTo(findPlayer(arg)):sysMsg('Usage: /invite <player name>','c-err');
    if(cmd==='kick'){ const o=findPlayer(arg); return o?kickMember(o):err('Player not found'); }
    if(GMCMDS.has(cmd)) return gmCmd(cmd,arg);
    if(EMOTES[cmd]) return doEmote(cmd);
    if(cmd==='party'||cmd==='join'||cmd==='invite') return joinParty(arg);
    if(cmd==='leave') return joinParty('');
    if(cmd==='s'||cmd==='say') return sayChat(arg,0);
    if(cmd==='who') return toggleWin('whoWin',true);
    if(cmd==='help') return toggleWin('helpWin',true);
    return sysMsg('Commands: /p msg · /invite name · /kick name · /party name · /leave · /who · /help · /dance /wave /sit /cheer /bow /kneel'+(isGM?' · GM: /gm':''),'c-err');
  }
  sayChat(txt,0);
}
function sayChat(txt,ch){ txt=txt.slice(0,120); if(!txt) return; if(ch===2&&!isGM) ch=0; myChat.push([++chSeq,ch,txt]); if(myChat.length>3) myChat.shift();
  if(ch===2){ gmAnnounceShow(me.c.name,txt,isRealmOwner()?'owner':'gm'); if(gmSrc==='owner'&&room&&typeof room.emit==='function'){ myChat.pop(); room.emit('gm',{k:'ann',txt,role:'owner'}).catch(()=>{}); return; } sendPresence(true); return; }
  chatLine(txt, ch?'c-party':'c-say', ch?'[Party] ':'', {n:me.c.name,col:CLS[me.c.cls].col,gm:isGM}); if(!ch){ me.bubble=txt; me.bubbleT=now()+6; } sendPresence(true); }

/* ---------- painted spell icons (SVG, drawn in code) ---------- */
const ISCHOOL={phys:['#f2b38a','#5a1a10'],steel:['#bcd4f4','#1a2a4a'],holy:['#fff4b0','#8a5a08'],life:['#d8ffb0','#1f5a14'],arcane:['#f0c0ff','#3a1060'],fire:['#ffe080','#7a1a04'],frost:['#e0faff','#0e3a6a'],storm:['#e8f0ff','#1a2060'],shadow:['#c0a0d8','#140a20'],potion:['#ffb0b0','#4a0a10'],mount:['#f0d8a8','#4a2a10']};
function starPts(cx,cy,r1,r2,n,rot){ let s=''; for(let i=0;i<n*2;i++){ const a=(rot||0)+i*Math.PI/n, r=i%2?r2:r1; s+=(cx+Math.sin(a)*r).toFixed(1)+','+(cy-Math.cos(a)*r).toFixed(1)+' '; } return s; }
const OL='stroke="#120a06" stroke-width="1.6" stroke-linejoin="round"';
const ICONS={
  strike:['phys',`<path d="M12 22 Q30 4 54 28" stroke="#ff7a4a" stroke-width="4" fill="none" opacity=".75" filter="url(#igl)"/><path d="M50 7 L57 7 L57 14 L27 44 L20 37 Z" fill="#eef3fa" ${OL}/><path d="M53 9 L28 39" stroke="#9fb0c8" stroke-width="1.4"/><path d="M13 35 L29 51 L25 55 L9 39Z" fill="#d8ac4a" ${OL}/><path d="M17 45 L19 47 L10 56 L8 54Z" fill="#6a4020" ${OL}/><circle cx="8" cy="57" r="3" fill="#d8ac4a" ${OL}/>`],
  bash:['steel',`<polygon points="${starPts(47,17,15,6,8,.2)}" fill="#ffe27a" filter="url(#igl)"/><path d="M28 12 L46 18 L44 37 Q40 51 28 57 Q16 51 12 37 L10 18Z" fill="#8fa8cc" ${OL}/><path d="M28 17 L41 21 L39 36 Q36 46 28 51 Q20 46 17 36 L15 21Z" fill="#3d5a8a"/><path d="M28 22 L28 47 M19 31 L37 31" stroke="#ffd56a" stroke-width="3.5"/>`],
  taunt:['phys',`<polygon points="${starPts(32,32,28,16,12)}" fill="#ff5a2a" opacity=".55" filter="url(#igl)"/><path d="M14 20 Q6 32 14 44 M50 20 Q58 32 50 44 M9 14 Q-2 32 9 50 M55 14 Q66 32 55 50" stroke="#ffd0a0" stroke-width="2.5" fill="none" opacity=".8"/><path d="M27 10 L37 10 L35 38 L29 38Z" fill="#fff2d0" ${OL}/><circle cx="32" cy="48" r="5" fill="#fff2d0" ${OL}/>`],
  bulwark:['steel',`<circle cx="32" cy="33" r="27" fill="none" stroke="#9fdcff" stroke-width="3" opacity=".7" filter="url(#igl)"/><path d="M32 8 L54 15 L52 36 Q47 52 32 59 Q17 52 12 36 L10 15Z" fill="#d8b04a" ${OL}/><path d="M32 13 L49 18 L47 35 Q43 47 32 53 Q21 47 17 35 L15 18Z" fill="#2c4a86"/><path d="M32 18 L44 22 L42 34 Q39 42 32 46Z" fill="#5a86d0"/><circle cx="32" cy="31" r="5" fill="#ffd56a" ${OL}/>`],
  whirl:['phys',`<circle cx="32" cy="32" r="22" fill="none" stroke="#ffb07a" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>${[0,120,240].map(r=>`<g transform="rotate(${r} 32 32)"><path d="M32 30 Q44 10 58 14 Q46 18 36 34Z" fill="#e8eef6" ${OL}/></g>`).join('')}<circle cx="32" cy="32" r="6" fill="#d8ac4a" ${OL}/>`],
  charge:['phys',`<path d="M6 22 L26 22 M2 32 L22 32 M6 42 L26 42" stroke="#ffd0a0" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M24 20 L42 20 L42 10 L60 32 L42 54 L42 44 L24 44Z" fill="#ff9a4a" ${OL}/><path d="M28 24 L44 24 L44 18 L55 32" stroke="#ffe0a0" stroke-width="2" fill="none"/>`],
  rally:['phys',`<path d="M44 14 Q58 32 44 50 M50 8 Q68 32 50 56" stroke="#ffe0a0" stroke-width="2.5" fill="none" opacity=".85" filter="url(#igl)"/><path d="M8 40 Q14 38 38 16 L44 22 L44 46 L38 50 Q20 40 12 46Z" fill="#d8ac4a" ${OL}/><path d="M38 16 L44 22 L44 46 L38 50Z" fill="#8a5a1a" ${OL}/><path d="M12 42 L20 36" stroke="#fff2c0" stroke-width="2"/>`],
  avatar:['steel',`<polygon points="${starPts(32,32,30,20,16)}" fill="#9fe0ff" opacity=".45" filter="url(#igl)"/><path d="M16 36 Q16 12 32 10 Q48 12 48 36 L44 50 L20 50Z" fill="#c8d6ea" ${OL}/><path d="M20 30 L30 30 L30 36 L20 34Z M44 30 L34 30 L34 36 L44 34Z" fill="#7ef0ff" filter="url(#igl)"/><path d="M32 10 L32 50" stroke="#7a8aa8" stroke-width="2"/><path d="M34 2 L26 24 L33 24 L28 40 L40 18 L33 18Z" fill="#fff4a0" ${OL}/>`],
  smite:['holy',`<circle cx="46" cy="18" r="11" fill="#fff8d0" filter="url(#igl)"/><polygon points="${starPts(46,18,16,10,10)}" fill="#ffd34a" opacity=".7"/><path d="M40 22 L8 56 L14 58 L46 26Z" fill="#fffbe0" filter="url(#igl)"/><path d="M42 21 L10 55" stroke="#ffffff" stroke-width="2"/>`],
  mend:['life',`<circle cx="32" cy="32" r="22" fill="#fff6a0" opacity=".35" filter="url(#igl)"/><path d="M25 10 L39 10 L39 25 L54 25 L54 39 L39 39 L39 54 L25 54 L25 39 L10 39 L10 25 L25 25Z" fill="#fff0a0" ${OL}/><path d="M28 14 L36 14 L36 28 L50 28 L50 33 L28 33Z" fill="#ffffff" opacity=".7"/>`],
  bloom:['life',`<path d="M32 60 Q30 46 32 36" stroke="#3a8a2a" stroke-width="3" fill="none"/><path d="M32 50 Q20 44 18 50 Q24 56 32 50Z" fill="#5ac84a" ${OL}/>${[0,72,144,216,288].map(r=>`<g transform="rotate(${r} 32 28)"><ellipse cx="32" cy="16" rx="7" ry="11" fill="#ff8ac8" ${OL}/></g>`).join('')}<circle cx="32" cy="28" r="6" fill="#ffe27a" ${OL}/><circle cx="14" cy="14" r="2" fill="#fff" filter="url(#igl)"/><circle cx="52" cy="44" r="1.6" fill="#fff" filter="url(#igl)"/>`],
  radiance:['holy',`<polygon points="${starPts(32,32,30,12,12)}" fill="#ffd34a" ${OL}/><polygon points="${starPts(32,32,22,9,12,.26)}" fill="#fff4a0"/><circle cx="32" cy="32" r="9" fill="#ffffff" filter="url(#igl)"/>`],
  aegis:['holy',`<circle cx="32" cy="32" r="24" fill="#bfe8ff" opacity=".35" stroke="#e8f8ff" stroke-width="2.5"/><path d="M14 26 Q22 12 36 12" stroke="#ffffff" stroke-width="3" fill="none" opacity=".8"/><polygon points="${starPts(32,33,14,14,6)}" fill="none" stroke="#ffd34a" stroke-width="2.5"/><circle cx="32" cy="27" r="4" fill="#fff4d0" ${OL}/><path d="M25 44 Q32 30 39 44Z" fill="#fff4d0" ${OL}/>`],
  dawn:['holy',`<ellipse cx="32" cy="52" rx="24" ry="7" fill="none" stroke="#ffd34a" stroke-width="2.5"/><ellipse cx="32" cy="52" rx="15" ry="4" fill="#fff4a0" opacity=".6"/><path d="M22 0 L42 0 L38 52 L26 52Z" fill="#fffbe0" opacity=".9" filter="url(#igl)"/><path d="M29 0 L35 0 L34 52 L30 52Z" fill="#ffffff"/>`],
  guardian:['holy',`<ellipse cx="32" cy="12" rx="10" ry="3.5" fill="none" stroke="#fff4a0" stroke-width="2.5" filter="url(#igl)"/><path d="M30 24 Q12 14 4 26 Q8 30 6 36 Q14 34 14 40 Q22 38 24 44 Q28 36 30 34Z" fill="#ffffff" ${OL}/><path d="M34 24 Q52 14 60 26 Q56 30 58 36 Q50 34 50 40 Q42 38 40 44 Q36 36 34 34Z" fill="#ffffff" ${OL}/><circle cx="32" cy="22" r="5" fill="#ffe8b0" ${OL}/><path d="M26 56 Q32 28 38 56Z" fill="#ffe8b0" ${OL}/>`],
  sanct:['life',`<ellipse cx="32" cy="48" rx="27" ry="10" fill="#fff4a0" opacity=".3" stroke="#ffd34a" stroke-width="2"/><ellipse cx="32" cy="48" rx="18" ry="6" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M14 46 L14 22 M24 48 L24 14 M40 48 L40 14 M50 46 L50 22" stroke="#fffbe0" stroke-width="3" stroke-linecap="round" opacity=".85" filter="url(#igl)"/><path d="M20 26 Q32 18 44 26 Q38 24 34 30 Q32 22 26 28Z" fill="#ffffff" ${OL}/>`],
  ember:['fire',`<path d="M8 56 Q16 44 26 40" stroke="#ff7a1a" stroke-width="5" stroke-linecap="round" opacity=".6"/><path d="M40 8 Q58 22 52 40 Q46 56 30 54 Q14 50 18 34 Q22 26 30 28 Q26 18 40 8Z" fill="#ff6a12" ${OL}/><path d="M38 20 Q50 30 46 42 Q40 50 32 48 Q24 44 28 36 Q34 38 38 20Z" fill="#ffc23a"/><circle cx="36" cy="40" r="5" fill="#fff6c0" filter="url(#igl)"/>`],
  lance:['arcane',`<path d="M10 54 L46 18" stroke="#d8a0ff" stroke-width="7" stroke-linecap="round" opacity=".55" filter="url(#igl)"/><path d="M10 54 L46 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/><polygon points="${starPts(48,16,14,4,4,.4)}" fill="#f4dcff" ${OL}/><circle cx="48" cy="16" r="3.5" fill="#ffffff" filter="url(#igl)"/><circle cx="18" cy="30" r="1.8" fill="#fff"/><circle cx="34" cy="50" r="1.5" fill="#fff"/>`],
  nova:['frost',`<circle cx="32" cy="32" r="26" fill="#9fe8ff" opacity=".25" filter="url(#igl)"/>${[0,60,120].map(r=>`<g transform="rotate(${r} 32 32)"><path d="M32 4 L32 60 M32 12 L26 6 M32 12 L38 6 M32 52 L26 58 M32 52 L38 58 M32 20 L25 15 M32 20 L39 15 M32 44 L25 49 M32 44 L39 49" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/></g>`).join('')}<polygon points="${starPts(32,32,7,4,6)}" fill="#bff4ff" ${OL}/>`],
  blink:['arcane',`<path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16" stroke="#e8c0ff" stroke-width="3" fill="none" filter="url(#igl)"/><path d="M40 8 L58 8 L58 26" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 8 L44 22" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`],
  meteor:['fire',`<path d="M60 4 L30 30 M52 2 L26 26 M62 14 L36 36" stroke="#ffb03a" stroke-width="6" stroke-linecap="round" opacity=".7" filter="url(#igl)"/><path d="M58 6 L32 30" stroke="#fff0a0" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="40" r="15" fill="#5a3020" ${OL}/><path d="M14 36 Q18 30 24 32 M26 46 Q30 44 32 48 M18 46 L20 48" stroke="#ff6a1a" stroke-width="2.5" fill="none"/><path d="M28 28 Q38 32 38 42" stroke="#ffc23a" stroke-width="3" fill="none"/>`],
  chain:['storm',`<path d="M38 2 L14 34 L28 34 L20 62 L50 24 L34 24 L44 2Z" fill="#bcd8ff" opacity=".6" filter="url(#igl)"/><path d="M38 4 L16 33 L29 33 L22 58 L47 26 L33 26 L42 4Z" fill="#ffffff" ${OL}/><circle cx="10" cy="14" r="3" fill="#e8f0ff" filter="url(#igl)"/><circle cx="54" cy="52" r="3" fill="#e8f0ff" filter="url(#igl)"/>`],
  blizzard:['frost',`<path d="M12 28 Q8 18 18 16 Q20 6 32 8 Q42 4 46 14 Q58 14 54 26 Z" fill="#e8f4ff" ${OL}/><path d="M16 22 Q28 18 50 22" stroke="#9fc0e0" stroke-width="2" fill="none"/>${[[16,36],[30,40],[44,34],[22,50],[38,54],[50,48]].map(([x,y])=>`<path d="M${x} ${y} l3 -8 l3 8 l-3 4z" fill="#bff4ff" ${OL}/>`).join('')}`],
  phoenix:['fire',`<path d="M32 60 Q28 46 32 36 Q36 46 32 60Z" fill="#ffc23a" ${OL}/><path d="M30 34 Q16 30 4 10 Q14 14 18 10 Q22 22 30 26Z" fill="#ff6a12" ${OL}/><path d="M34 34 Q48 30 60 10 Q50 14 46 10 Q42 22 34 26Z" fill="#ff6a12" ${OL}/><path d="M28 30 Q14 26 10 16 Q20 22 28 24Z M36 30 Q50 26 54 16 Q44 22 36 24Z" fill="#ffd34a"/><ellipse cx="32" cy="30" rx="5" ry="9" fill="#ffb03a" ${OL}/><circle cx="32" cy="20" r="4.5" fill="#ffe27a" ${OL}/><circle cx="32" cy="30" r="3" fill="#fff6c0" filter="url(#igl)"/>`],
  potion:['potion',`<path d="M26 6 L38 6 L38 10 L36 10 L36 22 Q52 28 50 44 Q48 58 32 58 Q16 58 14 44 Q12 28 28 22 L28 10 L26 10Z" fill="#d8e8f0" opacity=".9" ${OL}/><path d="M17 40 Q18 30 32 30 Q46 30 47 40 Q46 54 32 55 Q18 54 17 40Z" fill="#e8203a"/><ellipse cx="25" cy="38" rx="3" ry="5" fill="#ffb0b8" opacity=".8"/><rect x="26" y="2" width="12" height="7" rx="2" fill="#8a5a2a" ${OL}/>`],
  mount:['mount',`<path d="M16 54 L16 30 Q16 10 32 10 Q48 10 48 30 L48 54 L38 54 L38 30 Q38 22 32 22 Q26 22 26 30 L26 54Z" fill="#c8ccd4" ${OL}/>${[[20,32],[20,44],[44,32],[44,44]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="#3a3a44"/>`).join('')}`]
};
function iconSVG(id){ const d=ICONS[id]; if(!d) return null; const [a,b]=ISCHOOL[d[0]];
  return `<svg class="sv" viewBox="0 0 64 64"><defs><radialGradient id="ig_${id}" cx="38%" cy="30%" r="85%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="64" height="64" fill="url(#ig_${id})"/>${d[1]}<rect x="0" y="0" width="64" height="64" fill="url(#igloss)"/></svg>`; }
const abilIcon=ab=>iconSVG(ab.id)||ab.icon;
(function(){ const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('width','0'); s.setAttribute('height','0'); s.style.position='absolute';
  s.innerHTML='<defs><filter id="igl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="igloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".42" stop-color="#fff" stop-opacity=".04"/><stop offset=".43" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>';
  document.body.appendChild(s); })();

/* =====================================================================
   GAME MASTER TOOLS — only GMs can use these
   ===================================================================== */
let isGM=false, gmSrc='';
const gm={god:false,nocd:false,fly:false,speed:1,tOff:null,wx:null};
const GMCMDS=new Set(['gift','movegm','boot','ban','unban','aura','invis','makegm','removegm','gmlist','gm','gold','level','levelup','xp','god','nocd','fly','speed','tp','heal','revive','item','mats','mount','kill','time','weather','questdone','announce']);
let ownerOK=false, ownerSrc='';
function gmCharId(){ const RL=rosterList(); if(!saves.gmChar||!RL.some(c=>c.id===saves.gmChar)){ const S=RL.slice().sort((a,b)=>(b.lvl||1)-(a.lvl||1)||(a.created||a.lastT||0)-(b.created||b.lastT||0)); if(S[0]){ saves.gmChar=S[0].id; saveAll(saves); } } return saves.gmChar; }
function myGid(){ return me?MY_PID+':'+me.c.name.toLowerCase():''; }
function applyOwner(){ if(!ownerOK||!me) return; const want=me.c.id===gmCharId(); if(want&&!isGM) setGM(true,ownerSrc,true); else if(!want&&isGM&&gmSrc===ownerSrc){ setGM(false,ownerSrc,true); gm.god=gm.nocd=gm.fly=gm.invis=gm.aura=false; gm.speed=1; } }
function setGM(on,src,direct){ if(!direct&&on&&(src==='owner'||src==='master'||src==='solo')){ ownerOK=true; ownerSrc=src; gmSrc=src; applyOwner(); return; }
  const was=isGM; isGM=!!on; gmSrc=src||gmSrc; const b=document.getElementById('gmBtn'); if(b) b.classList.toggle('hidden',!isGM);
  if(isGM&&!was&&me){ sysMsg('You are a Game Master. Type /gm for your command list.','c-gm'); sendPresence(true); } }
const gmOk=t=>chatLine(t,'c-gm','[GM] ');
const RARN=['common','uncommon','rare','epic','legendary'];
function gmSetLevel(v){ const c=me.c; v=clamp(Math.round(v),1,MAXLVL); const up=v>c.lvl; c.lvl=v; c.xp=0; recalc(); me.hp=me.mhp; if(CLS[c.cls].res==='mana') me.res=me.mres;
  buildBar(); renderInv(); renderTracker(); persist(); sendPresence(true); if(up){ toast(`Level ${v}!`); burst(me.x,me.y,'#ffd66a',40,200,{glow:true}); } gmOk('Level set to '+v+'.'); }
function gmRevive(){ if(!me.dead) return; me.dead=false; me.rootU=0; document.getElementById('deathWin').classList.add('hidden'); me.hp=me.mhp; sparkle(me.x,me.y,'#fff3b0'); sendPresence(true); }
function gmPlaces(){ const out=[{n:'Hearthmere (town)',k:['town','home','hearthmere','spawn'],x:SPAWN.x,y:SPAWN.y}];
  for(const p of POIS) out.push({n:p.name,k:[p.id,p.name.toLowerCase()],x:p.x*TS+16,y:p.y*TS+16});
  for(const n of NPCS) out.push({n:n.name+' (NPC)',k:[n.id,n.name.toLowerCase()],x:n.x,y:n.y+40});
  for(const m of MOBT) if(m.pos&&(m.boss||m.elite)) out.push({n:m.name+' (boss)',k:[m.key,m.name.toLowerCase()],x:m.pos[0]*TS+16,y:m.pos[1]*TS+16+180});
  return out; }
function gmTpTo(x,y,label){ x=clamp(x,24,MW*TS-24); y=clamp(y,24,MH*TS-24);
  if(blockedP(x,y,10)){ let best=null; for(let r=16;r<480&&!best;r+=16) for(let a=0;a<16;a++){ const X=x+Math.cos(a/16*Math.PI*2)*r, Y=y+Math.sin(a/16*Math.PI*2)*r; if(!blockedP(X,Y,10)){ best=[X,Y]; break; } } if(best){ x=best[0]; y=best[1]; } }
  const [X0,Y0,Z0]=ph3(me.x,me.y,.6); burst3(X0,Y0,Z0,'#b07cff',30,3,{glow:true});
  me.x=x; me.y=y; me.dash=null; me.cast=null; me.target=null; const [X,Y,Z]=ph3(x,y,.6); burst3(X,Y,Z,'#b07cff',40,3,{glow:true});
  CAM.tx=x/TS; CAM.tz=y/TS; sendPresence(true); gmOk('Teleported to '+(label||`${Math.round(x/TS)}, ${Math.round(y/TS)}`)+'.'); }
function gmTeleport(arg){ const a=arg.trim().toLowerCase(); if(!a) return gmOk('Usage: /tp x y (tiles) · /tp town · /tp <place, NPC, boss or player>. Or Shift+click the world map.');
  const nums=a.split(/[\s,]+/).map(Number); if(nums.length===2&&nums.every(isFinite)) return gmTpTo(nums[0]*TS+16,nums[1]*TS+16);
  for(const o of others.values()) if(o.n.toLowerCase()===a||o.n.toLowerCase().startsWith(a)) return gmTpTo(o.x+30,o.y,o.n);
  const pl=gmPlaces(); const hit=pl.find(p=>p.k.includes(a))||pl.find(p=>p.k.some(k=>k.includes(a)));
  if(hit) return gmTpTo(hit.x,hit.y,hit.n);
  const z=Object.keys(ZONES).find(k=>k===a||ZONES[k].name.toLowerCase().includes(a));
  if(z){ let sx=0,sy=0,n=0; for(let i=0;i<zmap.length;i+=7) if(zmap[i]===z){ sx+=i%MW; sy+=(i/MW|0); n++; } if(n) return gmTpTo(sx/n*TS,sy/n*TS,ZONES[z].name); }
  chatLine(`No place or player called "${arg}".`,'c-err'); }
function gmKill(arg){ const t=now(); let list=[];
  if(/^(all|area|near)/.test(arg)) list=mobs.filter(m=>!m.dead&&dist(me.x,me.y,m.rx??m.x,m.ry??m.y)<420);
  else { const te=targetEnt(); if(te&&te.kind==='m'&&!te.e.dead) list=[te.e]; }
  if(!list.length) return chatLine('Target a monster first (or /kill all for everything nearby).','c-err');
  for(const m of list){ pushAct(0,m.id,Math.max(1,m.hp)+50,0); fct(m.rx,m.ry-26,'GM kill','#c78bff',true); }
  me.lastCombat=t; gmOk(`Smote ${list.length} monster${list.length>1?'s':''}.`); }
function gmCmd(cmd,arg){
  if(cmd==='gm'&&/^login\b/i.test(arg)) return gmLogin(arg.slice(5).trim());
  if(!isGM) return chatLine('You are not a Game Master.','c-err');
  const n=parseFloat(arg), c=me.c, has=isFinite(n);
  switch(cmd){
    case 'gm': return toggleGMWin(true);
    case 'gold': { const v=has?Math.round(n):1000; c.gold=Math.max(0,c.gold+v); renderInv(); persist(); return gmOk(`${v>=0?'Added':'Removed'} ${Math.abs(v)} gold. You now have ${c.gold}.`); }
    case 'level': return gmSetLevel(has?n:MAXLVL);
    case 'levelup': return gmSetLevel(c.lvl+(has?n:1));
    case 'xp': gainXp(Math.max(1,Math.round(has?n:1000))); buildBar(); renderTracker(); return;
    case 'god': gm.god=!gm.god; if(gm.god){ me.hp=me.mhp; me.res=me.mres; me.dots=[]; me.rootU=0; } renderGMWin(); return gmOk('God mode '+(gm.god?'ON: you take no damage and have unlimited '+CLS[c.cls].res+'.':'OFF.'));
    case 'nocd': gm.nocd=!gm.nocd; if(gm.nocd){ me.cds={}; me.gcd=0; } renderGMWin(); return gmOk('No cooldowns '+(gm.nocd?'ON.':'OFF.'));
    case 'fly': gm.fly=!gm.fly; renderGMWin(); return gmOk('Noclip '+(gm.fly?'ON: walk through walls, cliffs and water.':'OFF.'));
    case 'speed': gm.speed=clamp(has?n:1,.5,6); renderGMWin(); return gmOk('Run speed x'+gm.speed+'.');
    case 'tp': return gmTeleport(arg);
    case 'heal': gmRevive(); me.hp=me.mhp; me.res=me.mres; me.dots=[]; me.rootU=0; healMe(0); return gmOk('Fully healed.');
    case 'revive': if(!me.dead) return gmOk('You are not dead.'); gmRevive(); return gmOk('Revived where you stand.');
    case 'item': { const r=has?clamp(Math.round(n),0,4):Math.max(0,RARN.indexOf(arg.toLowerCase()))||3; if(c.inv.length>=18) return chatLine('Your bags are full.','c-err');
      const it=genItem(c.lvl,r); c.inv.push(it); renderInv(); persist(); chatLine(`You receive: [${it.name}]`,'c-loot t'+it.rar); return; }
    case 'mats': { const v=has?Math.round(n):10; for(const k in MATS) c.mats[k]=Math.max(0,(c.mats[k]||0)+v); renderInv(); persist(); return gmOk(`Added ${v} of every herb and ore.`); }
    case 'mount': c.mounts=MOUNTS.map((m,i)=>i).filter(i=>i>0); c.mount=c.mount||c.mounts[c.mounts.length-1]; persist(); return gmOk('All mounts unlocked. Press R to ride.');
    case 'kill': return gmKill(arg.toLowerCase());
    case 'time': { const a=arg.toLowerCase(); const ph={day:0,noon:0,dusk:.22,evening:.22,night:.5,midnight:.5,dawn:.78,morning:.85}[a];
      if(a==='auto'||a==='reset'||!a){ gm.tOff=null; return gmOk('Time of day follows the realm clock again (only on your screen).'); }
      if(ph===undefined) return chatLine('Use /time day, dusk, night, dawn or auto.','c-err'); gm.tOff=ph*600-(Date.now()/1000%600); return gmOk(`Time set to ${a} (only on your screen).`); }
    case 'weather': { const a=arg.toLowerCase(); const k={clear:0,sun:0,cloudy:1,clouds:1,rain:2,storm:3}[a];
      if(a==='auto'||a==='reset'||!a){ gm.wx=null; return gmOk('Weather follows the realm again.'); }
      if(k===undefined) return chatLine('Use /weather clear, cloudy, rain, storm or auto.','c-err'); gm.wx=k; return gmOk(`Weather set to ${a} (only on your screen).`); }
    case 'questdone': { let k=0; for(const q of activeQuests()){ const s=c.qs[q.id]; if(s&&s.st!=='done'){ s.st='done'; s.c=q.n||1; k++; } } renderTracker(); persist(); return gmOk(k?`Completed the objectives of ${k} quest${k>1?'s':''}. Return to the quest giver.`:'You have no unfinished quests.'); }
    case 'gift': return giftCmd(arg);
    case 'movegm': { if(!isRealmOwner()) return chatLine('Only the realm owner can do that.','c-err'); const ch=rosterList().find(c=>c.name.toLowerCase()===arg.toLowerCase());
      if(!ch) return chatLine('Usage: /movegm <one of YOUR character names on this device>','c-err'); saves.gmChar=ch.id; saveAll(saves); gmOk(`Your owner/GM powers now belong to ${ch.name}. Log in as ${ch.name} to use them.`); applyOwner(); return; }
    case 'boot': case 'ban': case 'unban': { if(!(room&&typeof room.admin==='function')) return chatLine('Removing and banning players works on your own server (see the README in the download).','c-err');
      if(!isRealmOwner()) return chatLine('Only the realm owner can do that.','c-err'); if(!arg) return chatLine(`Usage: /${cmd} <player name>`,'c-err'); const o=findPlayer(arg);
      if(!o&&cmd!=='unban') return chatLine(`No player called "${arg}" is online.`,'c-err'); room.admin(cmd,o?o.pid:'',o?o.n:arg); return gmOk(cmd==='boot'?`${o.n} was removed from the realm.`:cmd==='ban'?`${o.n} is banned.`:`${arg} is unbanned.`); }
    case 'aura': gm.aura=!gm.aura; sendPresence(true); renderGMWin(); return gmOk(gm.aura?'Your GM aura is ON. Other players can see it.':'Your GM aura is OFF.');
    case 'invis': gm.invis=!gm.invis; sendPresence(true); renderGMWin(); return gmOk(gm.invis?'You are now INVISIBLE. Other players cannot see you, and monsters ignore you.':'You are visible again.');
    case 'makegm': if(!arg) return chatLine('Usage: /makegm <player name>','c-err'); return gmGrant(arg,true);
    case 'removegm': if(!arg) return chatLine('Usage: /removegm <player name>','c-err'); return gmGrant(arg,false);
    case 'gmlist': { const L=saves.gmGrants||[]; return gmOk(isRealmOwner()?(L.length?'Game Masters you appointed: '+L.map(g=>g.n).join(', '):'You have not appointed any Game Masters. Use /makegm <name>.'):'Only the realm owner manages the GM list.'); }
    case 'announce': if(!arg) return chatLine('Usage: /announce message','c-err'); return sayChat(arg,2);
  }
}
function gmAnnounceShow(name,txt,role){ const who=role==='owner'?'Server Owner':'GM'; chatLine(`${who} says: ${txt}`,'c-ann'); banner(`${who} says:`,txt,'ann'); sfx('accept'); }
function gmLogin(pw){ if(isGM) return gmOk('You are already a Game Master.');
  if(room&&typeof room.gmLogin==='function'){ if(!pw) return chatLine('Usage: /gm login <password>','c-err'); room.gmLogin(pw).then(ok=>{ if(ok){ setGM(true,room.master?'master':'server'); gmOk('Logged in as Game Master.'); } else chatLine('Wrong GM password (or the server has no GM_PASSWORD set).','c-err'); }); return; }
  chatLine('No GM login here. Start the server with GM_PASSWORD set (see README), or set soloGM: true in config.js for solo play.','c-err'); }
/* ---------- GM window ---------- */
function toggleGMWin(force){ if(!isGM) return chatLine('You are not a Game Master.','c-err'); const w=$('gmWin'); const show=force??w.classList.contains('hidden'); w.classList.toggle('hidden',!show); if(show) renderGMWin(); }
function renderGMWin(){ const w=$('gmWin'); if(!w||w.classList.contains('hidden')||!me) return; const on=v=>v?' class="on"':'';
  const B=(cmd,label,cls)=>`<button data-gm="${esc(cmd)}"${cls||''}>${label}</button>`;
  w.querySelector('.gmbody').innerHTML=`
  <div class="gmsec"><h4>Character</h4>${B('gold 1000','+1,000 gold')}${B('gold 10000','+10,000 gold')}${B('levelup 1','Level up')}${B('level '+MAXLVL,'Max level ('+MAXLVL+')')}${B('level 1','Reset to level 1')}${B('xp 5000','+5,000 XP')}${B('heal','Full heal')}${B('revive','Revive')}</div>
  <div class="gmsec"><h4>Cheats</h4>${B('aura','✦ Aura',on(gm.aura))}${B('invis','Invisible',on(gm.invis))}${B('god','God mode',on(gm.god))}${B('nocd','No cooldowns',on(gm.nocd))}${B('fly','Noclip',on(gm.fly))}<span class="gmspd">Speed <input type="range" id="gmSpeed" min="1" max="6" step=".5" value="${gm.speed}"> x<b>${gm.speed}</b></span></div>
  <div class="gmsec"><h4>Items</h4>${B('item 3','<span class="t3">Epic item</span>')}${B('item 2','<span class="t2">Rare item</span>')}${B('mats 10','+10 all herbs & ore')}${B('mount','Unlock all mounts')}</div>
  <div class="gmsec"><h4>World <small>(time and weather change only on your screen)</small></h4>${B('kill','Kill target')}${B('kill all','Kill everything nearby')}${B('questdone','Finish quest objectives')}${B('time day','☀ Day')}${B('time dusk','Dusk')}${B('time night','☾ Night')}${B('time auto','Clock')}${B('weather clear','Clear')}${B('weather rain','Rain')}${B('weather storm','Storm')}${B('weather auto','Realm weather')}</div>
  <div class="gmsec"><h4>Teleport <small>(or Shift+click the world map)</small></h4><div class="gmtp">${gmPlaces().map((p,i)=>`<button data-tpi="${i}">${esc(p.n)}</button>`).join('')}${[...others.values()].map(o=>`<button data-tpp="${esc(o.u)}" style="color:${CLS[o.c].col}">➜ ${esc(o.n)}</button>`).join('')}</div>
    <div class="gmrow">X <input id="gmTx" type="number" min="0" max="${MW-1}" value="${Math.round(me.x/TS)}"> Y <input id="gmTy" type="number" min="0" max="${MH-1}" value="${Math.round(me.y/TS)}"> <button id="gmTgo">Go</button></div></div>
  <div class="gmsec"><h4>Announce to everyone</h4><div class="gmrow"><input id="gmAnn" maxlength="120" placeholder="Server message…" style="flex:1"> <button id="gmAgo">Send</button></div></div>
  <div class="gmsec" style="font-size:13px;color:var(--dim)">Owner character on this device: <b style="color:#ff9a3a">${esc((rosterList().find(c=>c.id===saves.gmChar)||{}).name||'—')}</b>. Your other characters are normal players. Use <code>/movegm name</code> to move GM to another of your characters.</div>
  <div class="gmsec gmcmds"><h4>Chat commands</h4><code>/gold n</code> add gold · <code>/level n</code> set level · <code>/levelup n</code> · <code>/xp n</code> · <code>/god</code> · <code>/nocd</code> · <code>/fly</code> noclip · <code>/speed 1–6</code> · <code>/tp x y</code> · <code>/tp town</code> · <code>/tp place|npc|boss|player</code> · <code>/heal</code> · <code>/revive</code> · <code>/item 0–3</code> · <code>/mats n</code> · <code>/mount</code> · <code>/kill</code> · <code>/kill all</code> · <code>/time day|dusk|night|dawn|auto</code> · <code>/weather clear|cloudy|rain|storm|auto</code> · <code>/questdone</code> · <code>/announce msg</code> · <code>/gift name wings|aura|steed|supporter|founder|title text</code> (donation rewards; works even if they are offline) · <code>/aura</code> glowing GM aura · <code>/invis</code> invisible · <code>/makegm name</code> · <code>/removegm name</code> · <code>/gmlist</code> · <code>/boot name</code> · <code>/ban name</code> · <code>/unban name</code> (owner only; boot/ban need your own server) · <code>/gm</code> this window<div style="margin-top:6px">Everything you do with these tools is private: other players never see a GM tag or GM effects, only the result (for example, a monster dying). Time and weather change on your screen only.</div></div>`;
  w.querySelectorAll('[data-gm]').forEach(b=>b.onclick=()=>{ const [c,...r]=b.dataset.gm.split(' '); gmCmd(c,r.join(' ')); renderGMWin(); });
  const pl=gmPlaces(); w.querySelectorAll('[data-tpi]').forEach(b=>b.onclick=()=>{ const p=pl[+b.dataset.tpi]; gmTpTo(p.x,p.y,p.n); });
  w.querySelectorAll('[data-tpp]').forEach(b=>b.onclick=()=>{ const o=othersByU.get(b.dataset.tpp); if(o) gmTpTo(o.x+30,o.y,o.n); });
  $('gmSpeed').oninput=e=>{ gm.speed=+e.target.value; e.target.nextElementSibling.textContent=gm.speed; };
  $('gmTgo').onclick=()=>gmTpTo((+$('gmTx').value||0)*TS+16,(+$('gmTy').value||0)*TS+16);
  $('gmAgo').onclick=()=>{ const v=$('gmAnn').value.trim(); if(v){ gmCmd('announce',clean(v)); $('gmAnn').value=''; } };
  for(const id of ['gmTx','gmTy','gmAnn']) $(id).onkeydown=e=>e.stopPropagation();
}

/* =====================================================================
   v8 FEATURES: cast bar, boss encounters, loot bags, quest feedback,
   NPC life, parties, GM privacy
   ===================================================================== */
const seenO=o=>!o.iv||isGM;
/* ---------- cast bar ---------- */
let cbKey='', cbEnd=null;
function updateCastbar(t){ const cb=$('castbar'); const c=me.cast;
  if(c){ const ab=c.ab||{}; const k=(ab.id||'x')+c.t0; const nm=ab.name||'Casting';
    if(cbKey!==k){ cbKey=k; cb.className=''; cb.style.opacity=''; cb.querySelector('.cbic').innerHTML=c.mount?iconSVG('mount'):c.node?`<span class="cbe">${MATS[c.node.mat].icon}</span>`:(abilIcon(ab)||''); cb.querySelector('.cbn').textContent=nm; }
    const p=clamp((t-c.t0)/c.dur,0,1); cb.firstElementChild.style.width=(p*100)+'%'; cb.querySelector('.cbt').textContent=Math.max(0,c.dur-(t-c.t0)).toFixed(1)+'s'; cbEnd=null; return; }
  if(cbKey){ cbKey=''; const fail=me.castFail&&t-me.castFail<.3; cbEnd={t}; cb.className=fail?'fail':'done'; if(fail) cb.querySelector('.cbn').textContent=me.castFailMsg||'Interrupted'; cb.querySelector('.cbt').textContent=''; cb.firstElementChild.style.width='100%'; }
  if(cbEnd&&t-cbEnd.t<.5){ cb.style.opacity=String(1-(t-cbEnd.t)/.5); return; } cb.style.opacity=''; cb.classList.add('hidden'); }
function castFail(msg){ me.castFail=now(); me.castFailMsg=msg; }
/* ---------- quest feedback ---------- */
function qProg(text,done){ const el=$('qprog'); const d=document.createElement('div'); d.textContent=text; if(done) d.className='done'; el.appendChild(d); while(el.children.length>3) el.firstChild.remove(); setTimeout(()=>d.remove(),2600); }
function banner(title,sub,cls){ const el=$('qbanner'); el.innerHTML=''; const d=document.createElement('div'); d.className='qb '+(cls||''); const h=document.createElement('div'); h.className='qbt'; h.textContent=title; d.appendChild(h);
  if(sub){ const s=document.createElement('div'); s.className='qbs'; s.textContent=sub; d.appendChild(s); } el.appendChild(d); setTimeout(()=>d.classList.add('out'),2600); setTimeout(()=>d.remove(),3300); }
function coinFx(n){ if(!n) return; sfx('coin'); if(n>0) stat('goldEarned',n); fct(me.x,me.y-44,'+'+n+' gold','#ffd34a',true); const [X,Y,Z]=ph3(me.x,me.y,1.2); for(let i=0;i<Math.min(14,4+n);i++) P3(X,Y,Z,(Math.random()-.5)*3,2+Math.random()*2,(Math.random()-.5)*3,.8,.1,'#ffd34a',{glow:true,grav:-6}); bagPulse(); }
function bagPulse(){ const b=document.querySelector('#menuBtns [data-k="inv"]'); if(!b) return; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
/* ---------- loot bags ---------- */
const LOOTS=[]; let lootSeq=0, lootOpen=null;
function dropLoot(m,gold,items,pots){ if(!gold&&!items.length&&!pots) return; const L={id:++lootSeq,x:m.rx,y:m.ry,name:m.t.name,gold,items,pots,t:now(),boss:!!(m.t.boss||m.t.elite)};
  L.best=items.reduce((a,i)=>Math.max(a,i.rar),-1); LOOTS.push(L); if(LOOTS.length>14) LOOTS.shift();
  const [X,Y,Z]=ph3(L.x,L.y,.4); burst3(X,Y,Z,'#ffd34a',12,1.6,{glow:true,up:1}); }
function nearLoot(r){ let b=null,bd=r||100; for(const L of LOOTS){ const d=dist(me.x,me.y,L.x,L.y); if(d<bd){bd=d;b=L} } return b; }
function openLoot(L){ if(!L) return; if(me.mounted) dismount(); lootOpen=L; renderLoot(); }
function renderLoot(){ const w=$('lootWin'); const L=lootOpen; if(!L||!LOOTS.includes(L)){ w.classList.add('hidden'); lootOpen=null; return; }
  const rows=[]; if(L.gold) rows.push(`<div class="lrow" data-k="g"><span class="lic coin"></span><span class="lnm" style="color:#ffd34a">${L.gold} gold</span></div>`);
  if(L.pots) rows.push(`<div class="lrow" data-k="p"><span class="lic">${iconSVG('potion')}</span><span class="lnm">Healing Draught${L.pots>1?' ×'+L.pots:''}</span></div>`);
  L.items.forEach((it,i)=>rows.push(`<div class="lrow" data-k="i${i}"><span class="lic r${it.rar}">${itemSVG(it)}</span><span class="lnm t${it.rar}">${esc(it.name)}<small>${RAR[it.rar]} ${it.slot}</small></span></div>`));
  w.innerHTML=`<div class="lh"><span>${esc(L.name)}</span><button class="close" id="lootX">×</button></div><div class="lrows">${rows.join('')}</div><button id="lootAll" class="gold">Take all</button>`; w.classList.remove('hidden');
  $('lootX').onclick=()=>{ lootOpen=null; w.classList.add('hidden'); hideTip(); }; $('lootAll').onclick=()=>{ hideTip(); takeAll(L); };
  w.querySelectorAll('.lrow').forEach(r=>{ const k=r.dataset.k; r.onclick=()=>{ hideTip(); takeLoot(L,k); }; if(k[0]==='i'){ const it=L.items[+k.slice(1)]; r.onmouseenter=e=>showTip(e,itemTip(it,true)); r.onmouseleave=hideTip; } }); }
function takeLoot(L,k,quiet){ const c=me.c;
  if(k==='g'){ c.gold+=L.gold; coinFx(L.gold); chatLine(`You loot ${L.gold} gold.`,'c-loot'); L.gold=0; }
  else if(k==='p'){ c.pots+=L.pots; chatLine(`You loot ${L.pots} Healing Draught${L.pots>1?'s':''}.`,'c-loot'); L.pots=0; bagPulse(); }
  else { const i=+k.slice(1); const it=L.items[i]; if(!it) return false; if(c.inv.length>=18){ err('Your bags are full'); return false; } c.inv.push(it); L.items.splice(i,1); chatLine(`You receive loot: [${it.name}]`,'c-loot t'+it.rar); if(it.rar>=2) toast((it.rar===4?'★ ':'')+it.name,'small t'+it.rar); bagPulse(); }
  if(!L.gold&&!L.pots&&!L.items.length){ LOOTS.splice(LOOTS.indexOf(L),1); }
  if(!quiet){ renderInv(); persist(); renderLoot(); } return true; }
function takeAll(L){ if(L.gold) takeLoot(L,'g',1); if(L.pots) takeLoot(L,'p',1); while(L.items.length){ if(!takeLoot(L,'i0',1)) break; } renderInv(); persist(); renderLoot(); }
function drawLootBags(near,t){ for(let i=LOOTS.length-1;i>=0;i--){ const L=LOOTS[i]; if(t-L.t>180){ LOOTS.splice(i,1); if(lootOpen===L) renderLoot(); continue; } if(!near(L.x,L.y,40)) continue;
    const X=L.x/TS, Z=L.y/TS, y=groundY(L.x,L.y); const col=L.best>=3?[.78,.36,1]:L.best===2?[.3,.55,1]:L.best===1?[.3,.9,.35]:[1,.82,.3]; const bob=Math.sin(t*2+L.id)*.04;
    mreset(); mtr(X,y,Z); mry(L.id); P(GEO.sph,.62,.5,.58,[.5,.34,.18],0,0,.25+bob,0); P(GEO.sph,.5,.18,.48,[.42,.28,.14],0,0,.48+bob,0); P(GEO.cyl,.2,.12,.2,[.38,.24,.12],0,0,.6+bob,0); P(GEO.cyl,.22,.04,.22,[.85,.68,.3],.4,0,.56+bob,0);
    if(L.gold) for(let k=0;k<4;k++) P(GEO.cyl,.12,.03,.12,[1,.82,.3],.6,Math.cos(k*1.7)*.38,.02+k*.025,Math.sin(k*1.7)*.38);
    addLight(X,y+.8,Z,3.2,col.map(v=>v*1.2)); if(Math.random()<.12) P3(X+(Math.random()-.5)*.5,y+.6,Z+(Math.random()-.5)*.5,0,.7,0,1,.07,'#'+col.map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).join(''),{glow:true}); } }
/* ---------- boss encounters ---------- */
const BOSSY={
  oldtusk:{title:'Terror of Amberfield',pull:'*Old Tusk paws the ground and lets out a furious squeal!*',p50:'*Old Tusk goes into a frenzy!*',die:'*Old Tusk collapses with a final grunt.*'},
  fangmaw:{title:'Alpha of Thornwood',pull:'*Fangmaw howls, and the forest howls back.*',p50:'*Fangmaw\'s eyes burn red!*',die:'*The great wolf falls silent.*'},
  hking:{title:'Lord of Fallen Vael',pull:'"Who dares disturb the court of Vael? Kneel before your king!"',p50:'"My kingdom was ash before you were born!"',p20:'"I... will not... fall again!"',die:'"At last... the crown... is free..."'},
  wyrm:{title:'Scourge of the Caldera',pull:'"Little embers... I will add your bones to my hoard of ash!"',p50:'"You only feed the flame!"',p20:'"BURN! ALL OF YOU, BURN!"',die:'"The fire... goes... out..."'},
  frostgiant:{title:'Jarl of the Ice',pull:'"Southern worms! Hrimgar will crush you flat!"',p50:'"The mountain does not break!"',p20:'"RAAAAGH! HRIMGAR SMASH!"',die:'"The ice... takes me home..."'},
  lich:{title:'Master of Hollowdeep',pull:'"The living trespass in my halls. Kneel, and be preserved forever."',p50:'"Rise, my servants! Rise and feast!"',p20:'"Death is only the beginning!"',die:'"This... is not... the end..."'}};
const TELNAME={1:'Ground Slam',2:'Crushing Blow',3:'Flame Breath',4:'Meteor',5:'Shadow Nova',6:'Frost Orb',7:'Death Nova'};
let bossEng=null;
function bossYell(m,line,big){ if(!line) return; const say=line[0]==='*'; chatLine(say?line.replace(/\*/g,''):`${m.t.name} yells: ${line}`,'c-yell'); m.bubble=line.replace(/\*/g,''); m.bubbleT=now()+5; if(big) shake(4); }
function updateBoss(t){ const bf=$('bossFrame'); let b=null,bd=1e9;
  for(const m of mobs){ if(m.dead||!(m.t.boss||m.t.elite)||m.t.summon) continue; const d=dist(me.x,me.y,m.rx,m.ry); if(d>1100) continue;
    const mine=m.tgt&&(m.tgt===MY_U||(othersByU.get(m.tgt)&&me.party&&othersByU.get(m.tgt).pt===me.party)); const eng=mine||(m.tag&&m.hp<m.mhp&&d<700)||(me.target&&me.target.kind==='m'&&me.target.id===m.id&&d<700);
    if(eng&&d<bd){ bd=d; b=m; } }
  if(bossEng&&(!b||b!==bossEng.m)){ if(!bossEng.m.dead&&dist(me.x,me.y,bossEng.m.rx,bossEng.m.ry)<1400&&bossEng.m.tgt) b=b||bossEng.m; else if(!bossEng.m.dead) bossEng=null; }
  if(!b){ bf.classList.add('hidden'); return; }
  if(!bossEng||bossEng.m!==b){ bossEng={m:b,said:{}}; if(b.t.boss) sfx('boss'); const Y=BOSSY[b.t.key]; if(b.t.boss) banner(b.t.name,Y?Y.title:'Boss','boss'); if(Y) bossYell(b,Y.pull,true); }
  const m=b, Y=BOSSY[m.t.key]||{}, f=m.hp/m.mhp; if(f<.5&&!bossEng.said.p50){ bossEng.said.p50=1; bossYell(m,Y.p50); } if(f<.2&&!bossEng.said.p20){ bossEng.said.p20=1; bossYell(m,Y.p20,true); }
  bf.classList.remove('hidden'); bf.classList.toggle('elite',!m.t.boss);
  $('bfName').textContent=(m.t.boss?'☠ ':'★ ')+m.t.name; $('bfTag').textContent=`Level ${m.lv}${m.t.boss?' Boss':' Elite'}${m.enr?' · ENRAGED':''}`; $('bfDrop').textContent=dropText(m.t.key)?'Drops: '+dropText(m.t.key):'';
  $('bfHp').style.width=(clamp(f,0,1)*100)+'%'; $('bfHpT').textContent=`${Math.ceil(m.hp).toLocaleString()} / ${m.mhp.toLocaleString()}  (${Math.ceil(f*100)}%)`;
  let tel=null; for(const e of tels){ if(dist(e.x,e.y,m.rx,m.ry)<900&&(!tel||e.t0>tel.t0)) tel=e; }
  const cb=$('bfCast'); if(tel){ const p=clamp((t-tel.t0)/tel.dur,0,1); cb.classList.remove('hidden'); cb.firstElementChild.style.width=(p*100)+'%'; cb.lastElementChild.textContent=(TELNAME[tel.kind]||'Charging')+' — move out!'; } else cb.classList.add('hidden'); }
function bossDied(m){ if(!bossEng||bossEng.m!==m) return; const Y=BOSSY[m.t.key]; if(Y) bossYell(m,Y.die); if(m.t.boss) banner('Victory!',m.t.name+' has been defeated','win'); bossEng=null; $('bossFrame').classList.add('hidden'); }
/* ---------- NPC life ---------- */
const NPCBARK={oriel:['Keep your blade sharp out there.','The wolves grow bolder every night.','Hearthmere stands because people like you fight for it.'],mira:['Potions! Fresh potions!','Got loot to sell? I pay fair.','Mind the step, traveller.'],doran:['*clang* *clang*','Good steel never lies.','Bring me ore and I\'ll make you a legend.'],hilde:['Easy there, girl... easy.','A good horse is worth ten swords.','Need a ride? I\'ve the finest steeds in the realm.'],hakon:['The cold bites deep here.','Keep moving or freeze.']};
const NPCGEN=['Well met, traveller.','Safe travels.','Have you seen the smoke over the caldera?','Strange times...'];
function updateNPCs(dt,t){ if(!me) return; for(const n of NPCS){ const d=dist(me.x,me.y,n.x,n.y); if(n.face===undefined){ n.face=Math.PI/2; n.near=false; n.barkT=0; }
    const want=d<190?Math.atan2(me.y-n.y,me.x-n.x):Math.PI/2+Math.sin(t*.3+n.x)*.3; let df=want-n.face; while(df>Math.PI) df-=6.283; while(df<-Math.PI) df+=6.283; n.face+=df*Math.min(1,dt*4);
    if(d<170&&!n.near){ n.near=true; if(t-n.barkT>40){ n.barkT=t; n.emote={k:'wave',t0:t}; n.emoteU=t+2.2; const L=NPCBARK[n.id]||NPCGEN; n.bubble=L[Math.random()*L.length|0]; n.bubbleT=t+4.5; } }
    else if(d>260) n.near=false; if(n.emote&&t>n.emoteU) n.emote=null; } }
function typeText(el,full){ if(!el) return; el.textContent=''; let i=0; const step=()=>{ if(!el.isConnected) return; i=Math.min(full.length,i+3); el.textContent=full.slice(0,i); if(i<full.length) setTimeout(step,16); }; step(); }
function npcPortrait(n){ const L=LOOK[n.id]; const c=n.col||'#a07a4a'; return `<div class="nport" style="background:radial-gradient(circle at 35% 30%,${shade(c,.25)},${shade(c,-.6)})">${esc(n.name[0])}</div>`; }
/* ---------- parties ---------- */
let invSeq=0, myInv=null, myIr=null, myKick=null, pendInv=null; const PARTY_MAX=5;
function partyMembers(){ return me.party?[...others.values()].filter(o=>o.pt===me.party&&seenO(o)):[]; }
function amLeader(){ if(!me.party) return false; if(me.lead) return true; return !partyMembers().some(o=>o.pl); }
function inviteTo(o){ if(!o) return err('Player not found'); if(o.pt&&o.pt===me.party) return err(o.n+' is already in your party');
  if(me.party&&partyMembers().length+1>=PARTY_MAX) return err('Your party is full ('+PARTY_MAX+')');
  if(!me.party){ joinParty(me.c.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'-'+rid(3),true); me.lead=1; }
  myInv=[++invSeq,o.u,me.party]; sysMsg(`You invited ${o.n} to your party.`); sendPresence(true); renderPartyWin(); }
function findPlayer(name){ name=(name||'').toLowerCase().trim(); if(!name) return null; for(const o of others.values()) if(seenO(o)&&o.n.toLowerCase()===name) return o; for(const o of others.values()) if(seenO(o)&&o.n.toLowerCase().startsWith(name)) return o; return null; }
function gotInvite(o,party,seq){ if(me.party&&me.party===party) return; pendInv={o,party,seq,until:now()+60}; const el=$('invPop'); el.innerHTML='';
  const h=document.createElement('div'); h.className='ipt'; const b=document.createElement('b'); b.textContent=o.n; b.style.color=CLS[o.c].col; h.append(b,' invites you to join their party.'); el.appendChild(h);
  if(me.party){ const w=document.createElement('div'); w.className='ipw'; w.textContent='Accepting will leave your current party.'; el.appendChild(w); }
  const row=document.createElement('div'); row.className='btns'; const y=document.createElement('button'); y.className='gold'; y.textContent='Accept'; const n=document.createElement('button'); n.textContent='Decline'; row.append(n,y); el.appendChild(row); el.classList.remove('hidden');
  y.onclick=()=>answerInvite(true); n.onclick=()=>answerInvite(false); sysMsg(`${o.n} invites you to join a party.`); }
function answerInvite(ok){ const P=pendInv; pendInv=null; $('invPop').classList.add('hidden'); if(!P) return; myIr=[P.seq,P.o.u,ok?1:0];
  if(ok){ me.lead=0; joinParty(P.party,true); sysMsg(`You joined ${P.o.n}'s party. Use /p to talk to your party.`); banner('Party joined','Fight together for shared kill credit and quest progress'); } else sysMsg('Invite declined.'); sendPresence(true); renderPartyWin(); }
function kickMember(o){ if(!amLeader()) return err('Only the party leader can remove members'); myKick=[++invSeq,o.u]; sysMsg(`You removed ${o.n} from the party.`); sendPresence(true); }
function partyNet(o,pr){ // called per remote presence
  if(Array.isArray(pr.inv)&&pr.inv[1]===MY_U&&(pr.inv[0]|0)>(o.invSeen||0)){ o.invSeen=pr.inv[0]|0; if(me) gotInvite(o,clean(pr.inv[2]).slice(0,30),pr.inv[0]|0); }
  if(Array.isArray(pr.ir)&&pr.ir[1]===MY_U&&(pr.ir[0]|0)>(o.irSeen||0)){ o.irSeen=pr.ir[0]|0; if(me){ if(pr.ir[2]){ sysMsg(`${o.n} has joined the party.`); toast(o.n+' joined your party','small'); } else sysMsg(`${o.n} declined your invite.`,'c-err'); } }
  if(Array.isArray(pr.kk)&&pr.kk[1]===MY_U&&(pr.kk[0]|0)>(o.kkSeen||0)){ o.kkSeen=pr.kk[0]|0; if(me&&me.party&&o.pt===me.party&&pr.pl){ joinParty('',true); sysMsg('You were removed from the party.','c-err'); } } }
function renderPartyWin(){ const w=$('partyWin'); if(!w||w.classList.contains('hidden')||!me) return; const mem=partyMembers(); const lead=amLeader();
  const row=(n,cls,l,hpF,zone,isLead,you,u,dead)=>`<div class="pwrow"><span class="pwic" style="background:${CLS[cls].col}">${CLS[cls].glyph}</span><span class="pwn" style="color:${CLS[cls].col}">${isLead?'<span class="crown">♛</span> ':''}${esc(n)}${you?' <small>(you)</small>':''}</span><span class="pwl">Lv ${l} · ${esc(ZONES[zone]?.name||'')}</span><span class="pwhp"><i style="width:${Math.round(clamp(hpF,0,1)*100)}%"></i></span>${!you&&lead?`<button data-kick="${esc(u)}">Remove</button>`:''}${dead?'<span class="pwdead">Dead</span>':''}</div>`;
  let h=''; if(me.party){ h+=`<div class="pwsub">Party <b>${esc(me.party)}</b> · ${mem.length+1}/${PARTY_MAX} members</div>`; h+=row(me.c.name,me.c.cls,me.c.lvl,me.hp/me.mhp,zoneAtPx(me.x,me.y),lead,1,MY_U,me.dead); for(const o of mem) h+=row(o.n,o.c,o.l,o.hp/o.mhp,o.z,!!o.pl,0,o.u,o.d); }
  else h+='<div class="pwsub">You are not in a party. Invite someone below, or click a player and press <b>Invite</b>.</div>';
  const cand=[...others.values()].filter(o=>seenO(o)&&o.pt!==me.party||(!me.party&&seenO(o)));
  h+=`<h4>Invite players</h4>${cand.length?cand.map(o=>`<div class="pwrow small"><span class="pwic" style="background:${CLS[o.c].col}">${CLS[o.c].glyph}</span><span class="pwn" style="color:${CLS[o.c].col}">${esc(o.n)}</span><span class="pwl">Lv ${o.l}${o.pt?' · in a party':''}</span><button data-inv="${esc(o.u)}" class="gold">Invite</button></div>`).join(''):'<div class="pwsub">No other players online right now.</div>'}`;
  h+=`<div class="btns" style="margin-top:12px">${me.party?'<button id="pwLeave">Leave party</button>':''}<button id="pwName">Join by name…</button></div>`;
  w.querySelector('.pwbody').innerHTML=h;
  w.querySelectorAll('[data-inv]').forEach(b=>b.onclick=()=>inviteTo(othersByU.get(b.dataset.inv)));
  w.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>{ const o=othersByU.get(b.dataset.kick); if(o) kickMember(o); });
  if($('pwLeave')) $('pwLeave').onclick=()=>{ joinParty(''); renderPartyWin(); }; $('pwName').onclick=partyDlg; }
/* ---------- GM: invisibility & owner grants ---------- */
const MY_PID=(()=>{ let p=saves.pid; if(!p){ p=rid(8); saves.pid=p; saveAll(saves); } return p; })();
function gmNames(){ return (saves.gmGrants||[]); }
function isRealmOwner(){ return isGM&&(gmSrc==='owner'||gmSrc==='master'||gmSrc==='solo'); }
function gmGrant(name,on){ if(!isRealmOwner()) return chatLine('Only the realm owner can make or remove Game Masters.','c-err');
  const o=findPlayer(name); if(on&&!o) return chatLine(`No player called "${name}" is online.`,'c-err');
  let L=saves.gmGrants||[]; const gid=o?o.pid+':'+o.n.toLowerCase():''; if(on){ if(!o.pid) return chatLine(`${o.n} is on an older version of the game; ask them to reload.`,'c-err'); if(!L.some(g=>g.gid===gid)) L.push({pid:o.pid,n:o.n,gid}); }
  else L=L.filter(g=>!(o&&g.gid===gid)&&g.n.toLowerCase()!==String(name).toLowerCase());
  saves.gmGrants=L; saveAll(saves); if(room&&typeof room.gmGrant==='function'&&o) room.gmGrant(gid,on);
  sendPresence(true); gmOk(on?`${o.n} is now a Game Master.`:`${name} is no longer a Game Master.`); }
let lastGrant=null;
function gmEventsInit(){ if(!room||typeof room.on!=='function'||typeof room.emit!=='function') return; room.on('gm',msg=>{ if(msg.sameTab) return; const d=msg.data||{};
    if(d.k==='grant'&&Array.isArray(d.pids)) lastGrant={t:now(),pids:d.pids.map(String).slice(0,40)};
    if(d.k==='ann'&&typeof d.txt==='string') gmAnnounceShow('',clean(d.txt).slice(0,160),d.role==='owner'?'owner':'gm'); });
  setInterval(()=>{ if(ownerOK&&ownerSrc==='owner'&&room&&room.emit) room.emit('gm',{k:'grant',pids:(saves.gmGrants||[]).map(g=>g.gid||g.pid).slice(0,40)}).catch(()=>{}); },4000); }
function gmGrantCheck(){ if(gmSrc==='owner'||gmSrc==='master'||gmSrc==='solo'||gmSrc==='server') return; let ok=false;
  if(room&&typeof room.emit==='function'){ ok=!!(lastGrant&&now()-lastGrant.t<15&&lastGrant.pids.includes(myGid())); }
  else for(const p of peerList()){ const pr=p.presence; if(!p.sameTab&&pr&&pr.own&&Array.isArray(pr.gl)&&pr.gl.includes(myGid())&&(p.own===undefined||p.own)) ok=true; }
  if(ok&&!isGM){ setGM(true,'granted'); sysMsg('The realm owner made you a Game Master. Type /gm for your tools.','c-gm'); }
  else if(!ok&&isGM&&gmSrc==='granted'){ setGM(false); gm.god=gm.nocd=gm.fly=gm.invis=false; gm.speed=1; sysMsg('Your Game Master powers are inactive (they only work while the realm owner is online and has not removed them).','c-err'); sendPresence(true); } }
setInterval(()=>{ if(me) gmGrantCheck(); },2000);

/* ---------- lava ---------- */
let lavaT=0;
function inLava(x,y){ const tx=Math.floor(x/TS), ty=Math.floor(y/TS); if(tAt(tx,ty)===T.LAVA) return true; let nearL=false; for(let dy=-1;dy<=1&&!nearL;dy++) for(let dx=-1;dx<=1;dx++) if(tAt(tx+dx,ty+dy)===T.LAVA){ nearL=true; break; }
  return nearL&&groundY(x,y)<LAVA_Y+.05; }
function lavaCheck(t){ if(!me||me.dead||gm.fly) return; if(!inLava(me.x,me.y)){ me.inLava=false; return; }
  if(!me.inLava){ me.inLava=true; err('You are burning in the lava!'); lavaT=0; }
  const [X,Y,Z]=ph3(me.x,me.y,.1); if(Math.random()<.6) P3(X+(Math.random()-.5)*.6,LAVA_Y,Z+(Math.random()-.5)*.6,0,1.5+Math.random(),0,.7,.2,Math.random()<.5?'#ff6a1a':'#ffd36a',{glow:true});
  if(t>=lavaT){ lavaT=t+.5; if(me.mounted) dismount(); const d=Math.round(me.mhp*.09); if(gm.god) return; me.hp-=d; me.lastCombat=t; fct(me.x,me.y-24,'-'+d+' (lava)','#ff7a2a',true); hurtFlash=Math.min(1,hurtFlash+.35); if(me.hp<=0){ me.hp=0; die(); sysMsg('You were burned to death in the lava.','c-err'); } } }
/* ---------- world map ---------- */
const MAPF={quests:true,players:true,gather:true,bosses:true}; let mapFeat=[];
function buildMapBase(){ const W=MW*MAPS, H=MH*MAPS; const PAPER=[226,208,166];
  const tiny=document.createElement('canvas'); tiny.width=MW; tiny.height=MH; const tx=tiny.getContext('2d'); const id=tx.createImageData(MW,MH); const D=id.data;
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){ const t=tAt(i,j); let col; const z=zmap[j*MW+i];
    if(t===T.WATER) col=[86,134,160]; else if(t===T.LAVA) col=[214,96,40]; else if(t===T.TREE) col=z==='swamp'?[78,98,70]:z==='frost'?[120,140,130]:[74,108,62];
    else { const ct=cellType(i*TS+16,j*TS+16); col=(GC[ct]||GC[0]).slice(); if(t===T.PATH||t===T.BRIDGE) col=[196,170,120]; if(t===T.COBBLE||t===T.HOUSE) col=[186,160,124]; }
    const o=(j*MW+i)*4; for(let k=0;k<3;k++) D[o+k]=col[k]*.72+PAPER[k]*.28; D[o+3]=255; }
  tx.putImageData(id,0,0);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  x.fillStyle='rgb(226,208,166)'; x.fillRect(0,0,W,H); x.imageSmoothingEnabled=true; x.filter='blur(2.2px)'; x.drawImage(tiny,0,0,W,H); x.filter='blur(.8px)'; x.drawImage(tiny,0,0,W,H); x.filter='none';
  // hill shading
  const hs=document.createElement('canvas'); hs.width=MW*2; hs.height=MH*2; const hx=hs.getContext('2d'); const hd=hx.createImageData(hs.width,hs.height);
  for(let j=0;j<hs.height;j++)for(let i=0;i<hs.width;i++){ const X=(i+.5)/2, Z=(j+.5)/2; const d=(hgt(X,Z)-hgt(X-.5,Z-.5))*1.4; const o=(j*hs.width+i)*4;
    if(d<0){ hd.data[o]=40; hd.data[o+1]=28; hd.data[o+2]=12; hd.data[o+3]=Math.min(150,-d*170); } else { hd.data[o]=255; hd.data[o+1]=250; hd.data[o+2]=230; hd.data[o+3]=Math.min(110,d*120); } }
  hx.putImageData(hd,0,0); x.filter='blur(1.5px)'; x.drawImage(hs,0,0,W,H); x.filter='none';
  // forests as painted tree dots, houses as crisp blocks
  const R=mulberry32(77);
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){ const t=tAt(i,j); const px=(i+.5)*MAPS, py=(j+.5)*MAPS;
    if(t===T.TREE&&R()<.55){ const z=zmap[j*MW+i]; const tc=z==='frost'?'rgba(70,96,90,.75)':z==='swamp'?'rgba(48,66,44,.75)':'rgba(46,82,40,.75)'; x.fillStyle='rgba(30,40,20,.25)'; x.beginPath(); x.arc(px+1,py+1.5,2.6,0,7); x.fill(); x.fillStyle=tc; x.beginPath(); x.arc(px+(R()-.5)*2,py+(R()-.5)*2,2.5,0,7); x.fill(); }
    if(t===T.HOUSE){ x.fillStyle='#9a4a34'; x.fillRect(i*MAPS,j*MAPS,MAPS,MAPS); } }
  // shoreline glow
  x.strokeStyle='rgba(40,70,90,.35)'; x.lineWidth=1.2; for(let j=1;j<MH-1;j++)for(let i=1;i<MW-1;i++){ if(tAt(i,j)!==T.WATER) continue;
    if(tAt(i+1,j)!==T.WATER&&tAt(i+1,j)!==T.BRIDGE){ x.beginPath(); x.moveTo((i+1)*MAPS,j*MAPS); x.lineTo((i+1)*MAPS,(j+1)*MAPS); x.stroke(); }
    if(tAt(i-1,j)!==T.WATER&&tAt(i-1,j)!==T.BRIDGE){ x.beginPath(); x.moveTo(i*MAPS,j*MAPS); x.lineTo(i*MAPS,(j+1)*MAPS); x.stroke(); }
    if(tAt(i,j+1)!==T.WATER&&tAt(i,j+1)!==T.BRIDGE){ x.beginPath(); x.moveTo(i*MAPS,(j+1)*MAPS); x.lineTo((i+1)*MAPS,(j+1)*MAPS); x.stroke(); }
    if(tAt(i,j-1)!==T.WATER&&tAt(i,j-1)!==T.BRIDGE){ x.beginPath(); x.moveTo(i*MAPS,j*MAPS); x.lineTo((i+1)*MAPS,j*MAPS); x.stroke(); } }
  // paper grain + vignette
  for(let k=0;k<5000;k++){ x.fillStyle=R()<.5?'rgba(90,60,20,.05)':'rgba(255,250,235,.06)'; x.fillRect(R()*W,R()*H,1+R()*2,1+R()*2); }
  const vg=x.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.72); vg.addColorStop(0,'rgba(90,60,20,0)'); vg.addColorStop(1,'rgba(90,55,15,.42)'); x.fillStyle=vg; x.fillRect(0,0,W,H);
  return c; }
function mapIcon(x,kind,px,py,col,s){ s=s||1; x.save(); x.translate(px,py); x.scale(s,s);
  if(kind==='boss'||kind==='elite'||kind==='bossdead'){ const dead=kind==='bossdead'; x.fillStyle=dead?'#5a5048':kind==='boss'?'#8a1a10':'#7a5a10'; x.strokeStyle=dead?'#2a2420':'#ffd34a'; x.lineWidth=2;
    x.beginPath(); x.arc(0,0,10,0,7); x.fill(); x.stroke(); x.fillStyle=dead?'#a89c90':'#fff2d8'; x.beginPath(); x.arc(0,-1.5,5.2,0,7); x.fill(); x.fillRect(-3,2,6,4); x.fillStyle=dead?'#5a5048':kind==='boss'?'#8a1a10':'#7a5a10';
    x.beginPath(); x.arc(-2,-1.5,1.5,0,7); x.arc(2,-1.5,1.5,0,7); x.fill(); x.fillRect(-.6,3,1.2,3); }
  else if(kind==='npc'){ x.fillStyle=col||'#ffd34a'; x.strokeStyle='#2a1a08'; x.lineWidth=1.5; x.beginPath(); x.arc(0,0,4,0,7); x.fill(); x.stroke(); }
  else if(kind==='poi'){ x.rotate(Math.PI/4); x.fillStyle=col; x.strokeStyle='#3a2408'; x.lineWidth=1.5; x.fillRect(-4,-4,8,8); x.strokeRect(-4,-4,8,8); }
  x.restore(); }
const MAPZ={z:1,cx:0,cy:0,init:false};
function mapView(){ const cv2=$('mapC'); const S=cv2.width/MW*MAPZ.z; let ox=cv2.width/2-MAPZ.cx*S, oy=cv2.height/2-MAPZ.cy*S; ox=Math.min(0,Math.max(cv2.width-MW*S,ox)); oy=Math.min(0,Math.max(cv2.height-MH*S,oy)); MAPZ.cx=(cv2.width/2-ox)/S; MAPZ.cy=(cv2.height/2-oy)/S; return {S,ox,oy}; }
function mapZoomBy(f,px,py){ const cv2=$('mapC'); const v=mapView(); const wx=px==null?MAPZ.cx:(px-v.ox)/v.S, wy=py==null?MAPZ.cy:(py-v.oy)/v.S; const z=Math.max(1,Math.min(6,MAPZ.z*f)); if(z===MAPZ.z) return;
  const S2=cv2.width/MW*z; const sx=px==null?cv2.width/2:px, sy=py==null?cv2.height/2:py; MAPZ.z=z; MAPZ.cx=wx+(cv2.width/2-sx)/S2; MAPZ.cy=wy+(cv2.height/2-sy)/S2; drawWorldMap(); }
function mapCenterMe(){ if(!me) return; MAPZ.init=true; MAPZ.cx=me.x/TS; MAPZ.cy=me.y/TS; drawWorldMap(); }
function drawWorldMap(){ if($('mapWin').classList.contains('hidden')||!me) return; if(!mapBase) mapBase=buildMapBase(); const cv2=$('mapC'), x=cv2.getContext('2d'); if(!MAPZ.init){ MAPZ.init=true; MAPZ.cx=MW/2; MAPZ.cy=MH/2; } const V=mapView(); const S=V.S, t=now(); mapFeat=[]; MAPZ.ox=V.ox; MAPZ.oy=V.oy;
  x.setTransform(1,0,0,1,0,0); x.fillStyle='#d8c49a'; x.fillRect(0,0,cv2.width,cv2.height); x.translate(V.ox,V.oy); x.imageSmoothingEnabled=true;
  x.drawImage(mapBase,0,0,MW*S,MH*S);
  const txt=(s,px,py,size,col,w,stroke,cz)=>{ x.font=`${w||700} ${size}px ${cz?'Cinzel,serif':'"Alegreya Sans",sans-serif'}`; x.textAlign='center'; x.lineJoin='round'; x.lineWidth=stroke||3.5; x.strokeStyle='rgba(245,232,200,.85)'; x.strokeText(s,px,py); x.fillStyle=col; x.fillText(s,px,py); };
  const txtD=(s,px,py,size,col)=>{ x.font=`700 ${size}px "Alegreya Sans",sans-serif`; x.textAlign='center'; x.lineJoin='round'; x.lineWidth=3; x.strokeStyle='rgba(20,12,4,.85)'; x.strokeText(s,px,py); x.fillStyle=col; x.fillText(s,px,py); };
  for(const z in ZONES){ const c=ZCENT[z]; if(!c) continue; x.save(); x.font='700 17px Cinzel,serif'; if(x.letterSpacing!==undefined) x.letterSpacing='2px'; txt(ZONES[z].name.toUpperCase(),c[0]*S,c[1]*S-6,17,'#4a2c10',700,4,true); x.restore(); if(ZONES[z].sub) txt(ZONES[z].sub,c[0]*S,c[1]*S+10,11,'#7a5226',600,3); }
  if(MAPF.quests) for(const q of activeQuests()){ const s=me.c.qs[q.id]; if(s.st==='done') continue; x.fillStyle='rgba(255,200,40,.16)'; x.strokeStyle='rgba(180,120,10,.8)'; x.lineWidth=1.5; x.setLineDash([5,4]);
    let cx=null,cz=null,r=4;
    if(q.type==='kill'){ const ms=mobs.filter(m=>m.t.key===q.mob); if(ms.length){ cx=ms.reduce((a,m)=>a+m.sx,0)/ms.length/TS; cz=ms.reduce((a,m)=>a+m.sy,0)/ms.length/TS; r=Math.max(3,...ms.map(m=>Math.hypot(m.sx/TS-cx,m.sy/TS-cz)))+2; } }
    if(q.type==='explore'){ const id=q.pois.find(id=>!s.p.includes(id)); const p=POIS.find(o=>o.id===id); if(p){ cx=p.x; cz=p.y; r=p.r; } }
    if(cx!==null){ x.beginPath(); x.arc(cx*S,cz*S,r*S,0,7); x.fill(); x.stroke(); mapFeat.push({x:cx*S,y:cz*S,r:Math.max(14,r*S*.6),tip:'Quest: '+q.title}); }
    x.setLineDash([]); if(q.type==='gather'&&MAPF.gather) for(const n of NODES) if(n.mat===q.mat){ x.fillStyle=MATS[n.mat].col; x.strokeStyle='#2a1a08'; x.lineWidth=1; x.beginPath(); x.arc((n.tx+.5)*S,(n.ty+.5)*S,3.5,0,7); x.fill(); x.stroke(); } }
  for(const p of POIS){ const d=me.c.disc.includes(p.id); mapIcon(x,'poi',p.x*S,p.y*S,d?'#e0a830':'#a89878'); txt(d?p.name:'Unexplored',p.x*S,p.y*S-9,11,d?'#3a2408':'#8a7a5a',700,3); mapFeat.push({x:p.x*S,y:p.y*S,r:10,tip:d?p.name:'An unexplored place'}); }
  for(const n of NPCS){ const m=npcMark(n); const px=n.x/TS*S, py=n.y/TS*S; if(n.id==='hilde'){ drawShoe(x,px,py-2,.6,1); } else mapIcon(x,'npc',px,py,m==='!'||m==='?'?'#ffd34a':m==='$'?'#9fe07a':'#d8c8a8');
    if(m==='!'||m==='?') txtD(m,px,py-7,16,'#ffd34a'); mapFeat.push({x:px,y:py,r:8,tip:`${n.name} <${n.title}>`+(m==='!'?' · has a quest':m==='?'?' · quest ready to turn in':'')}); }
  if(MAPF.bosses) for(const bm of mobs){ const mt=bm.t; if(!(mt.boss||mt.elite)||mt.summon) continue; const px=bm.sx/TS*S, py=bm.sy/TS*S; let rem=0; if(bm.dead){ rem=Math.max(0,(bm.resp&&bm.resp<1e9?bm.resp:(bm.deathT||t)+(mt.resp||60))-t); }
    mapIcon(x,bm.dead?'bossdead':mt.boss?'boss':'elite',px,py,null,mt.boss?1.15:.95); txtD(mt.name,px,py+(mt.boss?22:19),11,bm.dead?'#cfc4b8':mt.boss?'#ffb08a':'#ffe08a'); if(bm.dead) txtD('Respawns in '+fmtT(rem),px,py+(mt.boss?34:31),10,'#e8dcc8');
    mapFeat.push({x:px,y:py,r:12,tip:`${mt.boss?'☠ Boss':'★ Elite'}: ${mt.name} · Level ${bm.lv}`+(bm.dead?` · respawns in ${fmtT(rem)}`:' · alive')+(dropText(mt.key)?' · Drops: '+dropText(mt.key):'')}); }
  if(MAPF.players) for(const o of others.values()){ if(!seenO(o)) continue; const party=o.pt&&o.pt===me.party; x.fillStyle=party?'#3a8cff':CLS[o.c].col; x.strokeStyle='#fff'; x.lineWidth=1.5; x.beginPath(); x.arc(o.rx/TS*S,o.ry/TS*S,party?5:4,0,7); x.fill(); x.stroke(); if(party) txtD(o.n,o.rx/TS*S,o.ry/TS*S-8,11,'#bfe0ff'); mapFeat.push({x:o.rx/TS*S,y:o.ry/TS*S,r:8,tip:`${o.n} · Level ${o.l} ${CLS[o.c].name}`+(party?' · party':'')}); }
  for(const L of LOOTS){ x.fillStyle='#ffd34a'; x.beginPath(); x.arc(L.x/TS*S,L.y/TS*S,2.5,0,7); x.fill(); }
  const pr=6+Math.sin(t*4)*2.5; x.strokeStyle='rgba(255,255,255,.7)'; x.lineWidth=2; x.beginPath(); x.arc(me.x/TS*S,me.y/TS*S,pr+6,0,7); x.stroke();
  x.save(); x.translate(me.x/TS*S,me.y/TS*S); x.rotate(me.face+Math.PI/2); x.fillStyle='#ffe27a'; x.strokeStyle='#2a1a08'; x.lineWidth=2; x.beginPath(); x.moveTo(0,-11); x.lineTo(7,8); x.lineTo(0,4); x.lineTo(-7,8); x.closePath(); x.fill(); x.stroke(); x.restore();
  x.setTransform(1,0,0,1,0,0);
  // compass rose
  const cx=cv2.width-46, cy=cv2.height-46; x.save(); x.translate(cx,cy); x.fillStyle='rgba(74,44,16,.85)'; for(let k=0;k<4;k++){ x.beginPath(); x.moveTo(0,-26); x.lineTo(5,0); x.lineTo(-5,0); x.closePath(); x.fill(); x.rotate(Math.PI/2); } x.beginPath(); x.arc(0,0,4,0,7); x.fill(); x.restore(); txt('N',cx,cy-30,13,'#4a2c10',700,3,true);
  $('mapCoords').textContent=`${ZONES[zoneAtPx(me.x,me.y)].name} · ${Math.round(me.x/TS)}, ${Math.round(me.y/TS)}`; }
function fmtT(s){ s=Math.ceil(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
/* ---------- login / roster ---------- */
function rosterList(){ if(!saves.roster){ saves.roster=Object.values(saves.chars||{}).map(c=>{ c.id=c.id||rid(6); return c; }); delete saves.chars; saveAll(saves); } return saves.roster; }
const CLSICON={warden:'bulwark',mender:'mend',arcanist:'ember'};
const CLSDETAIL={warden:['Plate armour and shield','Holds monsters\' attention','Difficulty: ★☆☆'],mender:['Heals friends and smites foes','Shields, wings and sanctuary','Difficulty: ★★☆'],arcanist:['Fire, frost and lightning','Huge area damage','Difficulty: ★★★']};
let selCls='warden', delArm=null;
function renderLogin(){ const R=rosterList().slice().sort((a,b)=>(b.lastT||0)-(a.lastT||0));
  const rl=$('roster'); rl.innerHTML='';
  if(!R.length){ rl.innerHTML='<div class="rempty">No characters yet.<br>Create your first hero →</div>'; }
  for(const c of R){ const cl=CLS[c.cls]; const d=document.createElement('div'); d.className='rchar';
    d.innerHTML=`<div class="rport" style="--cc:${cl.col}">${iconSVG(CLSICON[c.cls])||cl.glyph}</div><div class="rinfo"><div class="rname" style="color:${cl.col}"></div><div class="rsub">Level ${c.lvl} ${cl.name}${c.zone&&ZONES[c.zone]?' · '+ZONES[c.zone].name:''}</div></div><button class="rplay gold">Play</button><button class="rdel" title="Delete character">✕</button>`;
    d.querySelector('.rname').textContent=c.name; d.querySelector('.rplay').onclick=()=>enterWorld(c.name,c.cls,c);
    d.ondblclick=()=>enterWorld(c.name,c.cls,c);
    const del=d.querySelector('.rdel'); del.onclick=e=>{ e.stopPropagation(); if(delArm!==c.id){ delArm=c.id; del.textContent='Delete?'; del.classList.add('arm'); setTimeout(()=>{ if(delArm===c.id){ delArm=null; renderLogin(); } },3000); return; }
      saves.roster=rosterList().filter(x=>x.id!==c.id); saveAll(saves); delArm=null; renderLogin(); };
    rl.appendChild(d); }
  const el=$('classCards'); el.innerHTML='';
  for(const k of Object.keys(CLS)){ const cl=CLS[k]; const d=document.createElement('div'); d.className='ccard'+(k===selCls?' sel':''); d.style.setProperty('--cc',cl.col);
    d.innerHTML=`<div class="cicon">${iconSVG(CLSICON[k])||cl.glyph}</div><h3 style="color:${cl.col}">${cl.name}</h3><div class="role">${cl.role}</div><p>${cl.desc}</p><ul>${CLSDETAIL[k].map(s=>`<li>${s}</li>`).join('')}</ul>`;
    d.onclick=()=>{ selCls=k; renderLogin(); }; el.appendChild(d); }
  $('rosterCount').textContent=`${R.length}/8`; }
function createChar(){ const err2=m=>{ $('nameErr').textContent=m; $('nameIn').focus(); };
  let n=clean($('nameIn').value).trim().replace(/[^\p{L}\p{N} '\-]/gu,'').replace(/\s+/g,' ').slice(0,14);
  if(n.length<3) return err2('Names need at least 3 letters.'); n=n[0].toUpperCase()+n.slice(1);
  if(rosterList().some(c=>c.name.toLowerCase()===n.toLowerCase())) return err2('You already have a character with that name.');
  if(rosterList().length>=8) return err2('You can have up to 8 characters. Delete one first.');
  $('nameErr').textContent=''; enterWorld(n,selCls,null,true); }
function makeEmbers(){ const el=$('embers'); if(!el) return; let h=''; for(let i=0;i<34;i++){ const l=Math.random()*100, d=6+Math.random()*9, dl=-Math.random()*15, s=2+Math.random()*3.5, dx=(Math.random()-.5)*120;
    h+=`<i style="left:${l.toFixed(1)}%;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;animation-duration:${d.toFixed(1)}s;animation-delay:${dl.toFixed(1)}s;--dx:${dx.toFixed(0)}px"></i>`; } el.innerHTML=h; }

/* =====================================================================
   AUDIO — procedural music and ambience (no sound files needed)
   ===================================================================== */
const AUD={ctx:null,on:false,vol:{master:.8,music:.55,amb:.45,sfx:.7,mute:false},track:'',want:'',layers:{},nextNote:0,step:0,bar:0,lastEv:0};
try{ Object.assign(AUD.vol,(saves.audio||{})); if(!saves.audioV2){ AUD.vol.amb=Math.min(AUD.vol.amb,.45); saves.audioV2=1; } }catch(e){}
function audInit(){ if(AUD.ctx) { if(AUD.ctx.state==='suspended') AUD.ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const c=AUD.ctx=new AC();
  const g=n=>{ const x=c.createGain(); x.gain.value=0; return x; };
  AUD.master=c.createGain(); AUD.master.connect(c.destination);
  const comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.connect(AUD.master);
  AUD.music=g(); AUD.amb=g(); AUD.sfx=g(); AUD.music.connect(comp); AUD.amb.connect(comp); AUD.sfx.connect(comp);
  // reverb-ish room for music
  const dl=c.createDelay(); dl.delayTime.value=.23; const fb=c.createGain(); fb.gain.value=.28; const lp=c.createBiquadFilter(); lp.frequency.value=2200;
  AUD.wet=c.createGain(); AUD.wet.gain.value=.35; AUD.wet.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(AUD.music);
  AUD.mbus=c.createGain(); AUD.mbus.gain.value=1; AUD.mbus.connect(AUD.music); AUD.mbus.connect(AUD.wet);
  // noise source
  const nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate); const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; AUD.noise=nb;
  const pink=c.createBuffer(1,c.sampleRate*3,c.sampleRate); const p=pink.getChannelData(0); let b0=0,b1=0,b2=0; for(let i=0;i<p.length;i++){ const w=Math.random()*2-1; b0=.997*b0+w*.029591; b1=.985*b1+w*.032534; b2=.95*b2+w*.048056; p[i]=(b0+b1+b2+w*.016)*.9; } AUD.pink=pink;
  const loop=(buf,type,f,q)=>{ const s=c.createBufferSource(); s.buffer=buf; s.loop=true; const fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q||.7; const gg=c.createGain(); gg.gain.value=0; s.connect(fl); fl.connect(gg); gg.connect(AUD.amb); s.start(); return {g:gg,f:fl}; };
  const L=AUD.layers; L.wind=loop(pink,'lowpass',500,.5); L.leaves=loop(nb,'bandpass',2600,.6); L.water=loop(pink,'lowpass',380,.8); L.rumble=loop(pink,'lowpass',110,.9); L.insects=loop(nb,'bandpass',5200,6); L.frost=loop(nb,'bandpass',700,9); L.cave=loop(pink,'lowpass',160,1.5); L.town=loop(pink,'bandpass',900,.4);
  // insects shimmer
  const lfo=c.createOscillator(); lfo.frequency.value=28; const lg=c.createGain(); lg.gain.value=.5; lfo.connect(lg); lg.connect(L.insects.g.gain); lfo.start();
  // frost wind sweeps
  const lf2=c.createOscillator(); lf2.frequency.value=.09; const lg2=c.createGain(); lg2.gain.value=380; lf2.connect(lg2); lg2.connect(L.frost.f.frequency); lf2.start();
  const lf3=c.createOscillator(); lf3.frequency.value=.13; const lg3=c.createGain(); lg3.gain.value=260; lf3.connect(lg3); lg3.connect(L.wind.f.frequency); lf3.start();
  AUD.on=true; audVolumes(); }
function audVolumes(){ if(!AUD.ctx) return; const v=AUD.vol, t=AUD.ctx.currentTime; AUD.master.gain.setTargetAtTime(v.mute?0:v.master,t,.1); AUD.music.gain.setTargetAtTime(v.music*.5,t,.2); AUD.amb.gain.setTargetAtTime(v.amb,t,.2); AUD.sfx.gain.setTargetAtTime(v.sfx*.6,t,.1); saves.audio=v; saveAll(saves); }
const NOTE=n=>440*Math.pow(2,(n-69)/12);
function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); }
function pluck(n,t,vol,dec){ const c=AUD.ctx; const o=c.createOscillator(), o2=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain(); o.type='triangle'; o2.type='sawtooth'; o.frequency.value=NOTE(n); o2.frequency.value=NOTE(n)*1.003;
  const g2=c.createGain(); g2.gain.value=.25; f.type='lowpass'; f.frequency.setValueAtTime(3200,t); f.frequency.exponentialRampToValueAtTime(700,t+.25); o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(AUD.mbus); env(g,t,.004,vol,dec||.7); o.start(t); o2.start(t); o.stop(t+(dec||.7)+.1); o2.stop(t+(dec||.7)+.1); }
function flute(n,t,vol,dur){ const c=AUD.ctx; const o=c.createOscillator(), g=c.createGain(), v=c.createOscillator(), vg=c.createGain(); o.type='sine'; o.frequency.value=NOTE(n); v.frequency.value=5.2; vg.gain.value=NOTE(n)*.006; v.connect(vg); vg.connect(o.frequency);
  const br=c.createBufferSource(); br.buffer=AUD.noise; const bf=c.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=NOTE(n)*2; bf.Q.value=4; const bg=c.createGain(); bg.gain.value=vol*.08; br.connect(bf); bf.connect(bg); bg.connect(g);
  o.connect(g); g.connect(AUD.mbus); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.06); g.gain.setValueAtTime(vol,t+dur*.7); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+.15);
  o.start(t); v.start(t); br.start(t); o.stop(t+dur+.2); v.stop(t+dur+.2); br.stop(t+dur+.2); }
function pad(ns,t,vol,dur,dark){ const c=AUD.ctx; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=dark?600:1100; const g=c.createGain(); f.connect(g); g.connect(AUD.mbus);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+dur*.35); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  for(const n of ns) for(const det of [-4,4]){ const o=c.createOscillator(); o.type=dark?'sawtooth':'triangle'; o.frequency.value=NOTE(n); o.detune.value=det; o.connect(f); o.start(t); o.stop(t+dur+.1); } }
function drum(t,vol,low){ const c=AUD.ctx; const s=c.createBufferSource(); s.buffer=AUD.noise; const f=c.createBiquadFilter(); f.type=low?'lowpass':'highpass'; f.frequency.value=low?140:6500; const g=c.createGain(); s.connect(f); f.connect(g); g.connect(AUD.mbus); env(g,t,.003,vol,low?.28:.07); s.start(t); s.stop(t+.4);
  if(low){ const o=c.createOscillator(); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(48,t+.2); const og=c.createGain(); o.connect(og); og.connect(AUD.mbus); env(og,t,.003,vol*1.1,.25); o.start(t); o.stop(t+.35); } }
/* tracks */
const PROG={tavern:[[50,[62,66,69]],[55,[62,67,71]],[57,[61,64,69]],[50,[62,66,69]],[47,[62,66,71]],[55,[62,67,71]],[57,[61,64,69]],[50,[62,66,69]]],
  pastoral:[[48,[60,64,67]],[53,[60,65,69]],[45,[60,64,69]],[55,[59,62,67]]], eerie:[[45,[57,60,64]],[41,[57,60,65]],[43,[55,59,62]],[40,[55,59,64]]], frost:[[50,[62,65,69]],[46,[58,62,65]],[48,[60,64,67]],[45,[57,61,64]]],
  battle:[[45,[57,60,64]],[45,[57,60,64]],[41,[53,57,60]],[43,[55,59,62]]]};
const SCALE={tavern:[62,64,66,67,69,71,73,74,76,78,79,81],pastoral:[60,62,64,67,69,72,74,76,79],eerie:[57,59,60,62,64,65,68,69,72],frost:[62,64,65,67,69,70,72,74],battle:[57,60,62,64,65,67,69]};
let melPrev=69;
function schedStep(tr,t,step){ const P=PROG[tr]; if(!P) return; const per=tr==='tavern'?6:tr==='battle'?8:8; const bar=Math.floor(step/per)%P.length, s=step%per; const [root,ch]=P[bar];
  if(tr==='tavern'){ // 6/8 jig
    if(s===0) { pluck(root-12,t,.32,.9); drum(t,.35,true); } if(s===3){ pluck(root-5,t,.22,.7); drum(t,.18,true); } if(s===2||s===5) drum(t,.08,false);
    pluck(ch[[0,1,2,1,2,1][s]]+(s===4?12:0)-12,t,.12,.5);
    if(AUD.bar%4!==3||s<3){ if(Math.random()<.78){ const sc=SCALE.tavern; let i=sc.indexOf(melPrev); if(i<0) i=4; i=clamp(i+[-2,-1,-1,0,1,1,2][Math.random()*7|0],0,sc.length-1); if(s===0) i=sc.indexOf(ch[Math.random()*3|0]+12)>=0?sc.indexOf(ch[Math.random()*3|0]+12):i; melPrev=sc[i]; (AUD.bar%8<4?pluck:flute)(melPrev,t,AUD.bar%8<4?.18:.12,AUD.bar%8<4?.45:.3); } } }
  else if(tr==='battle'){ if(s===0||s===3||s===6) drum(t,.45,true); if(s===2||s===4||s===7) drum(t,.12,false); if(s===0) pad([root-12,root-5],t,.12,2.2,true); if(s%2===0) pluck(root+(s===4?3:0),t,.12,.3); }
  else { if(s===0){ pad(ch,t,tr==='eerie'?.07:.06,5.2,tr==='eerie'); pluck(root,t,.12,2.2); } if(s===4&&Math.random()<.6){ const sc=SCALE[tr]; flute(sc[Math.random()*sc.length|0]+(tr==='frost'?0:0),t,.05,1.6); } }
  if(s===per-1) AUD.bar++; }
function audTick(){ if(!AUD.on||!me) return; const c=AUD.ctx, t=c.currentTime; const z=zoneAtPx(me.x,me.y); const night=curDark>.55;
  let tr=z==='town'?'tavern':z==='meadow'||z==='lake'||z==='forest'?'pastoral':z==='frost'?'frost':'eerie'; if(bossEng&&!bossEng.m.dead) tr='battle';
  if(tr!==AUD.track){ if(AUD.want!==tr){ AUD.want=tr; AUD.mbus.gain.setTargetAtTime(0.0001,t,.5); AUD.switchAt=t+1.4; } if(t>=AUD.switchAt){ AUD.track=tr; AUD.step=0; AUD.bar=0; AUD.nextNote=t+.1; AUD.mbus.gain.setTargetAtTime(1,t,.6); } }
  const spb=AUD.track==='tavern'?60/138/2*2:AUD.track==='battle'?60/150/2*2:60/70/2*2; const stepDur=AUD.track==='tavern'?.2:AUD.track==='battle'?.2:.42;
  if(AUD.track===AUD.want) while(AUD.nextNote<t+.35){ schedStep(AUD.track,AUD.nextNote,AUD.step); AUD.step++; AUD.nextNote+=stepDur; }
  // ambience levels per zone
  const T0={wind:0,leaves:0,water:0,rumble:0,insects:0,frost:0,cave:0,town:0}; const set=o=>Object.assign(T0,o);
  if(z==='town') set({wind:.025}); if(z==='meadow') set({wind:.16,leaves:.03}); if(z==='forest') set({wind:.12,leaves:.07}); if(z==='lake') set({wind:.1,water:.3}); if(z==='swamp') set({insects:.025,water:.12,wind:.05});
  if(z==='ruins') set({wind:.22}); if(z==='ash'||z==='lair') set({rumble:.55,wind:.05}); if(z==='frost') set({frost:.06,wind:.18}); if(z==='crypt') set({cave:.4});
  if(isWaterAt(me.x,me.y)) T0.water=.4; if(me.inLava) T0.rumble=.8;
  for(const k in T0) AUD.layers[k].g.gain.setTargetAtTime(T0[k],t,1.2);
  // random events
  const r=Math.random();
  if((z==='forest'||z==='meadow'||z==='lake'||z==='town')&&!night&&r<(z==='forest'?.09:.04)) bird(t);
  if((z==='forest')&&!night&&r>.985) woodpecker(t);
  if(night&&(z==='meadow'||z==='forest'||z==='lake'||z==='town')&&r<.12) cricket(t);
  if(night&&z==='forest'&&r>.993) owl(t);
  if(z==='swamp'&&r<.07) frog(t); if((z==='ash'||z==='lair')&&r<.12) crackle(t); if(z==='crypt'&&r<.035) drip(t); if(z==='frost'&&r>.992) creak(t);
  if(z==='town'&&r>.997) clink(t); }
function sweep(t,f0,f1,dur,vol,type,dest){ const c=AUD.ctx; const o=c.createOscillator(), g=c.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur); o.connect(g); g.connect(dest||AUD.amb); env(g,t,Math.min(.01,dur/4),vol,dur); o.start(t); o.stop(t+dur+.05); }
function bird(t){ const k=Math.random()*3|0, base=2400+Math.random()*1800, n=2+Math.random()*5|0; for(let i=0;i<n;i++){ const tt=t+i*(k===0?.11:k===1?.16:.08); if(k===0) sweep(tt,base,base*1.4,.07,.035); else if(k===1) sweep(tt,base*1.3,base*.8,.1,.03); else sweep(tt,base*(1+(i%2)*.25),base*(1.15+(i%2)*.25),.05,.025); } }
function woodpecker(t){ for(let i=0;i<9;i++) drumAmb(t+i*.055,.05); }
function drumAmb(t,v){ const c=AUD.ctx; const s=c.createBufferSource(); s.buffer=AUD.noise; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=3; const g=c.createGain(); s.connect(f); f.connect(g); g.connect(AUD.amb); env(g,t,.002,v,.03); s.start(t); s.stop(t+.06); }
function cricket(t){ const f=4300+Math.random()*500; for(let i=0;i<3;i++) sweep(t+i*.07,f,f*1.01,.045,.012); }
function owl(t){ sweep(t,420,360,.35,.05); sweep(t+.55,400,330,.6,.05); }
function frog(t){ const c=AUD.ctx; const o=c.createOscillator(), g=c.createGain(), am=c.createOscillator(), ag=c.createGain(); o.type='square'; o.frequency.value=70+Math.random()*60; am.frequency.value=24; ag.gain.value=.5; am.connect(ag); ag.connect(g.gain);
  const f=c.createBiquadFilter(); f.frequency.value=600; o.connect(f); f.connect(g); g.connect(AUD.amb); env(g,t,.02,.04,.35); o.start(t); am.start(t); o.stop(t+.45); am.stop(t+.45); }
function crackle(t){ for(let i=0;i<3+Math.random()*4;i++) drumAmb(t+Math.random()*.4,.03+Math.random()*.04); }
function drip(t){ sweep(t,1400,700,.08,.05); const c=AUD.ctx; setTimeout(()=>{ if(AUD.ctx) sweep(AUD.ctx.currentTime,1400,700,.08,.018); },260); }
function creak(t){ sweep(t,180,140,.8,.03,'sawtooth'); }
function clink(t){ sweep(t,2600,2550,.25,.02,'triangle'); sweep(t+.08,3300,3250,.25,.015,'triangle'); }
function sfx(k){ if(!AUD.on) return; const t=AUD.ctx.currentTime, D=AUD.sfx;
  if(k==='coin') for(let i=0;i<3;i++) sweep(t+i*.06,2200+i*300,2300+i*300,.12,.08,'triangle',D);
  if(k==='level'){ [0,4,7,12].forEach((n,i)=>sweep(t+i*.09,NOTE(72+n),NOTE(72+n),.5,.09,'triangle',D)); }
  if(k==='quest'){ [0,4,7,12,16].forEach((n,i)=>sweep(t+i*.07,NOTE(67+n),NOTE(67+n),.4,.08,'triangle',D)); }
  if(k==='accept'){ sweep(t,NOTE(74),NOTE(74),.2,.07,'triangle',D); sweep(t+.1,NOTE(79),NOTE(79),.3,.07,'triangle',D); }
  if(k==='loot') sweep(t,600,900,.12,.06,'triangle',D);
  if(k==='legend'){ [0,7,12,16,19,24].forEach((n,i)=>sweep(t+i*.08,NOTE(64+n),NOTE(64+n),.9,.08,'triangle',D)); }
  if(k==='boss'){ drum(t,.5,true); drum(t+.3,.5,true); sweep(t,110,80,1.4,.12,'sawtooth',D); } }
setInterval(()=>{ try{ audTick(); }catch(e){} },150);
addEventListener('pointerdown',()=>{ if(me) audInit(); },{passive:true}); addEventListener('keydown',()=>{ if(me) audInit(); });
function renderSound(box){ const w=box||$('soundWin').querySelector('.sbody'); const v=AUD.vol; const row=(k,l)=>`<div class="sndrow"><span>${l}</span><input type="range" min="0" max="1" step=".05" value="${v[k]}" data-v="${k}"><b>${Math.round(v[k]*100)}%</b></div>`;
  w.innerHTML=row('master','Master')+row('music','Music')+row('amb','Ambience')+row('sfx','Effects')+`<label class="sndmute"><input type="checkbox" id="sndMute" ${v.mute?'checked':''}> Mute all sound</label><div class="sndnow">Now playing: <b>${({tavern:'Tavern jig',pastoral:'Open fields',eerie:'Shadows',frost:'Frozen frontier',battle:'Boss battle'})[AUD.track]||'—'}</b></div>`;
  w.querySelectorAll('[data-v]').forEach(i=>i.oninput=()=>{ v[i.dataset.v]=+i.value; i.nextElementSibling.textContent=Math.round(i.value*100)+'%'; audInit(); audVolumes(); });
  $('sndMute').onchange=e=>{ v.mute=e.target.checked; audInit(); audVolumes(); }; }

/* ---------- item icons (SVG, framed by rarity colour) ---------- */
function itemKind(it){ const n=it.name.toLowerCase(); if(it.slot==='weapon'){ if(it.leg==='mender'||/staff/.test(n)) return 'staff'; if(it.leg==='arcanist'||/wand|focus/.test(n)) return 'wand'; if(/axe/.test(n)) return 'axe'; if(/morningstar/.test(n)) return 'mace'; return 'sword'; }
  if(it.slot==='armor') return /robe|vestment|mantle/.test(n)?'robe':'plate'; return /charm|locket|talisman/.test(n)?'amulet':'ring'; }
const IKP={sword:'<path d="M44 8 L52 8 L52 16 L26 42 L20 36Z" fill="#eef2f8" stroke="#1a1208" stroke-width="1.5"/><path d="M14 34 L28 48 L24 52 L10 38Z" fill="#d8ac4a" stroke="#1a1208" stroke-width="1.5"/><path d="M17 45 L19 47 L10 56 L8 54Z" fill="#6a4020"/>',
  axe:'<path d="M20 54 L46 14" stroke="#7a4a20" stroke-width="5" stroke-linecap="round"/><path d="M38 8 Q58 10 56 30 Q46 26 40 22Z" fill="#dfe6ee" stroke="#1a1208" stroke-width="1.5"/>',
  mace:'<path d="M18 52 L40 22" stroke="#7a4a20" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="18" r="10" fill="#c8ced8" stroke="#1a1208" stroke-width="1.5"/><path d="M43 4 L43 32 M29 18 L57 18 M33 8 L53 28 M53 8 L33 28" stroke="#9aa2ae" stroke-width="2.5"/>',
  staff:'<path d="M18 58 L44 14" stroke="#8a5a28" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="12" r="8" fill="#fff4b0" stroke="#1a1208" stroke-width="1.5"/><circle cx="46" cy="12" r="4" fill="#ffffff"/>',
  wand:'<path d="M16 50 L40 22" stroke="#3a2040" stroke-width="5" stroke-linecap="round"/><polygon points="44,6 49,14 58,16 51,22 52,31 44,26 36,31 37,22 30,16 39,14" fill="#e8c0ff" stroke="#1a1208" stroke-width="1.5"/>',
  plate:'<path d="M18 14 L28 10 Q32 16 36 10 L46 14 L50 28 L44 30 L44 54 L20 54 L20 30 L14 28Z" fill="#c4ccd8" stroke="#1a1208" stroke-width="1.5"/><path d="M32 18 L32 50" stroke="#8a94a4" stroke-width="2"/>',
  robe:'<path d="M22 10 L42 10 L48 26 L44 28 L50 56 L14 56 L20 28 L16 26Z" fill="#8a5ac8" stroke="#1a1208" stroke-width="1.5"/><path d="M32 12 L32 56" stroke="#e8c870" stroke-width="2.5"/>',
  ring:'<circle cx="32" cy="36" r="13" fill="none" stroke="#e8c050" stroke-width="5"/><polygon points="32,12 39,20 32,28 25,20" fill="#bfe8ff" stroke="#1a1208" stroke-width="1.5"/>',
  amulet:'<path d="M18 10 Q32 34 46 10" fill="none" stroke="#c8a040" stroke-width="2.5"/><circle cx="32" cy="38" r="12" fill="#e8c050" stroke="#1a1208" stroke-width="1.5"/><circle cx="32" cy="38" r="6" fill="#ff6a8a"/>'};
function itemSVG(it){ const c=RARCOL[it.rar]||'#888'; const id='ir'+it.rar; return `<svg class="isv" viewBox="0 0 64 64"><defs><radialGradient id="${id}" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".6" stop-color="#1a1008"/><stop offset="1" stop-color="#050302"/></radialGradient></defs><rect width="64" height="64" fill="url(#${id})"/>${IKP[itemKind(it)]}${it.rar>=4?'<rect x="1" y="1" width="62" height="62" fill="none" stroke="#ffb03a" stroke-width="2.5"/>':''}<rect width="64" height="64" fill="url(#igloss)"/></svg>`; }
/* ---------- character panel ---------- */
function cosPanel(){ const C=cos(); const titles=C.titles||(C.title?[C.title]:[]); if(!C.wings&&!C.aura&&!titles.length) return '';
  return `<div class="cospan"><h4>Cosmetics</h4>${C.wings?`<label><input type="checkbox" data-cos="wingsOn" ${C.wingsOn!==false?'checked':''}> Phoenix Wings</label>`:''}${C.aura?`<label><input type="checkbox" data-cos="auraOn" ${C.auraOn!==false?'checked':''}> Supporter Aura</label>`:''}${titles.length?`<label>Title <select id="cosTitle"><option value="">(none)</option>${titles.map(x=>`<option ${x===C.title&&C.showTitle!==false?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:''}</div>`; }
function bindCos(){ document.querySelectorAll('[data-cos]').forEach(i=>i.onchange=()=>{ cos()[i.dataset.cos]=i.checked; persist(); sendPresence(true); });
  const sel=$('cosTitle'); if(sel) sel.onchange=()=>{ const C=cos(); if(sel.value){ C.title=sel.value; C.showTitle=true; } else C.showTitle=false; persist(); sendPresence(true); armorySync(true); }; }
function renderChar(){ const w=$('charWin'); if(!w||w.classList.contains('hidden')||!me) return; const c=me.c, cl=CLS[c.cls];
  $('chName').textContent=c.name; $('chName').style.color=cl.col; $('chSub').textContent=`Level ${c.lvl} ${cl.name} · ${cl.role}`; $('chPort').innerHTML=iconSVG(CLSICON[c.cls])||cl.glyph; $('chPort').style.setProperty('--cc',cl.col);
  const qd=Object.values(c.qs).filter(s=>s.st==='complete').length; const wpn=c.eq.weapon;
  const st=[['Health',me.mhp],[cl.res==='rage'?'Rage':'Mana',me.mres],['Power',me.pow],['Stamina',me.sta],['Damage bonus','+'+Math.round((me.pow*.8)/(10+c.lvl*4)*100)+'%'+(wpn&&wpn.rar===4?' · legendary +10%':'')],['Damage taken',Math.round(cl.mit*100)+'%'],['Mount',c.mount?MOUNTS[c.mount].name:'None'],['Gold',c.gold],['Quests completed',qd],['Places discovered',`${c.disc.length}/${POIS.length}`]];
  const ach=c.ach||{}; st.push(['Achievements',`${Object.keys(ach).length}/${ACH.length}`]); st.push(['Monsters defeated',cstats().kills]);
  $('statBox').innerHTML=st.map(([a,b])=>`<div class="strow"><span>${a}</span><b>${esc(String(b))}</b></div>`).join('')+cosPanel();
  bindCos();
  const xpn=xpNeed(c.lvl); $('chXp').innerHTML=c.lvl>=MAXLVL?'Max level':`<i style="width:${Math.round(c.xp/xpn*100)}%"></i><span>XP ${c.xp} / ${xpn}</span>`; }
/* ---------- GM aura ---------- */
function drawAura(X,Y,Z,t,col){ const c=C3(col); mreset(); mtr(X,Y+.06,Z); mry(t*.9); P(GEO.cyl,1.9,.02,1.9,c,1.3,0,0,0,.22); mry(-t*1.8); P(GEO.cyl,1.35,.02,1.35,[1,.95,.8],1.2,0,.01,0,.1);
  for(let k=0;k<8;k++){ const a=t*1.6+k*.785; P(GEO.box,.12,.04,.04,c,3,Math.cos(a)*.92,.02,Math.sin(a)*.92,.8); }
  for(let k=0;k<3;k++){ const a=t*2.2+k*2.094, h=.4+((t*.6+k*.33)%1)*1.8; mreset(); mtr(X+Math.cos(a)*.7,Y+h,Z+Math.sin(a)*.7); P(GEO.sph,.09,.09,.09,c,4); }
  if(Math.random()<.35) P3(X+(Math.random()-.5)*1.4,Y+.1,Z+(Math.random()-.5)*1.4,0,1.2+Math.random(),0,1.2,.1,col,{glow:true}); addLight(X,Y+1,Z,5,c.map(v=>v*1.3)); }
/* ---------- Celestial Steed ---------- */
function drawCelestial(o){ const t=now(), mv=o.mv||0, ph=(o.walk||0)*.55; const A=.45, body=[.42,.68,1], deep=[.3,.38,.9], star=[1,.95,.8];
  mreset(); mtr(o.x,o.y+Math.abs(Math.sin(ph))*.14*mv+.08+Math.sin(t*2)*.04,o.z); mry(-o.face); mrz(Math.sin(ph*2)*.05*mv);
  for(const [lx,lz,off] of [[.62,.22,0],[.62,-.22,Math.PI],[-.6,.22,Math.PI*.5],[-.6,-.22,Math.PI*1.5]]){ mpush(); mtr(lx,1.05,lz); mrz(Math.sin(ph+off)*.85*mv);
    P(GEO.limb,.19,.55,.19,body,.35,0,0,0,A); mtr(0,-.55,0); mrz(-Math.max(0,Math.sin(ph+off))*1.0*mv); P(GEO.limb,.13,.45,.13,deep,.45,0,0,0,A); mtr(0,-.48,0); P(GEO.box,.2,.09,.2,[.7,.9,1],.9,0,0,0,.85); mpop(); }
  P(GEO.sph,1.85,.85,.8,body,.35,0,1.3,0,A); P(GEO.sph,1.2,.5,.6,deep,.45,0,1.15,0,A); P(GEO.sph,.28,.24,.24,star,1.6+Math.sin(t*3)*.4,.15,1.32,0,.9);
  for(let k=0;k<6;k++){ mpush(); mtr(-.5+k*.22,1.7,0); mrz(-.25); P(GEO.cone,.14,.32+(k%2)*.14,.1,[.75,.9,1],.7,0,0,0,.75); mpop(); }
  for(const s of [-1,1]){ mpush(); mtr(.1,1.62,s*.32); mrx(-s*(.5+Math.sin(t*3)*.25)); P(GEO.wing,1.1,.8,1.1*s,[.6,.8,1],.5,0,0,0,.3); P(GEO.wing,.7,.8,.7*s,[.85,.92,1],.8,.05,.02,0,.28); mpop(); }
  P(GEO.box,.62,.12,.85,[.25,.3,.6],.4,0,1.7,0); P(GEO.box,.75,.04,.95,[.95,.85,.45],.6,0,1.64,0);
  mpush(); mtr(-.92,1.5,0); mrz(-.4-mv*.5+Math.sin(t*3)*.12); for(let k=0;k<5;k++){ P(GEO.cone,.16-k*.02,.32,.16-k*.02,k%2?[.9,.95,1]:[.6,.8,1],.8,0,-.2-k*.18,0,.7); } mpop();
  mpush(); mtr(.72,1.55,0); mrz(Math.PI-.62+Math.sin(ph)*.05*mv); P(GEO.limb,.36,.8,.36,body,.35,0,0,0,A); for(let k=0;k<4;k++) P(GEO.cone,.1,.26,.06,[.8,.92,1],.8,-.12,-.12-k*.17,0,.75); mtr(0,-.82,0); mrz(-(Math.PI-.62)-.45);
    P(GEO.box,.62,.3,.28,body,.35,.22,0,0,A); P(GEO.box,.26,.24,.25,deep,.45,.52,-.04,0,A); for(const s of [-1,1]){ P(GEO.cone,.08,.2,.06,body,.4,-.05,.18,s*.1,A); P(GEO.sph,.07,.07,.07,[.6,.95,1],4,.22,.06,s*.14); }
    mpush(); mtr(.2,.2,0); mrz(-.5); P(GEO.cone,.07,.55,.07,[1,.92,.7],1.4,0,0,0,.9); mpop(); mpop();
  addLight(o.x,o.y+1.5,o.z,4.5,[.4,.6,1.1]); if(Math.random()<.6) P3(o.x+(Math.random()-.5)*1.4,o.y+.2+Math.random()*1.4,o.z+(Math.random()-.5)*1.4,0,.3,0,1.3,.08,Math.random()<.5?'#bfe8ff':'#fff3c0',{glow:true,drag:.98});
  if(mv>.2&&Math.random()<.8) P3(o.x,o.y+.1,o.z,(Math.random()-.5)*.5,.4,(Math.random()-.5)*.5,1.6,.14,'#9fd8ff',{glow:true,drag:.95}); }

/* =====================================================================
   OPTIONS, KEYBINDS, ESCAPE MENU, QUEST ARROW, TOUCH CONTROLS
   ===================================================================== */
const BIND_DEF={forward:'w',back:'s',left:'a',right:'d',jump:' ',interact:'f',target:'tab',mount:'r',potion:'q',sit:'x',autorun:'`',
  ab1:'1',ab2:'2',ab3:'3',ab4:'4',ab5:'5',ab6:'6',ab7:'7',ab8:'8',character:'c',bags:'b',map:'m',quests:'l',party:'p',players:'o',help:'h'};
const BIND_LABEL={forward:'Move forward',back:'Move backward',left:'Strafe left',right:'Strafe right',jump:'Jump',autorun:'Auto-run',interact:'Talk / loot / gather',target:'Target nearest enemy',mount:'Mount / dismount',potion:'Drink potion',sit:'Sit',
  ab1:'Ability 1',ab2:'Ability 2',ab3:'Ability 3',ab4:'Ability 4',ab5:'Ability 5',ab6:'Ability 6',ab7:'Ability 7',ab8:'Ability 8',character:'Character panel',bags:'Bags',map:'World map',quests:'Quest log',party:'Party',players:'Players online',help:'Help'};
const OPT=Object.assign({sens:1,invertY:false,camMax:30,questArrow:true,uiScale:innerWidth<760?.62:1,shake:true,names:true,gfx:'auto',fullscreen:true},saves.opts||{});
let BIND=Object.assign({},BIND_DEF,saves.binds||{}); let KEYMAP={}; function rebuildKeymap(){ KEYMAP={}; for(const a in BIND) if(BIND[a]) KEYMAP[BIND[a]]=a; } rebuildKeymap();
function saveOpts(){ saves.opts=OPT; saves.binds=BIND; saveAll(saves); applyOpts(); }
function applyOpts(){ document.documentElement.style.setProperty('--uis',OPT.uiScale); }
applyOpts();
const keyName=k=>k===' '?'Space':k==='tab'?'Tab':k==='`'?'`':k.startsWith('arrow')?k.replace('arrow','Arrow '):k.length===1?k.toUpperCase():k[0].toUpperCase()+k.slice(1);
let capBind=null, autoRun=false;
addEventListener('keydown',e=>{ if(!capBind) return; e.preventDefault(); e.stopImmediatePropagation(); const k=e.key.toLowerCase();
  if(k!=='escape'){ for(const a in BIND) if(BIND[a]===k) BIND[a]=''; BIND[capBind]=k; rebuildKeymap(); saveOpts(); } capBind=null; renderOptions(); },true);
/* ---------- escape menu ---------- */
function anyWindowOpen(){ const ids=['invWin','whoWin','helpWin','mapWin','qlogWin','charWin','partyWin','soundWin','gmWin','optWin','escMenu','lootWin','bugWin']; let open=false;
  for(const id of ids){ const w=$(id); if(w&&!w.classList.contains('hidden')){ open=true; if(id==='lootWin'){ lootOpen=null; } w.classList.add('hidden'); } }
  if(!$('dlg').classList.contains('hidden')){ closeDlg(); open=true; } if(!$('ctxMenu').classList.contains('hidden')){ $('ctxMenu').classList.add('hidden'); open=true; } if(!$('confirmPop').classList.contains('hidden')){ $('confirmPop').classList.add('hidden'); open=true; } hideTip(); return open; }
function onEscape(){ if(anyWindowOpen()) return; if(me.cast){ me.cast=null; return; } if(me.target){ me.target=null; me.auto=false; return; } openEsc(); }
function openEsc(){ const m=$('escMenu'); m.classList.remove('hidden'); }
function initEsc(){ const m=$('escMenu');
  m.querySelector('[data-e="resume"]').onclick=()=>m.classList.add('hidden');
  m.querySelector('[data-e="options"]').onclick=()=>{ m.classList.add('hidden'); optTab='controls'; $('optWin').classList.remove('hidden'); renderOptions(); };
  m.querySelector('[data-e="sound"]').onclick=()=>{ m.classList.add('hidden'); optTab='sound'; audInit(); $('optWin').classList.remove('hidden'); renderOptions(); };
  m.querySelector('[data-e="fs"]').onclick=()=>{ m.classList.add('hidden'); toggleFullscreen(); };
  m.querySelector('[data-e="gfx"]').onclick=()=>{ m.classList.add('hidden'); optTab='gfx'; $('optWin').classList.remove('hidden'); renderOptions(); };
  m.querySelector('[data-e="keys"]').onclick=()=>{ m.classList.add('hidden'); optTab='keys'; $('optWin').classList.remove('hidden'); renderOptions(); };
  m.querySelector('[data-e="help"]').onclick=()=>{ m.classList.add('hidden'); toggleWin('helpWin',true); };
  m.querySelector('[data-e="bug"]').onclick=()=>{ m.classList.add('hidden'); openBug(); };
  m.querySelector('[data-e="repick"]').onclick=()=>{ m.classList.add('hidden'); askConfirm('Return to character select? Your progress is saved.','Character select',backToSelect); };
  $('escBtn').onclick=()=>{ if(!anyWindowOpen()) openEsc(); }; }
function backToSelect(){ if(!me) return; if(me.inLava||inCombat()) { if(!isGM) return err("You can't do that in combat"); } persist(); dismount(); anyWindowOpen();
  try{ if(room) room.presence({v:VERSION,u:null,n:null}).catch(()=>{}); }catch(e){}
  me=null; lootOpen=null; LOOTS.length=0; bossEng=null; pendInv=null; myInv=myIr=myKick=null; gm.invis=false; gm.aura=false;
  $('hud').classList.add('hidden'); $('deathWin').classList.add('hidden'); $('bossFrame').classList.add('hidden'); $('qArrow').classList.add('hidden'); $('login').classList.remove('hidden'); renderLogin();
  if(AUD.on){ AUD.mbus.gain.setTargetAtTime(0.0001,AUD.ctx.currentTime,.4); for(const k in AUD.layers) AUD.layers[k].g.gain.setTargetAtTime(0,AUD.ctx.currentTime,.4); AUD.track=''; AUD.want=''; } }
/* ---------- options window ---------- */
let optTab='controls';
function renderOptions(){ const w=$('optWin'); if(w.classList.contains('hidden')) return; const tabs=[['controls','Controls'],['gfx','Graphics'],['keys','Keybinds'],['sound','Sound'],['ui','Interface']];
  let h=`<div class="otabs">${tabs.map(([k,l])=>`<button data-tab="${k}" class="${optTab===k?'on':''}">${l}</button>`).join('')}</div><div class="obody">`;
  const sl=(k,l,min,max,step,fmt)=>`<div class="sndrow"><span>${l}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${OPT[k]}" data-o="${k}"><b>${fmt(OPT[k])}</b></div>`;
  const ck=(k,l)=>`<label class="ock"><input type="checkbox" data-c="${k}" ${OPT[k]?'checked':''}> ${l}</label>`;
  if(optTab==='controls') h+=sl('sens','Mouse / touch look speed',.3,2.5,.1,v=>Math.round(v*100)+'%')+sl('camMax','Max camera zoom out',10,40,1,v=>v)+ck('invertY','Invert camera up/down')+ck('shake','Screen shake')+`<div class="onote">Movement: hold both mouse buttons to run forward, right-drag to steer, left-drag to look around, wheel to zoom. On touch screens use the joystick and drag the screen to look.</div>`;
  if(optTab==='keys'){ h+='<div class="okeys">'+Object.keys(BIND_DEF).map(a=>`<div class="okey"><span>${BIND_LABEL[a]}</span><button data-bind="${a}" class="${capBind===a?'cap':''}">${capBind===a?'Press a key…':(BIND[a]?keyName(BIND[a]):'—')}</button></div>`).join('')+'</div><div class="onote">Arrow keys always move too. Esc cancels. <button id="bindReset">Reset to defaults</button></div>'; }
  if(optTab==='gfx'){ const Q=[['auto','Auto'],['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']];
    h+=`<div class="sndrow"><span>Graphics quality</span><select id="gfxSel">${Q.map(([k,l])=>`<option value="${k}" ${OPT.gfx===k?'selected':''}>${l}</option>`).join('')}</select><b>${GFX.q}</b></div>`+ck('fullscreen','Start in full screen')+`<div class="onote"><button id="fsNow">${document.fullscreenElement?'Leave full screen':'Go full screen now'}</button> Quality changes apply after you press <button id="gfxReload">Restart the game</button> (your character is saved). Low is best for phones and older laptops; Ultra needs a gaming graphics card.</div>`; }
  if(optTab==='sound') h+='<div id="optSound"></div>';
  if(optTab==='ui') h+=sl('uiScale','Interface size',.5,1.3,.02,v=>Math.round(v*100)+'%')+ck('questArrow','Show quest direction arrow')+ck('names','Show player and monster names');
  w.querySelector('.obodywrap').innerHTML=h+'</div>';
  w.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ optTab=b.dataset.tab; capBind=null; renderOptions(); });
  w.querySelectorAll('[data-o]').forEach(i=>i.oninput=()=>{ OPT[i.dataset.o]=+i.value; i.nextElementSibling.textContent=i.dataset.o==='camMax'?i.value:Math.round(i.value*100)+'%'; saveOpts(); });
  w.querySelectorAll('[data-c]').forEach(i=>i.onchange=()=>{ OPT[i.dataset.c]=i.checked; saveOpts(); });
  w.querySelectorAll('[data-bind]').forEach(b=>b.onclick=()=>{ capBind=b.dataset.bind; renderOptions(); });
  if($('bindReset')) $('bindReset').onclick=()=>{ BIND=Object.assign({},BIND_DEF); rebuildKeymap(); saveOpts(); renderOptions(); };
  if($('gfxSel')) $('gfxSel').onchange=e=>{ OPT.gfx=e.target.value; saveOpts(); };
  if($('fsNow')) $('fsNow').onclick=()=>{ toggleFullscreen(); setTimeout(renderOptions,300); };
  if($('gfxReload')) $('gfxReload').onclick=()=>{ try{ if(me) persist(); }catch(e){} location.reload(); };
  if(optTab==='sound') renderSound($('optSound')); }
/* ---------- full screen ---------- */
const FS_IOS=/iPhone|iPod/i.test(navigator.userAgent);
function windowIsFull(){ return innerWidth>=screen.width-2&&innerHeight>=screen.height-2; }
function goFullscreen(){ const el=document.documentElement; if(document.fullscreenElement||FS_IOS||!el.requestFullscreen) return; const p=el.requestFullscreen({navigationUI:'hide'}); if(p&&p.then) p.then(()=>{ try{ if(navigator.keyboard&&navigator.keyboard.lock) navigator.keyboard.lock(['Escape']); }catch(e){} }).catch(()=>{}); }
function toggleFullscreen(){ if(document.fullscreenElement){ try{ navigator.keyboard&&navigator.keyboard.unlock&&navigator.keyboard.unlock(); }catch(e){} document.exitFullscreen().catch(()=>{}); } else goFullscreen(); }
(function(){ const first=()=>{ removeEventListener('pointerdown',first,true); removeEventListener('keydown',first,true); if(OPT.fullscreen&&!windowIsFull()) goFullscreen(); };
  addEventListener('pointerdown',first,true); addEventListener('keydown',first,true);
  document.addEventListener('fullscreenchange',()=>{ setTimeout(resize,50); }); })();
/* ---------- bug reports (beta) ---------- */
function openBug(){ const w=$('bugWin'); w.classList.remove('hidden'); $('bugTxt').value=''; $('bugTxt').focus();
  $('bugSend').onclick=()=>{ const txt=$('bugTxt').value.trim().slice(0,1500); if(!txt) return; const BUG_EMAIL=(window.EMBERFALL_CONFIG&&window.EMBERFALL_CONFIG.bugEmail)||'ellis.jaden22@gmail.com'; const info=`[${new Date().toISOString()}] v${VERSION} ${me?me.c.name+' L'+me.c.lvl+' '+zoneAtPx(me.x,me.y)+' '+Math.round(me.x/TS)+','+Math.round(me.y/TS):''} ${navigator.userAgent.slice(0,80)}`;
    if(room&&typeof room.bug==='function') room.bug(info+'\n'+txt);
    const href='mailto:'+BUG_EMAIL+'?subject='+encodeURIComponent('Emberfall bug report'+(me?' from '+me.c.name:''))+'&body='+encodeURIComponent(txt+'\n\n---\n'+info);
    let opened=false; try{ const a=document.createElement('a'); a.href=href; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); opened=true; }catch(e){}
    try{ navigator.clipboard.writeText('To: '+BUG_EMAIL+'\n'+info+'\n'+txt); }catch(e){}
    sysMsg(`Thanks! Your email app should open with the report addressed to ${BUG_EMAIL}. If it does not, the report is copied to your clipboard: paste it into an email to that address.`);
    w.classList.add('hidden'); }; }
/* ---------- quest arrow ---------- */
let trackQ=null;
function questTarget(q){ const s=me.c.qs[q.id]; if(!s) return null; if(s.st==='done'){ const n=NPCS.find(n=>n.id===q.giver); return n?{x:n.x,y:n.y,lbl:'Turn in: '+n.name}:null; }
  if(q.type==='kill'){ let b=null,bd=1e9; for(const m of mobs) if(m.t.key===q.mob&&!m.dead){ const d=dist(me.x,me.y,m.rx,m.ry); if(d<bd){bd=d;b=m} } if(b) return {x:b.rx,y:b.ry,lbl:b.t.name};
    const ms=mobs.filter(m=>m.t.key===q.mob); if(ms.length) return {x:ms[0].sx,y:ms[0].sy,lbl:ms[0].t.name}; }
  if(q.type==='gather'){ let b=null,bd=1e9; const t=now(); for(const n of NODES) if(n.mat===q.mat&&n.resp<=t){ const d=dist(me.x,me.y,n.x,n.y); if(d<bd){bd=d;b=n} } if(b) return {x:b.x,y:b.y,lbl:MATS[q.mat].name}; }
  if(q.type==='explore'){ const id=q.pois.find(id=>!s.p.includes(id)); const p=POIS.find(o=>o.id===id); if(p) return {x:p.x*TS+16,y:p.y*TS+16,lbl:p.name}; }
  return null; }
function updateQuestArrow(){ const el=$('qArrow'); const qs=activeQuests(); if(!OPT.questArrow||!qs.length||me.dead){ el.classList.add('hidden'); return; }
  let q=qs.find(q=>q.id===trackQ)||qs[0]; trackQ=q.id; const T=questTarget(q); if(!T){ el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); const d=dist(me.x,me.y,T.x,T.y); const rel=Math.atan2(T.y-me.y,T.x-me.x)-CAM.yaw;
  el.querySelector('.qa').style.transform=`rotate(${rel}rad)`; el.classList.toggle('here',d<90);
  el.querySelector('.qat').textContent=q.title; el.querySelector('.qad').textContent=d<90?`${T.lbl} · you are here`:`${T.lbl} · ${Math.round(d/10)} yd`; el.querySelector('.qan').textContent=qs.length>1?`(${qs.indexOf(q)+1}/${qs.length})`:''; }
function cycleQuest(){ const qs=activeQuests(); if(!qs.length) return; const i=qs.findIndex(q=>q.id===trackQ); trackQ=qs[(i+1)%qs.length].id; updateQuestArrow(); }
/* ---------- touch controls ---------- */
const JOY={on:false,x:0,y:0,id:null}; const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
function initTouch(){ if(!isTouch) return; document.body.classList.add('touch'); const pad=$('joy'), knob=pad.querySelector('i');
  const setJ=(cx,cy)=>{ const r=pad.getBoundingClientRect(); let dx=(cx-(r.left+r.width/2))/(r.width/2), dy=(cy-(r.top+r.height/2))/(r.height/2); const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l} JOY.x=dx; JOY.y=dy; knob.style.transform=`translate(${dx*36}px,${dy*36}px)`; };
  pad.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; JOY.on=true; JOY.id=t.identifier; setJ(t.clientX,t.clientY); audInit(); },{passive:false});
  pad.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===JOY.id) setJ(t.clientX,t.clientY); },{passive:false});
  const end=e=>{ for(const t of e.changedTouches) if(t.identifier===JOY.id){ JOY.on=false; JOY.x=JOY.y=0; knob.style.transform=''; } }; pad.addEventListener('touchend',end); pad.addEventListener('touchcancel',end);
  const TL={}; let pinch=null;
  cv.addEventListener('touchstart',e=>{ e.preventDefault(); for(const t of e.changedTouches) TL[t.identifier]={x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,t0:performance.now()}; const ids=Object.keys(TL); if(ids.length===2){ const a=TL[ids[0]],b=TL[ids[1]]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),c:CAM.dist}; } audInit(); },{passive:false});
  cv.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches){ const T=TL[t.identifier]; if(!T) continue; const dx=t.clientX-T.x, dy=t.clientY-T.y; T.x=t.clientX; T.y=t.clientY;
      if(!pinch&&me){ CAM.yaw+=dx*.008*OPT.sens; CAM.pitch=clamp(CAM.pitch+dy*.006*OPT.sens*(OPT.invertY?-1:1),-.15,1.35); } }
    const ids=Object.keys(TL); if(pinch&&ids.length>=2){ const a=TL[ids[0]],b=TL[ids[1]]; const d=Math.hypot(a.x-b.x,a.y-b.y); CAM.dist=clamp(pinch.c*pinch.d/Math.max(20,d),3,OPT.camMax); } },{passive:false});
  const tend=e=>{ for(const t of e.changedTouches){ const T=TL[t.identifier]; delete TL[t.identifier]; if(T&&!pinch&&Math.hypot(T.x-T.sx,T.y-T.sy)<12&&performance.now()-T.t0<350&&me) pickAt(t.clientX,t.clientY,0); } if(Object.keys(TL).length<2) pinch=null; };
  cv.addEventListener('touchend',tend); cv.addEventListener('touchcancel',tend);
  document.querySelectorAll('#touchBtns [data-t]').forEach(b=>b.addEventListener('touchstart',e=>{ e.preventDefault(); if(!me) return; const a=b.dataset.t; doAction(a); },{passive:false})); }
function doAction(a){ if(!me) return;
  if(a.startsWith('ab')) return useAbility(+a.slice(2)-1);
  switch(a){ case 'jump': return jump(); case 'target': return tabTarget(); case 'potion': return usePotion(); case 'mount': return toggleMount();
    case 'sit': if(me.emote&&me.emote.k==='sit'){ me.emote=null; sendPresence(true); } else doEmote('sit'); return;
    case 'autorun': autoRun=!autoRun; return;
    case 'map': return toggleWin('mapWin'); case 'quests': return toggleWin('qlogWin'); case 'character': return toggleWin('charWin'); case 'bags': return toggleWin('invWin');
    case 'party': return toggleWin('partyWin'); case 'players': return toggleWin('whoWin'); case 'help': return toggleWin('helpWin');
    case 'chat': chatIn.classList.remove('hidden'); chatIn.focus(); return;
    case 'interact': { if(nearLoot()) return openLoot(nearLoot()); if(nearNode()&&!NPCS.some(n=>dist(n.x,n.y,me.x,me.y)<70)) return startGather(nearNode());
      const near=NPCS.find(n=>dist(n.x,n.y,me.x,me.y)<110); if(near){ me.target={kind:'n',id:near.id}; talk(near); } else if(me.target&&me.target.kind==='n') talk(NPCS.find(n=>n.id===me.target.id)); return; } } }

/* =====================================================================
   ACHIEVEMENTS, STATS, COSMETICS, GIFTS, ARMORY SYNC
   ===================================================================== */
const ACH=[
  {id:"lvl5",n:"Seasoned",d:"Reach level 5",ic:"\u2b50",f:(c,S,QDONE,EPICALL,FORGE5)=>c.lvl>=5},
  {id:"lvl10",n:"Veteran",d:"Reach level 10",ic:"\ud83c\udf1f",f:(c,S,QDONE,EPICALL,FORGE5)=>c.lvl>=10},
  {id:"lvl15",n:"Hero of Emberfall",d:"Reach the maximum level, 15",ic:"\ud83d\udc51",f:(c,S,QDONE,EPICALL,FORGE5)=>c.lvl>=15},
  {id:"kill1",n:"First Blood",d:"Defeat your first monster",ic:"\ud83d\udde1\ufe0f",f:(c,S,QDONE,EPICALL,FORGE5)=>S.kills>=1},
  {id:"kill100",n:"Monster Hunter",d:"Defeat 100 monsters",ic:"\u2694\ufe0f",f:(c,S,QDONE,EPICALL,FORGE5)=>S.kills>=100},
  {id:"kill1000",n:"Scourge of Beasts",d:"Defeat 1,000 monsters",ic:"\ud83d\udc80",f:(c,S,QDONE,EPICALL,FORGE5)=>S.kills>=1000},
  {id:"boss_oldtusk",n:"Tusk Breaker",d:"Defeat Old Tusk",ic:"\ud83d\udc17",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.oldtusk||0)>0},
  {id:"boss_fangmaw",n:"Alpha Slayer",d:"Defeat Fangmaw",ic:"\ud83d\udc3a",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.fangmaw||0)>0},
  {id:"boss_hking",n:"Kingslayer",d:"Defeat the Hollow King",ic:"\ud83d\udddd\ufe0f",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.hking||0)>0},
  {id:"boss_wyrm",n:"Wyrmbane",d:"Defeat the Cinder Wyrm",ic:"\ud83d\udc09",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.wyrm||0)>0},
  {id:"boss_frostgiant",n:"Giant Felled",d:"Defeat Hrimgar the Frost Giant",ic:"\ud83e\uddca",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.frostgiant||0)>0},
  {id:"boss_lich",n:"Deathless",d:"Defeat Morvath the Lich",ic:"\u2620\ufe0f",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.bosses.lich||0)>0},
  {id:"explore5",n:"Wanderer",d:"Discover 5 landmarks",ic:"\ud83e\udded",f:(c,S,QDONE,EPICALL,FORGE5)=>c.disc.length>=5},
  {id:"exploreall",n:"Cartographer",d:"Discover every landmark in Emberfall",ic:"\ud83d\uddfa\ufe0f",f:(c,S,QDONE,EPICALL,FORGE5)=>c.disc.length>=POIS.length},
  {id:"quest10",n:"Helping Hand",d:"Complete 10 quests",ic:"\ud83d\udcdc",f:(c,S,QDONE,EPICALL,FORGE5)=>QDONE>=10},
  {id:"questall",n:"Lorekeeper",d:"Complete every quest",ic:"\ud83d\udcda",f:(c,S,QDONE,EPICALL,FORGE5)=>QDONE>=QUESTS.length},
  {id:"mount1",n:"Saddle Up",d:"Own a mount",ic:"\ud83d\udc0e",f:(c,S,QDONE,EPICALL,FORGE5)=>c.mounts.length>=1},
  {id:"celestial",n:"Among the Stars",d:"Own the Celestial Steed",ic:"\u2728",f:(c,S,QDONE,EPICALL,FORGE5)=>c.mounts.includes(4)},
  {id:"gold1000",n:"Coin Collector",d:"Earn 1,000 gold",ic:"\ud83d\udcb0",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.goldEarned||0)>=1000},
  {id:"legend",n:"Legend Born",d:"Obtain a legendary weapon",ic:"\ud83d\udd25",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.legendary||0)>=1},
  {id:"epicgear",n:"Clad in Glory",d:"Wear epic or better gear in every slot",ic:"\ud83d\udc9c",f:(c,S,QDONE,EPICALL,FORGE5)=>EPICALL},
  {id:"forge5",n:"Master of the Forge",d:"Upgrade an item to +5",ic:"\ud83d\udd28",f:(c,S,QDONE,EPICALL,FORGE5)=>FORGE5},
  {id:"gather50",n:"Green Thumb",d:"Gather 50 herbs or ore",ic:"\ud83c\udf3f",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.gathered||0)>=50},
  {id:"party",n:"Better Together",d:"Join a party",ic:"\ud83e\udd1d",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.partied||0)>=1},
  {id:"deaths10",n:"Back from the Brink",d:"Die 10 times and keep going",ic:"\ud83e\udea6",f:(c,S,QDONE,EPICALL,FORGE5)=>(S.deaths||0)>=10}
];
function cstats(){ const c=me.c; c.stats=c.stats||{}; const S=c.stats; S.kills=S.kills||0; S.bosses=S.bosses||{}; return S; }
function stat(k,n){ if(!me) return; const S=cstats(); S[k]=(S[k]||0)+n; }
function trackKill(m){ const S=cstats(); S.kills++; if(m.t.boss||m.t.elite) S.bosses[m.t.key]=(S.bosses[m.t.key]||0)+1; }
function questsDone(c){ return Object.values(c.qs||{}).filter(s=>s.st==='complete').length; }
function checkAch(){ if(!me) return; const c=me.c; c.ach=c.ach||{}; const S=cstats(); const eq=c.eq||{}; const QD=questsDone(c);
  const EP=['weapon','armor','trinket'].every(s=>eq[s]&&eq[s].rar>=3); const F5=['weapon','armor','trinket'].some(s=>eq[s]&&(eq[s].up||0)>=5); let any=false;
  for(const a of ACH){ if(c.ach[a.id]) continue; let ok=false; try{ ok=a.f(c,S,QD,EP,F5); }catch(e){} if(ok){ c.ach[a.id]=Date.now(); any=true; banner('Achievement unlocked',a.ic+' '+a.n,'win'); chatLine(`Achievement unlocked: ${a.n} (${a.d})`,'c-loot t3'); sfx('quest'); } }
  if(any){ persist(); armorySync(true); } }
setInterval(()=>{ try{ checkAch(); }catch(e){} },3000);
/* ---------- cosmetics ---------- */
const COS_TITLES=['Supporter','Founder','Champion','the Generous','Wyrmbane','Deathless'];
function cos(){ const c=me.c; c.cos=c.cos||{}; return c.cos; }
function cosBits(){ if(!me) return 0; const C=cos(); return (C.wings&&C.wingsOn!==false?1:0)|(C.aura&&C.auraOn!==false?2:0); }
function myTitle(){ if(!me) return ''; const C=cos(); return C.showTitle!==false&&C.title?C.title:''; }
function drawCosWings(X,Y,Z,face,t){ mreset(); mtr(X,Y+1.42,Z); mry(-face); for(const s of [-1,1]){ mpush(); mtr(-.24,0,s*.12); mrx(-s*(.45+Math.sin(t*2.6)*.2)); P(GEO.wing,.95,.75,.95*s,[1,.42,.08],1.3,0,0,0,.72); P(GEO.wing,.6,.75,.6*s,[1,.82,.3],1.7,.04,.02,0,.55); mpop(); }
  if(Math.random()<.25){ const a=face+Math.PI+(Math.random()-.5)*1.6; P3(X+Math.cos(a)*.6,Y+1.3+Math.random()*.6,Z+Math.sin(a)*.6,0,.5,0,.9,.08,Math.random()<.5?'#ff8a1a':'#ffd36a',{glow:true}); } }
const GIFTS={wings:'Phoenix Wings',aura:'Supporter Aura',steed:'Celestial Steed',supporter:'Supporter Pack',founder:"Founder's Pack"};
function applyGift(what,from){ if(!me) { (saves.pendingGifts=saves.pendingGifts||[]).push(what); saveAll(saves); return; } const C=cos(); const c=me.c; let label=GIFTS[what]||what;
  if(what==='wings') C.wings=1; else if(what==='aura') C.aura=1; else if(what==='steed'){ if(!c.mounts.includes(4)) c.mounts.push(4); }
  else if(what==='supporter'){ C.aura=1; C.title=C.title||'Supporter'; C.titles=[...new Set([...(C.titles||[]),'Supporter'])]; }
  else if(what==='founder'){ C.aura=1; C.wings=1; if(!c.mounts.includes(4)) c.mounts.push(4); C.title='Founder'; C.titles=[...new Set([...(C.titles||[]),'Founder','Supporter'])]; }
  else if(what.startsWith('title:')){ const tt=clean(what.slice(6)).slice(0,20); if(!tt) return; C.title=tt; C.titles=[...new Set([...(C.titles||[]),tt])]; label='Title: '+tt; }
  else return;
  banner('A gift has arrived!',label+(from?' — from '+from:''),'win'); sfx('legend'); chatLine(`You received: ${label}. Thank you for supporting Emberfall! Open your Character panel (C) to show or hide cosmetics.`,'c-loot t4');
  persist(); renderChar(); sendPresence(true); armorySync(true); }
function giftCmd(arg){ const m=arg.match(/^(\S+)\s+(.+)$/); if(!m) return chatLine('Usage: /gift <player> wings|aura|steed|supporter|founder|title <text>','c-err');
  const who=m[1], what0=m[2].trim().toLowerCase(); const what=what0.startsWith('title ')?'title:'+m[2].trim().slice(6):what0;
  if(!GIFTS[what]&&!what.startsWith('title:')) return chatLine('Gift must be one of: wings, aura, steed, supporter, founder, title <text>','c-err');
  if(room&&typeof room.gift==='function'){ room.gift(who,what); return gmOk(`Gift "${GIFTS[what]||what}" sent to ${who}. If they are offline they receive it next time they log in.`); }
  if(me.c.name.toLowerCase()===who.toLowerCase()) return applyGift(what,'the Realm');
  chatLine('Gifts to other players work on your online realm server.','c-err'); }
/* ---------- armory sync (server realms only) ---------- */
let armLast=0;
function armorySnapshot(){ const c=me.c; const eq={}; for(const s of ['weapon','armor','trinket']){ const it=c.eq[s]; if(it) eq[s]={name:it.name,rar:it.rar,slot:it.slot,pow:it.pow,sta:it.sta,up:it.up||0,lv:it.lv,leg:it.leg||null,desc:it.desc||null}; }
  return {pid:MY_PID,name:c.name,cls:c.cls,lvl:c.lvl,xp:c.xp,xpNeed:xpNeed(c.lvl),gold:c.gold,zone:zoneAtPx(me.x,me.y),eq,hp:me.mhp,res:me.mres,pow:me.pow,sta:me.sta,
    quests:Object.keys(c.qs||{}).filter(k=>c.qs[k].st==='complete'),disc:c.disc||[],mounts:c.mounts||[],mount:c.mount||0,stats:cstats(),ach:c.ach||{},
    cos:{title:myTitle(),wings:!!cos().wings,aura:!!cos().aura},party:me.party||'',created:c.created||0,v:VERSION}; }
function armorySync(force){ if(!me||!room||typeof room.armory!=='function') return; const t=now(); if(!force&&t-armLast<45) return; armLast=t; try{ room.armory(armorySnapshot()); }catch(e){} }
setInterval(()=>armorySync(false),5000);

/* =====================================================================
   INPUT
   ===================================================================== */
const keys={};
const chatIn=$('chatin');
addEventListener('keydown',e=>{
  if(!me) { if(e.key==='Enter' && document.activeElement===$('nameIn')) $('enterBtn').click(); return; }
  if(document.activeElement===chatIn){ if(e.key==='Enter'){ sendChat(chatIn.value); chatIn.value=''; chatIn.blur(); chatIn.classList.add('hidden'); e.preventDefault(); } else if(e.key==='Escape'){ chatIn.value=''; chatIn.blur(); chatIn.classList.add('hidden'); } return; }
  if(document.activeElement && (document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA')){ if(e.key==='Escape') document.activeElement.blur(); if(e.key==='Enter'&&$('ptJoin')) $('ptJoin').click(); return; }
  const k=e.key.toLowerCase();
  if(k==='enter'){ chatIn.classList.remove('hidden'); chatIn.focus(); e.preventDefault(); return; }
  if(k==='/' ){ chatIn.classList.remove('hidden'); chatIn.focus(); chatIn.value='/'; e.preventDefault(); return; }
  keys[k]=true;
  if(k==='escape'){ onEscape(); return; }
  if(!$('escMenu').classList.contains('hidden')) return;
  const act=KEYMAP[k]; if(!act) return; if(act==='target'||act==='jump') e.preventDefault();
  if(act==='forward'||act==='back'||act==='left'||act==='right'){ if(act==='back'||act==='forward') autoRun=false; return; }
  doAction(act);
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
function tabTarget(){
  const list=mobs.filter(m=>!m.dead&&dist(m.rx,m.ry,me.x,me.y)<480).sort((a,b)=>dist(a.rx,a.ry,me.x,me.y)-dist(b.rx,b.ry,me.x,me.y));
  if(!list.length) return; const cur=me.target&&me.target.kind==='m'?list.findIndex(m=>m.id===me.target.id):-1;
  const m=list[(cur+1)%list.length]; me.target={kind:'m',id:m.id};
}

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>toggleWin(b.dataset.close,false));
document.querySelectorAll('#menuBtns button').forEach(b=>b.onclick=()=>{ const k=b.dataset.k; if(k==='who') toggleWin('whoWin'); if(k==='char') toggleWin('charWin'); if(k==='sound'){ audInit(); toggleWin('soundWin'); } if(k==='inv') toggleWin('invWin'); if(k==='help') toggleWin('helpWin'); if(k==='party'){ toggleWin('partyWin'); renderPartyWin(); } if(k==='map') toggleWin('mapWin'); if(k==='qlog') toggleWin('qlogWin'); b.blur(); });
$('netline').onclick=()=>toggleWin('whoWin');
$('gmBtn').onclick=e=>{ toggleGMWin(); e.currentTarget.blur(); };
$('mapC').addEventListener('click',e=>{ if(!isGM||!e.shiftKey||!me||MAPZ.moved) return; const cvm=e.currentTarget, r=cvm.getBoundingClientRect(); const mpx=(e.clientX-r.left)*cvm.width/r.width, mpy=(e.clientY-r.top)*cvm.height/r.height; const V=mapView(); gmTpTo((mpx-V.ox)/V.S*TS,(mpy-V.oy)/V.S*TS); });
$('releaseBtn').onclick=release;

/* =====================================================================
   LOGIN
   ===================================================================== */
makeEmbers(); renderLogin(); $('enterBtn').onclick=createChar; initBagZones(); initEsc(); initTouch(); $('qArrow').onclick=cycleQuest;
document.querySelectorAll('[data-mf]').forEach(cb=>cb.onchange=()=>{ MAPF[cb.dataset.mf]=cb.checked; drawWorldMap(); });
$('mapC').addEventListener('mousemove',e=>{ const cv=$('mapC'), r=cv.getBoundingClientRect(); const px=(e.clientX-r.left)*cv.width/r.width, py=(e.clientY-r.top)*cv.height/r.height; let best=null,bd=1e9;
  if(MAPZ.drag) return; for(const f of mapFeat){ const d=Math.hypot(f.x+(MAPZ.ox||0)-px,f.y+(MAPZ.oy||0)-py); if(d<f.r&&d<bd){ bd=d; best=f; } } const tp=$('tip');
  if(best){ tp.textContent=best.tip; tp.classList.remove('hidden'); tp.style.left=Math.min(innerWidth-270,e.clientX+14)+'px'; tp.style.top=(e.clientY+14)+'px'; } else tp.classList.add('hidden'); });
$('mapC').addEventListener('mouseleave',hideTip);
(function(){ const cv=$('mapC'); const loc=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]; };
  cv.addEventListener('wheel',e=>{ e.preventDefault(); const [px,py]=loc(e); mapZoomBy(e.deltaY<0?1.25:.8,px,py); },{passive:false});
  cv.addEventListener('pointerdown',e=>{ if(e.button!==0||e.shiftKey) return; MAPZ.drag={x:e.clientX,y:e.clientY,cx:MAPZ.cx,cy:MAPZ.cy}; MAPZ.moved=false; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
  cv.addEventListener('pointermove',e=>{ const d=MAPZ.drag; if(!d) return; const r=cv.getBoundingClientRect(); const k=cv.width/r.width/(cv.width/MW*MAPZ.z); const dx=e.clientX-d.x, dy=e.clientY-d.y; if(Math.abs(dx)+Math.abs(dy)>4){ MAPZ.moved=true; cv.classList.add('drag'); hideTip(); }
    MAPZ.cx=d.cx-dx*k; MAPZ.cy=d.cy-dy*k; drawWorldMap(); });
  const end=()=>{ MAPZ.drag=null; cv.classList.remove('drag'); setTimeout(()=>{ MAPZ.moved=false; },0); }; cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  $('mapZin').onclick=()=>mapZoomBy(1.4); $('mapZout').onclick=()=>mapZoomBy(1/1.4); $('mapZme').onclick=()=>{ if(MAPZ.z<2) MAPZ.z=2.5; mapCenterMe(); };
  const mz=f=>{ OPT.miniZ=Math.max(.5,Math.min(4,(OPT.miniZ||1)*f)); saveOpts(); if(me) drawMini(); };
  $('mzIn').onclick=e=>{ e.stopPropagation(); mz(1.3); }; $('mzOut').onclick=e=>{ e.stopPropagation(); mz(1/1.3); };
  $('miniC').addEventListener('wheel',e=>{ e.preventDefault(); mz(e.deltaY<0?1.2:1/1.2); },{passive:false}); })();


/* =====================================================================
   MAIN LOOP
   ===================================================================== */
let lastT=now(), saveT=0;
function jump(){ if(!me||me.dead||me.mounted||isSwimming()||me.jumpH>0.01||me.rootU>now()) return; me.jumpV=5.2; }
function updateDash(t){ const d=me.dash, m=d.m; const k=Math.min(1,(t-d.t0)/d.dur);
  const ang=Math.atan2(m.ry-d.sy,m.rx-d.sx); const tx=m.rx-Math.cos(ang)*(m.t.r+14), ty=m.ry-Math.sin(ang)*(m.t.r+14);
  const nx=lerp(d.sx,tx,k), ny=lerp(d.sy,ty,k); if(!blocked(nx,ny,10)){ me.x=nx; me.y=ny; } me.face=ang;
  const [X,Y,Z]=ph3(me.x,me.y,1); for(let i=0;i<4;i++) P3(X+(Math.random()-.5)*.4,Y+(Math.random()-.5)*.8,Z+(Math.random()-.5)*.4,-Math.cos(ang)*3,0,-Math.sin(ang)*3,.4,.12,'#9fc4ff',{glow:true});
  if(k>=1){ me.dash=null; if(!m.dead){ pushAct(2,m.id,1500,0); spark(m.rx,m.ry,'#fff3a0'); burst(m.rx,m.ry,'#c8b48a',14,120,{h:.2}); shake(5); me.swingT=t; } } }
function update(dt){
  const t=now();
  syncPeers();
  if(me){
    let f=0,s=0;
    if(!me.dead&&!me.dash){ if(keys[BIND.forward]||keys['arrowup']||autoRun)f++; if(keys[BIND.back]||keys['arrowdown'])f--; if(keys[BIND.left]||keys['arrowleft'])s--; if(keys[BIND.right]||keys['arrowright'])s++;
      if(JOY.on&&Math.hypot(JOY.x,JOY.y)>.18){ f=-JOY.y; s=JOY.x; autoRun=false; } }
    if(MOUSE.both&&!me.dead&&!me.dash) f=1;
    const rooted=me.rootU>t; const yaw=CAM.yaw;
    let mx=Math.cos(yaw)*f-Math.sin(yaw)*s, my=Math.sin(yaw)*f+Math.cos(yaw)*s;
    const back=f<0&&!s;
    me.moving=!!(mx||my)&&!rooted;
    if(mx||my){ me.face=back?yaw:Math.atan2(my,mx); }
    if(me.moving){ const l=Math.hypot(mx,my), swm=isSwimming(), sp=(back?95:155)*(me.mounted?MOUNTS[me.mounted].speed:1)*(swm?.6:1)*(buffOn('swift')?1.2:1)*(gm.speed||1)*dt; movePlayer(me,mx/l*sp,my/l*sp,10); me.stepT-=dt; if(me.stepT<=0){ me.stepT=me.mounted?.15:.3; if(!swm) footDust(me.x,me.y); } }
    else if(!me.dash){ const te=targetEnt(); if(te&&te.kind!=='n'&&!te.self&&(me.cast||me.auto)) me.face=Math.atan2(te.y-me.y,te.x-me.x); }
    if(me.jumpV||me.jumpH>0){ me.jumpV=(me.jumpV||0)-15*dt; me.jumpH=Math.max(0,(me.jumpH||0)+me.jumpV*dt); if(me.jumpH<=0){ me.jumpH=0; me.jumpV=0; footDust(me.x,me.y); } }
    if(me.dash) updateDash(t);
    if(!me.dead){
      updateCast(); updateAuto(dt);
      const cl=CLS[me.c.cls], ic=inCombat();
      if(cl.res==='mana') me.res=Math.min(me.mres,me.res+me.mres*(t-me.lastSpend>5?.035:.012)*dt);
      else if(!ic) me.res=Math.max(0,me.res-3*dt);
      if(!ic) me.hp=Math.min(me.mhp,me.hp+me.mhp*.025*dt);
      for(const h of me.hots){ if(t>=h.next){ h.next+=2; h.left--; healMe(h.amt); } } me.hots=me.hots.filter(h=>h.left>0);
      for(const d of me.dots){ if(t>=d.next){ d.next+=1.5; d.left--; takeDamage(d.amt/cl.mit,null,0); const [X,Y,Z]=ph3(me.x,me.y,1.2); burst3(X,Y,Z,'#7aff4a',6,1,{glow:true,up:1}); if(me.dead) break; } }
      me.dots=me.dots.filter(d=>d.left>0);
      if(me.absorbU<t) me.absorb=0;
    }
    if(t-saveT>10){ saveT=t; persist(); }
  }
  if(amHost) hostSim(dt);
  const k=1-Math.pow(.0005,dt);
  for(const m of mobs){ const ox=m.rx, oy=m.ry;
    if(Math.abs(m.rx-m.x)>200||Math.abs(m.ry-m.y)>200){m.rx=m.x;m.ry=m.y}
    m.rx=lerp(m.rx,m.x,amHost?1:k*.9); m.ry=lerp(m.ry,m.y,amHost?1:k*.9);
    const mv=dist(ox,oy,m.rx,m.ry);
    if(!amHost){ if(mv>.3) m.face=Math.atan2(m.ry-oy,m.rx-ox); else if(m.tgt){ const p=entPos('p',m.tgt); if(p) m.face=Math.atan2(p.y-m.ry,p.x-m.rx); } }
    if(mv>.8 && !m.t.fly && !m.dead && Math.random()<.04) footDust(m.rx,m.ry);
  }
  for(const o of others.values()){ const ox=o.rx, oy=o.ry; if(Math.abs(o.rx-o.x)>300||Math.abs(o.ry-o.y)>300){o.rx=o.x;o.ry=o.y} o.rx=lerp(o.rx,o.x,k); o.ry=lerp(o.ry,o.y,k);
    o.moving=dist(ox,oy,o.rx,o.ry)>.4; if(o.moving&&Math.random()<.06) footDust(o.rx,o.ry); }
  ambient(dt); updateParticles(dt);
  shakeMag*=Math.pow(.004,dt); if(shakeMag<.1) shakeMag=0; hurtFlash=Math.max(0,hurtFlash-dt*1.8);
  worldTick(dt);
  if(me) sendPresence(false);
}
let emaDt=.016, rsT=0;
function frame(){
  const t=now(); const rawDt=t-lastT; const dt=Math.min(.1,rawDt); lastT=t;
  emaDt=lerp(emaDt,Math.min(.2,rawDt),.05); rsT+=dt; if(rsT>1.5){ rsT=0; const old=RSCALE; if(emaDt>.026&&RSCALE>GFX.rmin) RSCALE=Math.max(GFX.rmin,RSCALE-.1); else if(emaDt<.0145&&RSCALE<RSMAX) RSCALE=Math.min(RSMAX,RSCALE+.1); if(Math.abs(old-RSCALE)>.01) resize(); }
  try{ update(dt); render(dt); if(me){ updateBar(); if(++uiTick%3===0){ updateUI(); drawMini(); } } }catch(e){ console.error(e); if(!frame.errShown){ frame.errShown=1; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
connectRoom();
