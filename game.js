// Emberfall Online — the whole game. Edit freely; see README.md for a map of this file.
"use strict";
/* =====================================================================
   EMBERFALL ONLINE — an original browser MMO.
   Multiplayer: every open page shares one world through room presence.
   The peer with the lowest label simulates monsters ("world host") and
   publishes them; others send their actions in their own presence.
   ===================================================================== */
const VERSION = 39;
const TS = 32, MW = 336, OWH = 222, MH = OWH+98;
const WS=2.4, TL={x:56,y:82,r:19}, TC={x:112,y:176};
/* logical (old map) -> physical (new map), and back */
function WP(x,y){ const dx=x-TL.x, dy=y-TL.y, d=Math.hypot(dx,dy); if(d<=TL.r) return [TC.x+dx,TC.y+dy]; const f=(TL.r+(d-TL.r)*WS)/d; return [TC.x+dx*f,TC.y+dy*f]; }
function WI(X,Y){ const dx=X-TC.x, dy=Y-TC.y, d=Math.hypot(dx,dy); if(d<=TL.r) return [TL.x+dx,TL.y+dy]; const f=(TL.r+(d-TL.r)/WS)/d; return [TL.x+dx*f,TL.y+dy*f]; }
const WPT=(x,y)=>{ const p=WP(x,y); return [p[0]-x,p[1]-y]; };
/* structures are moved as a whole (never stretched): the offset of each one's anchor */
const VGO=WPT(99.5,48.5).map(Math.round), STO=WPT(91,72).map(Math.round), CRO=WPT(140,16).map(Math.round), RUO=WPT(88,40).map(Math.round);
let OFX=0, OFY=0; const _slp=Array.prototype.push;
function OFS(o){ OFX=o?o[0]:0; OFY=o?o[1]:0; try{ STAT_LIGHTS.push=OFX||OFY?function(...a){ for(const l of a){ l.x+=OFX; l.z+=OFY; } return _slp.apply(this,a); }:_slp; }catch(e){} }
const AR={x0:20,y0:OWH+52,w:120,h:40}; AR.x1=AR.x0+AR.w-1; AR.y1=AR.y0+AR.h-1; AR.cx=AR.x0+AR.w/2; AR.cy=AR.y0+AR.h/2; AR.shr=[[AR.x0+9.5,AR.cy],[AR.x1-8.5,AR.cy]]; AR.gate={x:0,y:0};
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
T.ICE=17; T.SNOW=18; T.TWALL=19; T.VOID=20; T.DWALL=21; T.DFLOOR=22; T.COLUMN=23; T.DOOR=24; T.DGATE=25; T.FENCE=26;
const SOLID=new Set([T.TREE,T.WATER,T.WALL,T.LAVA,T.HOUSE,T.ROCK,T.FOUNT,T.TWALL,T.VOID,T.DWALL,T.COLUMN,T.DGATE,T.FENCE]);
const TOWN={x:TC.x,y:TC.y,r:19,wallR:18.65,gates:[],gatePts:[]};
const LAIR=(()=>{ const p=WP(56,9); return {x:Math.round(p[0]),y:Math.round(p[1])}; })();
const ZONES={
  town:{name:'Hearthmere',sub:'Sanctuary',lv:''},
  meadow:{name:'Amberfield',sub:'Level 1–2',lv:''},
  forest:{name:'Thornwood',sub:'Level 2–4'},
  swamp:{name:'Gloamfen',sub:'Level 3–5'},
  ruins:{name:'Ruins of Vael',sub:'Level 5–7'},
  ash:{name:'Cinder Caldera',sub:'Level 7–10'},
  lake:{name:'Mirrowmere',sub:'Tranquil waters'},
  vault:{name:'The Sunken Vault',sub:'Dungeon · Level 10'},
  arena:{name:'Bloodsand Arena',sub:'Free-for-all PvP · Level 5+'},
};
function zoneOf(tx,ty){
  if(ty>=AR.y0-3) return 'arena';
  if(ty>=OWH) return 'vault';
  if(Math.hypot(tx-TOWN.x,ty-TOWN.y)<TOWN.r) return 'town';
  const L=WI(tx,ty); return zoneOfL(L[0],L[1]); }
function zoneOfL(tx,ty){
  if(Math.hypot(tx-TL.x,ty-TL.y)<TL.r) return 'meadow';
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
const tAt=(tx,ty)=>{ tx+=OFX|0; ty+=OFY|0; return (tx<0||ty<0||tx>=MW||ty>=MH)?T.ROCK:map[ty*MW+tx]; };
const setT=(tx,ty,v)=>{ tx+=OFX|0; ty+=OFY|0; if(tx>=0&&ty>=0&&tx<MW&&ty<MH) map[ty*MW+tx]=v; };
/* ---------- v22: the Sunken Vault, a level 10 dungeon carved below the overworld (rows OWH..MH) ---------- */
const VAULT={OX:8,OY:OWH+3,range:60,gate:{x:(99.5+(VGO[0]|0))*TS,y:(48.75+(VGO[1]|0))*TS},start:{x:0,y:0},exit:{x:(99.5+(VGO[0]|0))*TS,y:(50.7+(VGO[1]|0))*TS},doors:[],boss:{},emptySince:0,hint:false};
function carveVault(){ const V=VAULT, F=(x,y,t)=>setT(V.OX+x,V.OY+y,t);
  const rect=(x0,y0,x1,y1,t)=>{ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) F(x,y,t??T.DFLOOR); };
  const circ=(cx,cy,r,t)=>{ for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++) if(Math.hypot(x-cx,y-cy)<=r) F(x,y,t??T.DFLOOR); };
  for(let y=OWH;y<MH;y++)for(let x=0;x<MW;x++) setT(x,y,T.VOID);
  rect(2,6,10,14); rect(11,9,16,11);                                                                   // entry stair and passage
  rect(17,3,33,17); for(const [x,y] of [[21,7],[29,7],[21,13],[29,13]]) F(x,y,T.COLUMN); rect(34,9,39,11);   // Hall of Sentries
  circ(47,10,7.6); rect(55,9,59,11);                                                                   // the Gatekeeper's Rotunda
  rect(60,2,86,19); rect(71,2,74,19,T.WATER); rect(71,5,74,7,T.BRIDGE); rect(71,13,74,15,T.BRIDGE);   // the Flooded Galleries
  for(const [x,y] of [[65,4],[65,17],[80,4],[80,17]]) F(x,y,T.COLUMN);
  rect(80,20,82,24);                                                                                    // the stair down to the nest
  circ(81,31,7.2); circ(75.5,27.5,3.4); circ(87,35,3.2); circ(76,35,2.6); rect(89,30,93,32);           // the Silt Nest
  rect(94,27,117,35); for(let x=97;x<=113;x+=4){ F(x,28,T.COLUMN); F(x,34,T.COLUMN); } rect(118,30,121,32);  // the Drowned Colonnade
  rect(122,22,140,40); for(const [cx,cy] of [[122,22],[140,22],[122,40],[140,40]]) for(let dy=0;dy<3;dy++)for(let dx=0;dx<3-dy;dx++) F(cx+(cx>130?-dx:dx),cy+(cy>30?-dy:dy),T.VOID);  // Throne of the Drowned King
  rect(124,25,126,27,T.WATER); rect(136,25,138,27,T.WATER); rect(124,35,126,37,T.WATER); rect(136,35,138,37,T.WATER);
  for(const [x,y] of [[128,26],[128,36],[133,26],[133,36]]) F(x,y,T.COLUMN);
  carveArena();
  for(let y=OWH;y<MH;y++)for(let x=0;x<MW;x++){ if(tAt(x,y)!==T.VOID) continue; let open=false;
    for(let dy=-1;dy<=1&&!open;dy++)for(let dx=-1;dx<=1;dx++){ if(y+dy<OWH) continue; const n=tAt(x+dx,y+dy); if(n!==T.VOID&&n!==T.DWALL&&n!==T.ROCK){ open=true; break; } }
    if(open) setT(x,y,T.DWALL); }
  for(const [x,y0,y1,boss] of [[57,9,11,'ossric'],[91,30,32,'siltmother']]){ for(let y=y0;y<=y1;y++) F(x,y,T.DOOR); V.doors.push({x:V.OX+x,y0:V.OY+y0,y1:V.OY+y1,boss,lift:0}); }
  V.start={x:(V.OX+6.5)*TS,y:(V.OY+10.5)*TS};
}
function carveArena(){ const {x0,y0,w,h,cx,cy}=AR;
  for(let y=y0;y<=AR.y1;y++)for(let x=x0;x<=AR.x1;x++){ const nx=(x+.5-cx)/(w/2), ny=(y+.5-cy)/(h/2); if(nx**4+ny**4<=1) setT(x,y,T.SAND); }
  for(const [sx,sy] of AR.shr) for(let y=Math.floor(sy-4);y<=sy+4;y++)for(let x=Math.floor(sx-4);x<=sx+4;x++) if(Math.hypot(x+.5-sx,y+.5-sy)<=4.2) setT(x,y,T.COBBLE);
  // cover: broken pillars, ruined wall stubs and a sunken centre ring
  for(let k=0;k<10;k++){ const a=k/10*6.283+.3; const x=Math.round(cx+Math.cos(a)*12.5-.5), y=Math.round(cy+Math.sin(a)*7-.5); setT(x,y,T.COLUMN); }
  for(const [x,y,len,vert] of [[46,AR.y0+8,5,0],[46,AR.y1-8,5,0],[109,AR.y0+8,5,0],[109,AR.y1-8,5,0],[62,AR.y0+5,4,1],[97,AR.y1-8,4,1],[70,AR.y0+14,3,0],[87,AR.y1-14,3,0]])
    for(let i=0;i<len;i++) setT(x+(vert?0:i),y+(vert?i:0),T.DWALL);
  for(const [x,y] of [[40,AR.cy-6],[40,AR.cy+5],[119,AR.cy-6],[119,AR.cy+5],[56,AR.cy],[103,AR.cy-1]]) { setT(x,y,T.COLUMN); setT(x+1,y,T.COLUMN); }
}
function edgeOf(tx,ty){ if(ty>=OWH) return Math.min(tx,ty-OWH,MW-1-tx,MH-1-ty); const L=WI(tx,ty); return Math.min(tx,ty,MW-1-tx,OWH-1-ty,Math.max(0,Math.min(L[0],L[1],159-L[0],111-L[1]))*WS); }
function ridgeL(tx,ty){ const L=WI(tx,ty); return L[0]>=109.5&&L[0]<=114.5&&!(L[1]>=56&&L[1]<=62); }
const inVault=(px,py)=>py>=OWH*TS&&py<(AR.y0-3)*TS;
const inArena=(px,py)=>py>=(AR.y0-3)*TS, arenaSafe=(px,py)=>AR.shr.some(([sx,sy])=>Math.hypot(px/TS-sx,py/TS-sy)<5.2), pvpOn=(px,py)=>inArena(px,py)&&!arenaSafe(px,py);
function doorClosedAt(tx,ty){ for(const d of VAULT.doors) if(tx===d.x&&ty>=d.y0&&ty<=d.y1){ const b=VAULT.boss[d.boss]; return !(b&&b.dead); } return false; }
/* the gate in the Ruins of Vael: a flattened forecourt, a path down to the road, and the gatehouse itself (solid) */
function carveStable(){ const X0=85,X1=97,Z0=64,Z1=73;
  for(let y=62;y<=81;y++)for(let x=84;x<=99;x++){ const t=tAt(x,y); if(t===T.TREE||t===T.ROCK||t===T.WALL) setT(x,y,T.GRASS); }
  for(let x=X0;x<=X1;x++){ setT(x,Z0,T.FENCE); if(x<87||x>89) setT(x,Z1,T.FENCE); } for(let y=Z0;y<=Z1;y++){ setT(X0,y,T.FENCE); setT(X1,y,T.FENCE); }
  for(let y=75;y<=78;y++)for(let x=92;x<=97;x++) setT(x,y,T.HOUSE);
  for(let y=74;y<=80;y++)for(let x=88;x<=89;x++) setT(x,y,T.PATH); for(let x=78;x<=89;x++)for(const y of [79,80]){ const t=tAt(x,y); if(t!==T.WATER&&t!==T.BRIDGE&&t!==T.HOUSE) setT(x,y,T.PATH); } }
function carveVaultGate(){
  for(let y=42;y<=55;y++)for(let x=93;x<=106;x++){ if(Math.hypot(x-99.5,y-48.5)>5.6) continue; const t=tAt(x,y); if(t!==T.PATH&&t!==T.BRIDGE) setT(x,y,T.RUIN); }
  for(let y=51;y<=57;y++)for(let x=98;x<=100;x++) if(tAt(x,y)!==T.BRIDGE) setT(x,y,T.PATH);
  for(let x=97;x<=101;x++){ setT(x,46,T.DGATE); setT(x,47,T.DGATE); }
}

function genWorld(){
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const z=zoneOf(x,y); zmap[y*MW+x]=z; const LQ=WI(x,y), lx=LQ[0], ly=LQ[1];
    const h=hash2(x,y,3), n=fbm(x*.13,y*.13,1);
    let t=T.GRASS;
    switch(z){
      case 'town': t=T.COBBLE; break;
      case 'meadow': t=T.GRASS; if(n>.72&&h<.4) t=T.TREE; else if(h<.006) t=T.ROCK; break;
      case 'forest': t=T.FOREST; if(h<.2&&n>.36&&(x+y)%2===0) t=T.TREE; else if(h>.995) t=T.ROCK; break;
      case 'swamp': t=T.SWAMP; if(fbm(x*.21,y*.21,5)>.6) t=T.WATER; else if(h<.03) t=T.TREE; break;
      case 'ruins': { const f=fbm(x*.16,y*.16,8); t=f>.42?T.RUIN:T.GRASS;
        if(t===T.RUIN && ((x%7===0)||(y%7===0)) && hash2(x>>1,y>>1,4)<.5) t=T.WALL;
        if(t===T.GRASS && h<.03) t=T.TREE; break; }
      case 'ash': t=T.ASH; if(fbm(x*.19,y*.19,9)>.64) t=T.LAVA; else if(h<.035) t=T.ROCK; break;
      case 'lake': { const d=Math.hypot(lx-90,ly-93)*WS+(fbm(x*.2,y*.2,11)-.5)*6; t=d<8.5*WS?T.WATER:d<10*WS?T.SAND:T.GRASS; break; }
      case 'frost': { t=T.SNOW; const d=Math.hypot(lx-142,ly-84)*WS+(fbm(x*.2,y*.2,12)-.5)*5; if(d<8*WS) t=T.ICE; else if(h<.13&&n>.42) t=T.TREE; else if(h>.985) t=T.ROCK; break; }
      case 'crypt': t=T.RUIN; break;
      case 'vault': t=T.VOID; break;
      case 'arena': t=T.VOID; break;
    }
    if(y<OWH){ const eg=edgeOf(x,y); if(eg<2||eg<3&&h<.6) t=T.ROCK;
    if(lx>=110+(h<.3?.6:0)&&lx<=114-(h>.7?.6:0)&&!(ly>=56&&ly<=62)) t=T.ROCK; }
    map[y*MW+x]=t;
  }
  // paths out of town
  const carve=(x0,y0,x1,y1,seed)=>{const L=Math.hypot(x1-x0,y1-y0);const nx=-(y1-y0)/L, ny=(x1-x0)/L; let gRec=!(x0===TOWN.x&&y0===TOWN.y);
    for(let i=0;i<=L*3;i++){const t=i/(L*3);const w=(fbm(t*5,seed,seed)-.5)*9*WS*Math.sin(t*Math.PI);
      const cx=x0+(x1-x0)*t+nx*w, cy=y0+(y1-y0)*t+ny*w; if(!gRec&&Math.hypot(cx-TOWN.x,cy-TOWN.y)>=14.6){ gRec=true; TOWN.gatePts.push([cx,cy]); }
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const tx=Math.round(cx+ox),ty=Math.round(cy+oy);
        if(tx<3||ty<3||tx>=MW-3||ty>=MH-3) continue; const cur=tAt(tx,ty);
        if(cur===T.COBBLE) continue; setT(tx,ty, cur===T.WATER||cur===T.LAVA ? T.BRIDGE : T.PATH);}}};
  const Q=WP, cv=(a,b,sd)=>carve(a[0],a[1],b[0],b[1],sd), ST=(x,y,o)=>[x+o[0],y+o[1]];
  { const gw=TOWN.x-TOWN.r-2, ge=TOWN.x+TOWN.r+2, gy=TOWN.y;
    carve(TOWN.x,gy,gw,gy,13); carve(TOWN.x,gy,ge,gy,14);
    cv([gw,gy],Q(26,48),3); cv([gw,gy],Q(22,94),4);
    cv([ge,gy],Q(73,60),15); cv(Q(73,60),Q(57,31),2); cv(Q(57,31),Q(56,12),16); cv(Q(73,60),Q(84,44),5); cv(Q(73,60),Q(86,58),17); cv([ge,gy],Q(82,90),6);
    cv([ge,gy],ST(80,79.5,STO),18); cv(ST(99,57,VGO),Q(99,59),19); }
  cv(Q(26,48),Q(40,20),7);
  cv(Q(84,44),ST(88,45,RUO),8);
  cv(Q(86,58),Q(124,59),9); cv(Q(124,59),ST(140,27,CRO),10); cv(Q(124,59),Q(144,76),11); cv(Q(124,59),Q(146,56),12);
  OFS(CRO);
  for(let y=8;y<=24;y++)for(let x=130;x<=150;x++){ const edge=x===130||x===150||y===8||y===24; if(edge&&!(y===24&&x>=138&&x<=142)) setT(x,y,T.WALL); else if(!edge) setT(x,y,T.RUIN); }
  for(const [px,py] of [[134,12],[146,12],[134,19],[146,19],[137,16],[143,16]]) setT(px,py,T.WALL);
  OFS(RUO);
  for(let y=33;y<=47;y++)for(let x=81;x<=95;x++){ const d=Math.hypot(x-88,y-40); if(d<5.6) setT(x,y,T.RUIN); else if(d<6.6 && (x+y)%3===0 && tAt(x,y)!==T.PATH) setT(x,y,T.WALL); }
  OFS(null);
  // lair clearing
  for(let y=LAIR.y-7;y<=LAIR.y+7;y++)for(let x=LAIR.x-9;x<=LAIR.x+9;x++){const d=Math.hypot((x-LAIR.x)/1.3,y-LAIR.y);
    if(d<6.2) setT(x,y,T.ASH); else if(d<7.2 && tAt(x,y)!==T.PATH && tAt(x,y)!==T.BRIDGE) setT(x,y,T.ROCK);}
  // town: houses + fountain
  const H=[[-9,-7,5,3],[4,-7,5,3],[-9,3,5,3],[5,3,5,3],[-3,-10,6,2],[-6,-11,3,2],[4,-11,3,2],[-12,-5,3,3],[10,-6,2,3],[-10,7,3,2],[-3,10,6,3],[7,8,3,2],[10,4,2,3],[-12,3,2,3],[-8,-15,4,2],[-2,-16,4,2],[4,-15,4,2],[9,-12,3,2],[-13,-11,3,3],[-8,13,4,2],[3,14,4,2],[-14,9,3,2],[11,10,2,2],[14,-6,2,3],[14,4,2,3],[-16,-6,2,3],[-16,4,2,3]];
  for(const [dx,dy,w,h] of H){const hx=TOWN.x+dx,hy=TOWN.y+dy;houses.push({x:hx,y:hy,w,h});
    for(let y=hy;y<hy+h;y++)for(let x=hx;x<hx+w;x++)setT(x,y,T.HOUSE);}
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)setT(TOWN.x+x,TOWN.y+y,T.FOUNT);
  { const R=TOWN.wallR, half=1.45/R; TOWN.gates=[{c:Math.PI,a:Math.PI-half,b:Math.PI+half},{c:0,a:-half,b:half}];
    const inGate=a=>TOWN.gates.some(g=>Math.abs(Math.atan2(Math.sin(a-g.c),Math.cos(a-g.c)))<half);
    for(let y=TOWN.y-21;y<=TOWN.y+21;y++)for(let x=TOWN.x-21;x<=TOWN.x+21;x++){ const d=Math.hypot(x-TOWN.x,y-TOWN.y); if(d<R-.75||d>=R+.8) continue;
      if(Math.abs(y-TOWN.y)<=1&&inGate(Math.atan2(y-TOWN.y,x-TOWN.x))) continue; setT(x,y,T.TWALL); } }
  carveVault(); OFS(VGO); carveVaultGate(); OFS(STO); carveStable(); OFS(null);
}
genWorld();
const isSolidPx=(px,py)=>{ const tx=Math.floor(px/TS), ty=Math.floor(py/TS), t=tAt(tx,ty); return SOLID.has(t)||(t===T.DOOR&&doorClosedAt(tx,ty)); };
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
  warden:{name:'Bulwark',role:'Tank',col:'#3f8cff',glyph:'⛨',hp:150,hpL:28,res:'rage',mit:.72,
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
    {id:'bulwark',lvl:3,name:'Stoneguard',icon:'🛡',cost:0,cd:30,self:true,buff:'bulwark',dur:6,noGcd:true,desc:'Reduce all damage taken by 50% for 6s.'},
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
  const t=tAt(x,y); if((t===T.WATER&&keepWater)||t===T.PATH||t===T.BRIDGE||t===T.COBBLE||t===T.TWALL) continue; if(SOLID.has(t)||t===T.WATER||t===T.LAVA) setT(x,y,ZGROUND[zmap[y*MW+x]]||T.GRASS); } }
const POIS=[
  {id:'windmill',name:'Amberfield Mill',x:82,y:70,r:5},
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
  for(const p of POIS){ const q=p.id==='throne'?[p.x+RUO[0],p.y+RUO[1]]:WP(p.x,p.y); p.x=Math.round(q[0]); p.y=Math.round(q[1]); }
  const PO=id=>POIS.find(p=>p.id===id), wm=PO('windmill'), wt=PO('watchtower'), ho=PO('hollow'), ar=PO('archive'), gt=PO('gate');
  clearArea(wm.x,wm.y,3); clearArea(wt.x,wt.y,3); clearArea(ho.x,ho.y,3,true); clearArea(ar.x,ar.y,3); clearArea(gt.x,gt.y,2);
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++) setT(wm.x+x,wm.y+y,T.PROP);
  for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++) setT(ho.x+x,ho.y+y,T.PROP);
  setT(ar.x-2,ar.y,T.PROP); setT(ar.x+2,ar.y,T.PROP); setT(gt.x-2,gt.y,T.PROP); setT(gt.x+2,gt.y,T.PROP);
  { const lk=WP(90,93), dz=Math.round(lk[1]); DOCK.z=dz; for(let x=Math.round(lk[0])-40;x<lk[0];x++){ if(tAt(x,dz)===T.WATER){ DOCK.x0=x-1; DOCK.x1=x+6; break; } } }
  if(DOCK.x0){ PO('dock').x=DOCK.x0; PO('dock').y=DOCK.z; clearArea(DOCK.x0-1,DOCK.z,2,true); }
})();
const NPCS=[
  {id:'oriel',name:'Captain Oriel',title:'Quests',x:(TOWN.x-3.5)*TS,y:(TOWN.y+2.4)*TS,col:'#c9a14a'},
  {id:'mira',name:'Mira the Peddler',title:'Alchemy & Goods',x:(TOWN.x+4.5)*TS,y:(TOWN.y+2.4)*TS,col:'#6fae7a'},
];
const NPCOFF={hilde:STO,selis:VGO,ithren:RUO};
function addNPC(id,name,title,tx,ty,col){ if(ty<112&&Math.hypot(tx-TOWN.x,ty-TOWN.y)>TOWN.r+4){ const o=NPCOFF[id], q=o?[tx+o[0],ty+o[1]]:WP(tx,ty); tx=Math.round(q[0]); ty=Math.round(q[1]); } const [x,y]=findOpen(tx,ty); NPCS.push({id,name,title,x:x*TS+16,y:y*TS+16,col}); }
addNPC('doran','Doran Ironhand','Blacksmith',TOWN.x-6,TOWN.y+8,'#8a5a3a');
addNPC('hilde','Hilde','Stable Master',90,77,'#a07a4a');
{ let gi=0; for(const g of TOWN.gates) for(const q of [-1,1]){ const a=g.c, r=15; addNPC('guard'+(gi++),'Hearthmere Guard','Town Watch',Math.round(TOWN.x+Math.cos(a)*r),TOWN.y+q*2,'#8a8a9a'); } }
addNPC('sylas','Ranger Sylas','Thornwood Camp',20,43,'#3a6a3a');
addNPC('marla','Old Marla','Gloamfen Herbalist',18,98,'#6a5a3a');
addNPC('ithren','Scholar Ithren','Vael Expedition',95,34,'#4a5a9a');
addNPC('vok','Sergeant Vok','Ember Gate Watch',60,29,'#8a2a2a');
addNPC('selis','Seeker Selis','Sunken Vault',103,50,'#3a8a8a');
addNPC('varro','Varro the Bloodsworn','Bloodsand Arena',TOWN.x+1,TOWN.y+6,'#a8321e');
{ const v=NPCS.find(n=>n.id==='varro'); const [gx,gy]=findOpen(Math.floor(v.x/TS),Math.floor(v.y/TS)+2); AR.gate={x:gx*TS+16,y:gy*TS+16}; }
addNPC('keeperw','Arena Keeper','Leave the arena',Math.round(AR.shr[0][0])-2,Math.round(AR.shr[0][1]),'#8a6a3a'); addNPC('keepere','Arena Keeper','Leave the arena',Math.round(AR.shr[1][0])+2,Math.round(AR.shr[1][1]),'#8a6a3a'); POIS.push({id:'vault',name:'The Sunken Vault',x:99+VGO[0],y:48+VGO[1],r:4});
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
  while(n<22&&tries<14000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(OWH-8)); if(!M.zones.includes(zmap[ty*MW+tx])) continue;
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
  {name:'Chestnut Steed',col:[.45,.27,.14],mane:[.12,.08,.05],cost:20,speed:1.7,lvl:10},
  {name:'Midnight Charger',col:[.08,.08,.1],mane:[.78,.78,.82],cost:60,speed:1.85,lvl:12,armor:true},
  {name:'Emberhorn Elk',col:[.52,.36,.22],mane:[.92,.86,.76],cost:120,speed:2.0,lvl:14,elk:true},
  {name:'Celestial Steed',col:[.55,.78,1],mane:[.9,.95,1],cost:500,speed:2.3,lvl:16,celestial:true}];
const EMOTES={dance:'bursts into dance!',wave:'waves.',sit:'sits down.',cheer:'cheers!',bow:'bows gracefully.',kneel:'kneels.'};
const CRITTERS=[]; (function(){ const R=mulberry32(4321); for(const [k,zs,n] of [['deer',['meadow','forest','frost'],15],['rabbit',['meadow','lake','town'],14],['frog',['swamp'],10]]){ let c=0,tries=0;
  while(c<n&&tries<5000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(OWH-8)); if(!zs.includes(zmap[ty*MW+tx])) continue; const t=tAt(tx,ty); if(SOLID.has(t)||t===T.WATER) continue;
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
/* ---------- v16: the Assassin, Celestus, talents ---------- */
CLS.mender.name='Celestus';
CLS.mender.desc='A priest of the starlit heavens. Channels celestial light to mend and shield allies, and calls down pillars of light on foes.';
CLS.assassin={name:'Shade',role:'Damage',col:'#2fd27a',glyph:'🗡',hp:118,hpL:20,res:'energy',mit:.86,crit:.12,
  desc:'A shadow with two blades. Slips into stealth, strikes from behind for huge critical hits and vanishes before the body falls.',
  auto:{rng:44,dmg:6,dmgL:2.1,spd:1.4}};
ABIL.assassin=[
  {id:'sinister',lvl:1,name:'Sinister Strike',icon:'🗡',cost:40,cd:0,rng:50,hostile:true,melee:true,dmg:[11,3.9],cp:1,desc:'A vicious stab. Adds 1 combo point.'},
  {id:'evis',lvl:1,name:'Eviscerate',icon:'✂',cost:35,cd:0,rng:50,hostile:true,melee:true,dmg:[7,2.6],finisher:true,desc:'Finisher: tear into the target. Damage grows with every combo point (up to 5).'},
  {id:'stealth',lvl:2,name:'Stealth',icon:'👁',cost:0,cd:4,self:true,stealth:true,noGcd:true,desc:'Melt into the shadows. Monsters only notice you up close. You move a little slower. Attacking or taking damage reveals you.'},
  {id:'ambush',lvl:3,name:'Ambush',icon:'☾',cost:55,cd:0,rng:50,hostile:true,melee:true,dmg:[26,8.5],cp:2,stealthOnly:true,alwaysCrit:true,desc:'Only from stealth: a brutal strike that always lands as a critical hit. Adds 2 combo points.'},
  {id:'fan',lvl:4,name:'Fan of Knives',icon:'✷',cost:45,cd:5,self:true,radius:100,aoeDmg:[9,3.1],cp:1,vis:28,desc:'Hurl knives at every enemy around you. Adds 1 combo point.'},
  {id:'shadowstep',lvl:6,name:'Shadowstep',icon:'➷',cost:20,cd:18,rng:300,hostile:true,shadowstep:true,noGcd:true,desc:'Step through the shadows to appear behind your target. Your next attack within 3s deals 30% more damage.'},
  {id:'evasion',lvl:8,name:'Evasion',icon:'💨',cost:0,cd:40,self:true,buff:'evasion',dur:6,noGcd:true,desc:'For 6s you dodge half of all attacks.'},
  {id:'vanish',lvl:11,name:'Vanish',icon:'🌫',cost:0,cd:60,self:true,vanish:true,noGcd:true,desc:'Vanish in a puff of smoke: enter stealth even in combat and make every monster forget you.'},
];
/* ---------- v28: the Bard, a support class that fights with songs ---------- */
CLS.bard={name:'Bard',role:'Support',col:'#ff9a3c',glyph:'♫',hp:128,hpL:23,res:'mana',mit:.84,
  desc:'A war-singer with an axe and a horn. Songs power up every ally around them, Discord staggers foes, and a rallying cry pulls friends back from the brink.',
  auto:{rng:46,dmg:6,dmgL:2.2,spd:1.8}};
ABIL.bard=[
  {id:'chord',lvl:1,name:'Power Chord',icon:'🎸',cost:8,cd:0,rng:50,hostile:true,melee:true,songBonus:true,dmg:[12,4.3],desc:'A ringing axe blow. Hits 15% harder while you are singing.'},
  {id:'s_embers',lvl:1,name:'Song of Embers',icon:'🔥',cost:0,cd:1.5,self:true,song:1,noGcd:true,desc:'Sing of fire: you and every ally near you deal more damage (10% base). Only one song plays at a time; press again to stop.'},
  {id:'s_stone',lvl:2,name:'Song of Stone',icon:'🪨',cost:0,cd:1.5,self:true,song:2,noGcd:true,desc:'Sing of the mountain: you and every ally near you take 10% less damage. Only one song plays at a time.'},
  {id:'discord',lvl:3,name:'Discord',icon:'💢',cost:18,cd:10,self:true,radius:130,aoeDmg:[10,3.4],root:2,vis:31,desc:'A jarring blast of sound hits every enemy around you and pins them in place for 2s.'},
  {id:'bcry',lvl:4,name:'Rallying Cry',icon:'📯',cost:30,cd:25,self:true,radius:300,cryHeal:[16,5.2],cryAbs:[12,4],desc:'Sound your horn: heal yourself and every ally near you, and wrap them in a shield for 10s.'},
  {id:'s_hunt',lvl:6,name:'Song of the Hunt',icon:'🏹',cost:0,cd:1.5,self:true,song:3,noGcd:true,desc:'Sing of the chase: you and every ally near you move 15% faster and attack 10% faster.'},
  {id:'encore',lvl:8,name:'Encore',icon:'🎺',cost:0,cd:45,self:true,encore:8,noGcd:true,desc:'Your current song is twice as strong for 8s.'},
  {id:'banner',lvl:11,name:'War Banner',icon:'🚩',cost:25,cd:40,self:true,banner:14,desc:'Plant a war banner that keeps playing your current song around it for 14s, even when you walk away.'},
];
const SONGDEF=[null,{k:'embers',n:'Song of Embers',dmg:.10,col:'#ff8a3a'},{k:'stone',n:'Song of Stone',mit:.10,col:'#d8c49a'},{k:'hunt',n:'Song of the Hunt',spd:.15,as:.10,col:'#7dff8a'}];
const SONG_R=320;
const BARD_SONGS=ABIL.bard.filter(a=>a.song);
{ const B=ABIL.bard.filter(a=>!a.song), at=id=>B.findIndex(a=>a.id===id);
  B.splice(at('chord')+1,0,{id:'ballad',lvl:2,name:'Healing Ballad',icon:'🎶',cost:14,cd:0,cast:1.6,rng:340,friendly:true,heal:[24,8.5],desc:'Sing a soothing verse that heals a friendly target (or yourself).'});
  B.splice(at('bcry')+1,0,{id:'thunder',lvl:5,name:'Thunder Note',icon:'📢',cost:12,cd:6,rng:300,hostile:true,dmg:[16,5],proj:'arcane',songBonus:true,desc:'Blast a booming note at an enemy from range. Hits 15% harder while you are singing.'});
  B.splice(at('encore')+1,0,{id:'lullaby',lvl:9,name:'Lullaby',icon:'💤',cost:16,cd:22,rng:280,hostile:true,dmg:[5,1.5],stun:3,proj:'arcane',desc:'A drowsy tune that knocks an enemy out for 3s.'});
  ABIL.bard=B; }
function mySongMult(){ if(!me) return 1; return (1+TAL('song')+(me.c.eq.weapon&&me.c.eq.weapon.leg==='bard'?.25:0))*(me.encoreU>now()?2:1); }
let SFX_T=-9, SFX={dmg:0,mit:0,spd:0,as:0};
/* what every song and war banner near me is doing for me right now (the strongest of each kind counts; songs do not stack) */
/* every song reaching a spot: the strongest of each song, who is playing it, and whether it comes from a banner */
function songBuffsAt(x,y){ const t=now(), best={}; const add=(song,mult,sx,sy,src,ban,enc)=>{ const S=SONGDEF[song]; if(!S||dist(sx,sy,x,y)>SONG_R) return; if(!best[song]||best[song].mult<mult) best[song]={song,mult,src,ban,enc}; };
  if(me&&!me.dead){ if(me.song) add(me.song,mySongMult(),me.x,me.y,me.c.name,0,me.encoreU>t); if(me.banner&&me.banner.until>t) add(me.banner.song,me.banner.mult,me.banner.x,me.banner.y,me.c.name,1,0); }
  for(const o of others.values()){ if(o.sg&&!o.d) add(o.sg[0],o.sg[1],o.rx,o.ry,o.n,0,o.sg[1]>1.9); if(o.bn&&o.bn.until>t) add(o.bn.song,o.bn.mult,o.bn.x,o.bn.y,o.n,1,0); }
  return Object.values(best); }
function songBuffHTML(b){ const S=SONGDEF[b.song], fx=[]; if(S.dmg) fx.push(`+${Math.round(S.dmg*b.mult*100)}% damage dealt`); if(S.mit) fx.push(`${Math.round(Math.min(.4,S.mit*b.mult)*100)}% less damage taken`); if(S.spd) fx.push(`+${Math.round(S.spd*b.mult*100)}% movement speed`); if(S.as) fx.push(`${Math.round(S.as*b.mult*100)}% faster attacks`);
  return `<b style="color:${S.col}">${S.n}</b>${b.enc?' <span style="color:#fff3b0">(Encore)</span>':''}<div style="margin:4px 0">${fx.join('<br>')}</div><div style="color:var(--dim);font-size:12px">${b.ban?'War Banner planted by':'Sung by'} ${esc(b.src)}. Lasts while you stay near ${b.ban?'the banner':'the Bard'}.</div>`; }
function songIcons(list){ return list.map((b,i)=>`<div class="buff sbuff${b.enc?' enc':''}" data-sb="${i}" style="border-color:${SONGDEF[b.song].col}">${iconSVG(['','s_embers','s_stone','s_hunt'][b.song])||'♫'}${b.ban?'<span>🚩</span>':''}</div>`).join(''); }
function songFx(){ const t=now(); if(t-SFX_T<.1) return SFX; SFX_T=t; const r={dmg:0,mit:0,spd:0,as:0}; if(!me||me.dead) return SFX=r;
  const add=(song,mult,x,y)=>{ const S=SONGDEF[song]; if(!S||dist(x,y,me.x,me.y)>SONG_R) return; for(const k of ['dmg','mit','spd','as']) if(S[k]) r[k]=Math.max(r[k],S[k]*mult); };
  if(me.song) add(me.song,mySongMult(),me.x,me.y); if(me.banner&&me.banner.until>t) add(me.banner.song,me.banner.mult,me.banner.x,me.banner.y);
  for(const o of others.values()){ if(o.sg&&!o.d) add(o.sg[0],o.sg[1],o.rx,o.ry); if(o.bn&&o.bn.until>t) add(o.bn.song,o.bn.mult,o.bn.x,o.bn.y); }
  r.mit=Math.min(.4,r.mit); return SFX=r; }
function bardAbility(ab,tgt,t){
  if(ab.song){ const S=SONGDEF[ab.song]; if(me.song===ab.song){ me.song=0; sysMsg('You stop singing.'); }
    else { me.song=ab.song; sysMsg(`♫ ${S.n}: ${ab.desc.split(':')[1].split('.')[0].trim()}.`,'c-xp'); pushAct(6,0,SONG_R+ab.song,32,me.x,me.y); areaFx(32,me.x,me.y,SONG_R+ab.song); }
    SFX_T=-9; sendPresence(true); }
  if(ab.encore){ me.encoreU=t+ab.encore+(TAL('anthem')?4:0); pushAct(6,0,SONG_R,35,me.x,me.y); areaFx(35,me.x,me.y,SONG_R); SFX_T=-9; sendPresence(true); }
  if(ab.banner){ const R=1+(TAL('anthem')?.5:0); me.banner={x:me.x,y:me.y,until:t+ab.banner*R,song:me.song,mult:mySongMult()}; pushAct(6,0,SONG_R,33,me.x,me.y); areaFx(33,me.x,me.y,SONG_R); SFX_T=-9; sendPresence(true); }
  if(ab.cryHeal){ const h=Math.round(scaleV(ab.cryHeal)), a=Math.round(scaleV(ab.cryAbs)*(1+TAL('absorb'))); healMe(h); me.absorb=Math.max(me.absorb||0,a); me.absorbU=t+10;
    pushAct(6,0,ab.radius,34,me.x,me.y); areaFx(34,me.x,me.y,ab.radius);
    for(const o of others.values()) if(!o.d&&dist(o.rx,o.ry,me.x,me.y)<ab.radius){ pushAct(1,o.u,h,5); pushAct(7,o.u,a,0); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } }
}
/* mounts now come later: 10, 13, 15 and 20 */
MOUNTS[5]={name:'Cragmaw Mountain Goat',col:[.86,.83,.76],mane:[.97,.95,.9],cost:0,speed:2.15,lvl:10,goat:true,drop:'Vaelith, the Drowned King (Sunken Vault)'};
MOUNTS[1].lvl=10; MOUNTS[2].lvl=13; MOUNTS[3].lvl=15; MOUNTS[4].lvl=20; MOUNTS[1].cost=40; MOUNTS[2].cost=120; MOUNTS[3].cost=260; MOUNTS[4].cost=800;
/* talents: one point per level from level 2; tiers open at 0, 5, 10 and 15 points spent */
const TAL_TIERS=[0,5,10,15];
const TALENTS={
  warden:[
    {id:'w_skin',t:0,max:3,n:'Iron Skin',ic:'🛡',d:'Take {2}% less damage.',e:{mit:.02}},
    {id:'w_blows',t:0,max:3,n:'Heavy Blows',ic:'⚔',d:'Deal {4}% more damage.',e:{dmg:.04}},
    {id:'w_vigor',t:0,max:3,n:'Vigor',ic:'❤',d:'+{5}% maximum health.',e:{hp:.05}},
    {id:'w_whirl',t:1,max:3,n:'Whirling Steel',ic:'🌀',d:'Whirlwind deals {15}% more damage.',e:{'ab:whirl':.15}},
    {id:'w_rhythm',t:1,max:3,n:'Battle Rhythm',ic:'⏳',d:'Cooldowns are {6}% shorter.',e:{cdr:.06}},
    {id:'w_blood',t:1,max:3,n:'Bloodlust',ic:'🩸',d:'+{3}% critical strike chance.',e:{crit:.03}},
    {id:'w_jugg',t:2,max:2,n:'Juggernaut',ic:'🗿',d:'+{8}% maximum health and {4}% more damage.',e:{hp:.08,dmg:.04}},
    {id:'w_wall',t:2,max:2,n:'Shield Wall',ic:'🧱',d:'Take a further {5}% less damage.',e:{mit:.05}},
    {id:'w_last',t:3,max:1,n:'Last Stand',ic:'🔥',d:'Below 30% health you take 30% less damage.',e:{last:1}}],
  mender:[
    {id:'m_grace',t:0,max:3,n:'Radiant Grace',ic:'✚',d:'Your heals are {5}% stronger.',e:{heal:.05}},
    {id:'m_sun',t:0,max:3,n:'Sunfire',ic:'☀',d:'Deal {5}% more damage.',e:{dmg:.05}},
    {id:'m_wells',t:0,max:3,n:'Starwells',ic:'💧',d:'+{6}% maximum mana and mana regeneration.',e:{res:.06}},
    {id:'m_swift',t:1,max:3,n:'Swift Prayers',ic:'⏳',d:'Cooldowns are {6}% shorter.',e:{cdr:.06}},
    {id:'m_soul',t:1,max:3,n:'Blessed Soul',ic:'❤',d:'+{5}% maximum health.',e:{hp:.05}},
    {id:'m_focus',t:1,max:3,n:'Focused Light',ic:'✦',d:'+{3}% critical chance on heals and damage.',e:{crit:.03}},
    {id:'m_bearer',t:2,max:2,n:'Lightbearer',ic:'🕯',d:'Spells cost {8}% less mana.',e:{cost:.08}},
    {id:'m_bloom',t:2,max:2,n:'Bloom of Life',ic:'❀',d:'Bloom and Sanctuary heal {20}% more.',e:{'ab:bloom':.2,'ab:sanct':.2}},
    {id:'m_angel',t:3,max:1,n:'Angel\'s Grace',ic:'👼',d:'Aegis and Guardian Spirit absorb 40% more damage.',e:{absorb:.4}}],
  arcanist:[
    {id:'a_embers',t:0,max:3,n:'Searing Embers',ic:'🔥',d:'Deal {4}% more damage.',e:{dmg:.04}},
    {id:'a_mind',t:0,max:3,n:'Arcane Mind',ic:'🧠',d:'+{6}% maximum mana and mana regeneration.',e:{res:.06}},
    {id:'a_frost',t:0,max:3,n:'Frost Skin',ic:'❄',d:'Take {3}% less damage.',e:{mit:.03}},
    {id:'a_pyro',t:1,max:3,n:'Pyromancy',ic:'☄',d:'Meteor and Phoenix Flame deal {12}% more damage.',e:{'ab:meteor':.12,'ab:phoenix':.12}},
    {id:'a_quick',t:1,max:3,n:'Quickened Mind',ic:'⏳',d:'Cooldowns are {6}% shorter.',e:{cdr:.06}},
    {id:'a_mass',t:1,max:3,n:'Critical Mass',ic:'✦',d:'+{3}% critical strike chance.',e:{crit:.03}},
    {id:'a_weave',t:2,max:2,n:'Mana Weave',ic:'🌀',d:'Spells cost {8}% less mana.',e:{cost:.08}},
    {id:'a_ignite',t:2,max:2,n:'Ignite',ic:'💥',d:'Critical strikes deal {15}% more damage.',e:{critd:.15}},
    {id:'a_arch',t:3,max:1,n:'Archmage',ic:'🔮',d:'Deal 10% more damage with everything.',e:{dmg:.1}}],
  assassin:[
    {id:'r_blades',t:0,max:3,n:'Sharpened Blades',ic:'🗡',d:'Deal {4}% more damage.',e:{dmg:.04}},
    {id:'r_leth',t:0,max:3,n:'Lethality',ic:'💀',d:'Critical strikes deal {10}% more damage.',e:{critd:.1}},
    {id:'r_agile',t:0,max:3,n:'Fleet Footed',ic:'👟',d:'Move {4}% faster, and faster in stealth.',e:{spd:.04,stspd:.05}},
    {id:'r_prec',t:1,max:3,n:'Precision',ic:'🎯',d:'+{3}% critical strike chance.',e:{crit:.03}},
    {id:'r_recov',t:1,max:3,n:'Quick Recovery',ic:'⏳',d:'Cooldowns are {6}% shorter and energy returns {6}% faster.',e:{cdr:.06,res:.06}},
    {id:'r_tough',t:1,max:3,n:'Toughness',ic:'❤',d:'+{5}% maximum health.',e:{hp:.05}},
    {id:'r_opp',t:2,max:2,n:'Opportunist',ic:'☾',d:'Attacks from stealth deal {20}% more damage.',e:{opp:.2}},
    {id:'r_poison',t:2,max:2,n:'Vile Poisons',ic:'🧪',d:'Sinister Strike poisons the target for {30}% extra damage over 6s.',e:{poison:.3}},
    {id:'r_death',t:3,max:1,n:'Death Mark',ic:'☠',d:'Eviscerate deals 35% more damage and refunds 1 combo point.',e:{'ab:evis':.35,refund:1}}],
};

TALENTS.bard=[
    {id:'b_voice',t:0,max:3,n:'Strong Voice',ic:'🎶',d:'Your songs are {10}% stronger.',e:{song:.1}},
    {id:'b_axe',t:0,max:3,n:'Axe Rhythm',ic:'🪓',d:'Deal {4}% more damage.',e:{dmg:.04}},
    {id:'b_hide',t:0,max:3,n:'Tough Hide',ic:'❤',d:'+{5}% maximum health.',e:{hp:.05}},
    {id:'b_tempo',t:1,max:3,n:'Tempo',ic:'⏳',d:'Cooldowns are {6}% shorter.',e:{cdr:.06}},
    {id:'b_crowd',t:1,max:3,n:'Crowd Pleaser',ic:'📯',d:'Rallying Cry heals {15}% more.',e:{'ab:bcry':.15}},
    {id:'b_breath',t:1,max:3,n:'Deep Breath',ic:'💨',d:'+{6}% maximum mana and mana regeneration.',e:{res:.06}},
    {id:'b_chorus',t:2,max:2,n:'Chorus',ic:'🎼',d:'Your songs are a further {15}% stronger.',e:{song:.15}},
    {id:'b_dis',t:2,max:2,n:'Dissonance',ic:'💢',d:'Discord deals {25}% more damage.',e:{'ab:discord':.25}},
    {id:'b_anthem',t:3,max:1,n:'Anthem of Ages',ic:'🚩',d:'Encore lasts 4s longer and War Banner stands 50% longer.',e:{anthem:1}}];
POIS.push(...[{id:'pass',name:'Frostpeak Pass',x:112,y:59,r:4},{id:'rimewater',name:'Rimewater',x:142,y:84,r:7},{id:'crypt',name:'Hollowdeep Crypt',x:140,y:22,r:5},{id:'giantcamp',name:"Hrimgar's Camp",x:146,y:56,r:6}].map(p=>{ const q=p.id==='crypt'?[p.x+CRO[0],p.y+CRO[1]]:WP(p.x,p.y); p.x=Math.round(q[0]); p.y=Math.round(q[1]); return p; }));
addNPC('hakon','Jarl Hakon','Frostwatch',124,63,'#7a8aa8');
NPCGREET.varro='"Blood on the sand, glory in the stands! In my arena every hero is your enemy. No mercy, no loot lost, no grudges after."'; NPCGREET.keeperw=NPCGREET.keepere='"Inside the ring of stones you are safe. Step past it and anyone may strike you down. Want to go back up?"';
NPCGREET.hakon='"Welcome to the frontier, southerner. Up here the cold kills more than the monsters do. Almost."';
for(let i=0;i<4;i++) NPCGREET['guard'+i]=['"Keep your blade sheathed inside the walls, traveller."','"Wolves have been bold this season. Stay on the roads."','"Hearthmere\'s gates close to no one in need."','"Report anything strange to Captain Oriel."'][i];
MATS.frostbloom={name:'Frostbloom',icon:'❄️',col:'#8fe8ff',kind:'herb',zones:['frost']};
MATS.mithril={name:'Mithril Ore',icon:'🔷',col:'#7ab8ff',kind:'ore',zones:['frost']};
(function(){ const R=mulberry32(888); let id=NODES.length+1; for(const k of ['frostbloom','mithril']){ const M=MATS[k]; let n=0,tries=0;
  while(n<22&&tries<14000){ tries++; const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(OWH-8)); if(!M.zones.includes(zmap[ty*MW+tx])) continue; const t=tAt(tx,ty);
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
const xpNeed=l=>Math.round(190*Math.pow(l,1.72)*(l>15?1+(l-15)*.12:1));
const MAXLVL=20;
const RAR=['Common','Uncommon','Rare','Epic','Legendary'];
const NAMECOLS=[null,['Crimson','#ff4d4d'],['Ember','#ff8c2e'],['Gold','#ffd34a'],['Lime','#a6ff4d'],['Emerald','#2ee07c'],['Teal','#36f0d6'],['Sky','#5cc8ff'],['Royal','#4d7cff'],['Violet','#a56bff'],['Rose','#ff6fc8'],['Pearl','#f6f0e4'],['Silver','#a9b0c0']];
const nameCol=o=>o&&NAMECOLS[o.nc]?NAMECOLS[o.nc][1]:CLS[o&&o.c]?CLS[o.c].col:'#ffffff', myNameCol=()=>me&&NAMECOLS[me.c.nc]?NAMECOLS[me.c.nc][1]:CLS[me.c.cls].col;
const RARCOL=['#a8a8a8','#3dff3d','#3d8bff','#b45cff','#ff8a1a'];
const SLOTS=['weapon','armor','trinket'];
const SLOTICON={weapon:'🗡',armor:'🥋',trinket:'💍'};

/* ---------- v22: Sunken Vault inhabitants (world tile coordinates = local + (8,115)) ---------- */
{ const W=a=>a.map(([x,y])=>[x+8,y+OWH+3]);
  MOBT.push(
  {key:'vsentry',name:'Vault Sentry',lv:[10,10],hp:300,hpL:26,dmg:13,dmgL:2.5,spd:66,rng:46,as:2.2,aggro:140,r:16,col:'#5a8a86',zone:'vault',vault:1,resp:1e8,sp:{k:'slam',cd:11,r:85,delay:1.3,mul:1.05},
    spots:W([[20,5],[20,15],[22,16],[27,11],[84,11],[99,31],[110,30],[110,32],[116,31]])},
  {key:'dacolyte',name:'Drowned Acolyte',lv:[10,10],hp:220,hpL:20,dmg:12,dmgL:2.3,spd:62,rng:220,as:2.4,aggro:170,r:14,col:'#2a6a6a',zone:'vault',vault:1,resp:1e8,ranged:true,proj:15,light:'#4affd8',sp:{k:'poison',cd:10},
    spots:W([[22,4],[26,9],[25,11],[84,9],[97,30],[97,32],[115,29],[115,33]])},
  {key:'crawler',name:'Silt Crawler',lv:[10,10],hp:170,hpL:18,dmg:10,dmgL:2.1,spd:92,rng:34,as:1.6,aggro:130,r:13,col:'#5a4e3a',zone:'vault',vault:1,resp:1e8,sp:{k:'poison',cd:9},
    spots:W([[63,5],[64,7],[62,7],[63,15],[65,16],[78,15],[77,17],[79,16]])},
  {key:'tidewraith',name:'Tide Wraith',lv:[10,10],hp:200,hpL:22,dmg:12,dmgL:2.4,spd:84,rng:40,as:1.9,aggro:150,r:14,col:'#4ad8c8',zone:'vault',vault:1,resp:1e8,fly:true,light:'#4affd8',sp:{k:'drain',cd:8},
    spots:W([[68,10],[77,5],[104,29],[105,33]])},
  {key:'ossric',name:'Gatekeeper Ossric',lv:[10,10],hp:4200,hpL:0,dmg:26,dmgL:0,spd:72,rng:62,as:2.3,aggro:230,r:28,col:'#6a8a86',zone:'vault',vault:1,n:1,boss:true,resp:1e8,pos:[56,125],light:'#4affd8',sp:{k:'ossric'},xp:1400},
  {key:'siltmother',name:'Mother Silt',lv:[10,10],hp:5200,hpL:0,dmg:24,dmgL:0,spd:60,rng:76,as:2.4,aggro:240,r:36,col:'#4a4232',zone:'vault',vault:1,n:1,boss:true,resp:1e8,pos:[89,146],sp:{k:'silt'},xp:1700},
  {key:'siltling',name:'Siltling',lv:[10,10],hp:150,hpL:0,dmg:13,dmgL:0,spd:104,rng:32,as:1.5,aggro:520,r:11,col:'#6a5e44',zone:'vault',vault:1,n:4,summon:true,owner:'siltmother',pos:[89,146]},
  {key:'vaelith',name:'Vaelith, the Drowned King',lv:[10,10],hp:7600,hpL:0,dmg:30,dmgL:0,spd:66,rng:66,as:2.4,aggro:260,r:30,col:'#4affd8',zone:'vault',vault:1,n:1,boss:true,resp:1e8,pos:[140,146],light:'#4affd8',sp:{k:'vaelith'},xp:3000},
  {key:'drownedshade',name:'Drowned Shade',lv:[10,10],hp:260,hpL:0,dmg:16,dmgL:0,spd:88,rng:40,as:1.8,aggro:520,r:14,col:'#4ad8c8',zone:'vault',vault:1,n:3,summon:true,owner:'vaelith',pos:[140,146],fly:true});
  for(const mt of MOBT) if(mt.spots) mt.n=mt.spots.length; }

/* where a fixed-position monster stands on the bigger map */
function posW(mt){ const [x,y]=mt.pos; if(y>=112) return [x,y+OWH-112]; const k=mt.key; if(k==='lich'||/^lich|crypt/.test(k)||(x>=130&&x<=150&&y>=8&&y<=24)) return [x+CRO[0],y+CRO[1]]; if(k==='hking') return [x+RUO[0],y+RUO[1]]; if(x===56&&y===9) return [LAIR.x,LAIR.y]; return WP(x,y); }
/* mob spawn table: deterministic so every client agrees on ids */
const mobs=[], mobById={};
(function genSpawns(){
  const R=mulberry32(1337); let id=1;
  for(let ti=0;ti<MOBT.length;ti++){const mt=MOBT[ti];
    const NN=(!mt.pos&&!mt.spots&&!mt.boss&&!mt.elite&&!mt.vault&&!mt.summon)?mt.n*3:mt.n;
    for(let k=0;k<NN;k++){
      let x,y,tries=0;
      if(mt.pos){ const pp=posW(mt); x=pp[0]*TS+16+(mt.summon?(k-1)*60:0); y=pp[1]*TS+16+(mt.summon?70:0); }
      else if(mt.spots){x=mt.spots[k][0]*TS+16;y=mt.spots[k][1]*TS+16}
      else do{ x=(3+R()*(MW-6))*TS; y=(3+R()*(OWH-6))*TS; tries++;
        const tx=Math.floor(x/TS),ty=Math.floor(y/TS);
        var ok=zmap[ty*MW+tx]===mt.zone && !blocked(x,y,22) && !blocked(x,y,12) && !blocked(x,y,4) && !inTown(x,y) && Math.hypot(tx-LAIR.x,ty-LAIR.y)>10 && Math.hypot(tx-99.5-VGO[0],ty-48-VGO[1])>8 && Math.hypot(tx-91-STO[0],ty-72-STO[1])>11;
        if(mt.zone==='meadow') ok = ok && Math.hypot(tx-TOWN.x,ty-TOWN.y)<30*WS && ty<TOWN.y+6;
        if(ok){ const gap=tries<1500?112:tries<3000?96:70; for(const o of mobs) if(dist(o.sx,o.sy,x,y)<gap){ok=false;break} }
      }while(!ok && tries<4000);
      const lv=mt.lv[0]+Math.floor(R()*(mt.lv[1]-mt.lv[0]+1));
      const mhp=Math.round((mt.hp+mt.hpL*(lv-1))*(mt.critter?1:1.3));
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
let hostPeer=null, amHost=true, wasHost=false, HOSTPAUSE=false;
/* coming back after the game was paused (hidden tab, locked phone): someone else has been running the world, so do not grab it back with stale monsters */
document.addEventListener('visibilitychange',()=>{ if(document.hidden) window.__hidAt=performance.now(); else if(window.__hidAt&&performance.now()-window.__hidAt>3000&&room){ HOSTPAUSE=true; } });
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
addEventListener('beforeinstallprompt',e=>{ window.__bip=e; });
function mobileHelp(){ const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1), andr=/Android/.test(navigator.userAgent);
  if(window.__bip){ const e=window.__bip; window.__bip=null; e.prompt(); return; }
  let m=document.getElementById('mobHelp'); if(m) m.remove(); m=document.createElement('div'); m.id='mobHelp';
  const url=location.origin+'/play/';
  m.innerHTML=`<div class="mh"><button class="mhx">×</button><h3>Play on your phone or tablet</h3><p>No app store needed: Emberfall installs straight from the browser and then opens full screen like an app.</p>
    <div class="mhc${ios?' on':''}"><b>iPhone &amp; iPad</b> (Safari)<ol><li>Open <code>${url}</code> in <b>Safari</b></li><li>Tap <b>Share</b> (the square with the arrow)</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b></li></ol></div>
    <div class="mhc${andr?' on':''}"><b>Android</b> (Chrome)<ol><li>Open <code>${url}</code> in <b>Chrome</b></li><li>Tap the <b>⋮</b> menu</li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</li></ol></div>
    <p style="font-size:13px;opacity:.75">Then start Emberfall from the new icon on your home screen. Touch controls appear automatically.</p></div>`;
  document.body.appendChild(m); m.onclick=e=>{ if(e.target===m||e.target.classList.contains('mhx')) m.remove(); }; }
setTimeout(()=>{ const b=document.getElementById('dlMobile'); if(b) b.onclick=e=>{ e.preventDefault(); mobileHelp(); }; },0);
setTimeout(()=>{ const d=document.getElementById('dlBar'); if(!d||!/^https?:$/.test(location.protocol)||/^(127\.|localhost)/.test(location.hostname)&&location.port==='47811') return; d.classList.remove('hidden'); if(/^\/download/.test(location.pathname)){ d.classList.add('flash'); d.scrollIntoView({block:'center'}); } },0);
function makeWsRoom(){ return new Promise(resolve=>{ const cfg=window.EMBERFALL_CONFIG||{};
  const url=cfg.serverUrl||realmWs()||(/^https?:$/.test(location.protocol)?(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws':null); if(!url) return resolve(null);
  let ws=null, myId=null, conn=false, done=false, mine={}, gmWait=null; const peers=new Map(), connCbs=[]; let snap=Object.freeze([]);
  const mk=(peer,p,gm)=>Object.freeze({peer,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false,gm:!!gm,presence:Object.freeze(p||{}),updatedAt:Date.now()});
  const rebuild=()=>{ const arr=[]; if(myId) arr.push(Object.freeze({peer:myId,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false,presence:Object.freeze({...mine}),updatedAt:Date.now()})); for(const v of peers.values()) arr.push(v); snap=Object.freeze(arr); };
  const finish=r=>{ if(!done){ done=true; resolve(r); } };
  const api={ maxP:15000, presence(patch){ for(const k in patch){ if(patch[k]===null) delete mine[k]; else mine[k]=patch[k]; } rebuild(); if(conn&&ws.readyState===1) ws.send(JSON.stringify({t:'p',p:mine})); return Promise.resolve(); },
    peers:()=>snap, onPeers:()=>()=>{}, onConnection(fn){ connCbs.push(fn); setTimeout(()=>fn(conn),0); return ()=>{}; }, connected:()=>conn,
    armory(data){ if(conn) ws.send(JSON.stringify({t:'arm',c:data})); }, gift(name,what){ if(conn) ws.send(JSON.stringify({t:'gift',name,what})); },
    bug(text){ if(conn) ws.send(JSON.stringify({t:'bug',text:String(text).slice(0,2000)})); }, ticket(o){ if(!conn||ws.readyState!==1) return false; ws.send(JSON.stringify({...o,t:'bug'})); return true; }, tk(op,o){ if(conn&&ws.readyState===1) ws.send(JSON.stringify({...(o||{}),t:'tk',op})); }, admin(cmd,pid,name){ if(conn) ws.send(JSON.stringify({t:'admin',cmd,pid,name})); },
    master:false, gmGrant(pid,on){ if(conn) ws.send(JSON.stringify({t:'mkgm',pid,on:!!on})); },
    gmLogin(pw){ return new Promise(res=>{ if(!conn) return res(false); gmWait=res; ws.send(JSON.stringify({t:'gm',pw:String(pw).slice(0,200)})); setTimeout(()=>{ if(gmWait===res){ gmWait=null; res(false); } },5000); }); } };
  function open(){ try{ ws=new WebSocket(url); }catch(e){ return finish(null); }
    const to=setTimeout(()=>{ if(!conn){ try{ws.close()}catch(e){} finish(null); } },15000);
    ws.onmessage=e=>{ let d; try{ d=JSON.parse(e.data); }catch(_){ return; }
      if(d.t==='hello'){ if(d.ws) setTimeout(()=>{ try{ applyWorldWs(d.ws); }catch(e){} },0); myId=d.you; peers.clear(); for(const q of d.peers||[]) peers.set(q.peer,mk(q.peer,q.p,q.gm)); conn=true; clearTimeout(to); rebuild(); finish(api); connCbs.forEach(f=>f(true)); if(saves.gmToken) ws.send(JSON.stringify({t:'gmtok',token:saves.gmToken})); if(Object.keys(mine).length) ws.send(JSON.stringify({t:'p',p:mine})); }
      else if(d.t==='p'){ peers.set(d.peer,mk(d.peer,d.p,d.gm)); rebuild(); }
      else if(d.t==='leave'){ peers.delete(d.peer); rebuild(); }
      else if(d.t==='gm'){ if(d.master) api.master=true; if(d.token){ saves.gmToken=d.token; saveAll(saves); } if(d.forget){ delete saves.gmToken; saveAll(saves); } if(gmWait){ const r=gmWait; gmWait=null; r(!!d.ok); }
        else if(d.ok&&d.master&&!isGM){ setGM(true,'master'); if(me) sysMsg('Welcome back, realm owner. Your Game Master tools are ready (/gm).','c-gm'); }
        else if(d.granted&&!isGM){ setGM(true,'server'); sysMsg('The realm owner made you a Game Master. Type /gm for your tools.','c-gm'); }
        else if(d.revoked&&isGM){ setGM(false); gm.god=gm.nocd=gm.fly=gm.invis=false; gm.speed=1; sysMsg('Your Game Master powers were removed.','c-err'); sendPresence(true); } }
      else if(d.t==='gift'&&typeof d.what==='string'){ applyGift(d.what,d.from||'the Realm'); }
      else if(/^tk/.test(d.t)){ try{ onTicketNet(d); }catch(_){} }
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
  if(amHost && kind!==6 && kind!==7 && kind<12) hostApplyAct(MY_U,me.c.cls,a);
  return a;
}
function pushMd(u,amt,mobId,vis){ const a=[++mdSeq,u,Math.round(amt),mobId,vis||0]; myMd.push(a); if(myMd.length>16) myMd.shift();
  if(u===MY_U) mobHitsMe(a); else visualMobHit(mobById[mobId],u,vis); }
function pushTg(x,y,r,dur,kind){ const a=[++tgSeq,Math.round(x),Math.round(y),Math.round(r),Math.round(dur*1000),kind]; myTg.push(a); if(myTg.length>8) myTg.shift(); addTel(a); return a; }
function packMobs(){ const t=now(); const ps=[]; if(me) ps.push([me.x,me.y]); for(const o of others.values()) ps.push([o.x,o.y]);
  const out=[], vin=ps.some(p=>p[1]>=(OWH-6)*TS&&p[1]<(AR.y0-3)*TS); for(const m of mobs){ if(!m.tgt&&!(m.t.vault&&vin)&&!ps.some(p=>Math.abs(p[0]-m.x)<1700&&Math.abs(p[1]-m.y)<1700)) continue;
    if(m.dead){ out.push([m.id]); continue; } const fl=(m.stunU>t?2:0)|(m.rootU>t?4:0)|(m.evade?8:0)|(m.enr?16:0);
    if(m.hp>=m.mhp && !fl && !m.tgt && !m.tag) out.push([m.id,Math.round(m.x),Math.round(m.y)]);
    else out.push([m.id,Math.round(m.x),Math.round(m.y),Math.max(0,Math.round(m.hp)),fl,m.tgt||'',m.tag||'']); } return out; }

function sendPresence(force){
  if(!room||!me) return; const t=now(); if(!force && t-lastSend<.1) return; lastSend=t;
  const p={v:VERSION,u:MY_U,n:me.c.name,c:me.c.cls,l:me.c.lvl,x:Math.round(me.x),y:Math.round(me.y),f:+me.face.toFixed(2),
    hp:Math.round(me.hp),mhp:me.mhp,d:me.dead?1:0,pt:me.party||'',mt:me.mounted||null,em:me.emote?me.emote.k:null,wr:me.c.eq.weapon?me.c.eq.weapon.rar:0,ar:me.c.eq.armor?me.c.eq.armor.rar:0,gv:myGearVis(),nc:me.c.nc||null,ix:inspectData(),sg:me.song&&!me.dead?[me.song,+mySongMult().toFixed(2)]:null,bn:me.banner&&me.banner.until>t?[Math.round(me.banner.x),Math.round(me.banner.y),+(me.banner.until-t).toFixed(1),me.banner.song,+me.banner.mult.toFixed(2)]:null,ws:isGM&&gm.wset?[gm.wx,gm.tPh,gm.wset]:null,sl:me.stealth?1:null,
    b:(me.bulwark>t?1:0)|(me.hots.length?2:0)|(me.cast?4:0)|(me.absorb>0&&me.absorbU>t?8:0)|(me.rootU>t?16:0)|(me.dots.length?32:0)|(me.avatarU>t?64:0),
    z:zoneAtPx(me.x,me.y), gm:isGM?1:null, pid:MY_PID, iv:gm.invis?1:null, cs:cosBits()||null, ti:myTitle()||null, own:isRealmOwner()?1:null, au:gm.aura&&isGM&&!gm.invis?1:null, gl:isRealmOwner()&&(saves.gmGrants||[]).length?saves.gmGrants.map(g=>g.gid||g.pid).slice(0,20):null,
    inv:myInv, ir:myIr, kk:myKick, pl:me.party&&amLeader()?1:null, cn:me.cast&&!me.cast.node?[String(me.cast.ab.name||'').slice(0,24),Math.round(clamp((t-me.cast.t0)/me.cast.dur,0,1)*100),Math.round(me.cast.dur*1000)]:null, a:myActs.slice(-18), ch:myChat.slice(-3),
    w: amHost? packMobs(): null, md: amHost? myMd.slice(-16): null, tg: amHost? myTg.slice(-8): null, hs: amHost?1:null };
  const LIM=(room&&room.maxP)||3900; const ixs=JSON.stringify(p.ix); if(ixs===sendPresence.ixs&&t-(sendPresence.ixT||0)<4) delete p.ix; else { sendPresence.ixs=ixs; sendPresence.ixT=t; }
  let s=JSON.stringify(p);
  while(s.length>LIM && p.ch.length){p.ch.shift();s=JSON.stringify(p)}
  while(s.length>LIM && p.a.length>4){p.a.shift();s=JSON.stringify(p)}
  if(s.length>LIM && p.ix){ delete p.ix; sendPresence.ixs=''; s=JSON.stringify(p); }
  if(s.length>LIM && p.w){ const me0=me; p.w=p.w.map(e=>{ const m=mobById[e[0]]; return [e,m?Math.hypot(m.x-me0.x,m.y-me0.y)-(m.tgt?1e5:0):0]; }).sort((a,b)=>a[1]-b[1]).map(e=>e[0]);
    while(s.length>LIM && p.w.length>8){ p.w.length=Math.floor(p.w.length*.85); s=JSON.stringify(p); } }
  if(s.length>LIM+100) return;
  room.presence(p).catch(()=>{});
}

function syncPeers(){
  const t=now(); const list=peerList(); const seen=new Set(); const cand=[];
  for(const p of list){ if(p.sameTab){myPeer=p.peer;continue}
    if(p.presence&&p.presence.v>VERSION&&!window.__newVer){ window.__newVer=1; setTimeout(()=>{ sysMsg('A newer version of Emberfall is available. Refresh the page to update.','c-err'); toast('New version available — refresh to update','small'); },500); }
    if(p.kind!=='viewer'||!p.presence||p.presence.v!==VERSION||!p.presence.u) continue; cand.push(p.peer); }
  const mine=myPeer||'~';
  const fresh=p=>!(p.updatedAt>0)||Date.now()-p.updatedAt<4000;
  const claim=[]; for(const p of list){ if(!p.sameTab && cand.includes(p.peer) && p.presence.hs && fresh(p)) claim.push(p.peer); }
  const graceOver=!room||t-joinedAt>1.6; const lowest=a=>a.reduce((x,y)=>y<x?y:x);
  if(!room){ amHost=true; hostPeer=null; }
  else if(!me){ amHost=cand.length===0; hostPeer=claim.length?lowest(claim):cand.length?lowest(cand):null; }
  else { let pool=claim.slice(); if(amHost) pool.push(mine); if(!pool.length){ pool=cand.slice(); pool.push(mine); }
    if(HOSTPAUSE&&claim.length){ pool=claim.slice(); } else HOSTPAUSE=false;
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
    { const nx=+pr.x||0, ny=+pr.y||0, tn=now(), dtp=tn-(o.tr||0); if(o.tr&&dtp>.03&&dtp<1){ o.vx=clamp((nx-o.x)/dtp,-700,700); o.vy=clamp((ny-o.y)/dtp,-700,700); } else { o.vx=0; o.vy=0; } o.tr=tn; o.x=nx; o.y=ny; }o.f=+pr.f||0;o.hp=+pr.hp||0;o.mhp=Math.max(1,+pr.mhp||1);o.d=!!pr.d;
    o.sl=!!pr.sl; if(Array.isArray(pr.ws)&&pr.gm&&p.gm!==false) applyWorldWs(pr.ws); o.wr=clamp(pr.wr|0,0,4); o.ar=clamp(pr.ar|0,0,4); o.gv=parseGV(pr.gv); o.nc=clamp(pr.nc|0,0,12); o.sg=Array.isArray(pr.sg)?[clamp(pr.sg[0]|0,0,3),clamp(+pr.sg[1]||1,0,3)]:null; o.bn=Array.isArray(pr.bn)?{x:+pr.bn[0]||0,y:+pr.bn[1]||0,until:now()+clamp(+pr.bn[2]||0,0,25),song:clamp(pr.bn[3]|0,0,3),mult:clamp(+pr.bn[4]||1,0,3)}:null; if(Array.isArray(pr.ix)) o.ix=pr.ix.slice(0,3); o.pid=typeof pr.pid==='string'?pr.pid.slice(0,16):''; o.cs=pr.cs|0; o.ti=typeof pr.ti==='string'?clean(pr.ti).slice(0,20):''; o.own=!!pr.own&&!!pr.gm; o.au=!!pr.au&&!!pr.gm; o.iv=!!pr.iv; o.pl=!!pr.pl; if(Array.isArray(pr.cn)){ const nm=clean(pr.cn[0]).slice(0,24); if(!o.cast||o.cast.nm!==nm||Math.abs((pr.cn[1]|0)-o.cast.p0)>15&&(pr.cn[1]|0)<o.cast.p0) o.cast={nm,p0:clamp(pr.cn[1]|0,0,100),t0:t,dur:clamp(+pr.cn[2]||1000,200,10000)/1000}; } else o.cast=null; o.pt=clean(pr.pt).slice(0,20); o.gm=!!pr.gm&&(p.gm===undefined||!!p.gm); o.b=pr.b|0; o.wr=clamp(pr.wr|0,0,4); o.ar=clamp(pr.ar|0,0,3); o.mt=clamp(pr.mt|0,0,MOUNTS.length-1); { const ek=EMOTES[pr.em]?pr.em:''; if(ek!==(o.emk||'')){ o.emk=ek; o.emote=ek?{k:ek,t0:t}:null; if(ek&&me) chatLine(`${o.n} ${EMOTES[ek]}`,'c-say'); } } o.z=ZONES[pr.z]?pr.z:'meadow'; o.seenAt=t;
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
      const party=c[1]===1, txt=clean(c[2]).slice(0,120); if(!txt) continue; if(c[1]===3){ if(me&&me.party&&o.pt===me.party) vaultEvent(o,txt); continue; }
      if(c[1]===2&&o.gm){ const art=room&&typeof room.emit==='function'; if(!art||(lastGrant&&lastGrant.pids.includes(o.pid+':'+o.n.toLowerCase()))) gmAnnounceShow(o.n,txt,art?'gm':(o.own?'owner':'gm')); continue; }
      if(party && (!me||!me.party||o.pt!==me.party)) continue;
      chatLine(txt, party?'c-party':'c-say', party?'[Party] ':'', {n:o.n,col:nameCol(o),gm:o.gm&&isGM}); o.bubble=txt; o.bubbleT=t+6; }
  }
  for(const [peer,o] of others) if(!seen.has(peer)){ others.delete(peer); if(othersByU.get(o.u)===o) othersByU.delete(o.u); if(me&&seenO(o)) sysMsg(`${o.n} has left the realm.`);
    if(me&&me.target&&me.target.kind==='p'&&me.target.id===o.u) me.target=null; }
}
function handleRemoteAct(o,a){
  const kind=a[1],tgt=a[2],amt=a[3]|0,vis=a[4]|0;
  if(amHost && kind!==6 && kind!==7 && kind<12) hostApplyAct(o.u,o.c,a);
  if(kind===12){ o.swingT=vis===0?now():o.swingT; const tp=tgt===MY_U?null:othersByU.get(tgt); if(tp) spark(tp.rx,tp.ry,'#ffd0a0'); }
  if(kind===14&&me&&inArena(me.x,me.y)&&tgt!==MY_U){ const k=othersByU.get(tgt); sysMsg(`⚔ ${k?k.n:'Someone'} defeated ${o.n}.`,'c-yell'); }
  if(me && tgt===MY_U && kind===14){ const P=me.c.pvp=me.c.pvp||{k:0,d:0,best:0,st:0}; P.k++; P.st=(P.st||0)+1; P.best=Math.max(P.best,P.st); stat('pvpKills',1); persist();
    toast(`You defeated ${o.n}!`); sysMsg(`⚔ You defeated ${o.n}! Kill streak: ${P.st}.`,'c-xp'); if(P.st>=3) banner(P.st>=5?'UNSTOPPABLE':'KILLING SPREE',`${P.st} kills in a row`,'win'); }
  if(me && !me.dead && tgt===MY_U && (kind===12||kind===13) && pvpOn(me.x,me.y) && pvpOn(o.rx,o.ry) && !(me.party&&o.pt===me.party)){
    if(kind===12&&amt>0){ me.pvpBy={u:o.u,n:o.n,t:now()}; takeDamage(Math.min(amt,5000)*PVP_MUL,null,vis); }
    if(kind===13){ me.rootU=Math.max(me.rootU||0,now()+Math.min(amt,4000)/1000*.6); } }
  if(me && !me.dead && tgt===MY_U){
    if(kind===1 && amt>0) healMe(amt,o.n);
    if(kind===4){ me.hots=me.hots.filter(h=>h.src!==o.u); me.hots.push({src:o.u,amt,left:5,next:now()+2}); }
    if(kind===7){ me.absorb=amt; me.absorbU=now()+12; sysMsg(`${o.n} shields you.`,'c-party'); }
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
    { const nx=+s[1], ny=+s[2], tn=now(), dtp=tn-(m.tr||0); if(m.tr&&dtp>.03&&dtp<1&&!wasDead){ m.vx=clamp((nx-m.x)/dtp,-500,500); m.vy=clamp((ny-m.y)/dtp,-500,500); } else { m.vx=0; m.vy=0; } m.tr=tn; m.x=nx; m.y=ny; }
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
  const arr=[]; if(me&&!me.dead&&!gm.invis) arr.push({u:MY_U,x:me.x,y:me.y,l:me.c.lvl,sl:me.stealth});
  for(const o of others.values()) if(!o.d&&!o.iv) arr.push({u:o.u,x:o.x,y:o.y,l:o.l,sl:o.sl});
  return arr;
}
function hostApplyAct(u,cls,a){
  const kind=a[1],tgt=a[2],amt=a[3]|0; const t=now();
  if(kind===9){ for(const m of mobs){ delete m.threat[u]; if(m.tgt===u) m.tgt=''; } return; }
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
const mobDmg=m=>(m.t.dmg+m.t.dmgL*(m.lv-1))*(m.t.critter?1:1.2);
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
    case 'ossric': { m.phase=(m.phase||0)+1; m.spT=m.enr?4.6:6.5; const pick=m.phase%3;
      if(pick===1){ const a=Math.atan2(p.y-m.y,p.x-m.x); m.face=a; m.chanU=t+1.4; hostTel(m,m.x+Math.cos(a)*105,m.y+Math.sin(a)*105,115,1.4,1.5,3); }
      else if(pick===2){ m.chanU=t+1.6; hostTel(m,m.x,m.y,155,1.6,1.25,2); }
      else { let far=p,fd=0; for(const q of players){ const dq=dist(q.x,q.y,m.x,m.y); if(dq>fd&&dq<520){ fd=dq; far=q; } } const tx=far.x,ty=far.y; m.chanU=t+1.2;
        hostTel(m,tx,ty,80,1.2,1.35,1,()=>{ if(!m.dead&&!m.evade&&!blocked(tx,ty,m.t.r*.7)){ m.x=tx; m.y=ty; } }); }
      break; }
    case 'silt': { m.phase=(m.phase||0)+1; m.spT=m.enr?5:7; const pick=m.phase%3;
      if(pick===1){ for(const q of players) if(dist(q.x,q.y,m.x,m.y)<600) hostTel(m,q.x,q.y,78,1.7,.9,6); }
      else if(pick===2){ m.chanU=t+1.5; hostTel(m,m.x,m.y,145,1.5,1.2,2); }
      else { const q=players[Math.floor(Math.random()*players.length)]; if(q) pushMd(q.u,mobDmg(m)*.55,m.id,5); }
      break; }
    case 'vaelith': { m.phase=(m.phase||0)+1; m.spT=m.enr?4.4:6.2; const pick=m.phase%4;
      if(pick===1){ const a=Math.atan2(p.y-m.y,p.x-m.x); m.face=a; m.chanU=t+1.3; for(let k=0;k<3;k++) hostTel(m,m.x+Math.cos(a)*(95+k*105),m.y+Math.sin(a)*(95+k*105),95,1.4+k*.45,1.3,3); }
      else if(pick===2){ for(const q of players) if(dist(q.x,q.y,m.x,m.y)<650) hostTel(m,q.x,q.y,88,1.6,1.0,6); }
      else if(pick===3){ m.chanU=t+2; hostTel(m,m.x,m.y,175,2.0,1.35,7); }
      else { const q=players[Math.floor(Math.random()*players.length)]; if(q) pushMd(q.u,mobDmg(m)*.6,m.id,5); }
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
  const t=now(); const players=alivePlayers(); const pmap={}; for(const p of players) pmap[p.u]=p; vaultHostTick(players,t);
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
    for(const k in m.threat) if(!pmap[k]||(mt.boss&&m.zn&&zoneAtPx(pmap[k].x,pmap[k].y)!==m.zn&&dist(pmap[k].x,pmap[k].y,m.sx,m.sy)>260)) delete m.threat[k];
    for(const p of players){ if(m.threat[p.u]) continue; const ag=mt.aggro*(mt.boss?.6:1)*(p.l>m.lv+4?.5:1)*(p.sl?.22:1);
      if(dist(p.x,p.y,m.x,m.y)<ag && !inTown(p.x,p.y)) m.threat[p.u]=1; }
    let best='',bv=-1; for(const k in m.threat) if(m.threat[k]>bv){bv=m.threat[k];best=k}
    if(m.tgt && pmap[m.tgt] && m.threat[m.tgt]>0 && m.threat[m.tgt]*1.1>=bv) best=m.tgt;
    m.tgt=best;
    if(!best && (m.tag||m.hp<m.mhp)){ m.tag=''; m.hp=m.mhp; m.enr=false; if(mt.boss){ m.summoned=false; m.summoned2=false; despawnAdds(mt.key); } }
    m.atk-=dt;
    if(best){
      const p=pmap[best];
      if(mt.boss&&!m.zn) m.zn=zoneAtPx(m.sx,m.sy);
      if(dist(m.x,m.y,m.sx,m.sy)>(mt.boss?560:700) || inTown(p.x,p.y) || (mt.boss&&zoneAtPx(p.x,p.y)!==m.zn&&dist(p.x,p.y,m.sx,m.sy)>260)){ m.evade=true; m.threat={}; m.tgt=''; if(mt.boss) despawnAdds(mt.key); continue; }
      const d=dist(m.x,m.y,p.x,p.y);
      const stunned=m.stunU>t, rooted=m.rootU>t, chan=m.chanU>t;
      if(!stunned && !chan) m.face=Math.atan2(p.y-m.y,p.x-m.x);
      const stO=mt.ranged?mt.rng-6:mt.rng+3;
      if(d>stO && !stunned && !rooted && !chan){ const s=mt.spd*(m.enr?1.2:1)*dt; moveEnt(m,(p.x-m.x)/d*s,(p.y-m.y)/d*s,mt.r*.7); }
      if(d<=mt.rng+(mt.ranged?4:13) && m.atk<=0 && !stunned && !chan){
        m.atk=mt.as*(m.enr?.65:1); const dmg=mobDmg(m)*(.85+Math.random()*.3);
        pushMd(best,dmg,m.id,mt.ranged?(mt.proj||2):mt.boss?3:1); m.swingT=t;
      }
      if(!stunned && !chan) mobSpecial(m,p,players,dt,t);
      if(mt.key==='wyrm'){ if(!m.summoned && m.hp<m.mhp*.5){ m.summoned=true; summonAdds(m); } if(!m.enr && m.hp<m.mhp*.25) m.enr=true; }
      if(mt.key==='ossric'&&!m.enr&&m.hp<m.mhp*.2) m.enr=true;
      if(mt.key==='siltmother'){ if(!m.summoned&&m.hp<m.mhp*.7){ m.summoned=true; summonAdds(m); } if(!m.summoned2&&m.hp<m.mhp*.35){ m.summoned2=true; summonAdds(m); } if(!m.enr&&m.hp<m.mhp*.15) m.enr=true; }
      if(mt.key==='vaelith'){ if(!m.summoned&&m.hp<m.mhp*.5){ m.summoned=true; summonAdds(m); } if(!m.enr&&m.hp<m.mhp*.25) m.enr=true; }
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
  me.mhp=Math.round((cl.hp+cl.hpL*(c.lvl-1)+g.sta*8)*(buffOn('fort')?1.25:1)*(1+TAL('hp')));
  me.mres= cl.res!=='mana'?100:Math.round((100+22*(c.lvl-1)+g.sta*2)*(1+TAL('res')));
  me.hp=Math.min(me.hp??me.mhp,me.mhp); me.res=Math.min(me.res??me.mres,me.mres);
}
const costOf=ab=> Math.round((CLS[me.c.cls].res!=='mana'? ab.cost : ab.cost*(1+.22*(me.c.lvl-1)))*(1-TAL('cost')));
let SV_MUL=1;
const scaleV=v=>SV_MUL*(v[0]+v[1]*(me.c.lvl-1)+me.pow*.8)*(buffOn('might')?1.2:1)*(me.c.eq.weapon&&me.c.eq.weapon.rar===4?1.1:1)*(me.avatarU>now()?1.4:1);
function fixClassGear(c){ for(const sl of ['weapon','armor']){ const it=c.eq[sl]; if(it&&!canUse(it,c.cls)){ c.eq[sl]=null; c.inv.push(it); setTimeout(()=>sysMsg(`[${it.name}] cannot be used by a ${CLS[c.cls].name} and was moved to your bags.`,'c-err'),2500); } } }
function enterWorld(name,cls,existing,fresh){ TALC=null;
  try{ audInit(); }catch(e){}
  const RL=rosterList(); let c=existing||(!fresh&&RL.find(x=>x.name===name&&x.cls===cls)); if(!c){ c=newChar(name,cls); c.id=rid(6); c.created=Date.now(); RL.push(c); } migrateChar(c); fixClassGear(c);
  me={c,x:SPAWN.x,y:SPAWN.y,face:-Math.PI/2,hp:null,res:null,dead:false,target:null,cast:null,gcd:0,cds:{},auto:false,autoT:0,
    bulwark:0,hots:[],mounted:0,emote:null,jumpH:0,jumpV:0,absorb:0,absorbU:0,rootU:0,dots:[],dash:null,swingT:0,spinT:0,stepT:0,lastCombat:-99,lastSpend:-99,potCd:0,party:saves.party||'',moving:false,zone:'',tabIdx:0,cp:0,stealth:false,evasionU:0,stepU:0};
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
function inCombat(){ const t=now(); if(t-me.lastCombat<5) return true; for(const m of mobs) if(!m.dead&&!m.evade&&m.tgt===MY_U&&dist(m.rx,m.ry,me.x,me.y)<800&&t-(m.atkT||m.hit||0)<12) return true; return false; }
function mobHitsMe(a){ const mob=mobById[a[3]], vis=a[4]|0; takeDamage(Math.max(0,a[2]|0),mob,vis);
  if(!me||me.dead) return;
  if(vis===5){ me.rootU=now()+2; err('Entangled!'); }
  if(vis===6){ me.dots=me.dots.filter(d=>d.src!==a[3]); me.dots.push({src:a[3],amt:Math.max(1,Math.round(a[2]*.35)),left:4,next:now()+1.5}); err('Poisoned!'); }
}
function takeDamage(amt,mob,vis){
  if(!me||me.dead) return; if(gm.god){ if(mob) visualMobHit(mob,MY_U,vis||0,true); return; } const cl=CLS[me.c.cls]; if(me.evasionU>now()&&Math.random()<.5){ fct(me.x,me.y-44,'Dodge','#bfffd8'); return; } if(me.stealth) breakStealth(); let d=amt*cl.mit*(1-TAL('mit'))*(TAL('last')&&me.hp<me.mhp*.3?.7:1); if(me.bulwark>now()) d*=.5; if(buffOn('ward')) d*=.85; if(me.avatarU>now()) d*=.7; d*=1-songFx().mit; if(me.mounted) dismount(); d=Math.max(1,Math.round(d));
  let absorbed=0; if(me.absorb>0 && me.absorbU>now()){ absorbed=Math.min(me.absorb,d); me.absorb-=absorbed; d-=absorbed; }
  me.hp-=d; me.lastCombat=now(); if(cl.res==='rage') me.res=Math.min(100,me.res+(d+absorbed)/2.5);
  if(d>0) fct(me.x,me.y-24,'-'+d,'#ff5a4a',true);
  if(absorbed) fct(me.x+16,me.y-38,'('+absorbed+' absorbed)','#9fd8ff');
  if(mob) visualMobHit(mob,MY_U,vis||0,true);
  hurtFlash=Math.min(1,hurtFlash+d/me.mhp*3); if(d>me.mhp*.12) shake(6);
  if(me.cast && !me.cast.pushed){ me.cast.t0+=.25; me.cast.pushed=true; }
  if(d>0&&cdOk('hurt',.75)) snd('hurt',null,null,me.c.cls==='mender'||me.c.cls==='assassin'?1.35:1);
  if(me.hp<=0){ me.hp=0; die(); }
}
function healMe(amt,from){ if(me.dead) return; const before=me.hp; me.hp=Math.min(me.mhp,me.hp+amt); const h=Math.round(me.hp-before);
  if(h>0) fct(me.x,me.y-30,'+'+h,'#6dff7a'); sparkle(me.x,me.y,'#9dffb0'); }
function die(){ try{ snd('die'); }catch(e){} if(me&&me.pvpBy&&now()-me.pvpBy.t<10&&inArena(me.x,me.y)){ const P=me.c.pvp=me.c.pvp||{k:0,d:0,best:0,st:0}; P.d++; P.st=0; pushAct(14,me.pvpBy.u,0,0); sysMsg(`⚔ ${me.pvpBy.n} defeated you. Release to return to a shrine.`,'c-err'); } if(me) me.pvpBy=null; if(me){ me.song=0; me.banner=null; me.encoreU=0; } stat('deaths',1); me.dead=true; me.cast=null; me.mounted=0; me.emote=null; me.auto=false; me.hots=[]; me.dots=[]; me.dash=null; me.absorb=0; document.getElementById('deathWin').classList.remove('hidden'); sysMsg('You have died.','c-err'); sendPresence(true); }
function release(){ me.dead=false; if(inArena(me.x,me.y)){ const [sx,sy]=AR.shr[Math.random()*2|0]; me.x=(sx+(Math.random()-.5)*2)*TS; me.y=(sy+(Math.random()-.5)*2)*TS; me.hp=me.mhp; } else if(me.y>=OWH*TS){ me.x=VAULT.start.x; me.y=VAULT.start.y; } else { me.x=SPAWN.x; me.y=SPAWN.y; } me.rootU=0; me.hp=inArena(me.x,me.y)?me.mhp:Math.round(me.mhp*.7); me.res=CLS[me.c.cls].res==='rage'?0:me.mres*.7; document.getElementById('deathWin').classList.add('hidden'); me.target=null; sparkle(me.x,me.y,'#fff3b0'); sendPresence(true); }
function gainXp(n){
  const c=me.c; if(c.lvl>=MAXLVL){ return; }
  c.xp+=n; chatLine(`You gain ${n} experience.`,'c-xp');
  while(c.lvl<MAXLVL && c.xp>=xpNeed(c.lvl)){ c.xp-=xpNeed(c.lvl); c.lvl++; recalc(); me.hp=me.mhp; if(CLS[c.cls].res==='mana') me.res=me.mres;
    toast(`Level ${c.lvl}!`); sfx('level'); setTimeout(()=>{ toast('Talent point! Press N to spend it','small'); sysMsg('You earned a talent point. Open Talents (N) to spend it.','c-xp'); },1400); TALC=null; setTimeout(()=>armorySync(true),500); if(c.lvl===10&&!c.mounts.length){ setTimeout(()=>toast('Mounts unlocked! Visit Hilde the Stable Master','small'),900); sysMsg('You can now ride! Hilde the Stable Master, just outside the East Gate of Hearthmere, sells mounts. Look for the golden horseshoe on your map.'); renderTracker(); } burst(me.x,me.y,'#ffd66a',40,200,{glow:true}); for(const ab of curAbils()) if(ab.lvl===c.lvl) { sysMsg(`New ability learned: ${ab.name} (key ${curAbils().indexOf(ab)+1})`); toast('New ability: '+ab.name,'small'); } sysMsg(`You have reached level ${c.lvl}. Your power grows.`); ring(me.x,me.y,'#ffd66a',90); }
  if(c.lvl>=MAXLVL) c.xp=0;
  persist();
}

/* ---------- items ---------- */
const ARMT={plate:['Breastplate','Warplate','Hauberk'],leather:['Jerkin','Brigandine','Hide Tunic'],cloth:['Robes','Vestments','Mantle']};
const CLS_ARMOR={warden:'plate',assassin:'leather',mender:'cloth',arcanist:'cloth',bard:'leather'}, ARMNAME={plate:'Plate',leather:'Leather',cloth:'Cloth'};
const CLS_WEAP={warden:['Longsword','Morningstar','Greataxe'],mender:['Warstaff','Morningstar','Wand'],arcanist:['Wand','Warstaff','Spellblade'],assassin:['Daggers','Dirks'],bard:['Hand Axe','Warspear','Greataxe','Hand Axe']};
const BASES={weapon:['Longsword','Warstaff','Spellblade','Morningstar','Wand','Greataxe','Daggers','Dirks','Hand Axe','Warspear'],armor:[...ARMT.plate,...ARMT.leather,...ARMT.cloth],trinket:['Charm','Signet','Talisman','Locket','Idol']};
function armorType(it){ if(!it||it.slot!=='armor') return null; if(it.at) return it.at; const n=String(it.name||''); for(const k in ARMT) if(ARMT[k].some(b=>n.includes(b))) return k; return null; }
function weaponBase(it){ if(!it||it.slot!=='weapon') return null; const n=String(it.name||''); return BASES.weapon.find(b=>n.includes(b))||null; }
function canUse(it,cls){ if(!it) return true; if(it.leg) return it.leg===cls; if(it.slot==='armor'){ const at=armorType(it); return !at||at===CLS_ARMOR[cls]; }
  if(it.slot==='weapon'){ const b=weaponBase(it); return !b||CLS_WEAP[cls].includes(b); } return true; }
function useReason(it,cls){ if(it.slot==='armor') return `${CLS[cls].name}s can only wear ${ARMNAME[CLS_ARMOR[cls]].toLowerCase()} armour.`; return `${CLS[cls].name}s cannot use a ${weaponBase(it)||'weapon like that'}.`; }
const PRE=[['Worn','Rough','Plain','Dented'],['Sturdy','Keen','Hunter\'s','Tempered'],['Gleaming','Runed','Vaelborn','Moonlit'],['Emberforged','Wyrmscale','Cinderheart']];
const SUF=['of the Hollow','of Cinders','of the Mire','of Dawnlight','of the Wolf','of Embers'];
const LEGEND={
  warden:{name:'Dawnwarden, Oath of the Last Wall',desc:'Forged from the gate of a kingdom that never fell. +10% damage and threat.',pow:62,sta:58},
  mender:{name:'Solace, Staff of the Undying Sun',desc:'A shard of the first dawn burns in its crown. +10% healing and damage.',pow:58,sta:60},
  arcanist:{name:'Cinderheart, Focus of the Wyrm',desc:'The still-beating heart of an elder wyrm, bound in mithril. +10% spell damage.',pow:68,sta:48}};
LEGEND.bard={name:'Emberhorn, the Warsong Axe',desc:'An axe forged around the horn of a fallen wyrm. Your songs are 25% stronger and Power Chord hits 15% harder.',pow:64,sta:56};
LEGEND.assassin={name:'Nightfang, Twin Fangs of the Hollow',desc:'Two moon-forged blades that drink the dark. +10% damage and critical strikes.',pow:66,sta:50};
function legendaryFor(cls){ const L=LEGEND[cls]||LEGEND.warden; return {id:rid(6),slot:'weapon',name:L.name,rar:4,pow:L.pow,sta:L.sta,lv:15,val:400,leg:cls,desc:L.desc}; }
// drop chances in % per rarity [common, uncommon, rare, epic, legendary]; the legendary is always for the looter's class
const BOSSLOOT={oldtusk:{n:1,p:[55,40,5,0,0]},fangmaw:{n:1,p:[0,55,40,5,0]},hking:{n:1,p:[0,20,65,15,0]},wyrm:{n:2,p:[0,0,61,38.5,.5]},frostgiant:{n:2,p:[0,0,46,53.3,.7]},lich:{n:2,p:[0,0,0,98,2]}};
function rollRar(p){ let r=Math.random()*100; for(let i=0;i<p.length;i++){ r-=p[i]; if(r<0) return i; } return p.findIndex(v=>v>0); }
function dropText(key){ const B=BOSSLOOT[key]; if(!B) return ''; return B.p.map((v,i)=>v?`${RAR[i]} ${v}%`:'').filter(Boolean).join(' · '); }
function genItem(lv,rar,cls){ cls=cls||(me?me.c.cls:'warden'); if(rar>=4) return legendaryFor(cls);
  const R=Math.random, slot=SLOTS[R()*3|0];
  const budget=(2.2+lv*1.7)*[1,1.45,2,2.8,3.8][rar];
  const pf=[.72,.25,.5][SLOTS.indexOf(slot)];
  const pow=Math.max(0,Math.round(budget*pf)), sta=Math.max(1,Math.round(budget*(1-pf)));
  const pool=slot==='armor'?ARMT[CLS_ARMOR[cls]]:slot==='weapon'?CLS_WEAP[cls]:BASES.trinket;
  let name=PRE[rar][R()*PRE[rar].length|0]+' '+pool[R()*pool.length|0]; if(rar>=2) name+=' '+SUF[R()*SUF.length|0];
  const it={id:rid(6),slot,name,rar,pow,sta,lv,val:Math.max(1,Math.round(lv*[.5,1.4,3,7][rar]))}; if(slot==='armor') it.at=CLS_ARMOR[cls]; return it;
}
function lootFor(m){
  const c=me.c, mt=m.t;
  const g0=mt.boss?20+Math.floor(Math.random()*12):mt.elite?6+Math.floor(Math.random()*6):Math.floor(Math.random()*(1+m.lv*.6))+(Math.random()<.5?1:0);
  let pots=0;
  const items=[];
  const BL=BOSSLOOT[mt.key];
  if(BL){ for(let k=0;k<BL.n;k++){ const r=rollRar(BL.p); const it=r===4?legendaryFor(c.cls):genItem(m.lv,r); items.push(it); if(r===4){ banner('LEGENDARY!',it.name,'win'); sfx('legend'); stat('legendary',1); chatLine(`A legendary weapon drops: [${it.name}]!`,'c-loot t4'); } } }
  if(mt.key==='vaelith'&&!c.mounts.includes(5)&&Math.random()<.03){ c.mounts.push(5); c.mount=5; setTimeout(()=>{ banner('RARE MOUNT!','Cragmaw Mountain Goat','win'); sfx('legend'); },1200); chatLine('The Drowned King drops a rare mount: the Cragmaw Mountain Goat! Press R to ride.','c-loot t4'); persist(); }
  else if(mt.boss){ items.push(genItem(m.lv,Math.random()<.3?3:2)); }
  else if(mt.elite){ items.push(genItem(m.lv,Math.random()<.5?2:1)); }
  else if(!mt.summon && Math.random()<.24){ const r=Math.random(); items.push(genItem(m.lv, r<.06?2:r<.36?1:0)); }
  for(const it of items) if(it.rar>=2) fx.push({k:'lootbeam',x:m.rx,y:m.ry,col:RARCOL[it.rar],t:now(),dur:it.rar===4?12:4});
  if(Math.random()<.08 && !mt.boss) pots=1;
  dropLoot(m,g0,items,pots); if(g0||items.length||pots){ const L=LOOTS[LOOTS.length-1]; if(L&&dist(me.x,me.y,L.x,L.y)<100&&!lootOpen) openLoot(L); }
}

/* ---------- death credit ---------- */
function onMobDeath(m){
  try{ mobSnd(m,'die'); }catch(e){}
  m.deathT=now(); m.dx=m.rx; m.dy=m.ry; deathBurst(m);
  if(!me) return; bossDied(m);
  if(me.target && me.target.kind==='m' && me.target.id===m.id){ me.target=null; me.auto=false; if(me.cast&&me.cast.ab.hostile) me.cast=null; }
  let credit = m.tag===MY_U;
  if(!credit && me.party && m.tag){ const o=othersByU.get(m.tag); if(o && o.pt===me.party && dist(o.x,o.y,me.x,me.y)<1000) credit=true; }
  if(!credit || me.dead) return;
  const diff=m.lv-Math.min(me.c.lvl,15); const mult=diff<=-5?.1:diff<=-3?.45:diff>=3?1.3:1;
  const xp=m.t.xp?m.t.xp:m.t.key==='lich'?6000:m.t.key==='wyrm'?1600:m.t.boss?900:Math.round((14+11*m.lv)*mult*(m.t.elite?3:1)*(m.lv>=10?2.2:1));
  gainXp(xp); fct(m.rx,m.ry-30,'+'+xp+' xp','#c9a0f0');
  if(m.t.elite&&!m.t.boss) toast(`${m.t.name} defeated!`);
  lootFor(m);
  questEvent('kill',m.t.key,1); trackKill(m);
}

/* =====================================================================
   ABILITIES & COMBAT (local player)
   ===================================================================== */
function curAbils(){ return ABIL[me.c.cls]; }
const PVP_MUL=.55;
function pvpFoe(o){ return !!(me&&o&&!o.d&&!me.dead&&pvpOn(me.x,me.y)&&pvpOn(o.rx,o.ry)&&!(me.party&&o.pt===me.party)); }
function arenaEnter(){ if(!me) return; if(me.c.lvl<5) return err('You must be level 5 to fight in the arena'); if(me.mounted) dismount();
  const [sx,sy]=AR.shr[Math.random()*2|0]; me.x=(sx+(Math.random()-.5)*2)*TS; me.y=(sy+(Math.random()-.5)*2)*TS; me.target=null; me.auto=false; me.hp=me.mhp;
  banner('BLOODSAND ARENA','Free-for-all · every hero is your enemy','win'); sysMsg('⚔ You enter the Bloodsand Arena. Inside the ring of stones you are safe; beyond it, any hero not in your party can attack you. Defeat costs nothing: release to return to a shrine. Talk to a Keeper or type -o to leave.','c-xp');
  try{ snd('horn'); }catch(e){} sendPresence(true); }
function arenaLeave(){ if(!me) return; if(me.dead) release(); me.x=AR.gate.x; me.y=AR.gate.y; me.target=null; me.auto=false; me.rootU=0; sysMsg('You leave the Bloodsand Arena.'); sendPresence(true); }
function hitPlayer(o,d,vis,crit){ pushAct(12,o.u,d,vis||0); fct(o.rx,o.ry-26,crit?d+'!':d,crit?'#ffb02e':'#ff8a6a',crit); spark(o.rx,o.ry,'#ffd0a0'); me.lastCombat=now(); }
function arenaHud(){ let el=$('arenaHud'); const on=!!(me&&inArena(me.x,me.y)); if(!on){ if(el) el.style.display='none'; return; }
  if(!el){ el=document.createElement('div'); el.id='arenaHud'; el.className='panel'; document.body.appendChild(el); } el.style.display='block'; const P=me.c.pvp||{k:0,d:0,best:0,st:0}, safe=arenaSafe(me.x,me.y);
  const foes=[...others.values()].filter(o=>inArena(o.rx,o.ry)&&!(me.party&&o.pt===me.party)).length;
  el.innerHTML=`<b>⚔ Bloodsand Arena</b> <span class="${safe?'safe':'war'}">${safe?'Safe zone':'PvP active'}</span><br><small>Kills ${P.k} · Deaths ${P.d} · Streak ${P.st||0} (best ${P.best}) · ${foes} rival${foes===1?'':'s'} here</small>`; }
function targetEnt(){
  const tg=me.target; if(!tg) return null;
  if(tg.kind==='m'){ const m=mobById[tg.id]; return m&&!m.dead?{kind:'m',e:m,x:m.rx,y:m.ry,hostile:true}:null; }
  if(tg.kind==='p'){ if(tg.id===MY_U) return {kind:'p',self:true,x:me.x,y:me.y,u:MY_U}; const o=othersByU.get(tg.id); return o?{kind:'p',e:o,x:o.rx,y:o.ry,u:o.u,hostile:pvpFoe(o)}:null; }
  if(tg.kind==='n'){ const n=NPCS.find(n=>n.id===tg.id); return n?{kind:'n',e:n,x:n.x,y:n.y}:null; }
  return null;
}
function err(msg){ const el=document.getElementById('errmsg'); el.textContent=msg; clearTimeout(err.t); err.t=setTimeout(()=>el.textContent='',1600); }
function useAbility(i){
  if(!me||me.dead) return; const ab=typeof i==='object'?i:curAbils()[i]; if(!ab) return; const t=now();
  if(me.c.lvl<ab.lvl) return err(`Learned at level ${ab.lvl}`); if(me.mounted) dismount(); me.emote=null; if(ab.id!=='stealth'&&ab.id!=='vanish'&&ab.id!=='ambush'&&ab.id!=='shadowstep'&&ab.id!=='evasion'&&me.stealth&&!(ab.hostile||ab.aoeDmg)) breakStealth();
  if(me.cast) return err('Already casting');
  if(me.dash) return;
  if(!ab.noGcd && me.gcd>t) return;
  if((me.cds[ab.id]||0)>t) return err('Not ready yet');
  if(ab.stealth&&me.stealth){ breakStealth(); return; }
  if(ab.stealth&&inCombat()) return err("You can't hide while in combat");
  if(ab.stealthOnly&&!me.stealth) return err('You must be in stealth');
  if(ab.finisher&&!(me.cp>0)) return err('No combo points');
  if((ab.encore||ab.banner)&&!me.song) return err('Start a song first');
  if(!gm.god&&me.res<costOf(ab)) return err('Not enough '+CLS[me.c.cls].res);
  let tgt=null;
  if(ab.hostile){ const te=targetEnt(); if(!te||!te.hostile) return err('You have no target');
    const d=dist(me.x,me.y,te.x,te.y); if(d>ab.rng+(te.e.t?te.e.t.r:12)+(ab.melee?MELEE_SLACK:0)) return err('Out of range'); if(ab.minRng && d<ab.minRng) return err('Too close'); tgt=te; me.auto=true; }
  if(ab.friendly){ const te=targetEnt(); tgt=(te&&te.kind==='p'&&!(te.e&&te.e.d))?te:{kind:'p',self:true,x:me.x,y:me.y,u:MY_U};
    if(dist(me.x,me.y,tgt.x,tgt.y)>ab.rng) return err('Out of range'); }
  if(ab.charge && me.rootU>t) return err('You are rooted');
  if(!ab.noGcd) me.gcd=t+(gm.nocd?.25:1);
  flashSlot(i);
  if(ab.cast){ try{ snd('castStart'); }catch(e){} me.cast={ab,t0:t,dur:ab.cast,tgt:me.target?{...me.target}:null,tgtEnt:tgt}; return; }
  execAbility(ab,tgt);
}
function execAbility(ab,tgt){
  const t=now(); if(!gm.god) me.res-=costOf(ab); if(CLS[me.c.cls].res==='mana') me.lastSpend=t; if(ab.cd&&!gm.nocd) me.cds[ab.id]=t+ab.cd*(1-TAL('cdr'));
  const fromSt=!!me.stealth; if(fromSt&&(ab.hostile||ab.aoeDmg)) breakStealth(true);
  const stepB=me.stepU>t&&(ab.hostile||ab.aoeDmg)&&!ab.shadowstep; if(stepB) me.stepU=0;
  const dmgMul=(1+TAL('dmg')+TAL('ab:'+ab.id))*(fromSt?1.25+TAL('opp'):1)*(stepB?1.3:1)*(1+songFx().dmg)*(ab.songBonus&&me.song?1.15+(me.c.eq.weapon&&me.c.eq.weapon.leg==='bard'?.15:0):1), healMul=1+TAL('heal')+TAL('ab:'+ab.id);
  const critCh=(ab.alwaysCrit&&fromSt)?1:.1+(CLS[me.c.cls].crit||0)+TAL('crit')+(me.c.eq.weapon&&me.c.eq.weapon.leg==='assassin'?.06:0), critM=1.7+TAL('critd');
  SV_MUL=healMul;
  const vis={holy:1,fire:2,arcane:3,wand:4}[ab.proj]||0;
  if(ab.hostile||ab.aoeDmg) me.lastCombat=t;
  if(ab.melee) me.swingT=t;
  const hitMob=(m,base,v,from)=>{ const c=Math.random()<critCh; const d=Math.round(base*dmgMul/healMul*(.92+Math.random()*.16)*(c?critM:1));
    if(from!==undefined) pushAct(0,m.id,d,v,from,0); else pushAct(0,m.id,d,v);
    fct(m.rx,m.ry-26,c?d+'!':d,c?'#ffb02e':'#ffe066',c); m.hit=t; if(c) shake(3); return d; };
  if(ab.dmg && tgt && tgt.kind==='m' && !ab.chain){ const m=tgt.e; if(m.dead) return;
    const d=hitMob(m,scaleV(ab.dmg)*(ab.finisher?Math.max(1,me.cp):1),vis);
    if(ab.threatMul){ if(amHost) m.threat[MY_U]=(m.threat[MY_U]||0)+d*(ab.threatMul-1)*2.4; else pushAct(3,m.id,0,0); }
    visualAct({x:me.x,y:me.y,u:MY_U},[0,0,m.id,d,vis],true); if(ab.melee) FXP({k:'cut',m:m.id,dur:.32,x2:ab.id==='strike'||ab.id==='evis'||ab.id==='ambush',col:me.c.cls==='assassin'?'#5affa8':'#ff7a4a'});
  }
  if(ab.dmg && tgt && tgt.kind==='p' && tgt.hostile){ const c=Math.random()<critCh; const d=Math.round(scaleV(ab.dmg)*(ab.finisher?Math.max(1,me.cp):1)*dmgMul/healMul*(.92+Math.random()*.16)*(c?critM:1)); hitPlayer(tgt.e,d,vis,c); if(c) shake(3);
    if(ab.melee) FXP({k:'wave',x:tgt.x,y:tgt.y,r:26,col:'#ffd0a0',dur:.25,h:.9}); else if(ab.proj) FXP({k:'streak',sx:me.x,sy:me.y,ex:tgt.x,ey:tgt.y,col:{holy:'#fff3a0',fire:'#ff8a2a',arcane:'#d6b3ff',wand:'#bfe8ff'}[ab.proj]||'#fff',dur:.3}); }
  if(ab.charge && tgt){ FXP({k:'streak',sx:me.x,sy:me.y,ex:tgt.x,ey:tgt.y,dur:.5}); me.dash={sx:me.x,sy:me.y,m:tgt.e,t0:t,dur:.28}; pushAct(6,0,0,16,me.x,me.y); areaFx(16,me.x,me.y,0); me.res=Math.min(100,me.res+20); me.auto=true; }
  else if(ab.stun && tgt && tgt.kind==='p'){ pushAct(13,tgt.u,ab.stun*1000,0); spark(tgt.x,tgt.y,'#fff3a0'); }
  else if(ab.stun && tgt && tgt.kind==='m'){ pushAct(2,tgt.e.id,ab.stun*1000,0); spark(tgt.x,tgt.y,'#fff3a0'); shake(3); pushAct(6,0,60,22,tgt.x,tgt.y); areaFx(22,tgt.x,tgt.y,60); }
  if(ab.taunt && tgt && tgt.kind==='m'){ pushAct(3,tgt.e.id,0,7); fct(tgt.x,tgt.y-40,'!','#ff4a3a',true); ring(tgt.x,tgt.y,'#ff4a3a',40); pushAct(6,0,110,23,me.x,me.y); areaFx(23,me.x,me.y,110); FXP({k:'wave',x:tgt.x,y:tgt.y,r:45,col:'#ff4a3a',dur:.4,h:1}); }
  if(ab.buff==='bulwark'){ me.bulwark=t+ab.dur; ring(me.x,me.y,'#7fb2ff',60); burst(me.x,me.y,'#9fc4ff',16,90,{glow:true}); pushAct(6,0,60,24,me.x,me.y); areaFx(24,me.x,me.y,60); }
  if(ab.heal && tgt){ const c=Math.random()<critCh; const h=Math.round(scaleV(ab.heal)*(.92+Math.random()*.16)*(c?1.5:1));
    if(tgt.u===MY_U) healMe(h); else { pushAct(1,tgt.u,h,5); fct(tgt.x,tgt.y-30,'+'+h+(c?'!':''),'#6dff7a',c); sparkle(tgt.x,tgt.y,'#9dffb0'); } }
  if(ab.hot && tgt){ const h=Math.round(scaleV(ab.hot));
    petals(tgt.x,tgt.y); if(tgt.u===MY_U){ me.hots=me.hots.filter(x=>x.src!==MY_U); me.hots.push({src:MY_U,amt:h,left:5,next:t+2}); sparkle(me.x,me.y,'#c6ffb0'); }
    else { pushAct(4,tgt.u,h,6); sparkle(tgt.x,tgt.y,'#c6ffb0'); } }
  if(ab.absorb && tgt){ const a=Math.round(scaleV(ab.absorb)*(1+TAL('absorb')));
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
      for(const o of others.values()) if(pvpFoe(o)&&dist(o.rx,o.ry,cx,cy)<R+12){ const c=Math.random()<critCh; hitPlayer(o,Math.round(d0*dmgMul/healMul*(.92+Math.random()*.16)*(c?critM:1)),0,c); if(ab.root) pushAct(13,o.u,ab.root*1000,0); }
      if(ab.aoeHealAlly){ const h=Math.round(scaleV(ab.aoeHealAlly)); if(dist(me.x,me.y,cx,cy)<R) healMe(h);
        for(const o of others.values()) if(!o.d&&dist(o.rx,o.ry,cx,cy)<R){ pushAct(1,o.u,h,0); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } } };
    if(ab.ticks){ for(let k=0;k<ab.ticks;k++) setTimeout(apply,k*700+250); } else if(v===13) setTimeout(apply,550); else apply(); }
  if(ab.chain && tgt && tgt.kind==='p'){ const c=Math.random()<critCh; hitPlayer(tgt.e,Math.round(scaleV(ab.dmg)*dmgMul/healMul*(c?critM:1)),11,c); FXP({k:'streak',sx:me.x,sy:me.y,ex:tgt.x,ey:tgt.y,col:'#bfe4ff',dur:.3}); }
  else if(ab.chain && tgt){ let cur=tgt.e, from=0, base=scaleV(ab.dmg); const hit=new Set();
    for(let k=0;k<ab.chain && cur;k++){ hit.add(cur.id); hitMob(cur,base,11,from); lightningFx(from?mobById[from]:{rx:me.x,ry:me.y},cur);
      base*=.8; from=cur.id; let nx=null,nd=175; for(const m of mobs) if(!m.dead&&!hit.has(m.id)){ const dd=dist(m.rx,m.ry,cur.rx,cur.ry); if(dd<nd){nd=dd;nx=m} } cur=nx; } }
  if(ab.rallyHeal){ healMe(Math.round(me.mhp*ab.rallyHeal)); pushAct(6,0,ab.radius,20,me.x,me.y); areaFx(20,me.x,me.y,ab.radius); shake(3);
    for(const o of others.values()) if(!o.d&&dist(o.x,o.y,me.x,me.y)<ab.radius){ const h=Math.round(o.mhp*.15); pushAct(1,o.u,h,5); fct(o.rx,o.ry-30,'+'+h,'#6dff7a'); } }
  if(ab.buff==='avatar'){ me.avatarU=t+ab.dur; areaFx(20,me.x,me.y,120); pushAct(6,0,120,20,me.x,me.y); shake(4); }
  if(ab.sanct){ me.sanct={x:me.x,y:me.y,until:t+8,next:t,r:ab.radius}; pushAct(6,0,ab.radius,27,me.x,me.y); SANCTS.push({x:me.x,y:me.y,r:ab.radius,until:t+8}); FXP({k:'wave',x:me.x,y:me.y,r:ab.radius,col:'#ffe27a',dur:.8}); }
  rogueAbility(ab,tgt,t,dmgMul/healMul,critCh,critM);
  bardAbility(ab,tgt,t);
  if(ab.blink){ const sx=me.x,sy=me.y; for(let s=ab.blink;s>0;s-=8){ const nx=me.x+Math.cos(me.face)*s, ny=me.y+Math.sin(me.face)*s; if(!blocked(nx,ny,11)){me.x=nx;me.y=ny;break} }
    me.rootU=0; ring(sx,sy,'#d6b3ff',40); ring(me.x,me.y,'#d6b3ff',40); burst(sx,sy,'#d6b3ff',18,120,{glow:true}); burst(me.x,me.y,'#f0e0ff',18,90,{glow:true});
    pushAct(6,0,40,17,sx,sy); FXP({k:'portal',x:sx,y:sy,dur:.7,f:me.face+1.57}); FXP({k:'portal',x:me.x,y:me.y,dur:.6,f:me.face+1.57}); FXP({k:'streak',sx,sy,ex:me.x,ey:me.y,col:'#d6b3ff',dur:.4}); }
  SV_MUL=1;
}
function breakStealth(quiet){ if(!me||!me.stealth) return; me.stealth=false; if(!quiet) sysMsg('You leave the shadows.'); sendPresence(true); }
function enterStealth(vanish){ me.stealth=true; me.auto=false; const [X,Y,Z]=ph3(me.x,me.y,1); burst3(X,Y,Z,vanish?'#9a94a8':'#3a2a4a',vanish?40:14,vanish?2.5:1.2,{up:.8}); pushAct(6,0,40,29,me.x,me.y); areaFx(29,me.x,me.y,vanish?60:30);
  if(vanish){ pushAct(9,0,0,0); for(const m of mobs) if(m.tgt===MY_U&&me.target&&me.target.kind==='m'&&me.target.id===m.id) me.auto=false; } sendPresence(true); }
function rogueAbility(ab,tgt,t,dm,critCh,critM){
  if(ab.finisher){ me.cp=TAL('refund')?1:0; }
  if(ab.cp&&(ab.hostile||ab.aoeDmg)) me.cp=Math.min(5,(me.cp||0)+ab.cp);
  if(ab.id==='sinister'&&TAL('poison')&&tgt&&tgt.kind==='m'){ const m=tgt.e, pd=Math.max(1,Math.round(scaleV(ab.dmg)*dm*TAL('poison')/3)); for(let k=1;k<=3;k++) setTimeout(()=>{ if(!m.dead&&me&&!me.dead){ pushAct(0,m.id,pd,0); fct(m.rx,m.ry-26,pd,'#7aff4a'); } },k*2000); }
  if(ab.stealth) enterStealth(false);
  if(ab.vanish) enterStealth(true);
  if(ab.buff==='evasion'){ me.evasionU=t+ab.dur; const [X,Y,Z]=ph3(me.x,me.y,1); burst3(X,Y,Z,'#bfffd8',16,1.6,{glow:true}); FXP({k:'wave',x:me.x,y:me.y,r:40,col:'#7affc0',dur:.4}); }
  if(ab.shadowstep&&tgt){ const a=Math.atan2(tgt.y-me.y,tgt.x-me.x), sx=me.x, sy=me.y; const tr=(tgt.e.t?tgt.e.t.r:12)+16; let nx=tgt.x+Math.cos(a)*tr, ny=tgt.y+Math.sin(a)*tr; if(blocked(nx,ny,10)){ nx=tgt.x-Math.cos(a)*tr; ny=tgt.y-Math.sin(a)*tr; }
    if(!blocked(nx,ny,10)){ me.x=nx; me.y=ny; } me.face=Math.atan2(tgt.y-me.y,tgt.x-me.x); me.stepU=t+3; me.auto=true; pushAct(6,0,40,30,sx,sy); areaFx(30,sx,sy,40); areaFx(30,me.x,me.y,40); FXP({k:'streak',sx,sy,ex:me.x,ey:me.y,col:'#3aff9a',dur:.35}); }
}
function updateCast(){
  const c=me.cast; if(!c) return; const t=now();
  if(me.moving){ me.cast=null; castFail('Interrupted'); err('Interrupted'); return; }
  if(t-c.t0>=c.dur){ me.cast=null; if(c.node){ finishGather(c.node); return; } if(c.mount){ mountUp(); return; }
    let tgt=c.tgtEnt; const save=me.target; if(c.ab.hostile||c.ab.friendly){ me.target=c.tgt; const te=targetEnt(); me.target=save;
      if(c.ab.hostile){ if(!te||!te.hostile){ castFail('Target lost'); return err('Target lost'); } tgt=te; if(dist(me.x,me.y,te.x,te.y)>c.ab.rng+(te.e.t?te.e.t.r:12)+20){ castFail('Out of range'); return err('Out of range'); } }
      else { tgt=(te&&te.kind==='p')?te:{kind:'p',self:true,x:me.x,y:me.y,u:MY_U}; } }
    if(me.res<costOf(c.ab)) return err('Not enough '+CLS[me.c.cls].res);
    execAbility(c.ab,tgt);
  }
}
const MELEE_SLACK=14;
function updateAuto(dt){
  const te=targetEnt(); if(!me.auto||!te||!te.hostile||me.dead){ if(!te||!te.hostile) me.auto=false; return; }
  const a=CLS[me.c.cls].auto; me.autoT-=dt; if(me.cast||me.dash||me.stealth) return;
  if(me.autoT<=0 && dist(me.x,me.y,te.x,te.y)<=a.rng+(te.e.t?te.e.t.r:12)+(a.proj?0:MELEE_SLACK)){ me.autoT=a.spd*(1-songFx().as);
    const c=Math.random()<.08+(CLS[me.c.cls].crit||0)+TAL('crit'); const d=Math.round((a.dmg+a.dmgL*(me.c.lvl-1)+me.pow*.45)*(1+TAL('dmg'))*(1+songFx().dmg)*(.9+Math.random()*.2)*(c?1.7+TAL('critd'):1));
    if(te.kind==='p'){ hitPlayer(te.e,d,a.proj?4:0,c); if(!a.proj) me.swingT=now(); return; }
    pushAct(0,te.e.id,d,a.proj?4:0); fct(te.x,te.y-26,c?d+'!':d,c?'#ffb02e':'#fff',c); te.e.hit=now(); te.e.atkT=now(); me.lastCombat=now();
    if(!a.proj) me.swingT=now();
    if(CLS[me.c.cls].res==='rage') me.res=Math.min(100,me.res+10);
    visualAct({x:me.x,y:me.y,u:MY_U},[0,0,te.e.id,d,a.proj?4:0],true);
  }
}
function usePotion(){ if(!me||me.dead) return; const t=now(); if(me.c.pots<=0) return err('No potions left'); if(me.potCd>t) return err('Potion not ready');
  me.c.pots--; me.potCd=t+30; try{ snd('potion'); }catch(e){} healMe(Math.round(me.mhp*.38)); persist(); }

/* =====================================================================
   EMBERFALL 3D ENGINE — WebGL2, no libraries
   ===================================================================== */
const cv=document.getElementById('c'), ov=document.getElementById('ov'), g=ov.getContext('2d');
const gl=cv.getContext('webgl2',{antialias:true,powerPreference:'high-performance'});
if(!gl){ document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99;background:#0b0806;color:#f3e6c8;font:20px sans-serif;text-align:center;padding:30px">Emberfall needs WebGL 2. Please open it in an up-to-date Chrome, Edge, Firefox or Safari.</div>'); throw new Error('WebGL2 unavailable'); }
let W=0,H=0,DPR=1;
const GFX=(function(){ const ua=navigator.userAgent, tablet=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)||(/Android/.test(ua)&&!/Mobile/.test(ua)), mob=/Android|iPhone|iPod/i.test(ua)||(navigator.maxTouchPoints>1&&innerWidth<1100); let q=((typeof saves!=='undefined'&&saves.opts&&saves.opts.gfx)||'auto'); if(q==='auto') q=tablet?'medium':mob?'low':'high';
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
out vec3 vW; out vec3 vN; out vec4 vC; out vec4 vS; out vec3 vL;
void main(){
  vec3 p=aPos, n=aNor; vec4 c=aCol; vec3 w;
#ifdef INST
  p*=iB.xyz; n/=iB.xyz; float s=sin(iA.w), k=cos(iA.w);
  p=vec3(p.x*k+p.z*s,p.y,-p.x*s+p.z*k); n=vec3(n.x*k+n.z*s,n.y,-n.x*s+n.z*k);
  float sw=iB.w*aPos.y*aPos.y; p.x+=sin(uTime*1.6+iA.x*.37+iA.z*.23)*sw; p.z+=cos(uTime*1.25+iA.z*.31+iA.x*.11)*sw*.7;
  if(uGrassD>0.){ float gd=length(iA.xz-uCam.xz); p*=smoothstep(uGrassD,uGrassD*.72,gd); }
  w=p+iA.xyz; c.rgb*=iC; vL=p;
#else
  w=(uM*vec4(p,1.)).xyz; n=mat3(uM)*(n*uInvS2); vL=p*inversesqrt(max(uInvS2,vec3(1e-6)));
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
in vec3 vW; in vec3 vN; in vec4 vC; in vec4 vS; in vec3 vL;
uniform float uMat;
uniform vec3 uTint; uniform float uEmis; uniform float uAlpha; uniform float uTerrain; uniform float uSpec; uniform float uFol; uniform vec4 uFade;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uFog; uniform vec3 uCam;
uniform float uFogD; uniform float uTime; uniform float uShOn; uniform float uHFog;
uniform int uNL; uniform vec4 uLP[16]; uniform vec3 uLC[16];
uniform int uND; uniform vec4 uDec[12]; uniform vec4 uDecC[12];
uniform highp sampler2D uShadow;
out vec4 o;
${GLSL_NOISE}
const vec2 PD[12]=vec2[12](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893),vec2(.507,.064),vec2(.896,.412),vec2(-.322,-.933),vec2(-.792,-.598));
float shadowF(){ vec3 p=vS.xyz/vS.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  vec2 ts=1./vec2(textureSize(uShadow,0)); float bias=.0011+.0012*(1.-abs(dot(normalize(vN),uSunDir))); float s=0.; for(int i=0;i<12;i++){ s+= (p.z-bias > texture(uShadow,p.xy+PD[i]*ts*1.9).r) ? 0. : 1.; } return smoothstep(0.,1.,s/12.); }
void main(){
  if(uFade.w>.5){ vec3 A=uFade.xyz, ab=uCam-A; float tt=clamp(dot(vW-A,ab)/max(dot(ab,ab),.001),0.,1.); float dd=length(vW-(A+ab*tt));
    float k=(1.-smoothstep(.9,2.3,dd))*smoothstep(.03,.16,tt)*smoothstep(-1.4,-.2,vW.y-A.y);
    float nz=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))); if(nz<k*.86) discard; }
  vec3 N=normalize(vN); if(!gl_FrontFacing&&uFol<2.5) N=-N;
  vec3 base=vC.rgb*uTint; float trans=0.;
  if(uFol>.5&&uFol<1.5&&vC.g>vC.r*1.12){ float l1=vn(vW.xz*3.1+vW.y*2.3), l2=vn(vW.xz*8.7-vW.y*5.1), l3=vn(vW.zx*19.+vW.y*13.);
    base*=.62+.42*l1+.28*l2+.12*l3; N=normalize(N+vec3(l2-.5,l3-.5,l1-.5)*.9); trans=.55; }
  else if(uFol>.5&&uFol<1.5&&vC.r>vC.b*1.3){ float bk=vn(vec2(atan(vW.x,vW.z)*3.,vW.y*9.)); base*=.75+.4*bk; }
  if(uFol>1.5&&uFol<2.5){ float r1=fbm2(vW.xz*1.7+vW.y*1.3), r2=vn(vW.xz*7.+vW.y*5.); base*=.7+.5*r1+.15*r2; N=normalize(N+vec3(r2-.5,0.,r1-.5)*.5); if(N.y>.55) base=mix(base,base*vec3(.75,.95,.6),smoothstep(.55,.85,N.y)*.5*step(uTerrain,.5)*step(base.b,base.g*1.1)); }
  if(uFol>2.5){ N=normalize(mix(N,vec3(0.,1.,0.),.5)); trans=.35; }
  if(uTerrain>.5){ float n=vn(vW.xz*2.7)*.5+vn(vW.xz*9.)*.3+vn(vW.xz*.55)*.2; float n2=vn(vW.xz*23.)*.6+vn(vW.xz*41.)*.4; base*=(.78+.44*n)*(.9+.2*n2); N=normalize(N+vec3(vn(vW.xz*17.)-.5,0.,vn(vW.zx*17.+3.)-.5)*.18);
    float sl=1.-N.y; vec3 rk=mix(vec3(.4,.37,.34),base*1.15,.45)*(.7+.45*vn(vW.xz*3.5+vW.y)); base=mix(base,rk,smoothstep(.3,.55,sl)); }
  if(uMat>.5&&uTerrain<.5){ vec3 q=vL; float mDet=smoothstep(16.,3.,length(uCam-vW));
    if(uMat<1.5){ float wv=sin(q.x*420.+q.z*420.)*sin(q.y*420.)*.5+.5; float fz=vn(q.xy*38.+q.z*17.), lg=vn(q.yz*6.+q.x*3.);
      base*=mix(1.,.95+.035*wv+.05*fz,mDet)*(.93+.12*lg); N=normalize(N+vec3(fz-.5,wv-.5,vn(q.zy*38.)-.5)*.07*mDet); }
    else if(uMat<2.5){ float g=vn(q.xy*70.+q.z*40.)*.6+vn(q.zy*150.)*.4, wr=vn(q.xz*9.+q.y*4.); base*=mix(1.,.84+.24*g,mDet)*(.9+.18*wr); N=normalize(N+vec3(g-.5,vn(q.yx*70.)-.5,vn(q.xz*70.)-.5)*.26*mDet); }
    else if(uMat<3.5){ float br=vn(vec2(q.x*240.+q.z*240.,q.y*5.)); float sc=smoothstep(.93,.985,vn(q.xy*31.+q.z*17.)); float wr=vn(q.xz*7.+q.y*5.); base*=mix(1.,.9+.16*br-.3*sc,mDet)*(.9+.15*wr); }
    else if(uMat<4.5){ float po=vn(q.xy*160.+q.z*90.); base*=1.-.05*po*mDet; base=mix(base,base*vec3(1.07,.92,.88),smoothstep(.25,.65,vn(q.xz*9.+q.y*3.))*.22); }
    else { float st=vn(vec2((q.x+q.z)*180.,q.y*7.)), st2=vn(vec2((q.x-q.z)*60.,q.y*2.5)); base*=mix(.9,.7+.42*st,mDet)*(.88+.22*st2); if(uMat>5.5) base*=.88+.2*smoothstep(.3,.9,vn(q.xy*14.+q.z*9.));
      N=normalize(N+vec3(st-.5,0.,st2-.5)*.2*mDet); } }
  float sh=uShOn>.5?shadowF():1.;
  float ndr=dot(N,uSunDir); float nd=max(ndr,0.);
  bool skin=abs(uSpec-.26)<.01;
  if(skin) nd=max((ndr+.4)/1.4,0.);
  vec3 amb=mix(uGnd,uSky,N.y*.5+.5)*(.82+.18*N.y);
  vec3 col=base*(amb+uSunCol*nd*sh);
  if(skin) col+=base*vec3(.32,.1,.05)*uSunCol*smoothstep(.4,-.2,ndr)*smoothstep(-.8,-.2,ndr)*.6*sh;
  if(trans>0.) col+=base*uSunCol*pow(max(dot(normalize(uCam-vW),-uSunDir),0.),3.)*trans*sh+base*uSunCol*max(-ndr,0.)*trans*.35*sh;
  vec3 V=normalize(uCam-vW); float spw=uTerrain>.5?.036:uSpec*(uMat>.5&&uMat<1.5?.18:uMat>1.5&&uMat<2.5?.7:uMat>4.5?.25:1.); col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),uSpec>.5?60.:24.)*spw*sh*(uSpec>.5?2.2:1.);
  if(uTerrain<.5&&uFol<.5){ float nv=max(dot(N,V),0.); float fr=pow(1.-nv,3.); col+=mix(uSky,uSunCol,.35)*fr*(.14+uSpec*.25)*(.4+.6*sh);
    if(abs(uSpec-.12)<.01) col+=base*amb*pow(1.-nv,2.)*.3;
    if(uSpec>.5) col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),220.)*1.6*sh;
    if(uSpec>.5){ vec3 Rf=reflect(-V,N); col+=base*mix(uGnd*.6,uSky*1.4,Rf.y*.5+.5)*.45; }
    vec3 Hh=normalize(uSunDir+V);
    if(uMat>.5&&uMat<1.5) col+=base*mix(uSky,uSunCol,.5)*pow(1.-nv,4.)*.55*(.4+.6*sh);
    else if(uMat>1.5&&uMat<2.5) col+=uSunCol*pow(max(dot(N,Hh),0.),40.)*.16*sh;
    else if(uMat>4.5){ vec3 Tg=normalize(vec3(0.,1.,0.)-N*N.y+vec3(1e-4)); float th=dot(Tg,Hh); float kk=sqrt(max(1.-th*th,0.));
      col+=uSunCol*(pow(kk,70.)*.22+pow(kk,14.)*.06)*mix(vec3(1.),base*2.,.5)*sh; }
    col*=mix(1.,.82+.18*smoothstep(-.6,.5,N.y),.6); }
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
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uRealSun; uniform float uCloud; uniform float uNight; uniform vec4 uFC;
uniform int uNL; uniform vec4 uLP[16]; uniform vec3 uLC[16];
out vec4 o;
${GLSL_NOISE}
void main(){
  vec2 hv=texture(uHeight,vW.xz/uMap).rg; float depth=uLevel-hv.r; float fr=0.;
  if(uMode>1.5){ fr=length(vW.xz-uFC.xy); if(fr>uFC.z||fr<uFC.w) discard; depth=.55; } else if(depth<0.) discard;
  vec2 p=vW.xz; float t=uTime; vec3 col; float a=1.;
  if(uMode<.5||uMode>1.5){
    float h1=vn(p*1.2+vec2(t*.35,t*.21)), h2=vn(p*2.9-vec2(t*.27,t*.38)), h3=vn(p*1.6+vec2(-t*.22,t*.31));
    float amp=uMode>1.5?.35:1.;
    vec3 N=normalize(vec3(((h1-.5)*.38+(h2-.5)*.2)*amp,1.,((h3-.5)*.38+(h2-.5)*.15)*amp));
    if(uMode>1.5){ vec2 rd=(vW.xz-uFC.xy)/max(fr,.001); float w=sin(fr*15.-t*5.)*.07*smoothstep(uFC.z,uFC.w,fr)+sin(fr*31.-t*8.)*.025; N=normalize(N+vec3(rd.x*w,0.,rd.y*w)); }
    vec3 V=normalize(uCam-vW);
    /* what the water mirrors: the real sky in that direction, with its sun and drifting clouds */
    vec3 R=reflect(-V,N); R.y=abs(R.y);
    vec3 sky=mix(uHor,uZen,pow(clamp(R.y,0.,1.),.55));
    float sd=max(dot(R,uRealSun),0.); sky+=uSunCol*(pow(sd,700.)*7.+pow(sd,14.)*.3);
    vec2 cp=R.xz/(R.y+.12)*1.4+vec2(t*.006,t*.002); float cl=smoothstep(.66-uCloud*.4,.92-uCloud*.3,fbm2(cp))*smoothstep(0.,.18,R.y);
    sky=mix(sky,mix(uHor*1.15,vec3(1.),.45)*(1.-uNight*.85)+uSunCol*.15,cl*.7);
    float fres=.02+.98*pow(1.-max(dot(N,V),0.),5.);
    vec3 deep=vec3(.02,.1,.17), shal=uMode>1.5?vec3(.16,.42,.46):vec3(.1,.38,.42);
    col=mix(shal,deep,smoothstep(0.,1.3,depth))*(uSky*1.2+.15);
    col=mix(col,sky*1.05,clamp(fres*1.15+.08,0.,1.));
    col+=uSunCol*pow(max(dot(N,normalize(uSunDir+V)),0.),140.)*1.8;
    for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 L=uLP[i].xyz-vW; float d=length(L); float la=clamp(1.-d/uLP[i].w,0.,1.); col+=uLC[i]*la*la*.25; }
    float foam=smoothstep(.22,0.,depth)*(.55+.45*vn(p*7.+t*.8)); col=mix(col,vec3(.85,.92,.95)*(uSky+.3),foam);
    a=clamp(smoothstep(0.,.6,depth)*.72+.22+foam+fres*.2,0.,1.); if(uMode>1.5) a=min(a,.9);
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
let STATIC_D=null, OCC=null; const OCC_R=4;
function occMark(d,b){ if(!OCC) OCC=new Float32Array(MW*OCC_R*MH*OCC_R); const p=d.p; let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y0=1e9,y1=-1e9;
  for(let i=b*3;i<p.length;i+=3){ const x=p[i],y=p[i+1],z=p[i+2]; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z; }
  if(y1-y0<.6||x1-x0<.2||z1-z0<.2) return;   /* flat things (paths, rugs, water) and thin poles never block */
  const W=MW*OCC_R; for(let gz=Math.max(0,Math.ceil(z0*OCC_R-.5));gz<=Math.min(MH*OCC_R-1,Math.floor(z1*OCC_R-.5));gz++) for(let gx=Math.max(0,Math.ceil(x0*OCC_R-.5));gx<=Math.min(W-1,Math.floor(x1*OCC_R-.5));gx++){ const k=gz*W+gx; if(OCC[k]<y1) OCC[k]=y1; } }
const SCH=new Map(), SCS=32;
function gAdd(dst,src,x,y,z,ry,sx,sy,sz,col,e,rz,rx){ if(dst===STATIC_D){ const kx=Math.floor((x+OFX)/SCS), kz=Math.floor((z+OFY)/SCS), key=kx*1000+kz; let c=SCH.get(key); if(!c){ c={d:G0(),cx:(kx+.5)*SCS,cz:(kz+.5)*SCS}; SCH.set(key,c); } const b0=c.d.p.length/3; gAdd0(c.d,src,x,y,z,ry,sx,sy,sz,col,e,rz,rx); try{ occMark(c.d,b0); }catch(_){} return dst; } return gAdd0(dst,src,x,y,z,ry,sx,sy,sz,col,e,rz,rx); }
function gAdd0(dst,src,x,y,z,ry,sx,sy,sz,col,e,rz,rx){ x+=OFX; z+=OFY; const b=dst.p.length/3; const cy=Math.cos(ry||0),sy2=Math.sin(ry||0), cz=Math.cos(rz||0),szz=Math.sin(rz||0), cx=Math.cos(rx||0), sxx=Math.sin(rx||0);
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
function gLoft(seg,prof,down){ const d=G0(), n=prof.length; if(down) prof=prof.map(([y,r])=>[-y,r]);
  for(let j=0;j<n;j++){ const [y,r]=prof[j], p0=prof[Math.max(0,j-1)], p1=prof[Math.min(n-1,j+1)]; const sl=-(p1[1]-p0[1])/((p1[0]-p0[0])||1e-3), l=Math.hypot(1,sl);
    for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); gPush(d,nx*r,y,nz*r,nx/l,sl/l,nz/l); } }
  for(let j=0;j<n-1;j++) for(let i=0;i<seg;i++){ const a=j*(seg+1)+i, b=a+seg+1; if(down) d.i.push(a,a+1,b,b,a+1,b+1); else d.i.push(a,b,a+1,b,b+1,a+1); }
  return d; }
/* ---------- v20: sculpted head: skull, brow ridge, eye sockets, cheekbones, nose, lips, jaw and chin in one smooth mesh ---------- */
const HEADK=(function(){ const G=(v,s)=>Math.exp(-(v*v)/(2*s*s)), ss=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
  const rx=.46, ry=.5, rz=.37;
  const wz=y=>1-.27*ss(-.05,-.46,y)+.03*G(y+.04,.08);
  const bx=y=>(1.05-.55*ss(-.08,-.46,y));
  const nose=(y,z)=>{ const h=(.016+.085*ss(.04,-.15,y))*ss(.14,.035,y)*(1-ss(-.155,-.205,y)); const w=.03+.03*ss(.0,-.17,y); return h*G(z,w)+.03*G(y+.165,.022)*G(Math.abs(z)-.042,.022); };
  const lips=(y,z)=>.028*G(y+.268,.02)*G(z,.075)+.026*G(y+.315,.02)*G(z,.062);
  const D=(y,z)=>{ const az=Math.abs(z); return -.045*G(y-.005,.065)*G(az-.15,.07)+.024*G(y-.095,.03)*G(az-.14,.1)+.025*G(y+.07,.06)*G(az-.22,.06)
      +nose(y,z)+lips(y,z)-.012*G(y+.292,.009)*G(z,.085)+.034*G(y+.43,.05)*G(z,.09)-.012*G(y+.37,.03)*G(z,.06)+.01*G(y-.2,.12)*G(z,.2)+.13*ss(-.05,-.45,y)*G(z,.17)*(1-ss(-.47,-.52,y)); };
  const frontW=(x,y)=>ss(-.02,.25,x);
  function pt(ux,uy,uz){ let y=uy*ry, z=uz*rz*wz(y), x=ux*rx; if(x<0) x*=bx(y); else x*=1-.04*ss(.15,.45,y); const fw=frontW(ux,uy); x+=D(y,z)*fw; return [x,y,z,fw]; }
  function frontX(y,z){ const uy=y/ry, uz=z/(rz*wz(y)); const ux=Math.sqrt(Math.max(0,1-uy*uy-uz*uz)); return pt(ux,uy,uz)[0]; }
  function geo(seg,ring){ const d=G0();
    for(let j=0;j<=ring;j++){ const th=j/ring*Math.PI; for(let i=0;i<=seg;i++){ const ph=i/seg*Math.PI*2; const ux=Math.sin(th)*Math.cos(ph), uy=Math.cos(th), uz=Math.sin(th)*Math.sin(ph);
      const [x,y,z,fw]=pt(ux,uy,uz); const lp=Math.min(1,lips(y,z)/.022)*fw, ch=G(y+.08,.07)*G(Math.abs(z)-.2,.06)*fw;
      gPush(d,x,y,z,ux,uy,uz,[1-.02*lp-.02*ch,1-.3*lp-.07*ch,1-.3*lp-.08*ch]); } }
    for(let j=0;j<ring;j++)for(let i=0;i<seg;i++){ const a=j*(seg+1)+i, b=a+seg+1; d.i.push(a,a+1,b,b,a+1,b+1); }
    return gNormals(d); }
  function hairGeo(seg,ring,style){ const d=G0(); const idx=[];
    const thr=(ux,uz)=>{ const f=ss(-.4,.75,ux); return style===1? -.62+.92*f : -.42+.74*f; };
    for(let j=0;j<=ring;j++){ const th=j/ring*Math.PI; idx.push([]); for(let i=0;i<=seg;i++){ const ph=i/seg*Math.PI*2; const ux=Math.sin(th)*Math.cos(ph), uy=Math.cos(th), uz=Math.sin(th)*Math.sin(ph);
      const t0=thr(ux,uz); if(uy<t0-.04){ idx[j].push(-1); continue; }
      const p=pt(ux*1.005,uy,uz); const k=ss(t0-.04,t0+.22,uy); const th2=(.012+.07*k*(.75+.25*uy))*(1+.15*Math.sin(ph*9+th*5)*k);
      const n=Math.hypot(p[0],p[1],p[2])||1; const sag=style===1?ss(.2,-.6,uy)*.03:0;
      idx[j].push(gPush(d,p[0]+p[0]/n*th2,p[1]+p[1]/n*th2*.9-sag,p[2]+p[2]/n*th2,ux,uy,uz)); } }
    for(let j=0;j<ring;j++)for(let i=0;i<seg;i++){ const a=idx[j][i],b=idx[j+1][i],c=idx[j][i+1],e=idx[j+1][i+1]; if(a<0||b<0||c<0||e<0) continue; d.i.push(a,c,b,b,c,e); }
    return gNormals(d); }
  function hoodGeo(seg,ring){ const d=G0(), idx=[];
    for(let j=0;j<=ring;j++){ const th=j/ring*Math.PI; idx.push([]); for(let i=0;i<=seg;i++){ const ph=i/seg*Math.PI*2; const ux=Math.sin(th)*Math.cos(ph), uy=Math.cos(th), uz=Math.sin(th)*Math.sin(ph);
      const face=ux>.3&&uy<.46&&uy>-.82&&Math.abs(uz)<.8; if(face&&!(uy<-.62)){ idx[j].push(-1); continue; }
      const p=pt(ux,Math.max(uy,-.7),uz); const n=Math.hypot(p[0],p[1],p[2])||1; const th2=.1+.035*ss(.2,1,uy)+.05*ss(.1,-.7,uy)*(ux<.3?1:0);
      let x=p[0]+p[0]/n*th2, y=p[1]+p[1]/n*th2, z=p[2]+p[2]/n*th2; if(ux<0&&uy>.4) { x-=.06*ss(.4,1,uy)*(-ux); y+=.05*ss(.6,1,uy); } if(uy<-.55) y-=.08*ss(-.55,-1,uy);
      idx[j].push(gPush(d,x,y,z,ux,uy,uz)); } }
    for(let j=0;j<ring;j++)for(let i=0;i<seg;i++){ const a=idx[j][i],b=idx[j+1][i],c=idx[j][i+1],e=idx[j+1][i+1]; if(a<0||b<0||c<0||e<0) continue; d.i.push(a,c,b,b,c,e); }
    return gNormals(d); }
  return {pt,frontX,geo,hairGeo,hoodGeo,rx,ry,rz,wz}; })();
/* a shaped boot: rounded heel, high ankle, instep sloping down to a rounded toe, flat sole */
function gFoot(){ const d=G0(), NX=22, NA=20;
  for(let i=0;i<=NX;i++){ const t=i/NX, x=-.105+.335*t; const end=Math.sqrt(Math.max(0,Math.sin(Math.PI*Math.min(1,t*1.04)))); const w=(.13+.03*Math.sin(Math.PI*t))*Math.max(.12,end);
    const h=(.2-.12*Math.min(1,Math.max(0,(t-.22)/.6)))*Math.max(.12,end), cy=-.1+h*.5;
    for(let a=0;a<=NA;a++){ const an=a/NA*Math.PI*2; const y=Math.max(-.1,cy+Math.sin(an)*h*.5), z=Math.cos(an)*w*.5; gPush(d,x,y,z,0,Math.sin(an),Math.cos(an)); } }
  for(let i=0;i<NX;i++)for(let a=0;a<NA;a++){ const p=i*(NA+1)+a, q=p+NA+1; d.i.push(p,p+1,q,q,p+1,q+1); }
  return gNormals(d,{cy:-.04}); }

const TORSO_PROF=[[0,.3],[.04,.4],[.12,.45],[.24,.41],[.36,.39],[.5,.43],[.64,.48],[.78,.5],[.88,.47],[.95,.37],[.99,.2],[1,.05]];
const GEO={hoodM:mkVAO(HEADK.hoodGeo(64,56)),head:mkVAO(HEADK.geo(72,64)),hair:mkVAO(HEADK.hairGeo(72,64,0)),hairL:mkVAO(HEADK.hairGeo(72,64,1)),foot:mkVAO(gFoot()),torso:mkVAO(gLoft(GFX.q==='low'?28:40,TORSO_PROF)),uarm:mkVAO(gLoft(GFX.q==='low'?18:28,[[0,.16],[.05,.4],[.22,.5],[.5,.46],[.8,.38],[.95,.34],[1,.16]],1)),farm:mkVAO(gLoft(GFX.q==='low'?18:28,[[0,.16],[.05,.42],[.22,.5],[.55,.42],[.85,.32],[.96,.3],[1,.14]],1)),thigh:mkVAO(gLoft(GFX.q==='low'?18:28,[[0,.2],[.05,.44],[.2,.5],[.55,.44],[.85,.36],[.96,.34],[1,.16]],1)),shin:mkVAO(gLoft(GFX.q==='low'?18:28,[[0,.18],[.05,.4],[.25,.5],[.5,.42],[.8,.31],[.95,.29],[1,.14]],1)),box:mkVAO(gRBox(.2)),cube:mkVAO(gBox()),sph:mkVAO(GFX.q==='low'?gSphere(28,18):gSphere(44,30)),lsph:mkVAO(gSphere(12,8)),cyl:mkVAO(gCyl(GFX.q==='low'?24:36,.5,.5)),lcyl:mkVAO(gCyl(10,.5,.5)),cone:mkVAO(gCyl(GFX.q==='low'?24:36,0,.5)),lcone:mkVAO(gCyl(10,0,.5)),limb:mkVAO(gLimb(GFX.q==='low'?20:30)),llimb:mkVAO(gLimb(8)),wing:mkVAO(gWing()),prism:mkVAO(gPrism()),frus:mkVAO(gCyl(26,.32,.5)),blob:mkVAO(gBlob(22,15,.22,5,1.6))};

/* =====================================================================
   3D WORLD
   ===================================================================== */
const HR=2, HN=MW*HR+1, HNZ=MH*HR+1, HG=new Float32Array(HN*HNZ), HLM=new Float32Array(HN*HNZ);
const WATER_Y=0, LAVA_Y=2.6;
const LAMPS=[[-6,-3],[6,-3],[-6,6],[6,6],[0,8],[-11,-2],[10,2],[1,-11],[-4,12.5],[4,12.5],[-8,-9],[8,-9],[12,-2],[-12,2],[11,8],[-16,-2],[16,2],[0,-13.5],[0,16],[-12,-13],[12,-13],[-11,12],[9,13]].map(([dx,dy])=>({x:(TOWN.x+dx)*TS+16,y:(TOWN.y+dy)*TS+16})).filter(L=>!SOLID.has(tAt(Math.floor(L.x/TS),Math.floor(L.y/TS))));
const GC={20:[30,29,31],22:[86,90,92],17:[150,190,218],18:[200,208,222],0:[96,142,62],1:[60,100,46],4:[168,142,98],5:[214,192,140],6:[78,90,52],7:[140,137,126],9:[66,55,51],11:[146,138,120],14:[120,88,55],3:[120,104,78],10:[46,26,20]};
function groundT(t,tx,ty){ if(t===T.FENCE) t=T.GRASS; else if(t>=20) return t===T.DGATE?T.RUIN:t===T.VOID?T.VOID:T.DFLOOR; const z=zmap[clamp(ty,0,MH-1)*MW+clamp(tx,0,MW-1)];
  if(t===T.TREE||t===T.ROCK||t===T.PROP) return z==='ash'?T.ASH:z==='forest'?T.FOREST:z==='swamp'?T.SWAMP:z==='town'?T.COBBLE:z==='ruins'?T.RUIN:T.GRASS;
  if(t===T.HOUSE||t===T.FOUNT||t===T.TWALL) return T.COBBLE; if(t===T.WALL) return T.RUIN; return t; }
function cellType(wx,wy){
  const tx=Math.floor(wx/TS),ty=Math.floor(wy/TS); const t=tAt(tx,ty); if(t>=20||ty>=OWH) return groundT(t,tx,ty);
  if(t===T.BRIDGE||t===T.HOUSE||t===T.WALL||t===T.FOUNT||t===T.TWALL) return groundT(t,tx,ty);
  const ox=(vnoise(wx*.035,wy*.035,77)-.5)*22, oy=(vnoise(wx*.035,wy*.035,78)-.5)*22;
  const ux=Math.floor((wx+ox)/TS),uy=Math.floor((wy+oy)/TS); const t2=tAt(ux,uy);
  if(t2===T.BRIDGE) return groundT(t,tx,ty);
  return groundT(t2,ux,uy);
}
(function buildHeights(){
  const TT=new Float32Array(MW*MH);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ const i=ty*MW+tx, t=map[i], z=zmap[i]; const n=fbm(tx*.08,ty*.08,301), n2=fbm(tx*.22,ty*.22,302);
    let h; switch(z){ case 'town':h=.55;break; case 'meadow':h=.4+n*2.6;break; case 'forest':h=.6+n*3.2+n2*.7;break; case 'swamp':h=.2+n*.35;break; case 'ruins':h=.7+n*1.7;break; case 'lake':h=.35+n*.9;break; case 'frost':h=1.2+n*3.8+n2*.9;break; case 'crypt':h=2.2;break; case 'vault':h=t===T.VOID?6.5:.3;break; case 'arena':h=t===T.VOID?7.5:t===T.DWALL?.3:.3+n*.18;break; case 'ash':h=3.1+n*1.5+n2*.6;break; default:h=.5; }
    const edge=edgeOf(tx,ty);
    if(t===T.ICE) h=.22; else if(t===T.WATER) h=-1.5; else if(t===T.LAVA) h=1.4; else if(t===T.BRIDGE) h=z==='ash'?3.0:.4;
    else if(t===T.ROCK && (edge<3||ridgeL(tx,ty))) h+=4.5+hash2(tx,ty,9)*4+(edge<2?3.5:0)+(edge<1?3:0);
    else if(t===T.COBBLE||t===T.HOUSE||t===T.FOUNT||t===T.TWALL) h=.55;
    if(Math.hypot(tx-LAIR.x,ty-LAIR.y)<6.5 && t!==T.ROCK) h=3.0;
    { const gd=Math.hypot(tx-99.5-VGO[0],ty-48-VGO[1]); if(gd<7.5) h=lerp(h,1.0,clamp((7.5-gd)/2.5,0,1)); }
    TT[i]=h; }
  const B=new Float32Array(TT); for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){ if(ty>=OWH-1) continue; let s=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) s+=TT[(ty+dy)*MW+tx+dx]*(dx||dy?1:4); B[ty*MW+tx]=s/12; }
  const LMt=new Float32Array(MW*MH); for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){ let l=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(map[(ty+dy)*MW+tx+dx]===T.LAVA) l=1; LMt[ty*MW+tx]=l; }
  const tt=(x,y)=>B[clamp(y,0,MH-1)*MW+clamp(x,0,MW-1)];
  for(let j=0;j<HNZ;j++)for(let i=0;i<HN;i++){ const X=i/HR, Z=j/HR; const fx=X-.5, fz=Z-.5; const x0=Math.floor(fx), z0=Math.floor(fz), ax=fx-x0, az=fz-z0;
    let h=lerp(lerp(tt(x0,z0),tt(x0+1,z0),ax),lerp(tt(x0,z0+1),tt(x0+1,z0+1),ax),az);
    const tx=clamp(Math.floor(X),0,MW-1), ty=clamp(Math.floor(Z),0,MH-1), t=map[ty*MW+tx], z=zmap[ty*MW+tx];
    if(i%2===1&&j%2===1){ if(t===T.WATER) h=Math.min(h,-.7); else if(t===T.LAVA) h=Math.min(h,LAVA_Y-.7); else if(z==='ash'&&t!==T.BRIDGE) h=Math.max(h,LAVA_Y+.15); else h=Math.max(h,.12); }
    if(z!=='town'&&z!=='crypt'&&z!=='vault'&&t!==T.WATER&&t!==T.BRIDGE&&t!==T.HOUSE&&t!==T.ICE) h+=(vnoise(X*.9,Z*.9,55)-.5)*.32;
    HG[j*HN+i]=h; HLM[j*HN+i]=LMt[ty*MW+tx]; }
})();
function hgt(X,Z){ X+=OFX; Z+=OFY; const fx=clamp(X*HR,0,HN-1.001), fz=clamp(Z*HR,0,HNZ-1.001); const i=Math.floor(fx), j=Math.floor(fz), a=fx-i, b=fz-j;
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
  const CH=48, chunks=[]; for(let cj=0;cj<HNZ-1;cj+=CH)for(let ci=0;ci<HN-1;ci+=CH){ const off=d.i.length;
    for(let j=cj;j<Math.min(cj+CH,HNZ-1);j++)for(let i=ci;i<Math.min(ci+CH,HN-1);i++){ const a=j*HN+i, b=a+HN; d.i.push(a,b,a+1,b,b+1,a+1); }
    chunks.push({off:off*4,n:d.i.length-off,cx:(ci+CH/2)/HR,cz:(cj+CH/2)/HR}); }
  const V=mkVAO(d); V.chunks=chunks; return V; })();
function drawTerrain(){ gl.bindVertexArray(TERRAIN.vao); const VD=(GFX.q==='low'?95:GFX.q==='ultra'?150:120)+20, R2=VD*VD;
  for(const c of TERRAIN.chunks){ const dx=c.cx-CAM.tx, dz=c.cz-CAM.tz; if(dx*dx+dz*dz<=R2) gl.drawElements(gl.TRIANGLES,c.n,gl.UNSIGNED_INT,c.off); } }
const HTEX=(function(){ const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex); const data=new Float32Array(HN*HNZ*2); for(let k=0;k<HN*HNZ;k++){ data[k*2]=HG[k]; data[k*2+1]=HLM[k]; }
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RG16F,HN,HNZ,0,gl.RG,gl.FLOAT,data); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return tex; })();
const PLANE=(function(){ const d=G0(); const S=MW+40; for(const [x,z] of [[-20,-20],[S,-20],[S,S],[-20,S]]) gPush(d,x,0,z,0,1,0); d.i.push(0,1,2,0,2,3); return mkVAO(d); })();
const LPLANE=(function(){ const d=G0(); for(const [x,z] of [[0,0],[MW,0],[MW,30],[0,30]]) gPush(d,x,0,z,0,1,0); d.i.push(0,1,2,0,2,3); return mkVAO(d); })();

/* ---------- static scenery ---------- */
const RB=gBox(), RS=gSphere(10,7), RC=gCyl(10,.5,.5), RCN=gCyl(10,0,.5), RP=gPrism(), RFR=gCyl(12,.36,.5), RBL=gSphere(8,6,.45,3);
const STAT_LIGHTS=[], CHIMNEYS=[], FOUNTAIN={x:TOWN.x+.5,z:TOWN.y+.5};
const STATIC=(function(){ const d=G0(); STATIC_D=d; const R=mulberry32(4242);
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
  // town walls
  { const cx=TOWN.x+.5, cz=TOWN.y+.5, R=TOWN.wallR, y0=.55, wst=[.6,.57,.52], wdk=[.46,.44,.4];
    const onWall=a=>{ const tx=Math.floor(cx+Math.cos(a)*R), tz=Math.floor(cz+Math.sin(a)*R); return tAt(tx,tz)===T.TWALL; };
    const N=Math.round(Math.PI*2*R/1.05); let k=0;
    for(let i=0;i<N;i++){ const a=i/N*Math.PI*2; if(!onWall(a)) continue; k++; const x=cx+Math.cos(a)*R, z=cz+Math.sin(a)*R, ry=-a-Math.PI/2, sh=.92+hash2(i,3,5)*.14;
      box(x,y0+1.45,z,1.12,2.9,1.05,wst.map(v=>v*sh),ry); box(x,y0+.25,z,1.16,.5,1.2,wdk,ry); box(x,y0+2.95,z,1.14,.14,1.2,wdk,ry);
      if(i%2===0){ const ox=cx+Math.cos(a)*(R+.38), oz=cz+Math.sin(a)*(R+.38); box(ox,y0+3.3,oz,.5,.6,.3,wst.map(v=>v*sh*.95),ry); }
      const ix=cx+Math.cos(a)*(R-.38), iz=cz+Math.sin(a)*(R-.38); if(i%2===1) box(ix,y0+3.22,iz,.5,.4,.26,wst.map(v=>v*sh*.95),ry);
      if(i%7===3){ const bx=cx+Math.cos(a)*(R+.56), bz=cz+Math.sin(a)*(R+.56); box(bx,y0+1.9,bz,.55,1.4,.04,[.62,.1,.12],ry); box(bx,y0+2.62,bz,.6,.08,.06,[.88,.7,.3],ry); box(bx,y0+1.95,bz-0,.18,.18,.05,[.95,.78,.32],ry,.4); } }
    const tower=(a,big)=>{ const x=cx+Math.cos(a)*R, z=cz+Math.sin(a)*R, r=big?1.15:.95, h=big?4.6:4.0;
      gAdd(d,RC,x,y0,z,0,r*2,h,r*2,wst); gAdd(d,RC,x,y0,z,0,r*2+.2,.5,r*2+.2,wdk); gAdd(d,RC,x,y0+h,z,0,r*2+.3,.32,r*2+.3,wdk);
      for(let q=0;q<8;q++){ const b=q/8*Math.PI*2; box(x+Math.cos(b)*(r+.05),y0+h+.55,z+Math.sin(b)*(r+.05),.42,.5,.42,wst,-b); }
      gAdd(d,RCN,x,y0+h+.3,z,0,r*2+.5,big?2.2:1.8,r*2+.5,[.5,.17,.12]); gAdd(d,RC,x,y0+h+2.1,z,0,.05,1.2,.05,[.2,.15,.1]); box(x+.32,y0+h+2.95,z,.6,.36,.03,[.7,.1,.12],0,.2);
      for(const q of [0,1]){ const b=a+Math.PI+(q?.5:-.5); box(x+Math.cos(b)*(r+.01),y0+2.2+q*.6,z+Math.sin(b)*(r+.01),.08,.4,.22,[1,.7,.35],-b,1.2); }
      STAT_LIGHTS.push({x,y:y0+2.6,z,r:5,c:[1,.62,.3],night:true}); };
    for(const g of TOWN.gates){ const w=g.b-g.a+.14; tower(g.a-.07-.04,true); tower(g.b+.07+.04,true);
      for(let q=-1;q<=1;q++){ const a=g.c+q*w/3, x=cx+Math.cos(a)*R, z=cz+Math.sin(a)*R; box(x,y0+3.75,z,w*R/3+.08,.75,1.1,wst,-a-Math.PI/2); }
      const x=cx+Math.cos(g.c)*R, z=cz+Math.sin(g.c)*R; box(x,y0+4.25,z,.9,.3,.06,[.62,.1,.12],-g.c-Math.PI/2,.2);
      for(const q of [-1,1]){ const a=g.c+q*(w/2+.02); const lx=cx+Math.cos(a)*(R+.75), lz=cz+Math.sin(a)*(R+.75); gAdd(d,RC,lx,y0,lz,0,.1,2.4,.1,[.12,.11,.1]); box(lx,y0+2.5,lz,.26,.36,.26,[1,.62,.25],0,1.4); STAT_LIGHTS.push({x:lx,y:y0+2.5,z:lz,r:7,c:[1.2,.75,.38],night:true,lamp:true}); } }
    const gapAt=a=>TOWN.gates.some(g=>{ let d=Math.abs(((a-g.c)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI); return d<(g.b-g.a)/2+.35; });
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2+Math.PI/12; if(!gapAt(a)&&onWall(a)) tower(a,false); } }
  // market square stalls and crates
  for(const [ox,oz,col] of [[-4.5,-4.6,[.2,.36,.62]],[4.8,-4.4,[.62,.5,.15]],[-4.6,7.2,[.5,.18,.5]],[9.5,-3.6,[.2,.5,.3]]]){ const mx=TOWN.x+.5+ox, mz=TOWN.y+.5+oz, y0=.55; if(SOLID.has(tAt(Math.floor(mx),Math.floor(mz)))) continue;
    for(const [px,pz] of [[-1,-.5],[1,-.5],[-1,.5],[1,.5]]) box(mx+px,y0+1.1,mz+pz,.1,2.2,.1,wood);
    for(let k=0;k<5;k++) box(mx-.8+k*.4,y0+2.25,mz,.4,.07,1.25,k%2?[.88,.85,.76]:col);
    box(mx,y0+.5,mz,2.1,.1,.9,wood); box(mx,y0+.25,mz,2,.5,.8,[.4,.27,.15]); for(let k=0;k<4;k++) gAdd(d,RS,mx-.6+k*.4,y0+.65,mz,0,.2,.2,.2,[[.9,.3,.2],[.95,.75,.2],[.45,.75,.3],[.8,.5,.8]][k]); }
  for(const [ox,oz] of [[-8,-8.5],[8.5,-9.5],[-10,9.5],[9.5,10],[12,2.5],[-12.5,-2]]){ const x=TOWN.x+.5+ox, z=TOWN.y+.5+oz, y0=.55; if(SOLID.has(tAt(Math.floor(x),Math.floor(z)))) continue;
    box(x,y0+.3,z,.6,.6,.6,[.5,.36,.2],R()); box(x+.55,y0+.3,z+.2,.55,.55,.55,[.46,.33,.18],R()); gAdd(d,RFR,x-.4,y0,z+.55,0,.5,.75,.5,[.42,.28,.15]); }
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
  addLandmarks(d); addVault(d); addArena(d); addWilds(d); addWilds2(d);
  const V=mkVAO(d); V.chunks=[...SCH.values()].filter(c=>c.d.i.length).map(c=>{ const v=mkVAO(c.d); v.cx=c.cx; v.cz=c.cz; return v; }); SCH.clear(); STATIC_D=null; return V; })();
function drawStaticChunks(){ const VD=(GFX.q==='low'?90:GFX.q==='ultra'?140:112)+23, R2=VD*VD; for(const c of STATIC.chunks){ const dx=c.cx-CAM.tx, dz=c.cz-CAM.tz; if(dx*dx+dz*dz>R2) continue; gl.bindVertexArray(c.vao); gl.drawElements(gl.TRIANGLES,c.n,gl.UNSIGNED_INT,0); } }

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
    else if(t===T.ROCK){ const edge=edgeOf(tx,ty), ridge=ridgeL(tx,ty); if((edge<3||ridge)&&R()>.28) continue; const x=tx+.5, zz=ty+.5, y=hgt(x,zz);
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
const METALS=new WeakSet(), SKINSET=new WeakSet(), CLOTHS=new WeakSet(), LEATHERS=new WeakSet(), HAIRS=new WeakSet(); let MATD=0;
let HALPHA=1;
function P(geo,sx,sy,sz,col,emis,ox,oy,oz,alpha){ const mxs=Math.max(Math.abs(sx),Math.abs(sy),Math.abs(sz)); if(LOD_MID&&mxs<.075) return; if(LOD_FAR){ if(mxs<.16) return; geo=geo===GEO.head||geo===GEO.hair||geo===GEO.hairL||geo===GEO.hoodM?GEO.lsph:geo===GEO.torso?GEO.torso:geo===GEO.box?GEO.cube:geo===GEO.sph?GEO.lsph:geo===GEO.limb?GEO.llimb:geo===GEO.cyl?GEO.lcyl:geo===GEO.cone?GEO.lcone:geo; } else if(GFX.q==='low'){ if(Math.abs(sx)<.05&&Math.abs(sy)<.05&&Math.abs(sz)<.05) return; geo=geo===GEO.sph?GEO.lsph:geo===GEO.limb?GEO.llimb:geo; } const m=CUR.slice(); if(ox||oy||oz) for(let i=0;i<4;i++) m[12+i]+=m[i]*(ox||0)+m[4+i]*(oy||0)+m[8+i]*(oz||0);
  for(let i=0;i<4;i++){ m[i]*=sx; m[4+i]*=sy; m[8+i]*=sz; }
  const c={g:geo,m,c:col,e:emis||0,inv:[1/(sx*sx),1/(sy*sy),1/(sz*sz)],a:(alpha??1)*HALPHA,sh:CAST_SH&&mxs>.06&&HALPHA>.9,sp:METALS.has(col)?.95:SKINSET.has(col)?.26:.12,mt:METALS.has(col)?3:SKINSET.has(col)?4:HAIRS.has(col)?5:LEATHERS.has(col)?2:CLOTHS.has(col)?1:((emis||0)>.3?0:MATD)}; (c.a<1?tcmds:cmds).push(c); }
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
const HAIR=[[.18,.12,.08],[.45,.28,.14],[.75,.55,.25],[.1,.08,.07],[.6,.25,.1],[.85,.82,.78]]; HAIR.forEach(h=>HAIRS.add(h));
for(let i=0;i<4;i++) LOOK['guard'+i]={torso:[.62,.64,.7],legs:[.3,.3,.34],arms:[.6,.62,.68],boots:[.22,.18,.15],cape:[.55,.1,.12],trim:[.86,.7,.32],tabard:[.6,.1,.12],head:'helm',metal:[.68,.7,.76],pauld:[.66,.68,.74],weapon:'spear',off:'shield'};
Object.assign(LOOK,{
  hakon:{torso:[.42,.32,.24],legs:[.3,.24,.2],arms:[.45,.36,.28],boots:[.55,.5,.45],cape:[.85,.84,.8],trim:[.7,.6,.4],head:'horned',metal:[.62,.64,.68],pauld:[.82,.8,.76],fur:true,weapon:'axe',beard:[.75,.5,.25]},
  yeti:{scale:1.9,torso:[.86,.89,.93],legs:[.8,.84,.9],arms:[.86,.89,.93],boots:[.55,.6,.7],skin:[.45,.6,.8],head:'yeti',hunch:.35,longArms:true,fur:true},
  frostgiant:{scale:2.7,torso:[.5,.62,.76],legs:[.45,.36,.28],arms:[.52,.64,.78],boots:[.4,.32,.25],skin:[.52,.66,.82],head:'giant',cape:[.5,.42,.34],pauld:[.82,.84,.8],fur:true,weapon:'club',trim:[.4,.32,.25],eyes:[.5,.9,1]},
  cryptmage:{robe:[.1,.08,.14],torso:[.1,.08,.14],arms:[.12,.1,.16],legs:[.1,.08,.12],boots:[.08,.06,.08],head:'skullhood',hood:[.07,.06,.1],skin:[.88,.85,.75],trim:[.5,.35,.7],weapon:'skullstaff',eyes:[.5,1,.4]},
  thrall:{skel:true,bone:[.7,.66,.58],head:'skull',eyes:[.5,1,.4],weapon:'rustsword'},
  deathguard:{skel:true,bone:[.74,.71,.64],head:'skullhelm',eyes:[.6,1,.4],weapon:'greatsword',off:'rustshield',metal:[.34,.34,.38],pauld:[.34,.34,.38],cape:[.12,.12,.15],scale:1.3},
});
function emitTip(col,x,y,z){ const m=CUR; const X=m[0]*x+m[4]*y+m[8]*z+m[12], Y=m[1]*x+m[5]*y+m[9]*z+m[13], Z=m[2]*x+m[6]*y+m[10]*z+m[14]; P3(X,Y,Z,0,0,0,.28,.1,col,{glow:true,drag:.9}); }
function drawHumanoid(o){ const md=MATD; MATD=(o.L.bone||o.L.rock)?0:1; try{ return drawHumanoid0(o); } finally{ MATD=md; } }
function drawHumanoid0(o){
  const L=o.L, t=now(), sc=(L.scale||1)*(o.sc||1)*(o.big||1); const mv=o.mv||0, ph=o.walk||0;
  const AN=o.an||null, bank=o.ride?0:((AN&&AN.bankS)||0), heavy=sc>1.35?1:0, nr=o.ride?0:1;
  const rdy=(o.rdy&&!o.ride&&!o.swim&&!o.cast&&!o.emote&&mv<.5)?1-mv*2:0, stl=(o.stl&&!o.ride&&!o.swim)?1:0, cr=Math.max(rdy,stl), SWG=o.swing??-1;
  const twist=SWG>=0?(SWG<.3?-.3*SWG/.3:(-.3+.7*Math.min(1,(SWG-.3)/.35))*(1-Math.max(0,(SWG-.65)/.35))):0;
  const skin=L.skin||o.skin||SKIN[0]; const bone=L.bone; if(L.metal) METALS.add(L.metal); if(L.pauld) METALS.add(L.pauld); if(L.trim) METALS.add(L.trim); for(const k of ['torso','legs','robe','cape','hood','tabard','hat','arms','crest']) if(L[k]&&!METALS.has(L[k])) CLOTHS.add(L[k]); for(const k of ['boots','gloves','strapC','mask']) if(L[k]&&!METALS.has(L[k])) LEATHERS.add(L[k]); if(L.hair) HAIRS.add(L.hair); if(o.hair) HAIRS.add(o.hair); if(L.skin&&!L.rock) SKINSET.add(L.skin); const hitE=o.hit?.9:0;
  const EM=o.emote&&o.emote.k, sitting=EM==='sit', kneel=EM==='kneel';
  const emL=sitting?-.5:kneel?-.4:EM==='dance'?Math.abs(Math.sin(t*6))*.1:EM==='cheer'?Math.abs(Math.sin(t*5))*.22:0;
  mreset(); const bob=Math.abs(Math.cos(ph))*(.07-.02*heavy)*mv+Math.sin(t*2.1+o.x)*.008-cr*.08-stl*.05+Math.abs(Math.sin(t*3.2+o.x))*.014*rdy-STKb(o)*.05;
  mtr(o.x,o.y+(o.lift||0)+emL+bob*sc,o.z); mry(-o.face-(EM==='dance'?Math.sin(t*2.5)*.9:0)); msc(sc);
  if(o.pitch){ mtr(0,.58,0); mrz(o.pitch); mtr(0,-.58,0); }
  const STK=SWG>=0&&nr?Math.sin(Math.PI*clamp((SWG-.25)/.55,0,1)):0; if(STK) mtr(STK*.1,0,0);
  if(nr&&o.dead<0){ const wd=heavy?.45:1; mtr(0,0,-Math.cos(ph)*.035*mv*wd); mrx((bank-Math.cos(ph)*.022*mv)*wd); }
  if(o.dead>=0){ const k=Math.min(1,o.dead/.6); mrz(-k*1.45); mtr(0,k*.12,0); }
  const legA=Math.sin(ph)*(stl?.55:.8)*mv, armA=Math.sin(ph)*(stl?.3:.68)*mv;
  const limbW=bone?.075:(L.rock?.2:.15), legCol=bone||L.legs, armCol=bone||L.arms, boots=L.boots||legCol;
  for(const s of [-1,1]){ mpush(); mtr(0,.93,0); if(nr){ mry(Math.sin(ph)*.09*mv); mrx(Math.cos(ph)*.05*mv); } mtr(0,0,s*.115); let a=(s>0?legA:-legA)+cr*(s>0?.38:.12)+STK*(s>0?.34:-.22); if(o.ride){ mrx(-s*.5); a=1.2; } else if(o.air) a=s>0?.85:.2; else if(sitting) a=1.5; else if(kneel) a=s>0?1.4:-.1; else if(o.swim) a=mv>.3?Math.sin(t*12+(s>0?0:Math.PI))*.32:Math.sin(t*5+s*2)*.45; mrz(a);
    if(bone) P(GEO.limb,limbW*1.12,.45,limbW*1.15,legCol,hitE); else P(GEO.thigh,limbW*(L.lean?1.3:1.5),.47,limbW*(L.lean?1.3:1.48),legCol,hitE); mtr(0,-.45,0); P(GEO.sph,limbW*1.08,limbW*1.08,limbW*1.08,bone||(L.metal&&!bone?L.metal:legCol),hitE);
    if(L.metal&&!bone) P(GEO.sph,.17,.15,.17,L.metal,hitE,.03,0,0);
    let knee=Math.max(0,Math.cos(ph+(s>0?0:Math.PI)))*1.1*mv+(L.hunch||0)*.25+cr*.55; if(o.ride) knee=1.5; else if(o.air) knee=s>0?1.25:.75; else if(sitting) knee=.1; else if(kneel) knee=s>0?1.5:1.6; mrz(-knee);
    if(bone) P(GEO.limb,limbW*.92,.42,limbW*.92,legCol,hitE); if(!bone){ P(GEO.shin,limbW*1.25,.44,limbW*1.2,boots,hitE,-.01,0,0); P(GEO.frus,limbW*1.7,.1,limbW*1.7,L.fur?[.85,.84,.8]:boots.map(v=>v*1.15),hitE,0,-.08,0); }
    mtr(0,-.43,0); mrz(knee-a*.6);
    if(bone){ P(GEO.box,.26,.06,.12,boots,hitE,.06,-.05,0); for(let k=-1;k<=1;k++) P(GEO.sph,.08,.04,.035,boots,hitE,.18,-.06,k*.035); }
    else { P(GEO.foot,1,1,1.05,boots,hitE,0,.012,0); P(GEO.box,.34,.028,.15,boots.map(v=>v*.45),hitE,.06,-.088,0); P(GEO.box,.07,.04,.14,boots.map(v=>v*.45),hitE,-.07,-.075,0); } mpop(); }
  if(AN&&mv>.55&&nr&&!o.swim&&o.dead<0){ const sg=Math.cos(ph)>0; if(AN===me&&AN._ff!==undefined&&AN._ff!==sg) try{ footSnd(); }catch(e){}
    if(AN._ff!==undefined&&AN._ff!==sg&&GFX.q!=='low'){ const fx=Math.cos(o.face), fz=Math.sin(o.face);
      for(let k=0;k<(heavy?7:2);k++) P3(o.x-fx*.1+(Math.random()-.5)*.3*sc,o.y+.05,o.z-fz*.1+(Math.random()-.5)*.3*sc,(Math.random()-.5)*.6-fx*.3,.25+Math.random()*.3,(Math.random()-.5)*.6-fz*.3,heavy?1.1:.55,heavy?.5:.15,heavy?'#9a9488':'#b0a284',{big:heavy,drag:.92});
      if(heavy&&me&&Math.hypot(o.x*TS-me.x,o.z*TS-me.y)<260) shake(1.4); } AN._ff=sg; }
  if(L.robe){ mpush(); mtr(0,.96,0); mrz(Math.sin(ph)*.05*mv); P(GEO.frus,.62,.92,.7,L.robe,hitE,0,-.92,0);
    for(let k=0;k<12;k++){ const a=k/12*6.283+.26; mpush(); mtr(Math.cos(a)*.155,-.02,Math.sin(a)*.17); mry(-a); mrz(.16+Math.sin(ph+k)*.04*mv); P(GEO.limb,.075,.8,.065,L.robe.map(v=>v*(k%2?.86:1.04)),hitE); mpop(); } P(GEO.cyl,.64,.07,.68,L.trim||L.robe,hitE,0,-.9,0); P(GEO.cyl,.645,.025,.685,L.trim||L.robe,hitE+.1,0,-.78,0);
    if(L.det==='a') for(let k=0;k<4;k++) P(GEO.box,.02,.06,.06,L.gem||[.82,.62,1],2.2+Math.sin(t*3+k)*.6,.25+k*.02,-.15-k*.18,0);
    if(L.det==='m'){ P(GEO.box,.03,.8,.16,L.trim,hitE+.08,.27,-.45,0); P(GEO.sph,.02,.1,.1,[1,.86,.4],1.2,.29,-.3,0); }
    P(GEO.box,.04,.82,.12,L.trim||L.robe,hitE,.3,-.45,0); mpop(); }
  mpush(); mtr(0,.94+Math.sin(t*1.9+o.x)*.008*(1-mv),0); mry((-Math.sin(ph)*.17*mv)*nr+twist); mrz(-.15*mv-cr*.14-stl*.16-(SWG>=0?Math.sin(SWG*Math.PI)*.12:0)+Math.sin(t*1.9+o.x)*.012*(1-mv)-(L.hunch||0)-(EM==='bow'?.8:0)-(o.ride?.12+(o.rmv||0)*.16:0)-(o.swim?.25:0)+(o.cast?.07:0)-STK*.06);
  if(bone){ P(GEO.sph,.2,.14,.34,bone,hitE,0,.0,0); for(const s of [-1,1]) P(GEO.sph,.08,.08,.08,bone,hitE,0,-.04,s*.13); for(let k=0;k<8;k++) P(GEO.sph,.075,.06,.075,bone,hitE,-.05,.08+k*.075,0); for(const s of [-1,1]){ mpush(); mtr(.06,.62,s*.12); mrx(s*1.35); P(GEO.limb,.035,.15,.035,bone,hitE); mpop(); }
    for(let k=0;k<5;k++){ const w=.42-Math.abs(k-1.5)*.05; P(GEO.box,.05,.035,w,bone,hitE,.1,.2+k*.075,0); P(GEO.box,.22,.035,.035,bone,hitE,0,.2+k*.075,w/2-.02); P(GEO.box,.22,.035,.035,bone,hitE,0,.2+k*.075,-w/2+.02); }
    P(GEO.box,.06,.3,.06,bone,hitE,.13,.3,0); if(L.metal){ P(GEO.sph,.34,.36,.5,L.metal,hitE,.02,.44,0); P(GEO.box,.04,.3,.05,L.metal.map(v=>v*1.2),hitE+.1,.19,.44,0); } }
  else { const tor=L.torso; P(GEO.sph,.32,.24,.48,L.legs||tor,hitE,0,.03,0); P(GEO.torso,L.lean?.33:.36,.76,L.robe?.5:L.lean?.5:.55,tor,hitE,0,-.06,0);
    if(!L.robe) for(const s of [-1,1]) P(GEO.sph,L.lean?.17:.2,L.lean?.15:.17,L.lean?.2:.23,tor,hitE,L.lean?.07:.08,.5,s*.1); P(GEO.sph,.27,.17,L.robe?.52:.58,tor,hitE,-.03,.6,0); P(GEO.cyl,.2,.07,.22,tor.map(v=>v*.9),hitE,0,.62,0);
    if(L.metal){ const mt=L.metal; P(GEO.torso,.41,.68,.6,mt,hitE,.012,.05,0); P(GEO.box,.025,.36,.02,mt.map(v=>v*1.12),hitE+.05,.2,.42,0); for(let k=0;k<3;k++) P(GEO.sph,.3-k*.01,.06,.4-k*.01,mt.map(v=>v*.88),hitE,.035,.08+k*.075,0);
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
  mpush(); mtr(0,.72,0); if(!L.rock&&L.head!=='yeti'&&L.head!=='giant') msc(.92); mrz(L.hunch?L.hunch*.8:0); mry((Math.sin(ph)*.13*mv)*nr-twist*.6-(o.look||0)*.7); mrz(.08*mv+cr*.12+stl*.06); if(o.dead<0) mry(Math.sin(t*.6+o.x*1.7)*.16*(1-mv)); mrz(Math.sin(t*1.8+o.x)*.015); if(!bone&&L.head!=='rock') P(GEO.cyl,.11,.1,.11,skin,hitE,0,0,0);
  const eyeC=L.eyes, eyeE=eyeC?2.4:0;
  const face=(fx)=>{ const iris=o.eyeCol||[.28,.45,.62], lip=skin.map((v,i)=>v*[.8,.55,.52][i]), brow=o.hair||[.2,.13,.08], shade=skin.map(v=>v*.88);
    P(GEO.sph,.235,.2,.22,skin,hitE,.012,.085,0);
    for(const s of [-1,1]){
      P(GEO.sph,.05,.042,.046,[.97,.96,.93],0,.108,.172,s*.05); P(GEO.sph,.026,.03,.028,eyeC||iris,eyeE,.126,.172,s*.05);
      if(!eyeC){ P(GEO.sph,.013,.016,.014,[.02,.02,.02],0,.134,.172,s*.05); P(GEO.sph,.006,.006,.006,[1,1,1],1.2,.138,.178,s*.045); }
      P(GEO.sph,.056,.02,.052,skin,hitE,.112,.192,s*.05);
      mpush(); mtr(.113,.212,s*.052); mrx(s*.12); P(GEO.box,.026,.016,.064,brow,0); mpop();
      P(GEO.sph,.04,.07,.026,skin,hitE,-.005,.15,s*.128); P(GEO.sph,.02,.04,.012,shade,hitE,0,.15,s*.137); }
    P(GEO.box,.03,.07,.032,skin,hitE,.128,.14,0); P(GEO.sph,.044,.038,.046,skin,hitE,.14,.11,0);
    P(GEO.box,.014,.012,.058,lip,hitE,.126,.072,0); P(GEO.sph,.02,.014,.044,lip.map(v=>v*1.1),hitE,.124,.06,0); };
  const face2=()=>{ const k=.3, F=HEADK.frontX, iris=o.eyeCol||[.28,.45,.62], brow=o.hair||[.2,.13,.08], shade=skin.map(v=>v*.82);
    for(const s of [-1,1]){ const ez=s*.15*k, ex=(F(0,.15)-.02)*k;
      P(GEO.sph,.033,.033,.033,[.96,.95,.92],0,ex,.15,ez);
      P(GEO.sph,.006,.017,.017,eyeC||iris,eyeE,ex+.0158,.15,ez);
      if(!eyeC){ P(GEO.sph,.005,.008,.008,[.02,.02,.02],0,ex+.0172,.15,ez); P(GEO.sph,.004,.004,.004,[1,1,1],1.4,ex+.0178,.1535,ez-s*.0035); }
      P(GEO.sph,.036,.021,.037,skin,hitE,ex+.0012,.1572,ez); P(GEO.sph,.034,.012,.035,skin,hitE,ex+.0006,.1425,ez);
      P(GEO.sph,.006,.004,.032,brow.map(v=>v*.5),0,ex+.0168,.1478,ez);
      mpush(); mtr((F(.1,.14)+.008)*k,.15+.1*k,s*.14*k); mrx(s*.1); mrz(-.15); P(GEO.box,.012,.011,.058,brow,0); mpop();
      P(GEO.sph,.05,.075,.022,skin,hitE,-.012,.14,s*.112); P(GEO.sph,.03,.048,.01,shade,hitE,-.008,.14,s*.122); } };
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
  else { if(L.head==='helm') P(GEO.sph,.27,.3,.26,skin,hitE,0,.15,0); else { P(GEO.head,.3,.3,.3,skin,hitE,0,.15,0); face2(); }
    if(!L.head) P(GEO.hair,.3,.3,.3,o.hair||HAIR[(o.x*7|0)%HAIR.length]||HAIR[0],hitE,0,.15,0);
    switch(L.head){
      case 'rogue': { const hd=L.hood; P(GEO.sph,.33,.35,.32,hd,hitE,-.05,.18,0); P(GEO.sph,.3,.3,.36,hd.map(v=>v*.8),hitE,-.02,.16,0); mpush(); mtr(-.2,.22,0); mrz(1.9); P(GEO.cone,.16,.22,.14,hd,hitE); mpop();
        P(GEO.sph,.25,.15,.265,L.mask,hitE,.024,.082,0); P(GEO.sph,.05,.05,.052,L.mask,hitE,.142,.112,0); P(GEO.sph,.31,.14,.44,hd,hitE,-.04,-.05,0);
        for(const s of [-1,1]) P(GEO.sph,.016,.016,.016,[.3,1,.6],1.6,.142,.18,s*.056); break; }
      case 'circlet': { const hc=o.hair||[.85,.75,.5]; P(GEO.hairL,.3,.3,.3,hc,hitE,0,.15,0); P(GEO.sph,.17,.4,.22,hc,hitE,-.115,.0,0); for(const s of [-1,1]) P(GEO.sph,.09,.36,.07,hc,hitE,-.01,.02,s*.14);
        for(let k=0;k<15;k++){ const a=(k/14-.5)*3.6; P(GEO.sph,.045,.04,.045,L.trim,hitE+.5,Math.cos(a)*.145,.25,Math.sin(a)*.145); }
        P(GEO.sph,.035,.05,.026,[.55,.85,1],2.6,.15,.26,0); mpush(); mtr(.145,.27,0); P(GEO.cone,.025,.09,.025,L.trim,.8); mpop();
        if(L.halo){ mpush(); mtr(-.22,.3,0); mry(Math.PI/2); for(let k=0;k<36;k++){ const a=k/36*6.283; P(GEO.sph,.08,.08,.06,[1,.88,.5],3,Math.cos(a)*.4,Math.sin(a)*.4,0); } for(let k=0;k<12;k++){ const a=k/12*6.283-t*.25; mpush(); mtr(Math.cos(a)*.52,Math.sin(a)*.52,0); mrz(a-Math.PI/2); P(GEO.cone,.05,.16,.02,[1,.95,.75],2.4); mpop(); } mpop(); } break; }
      case 'helm': { const hm=L.metal; P(GEO.sph,.34,.36,.33,hm,hitE,-.01,.17,0); P(GEO.box,.12,.3,.27,hm,hitE,.095,.12,0); P(GEO.box,.03,.3,.035,L.trim||hm,hitE+.1,.155,.14,0); P(GEO.box,.025,.028,.22,[.03,.03,.04],0,.158,.2,0); for(let k=0;k<3;k++) for(const q of [-1,1]) P(GEO.sph,.012,.012,.012,[.03,.03,.04],0,.157,.08-k*.035,q*.06); P(GEO.cyl,.345,.035,.335,L.trim,hitE+.1,-.01,.27,0); P(GEO.cyl,.28,.06,.3,hm.map(v=>v*.9),hitE,-.01,-.04,0); P(GEO.cone,.06,.14,.06,L.trim,.2,0,.34,0); }
        for(const s of [-1,1]) for(let k=0;k<3;k++) P(GEO.sph,.025,.025,.025,L.trim,hitE+.2,-.05+k*.08,.21,s*.165); P(GEO.box,.012,.01,.2,L.crest?[.4,.7,1]:[.03,.03,.04],L.crest?1.6:0,.165,.2,0);
        if(L.crest) for(let k=0;k<6;k++) P(GEO.box,.07,.09+Math.sin(k*.6)*.05,.05,L.crest,hitE+.15,-.17+k*.065,.38-Math.abs(k-2.5)*.02,0); break;
      case 'plume': P(GEO.sph,.31,.31,.3,L.metal,hitE,-.01,.18,0); P(GEO.box,.04,.05,.26,[.08,.08,.1],0,.14,.17,0); P(GEO.sph,.14,.3,.06,[.75,.1,.1],hitE,-.08,.42,0); break;
      case 'horned': P(GEO.sph,.31,.28,.3,L.metal,hitE,-.01,.2,0); P(GEO.box,.05,.16,.04,L.metal,hitE,.15,.12,0); for(const s of [-1,1]){ mpush(); mtr(-.02,.25,s*.15); mrx(-s*1.0); mrz(.3); P(GEO.cone,.08,.32,.08,[.92,.88,.78],hitE); mpop(); }
        P(GEO.sph,.18,.22,.22,L.beard||[.6,.4,.2],hitE,.1,.0,0); break;
      case 'hood': { const hc=L.hood; P(GEO.hoodM,.3,.3,.3,hc,hitE,0,.15,0); P(GEO.sph,.36,.14,.44,hc.map(v=>v*.96),hitE,-.05,-.03,0);
        if(L.trim){ for(let k=0;k<18;k++){ const a=k/18*6.283; P(GEO.sph,.024,.024,.024,L.trim,hitE+.35,.15-.02*Math.abs(Math.cos(a)),.14+.09*Math.sin(a),.1*Math.cos(a)); } }
        if(L.halo){ P(GEO.sph,.034,.05,.024,[.55,.85,1],2.6,.17,.27,0); mpush(); mtr(-.24,.32,0); mry(Math.PI/2); for(let k=0;k<36;k++){ const a=k/36*6.283; P(GEO.sph,.08,.08,.06,[1,.88,.5],3,Math.cos(a)*.4,Math.sin(a)*.4,0); }
          for(let k=0;k<12;k++){ const a=k/12*6.283-t*.25; mpush(); mtr(Math.cos(a)*.52,Math.sin(a)*.52,0); mrz(a-Math.PI/2); P(GEO.cone,.05,.16,.02,[1,.95,.75],2.4); mpop(); } mpop(); } break; }
        if(L.det==='m'){ for(let k=0;k<9;k++){ const a=k/8*Math.PI; P(GEO.sph,.045,.045,.045,L.trim,hitE+.15,.13,.13+Math.sin(a)*.17,Math.cos(a)*.15); } P(GEO.sph,.045,.045,.03,[1,.9,.5],2.4,.15,.29,0); } break;
      case 'skullhood': P(GEO.sph,.34,.35,.33,L.hood,hitE,-.04,.17,0); P(GEO.sph,.2,.24,.22,L.skin,hitE,.06,.13,0); for(const s of [-1,1]){ P(GEO.sph,.05,.05,.04,[0,0,0],0,.15,.16,s*.05); P(GEO.sph,.025,.025,.025,eyeC,3,.17,.16,s*.05); } P(GEO.cone,.2,.24,.2,L.hood,hitE,-.12,.32,0); break;
      case 'drowned': { const hc=L.hair, gold=L.trim; HAIRS.add(hc);
        P(GEO.hairL,.3,.3,.3,hc,hitE,0,.15,0); for(let k=0;k<7;k++){ const a=(k/6-.5)*2.2; mpush(); mtr(-.06-Math.cos(a)*.08,.12,Math.sin(a)*.14); mrz(-.15+Math.sin(t*1.2+k)*.05); P(GEO.limb,.05,.5,.04,hc.map(v=>v*(k%2?.85:1.1)),hitE); mpop(); }
        P(GEO.cyl,.31,.07,.31,gold,hitE+.4,-.01,.27,0); for(let k=0;k<9;k++){ const a=k/9*6.283, f=Math.cos(a), hh=.12+(f>.7?.12:0)+(k%2)*.05; mpush(); mtr(Math.cos(a)*.145-.01,.3,Math.sin(a)*.145); mrz(-f*.12); P(GEO.cone,.05,hh,.05,gold,hitE+.5); mpop(); }
        P(GEO.sph,.055,.07,.04,[.3,1,.85],2.8,.15,.31,0); for(const q of [-1,1]) P(GEO.sph,.03,.03,.03,[.25,.9,.75],2.2,.12,.3,q*.09);
        for(const [bx,by,bz] of [[-.1,.3,.11],[.02,.31,-.13],[-.13,.28,-.06]]) P(GEO.sph,.035,.03,.035,[.62,.66,.58],hitE,bx,by,bz);
        P(GEO.sph,.13,.07,.13,skin.map(v=>v*.92),hitE,.08,.05,0);
        for(let k=0;k<6;k++){ const z=(k/5-.5)*.14; mpush(); mtr(.11-Math.abs(z)*.3,.04,z); mrz(.1+Math.sin(t*1.6+k*1.3)*.08); mrx(z*.8); P(GEO.limb,.026,.26+(k%3)*.06,.02,[.14,.34,.22].map(v=>v*(k%2?.8:1.1)),hitE+.1); mpop(); }
        if(Math.random()<.12) burst3(o.x,o.y+1.45*sc,o.z,'#6affe0',1,.15,{glow:true}); break; }
      case 'hoodopen': P(GEO.sph,.33,.33,.31,L.hood,hitE,-.06,.18,0); break;
      case 'hat': P(GEO.hair,.3,.3,.3,o.hair||[.2,.13,.08],hitE,0,.15,0); P(GEO.cyl,.64,.03,.64,L.hat,hitE,0,.25,0); mpush(); mtr(0,.26,0); mrz(-.25+Math.sin(t*1.5)*.04); P(GEO.cone,.32,.32,.32,L.hat,hitE,0,0,0); mtr(0,.3,0); mrz(-.5); P(GEO.cone,.16,.3,.16,L.hat,hitE,0,0,0); P(GEO.sph,.05,.05,.05,[1,.9,.5],2,0,.3,0); mpop(); P(GEO.cyl,.34,.05,.34,L.trim,hitE+.1,0,.26,0); { const bc=[.86,.86,.84]; HAIRS.add(bc); P(GEO.sph,.18,.14,.2,bc,hitE,.1,.05,0); mpush(); mtr(.11,.0,0); mrz(Math.PI+.25+Math.sin(t*1.3)*.04); P(GEO.cone,.15,.26,.15,bc,hitE); mpop(); for(const q of [-1,1]) P(GEO.sph,.1,.04,.07,bc,hitE,.142,.075,q*.035); } if(L.det==='a'){ P(GEO.sph,.06,.06,.04,L.gem||[.8,.55,1],2.6,.17,.27,0); for(let k=0;k<5;k++){ const a=k/5*6.283+.3; P(GEO.sph,.025,.025,.025,[1,.95,.7],2.2,Math.cos(a)*.28,.27,Math.sin(a)*.28); } } break;
      case 'witch': P(GEO.sph,.3,.2,.3,[.15,.15,.15],hitE,-.03,.25,0); P(GEO.cyl,.6,.03,.6,L.hat,hitE,0,.28,0); mpush(); mtr(0,.29,0); mrz(-.5); P(GEO.cone,.3,.6,.3,L.hat,hitE,0,0,0); mpop(); P(GEO.sph,.05,.09,.05,skin,hitE,.17,.08,0); break;
      case 'leafy': for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; P(GEO.blob,.26,.22,.26,L.leaf,hitE,Math.cos(a)*.12-.03,.3+Math.sin(k)*.05,Math.sin(a)*.13); } P(GEO.blob,.32,.28,.32,BRIGHT(L.leaf),hitE,0,.42,0); break;
      case 'bald': P(GEO.sph,.2,.22,.24,[.4,.24,.12],hitE,.1,.02,0); P(GEO.box,.08,.05,.14,[.4,.24,.12],hitE,.12,.1,0); break;
      case 'hair': P(GEO.hair,.3,.3,.3,L.hair,hitE,0,.15,0); break;
      case 'bardcap': { HAIRS.add(L.hair||o.hair||[.3,.18,.1]); P(GEO.hair,.3,.3,.3,L.hair||o.hair||[.3,.18,.1],hitE,0,.15,0);
        mpush(); mtr(-.01,.27,0); mrx(-.18); P(GEO.sph,.3,.15,.3,L.hat,hitE,0,.03,0); P(GEO.cyl,.4,.022,.36,L.hat.map(v=>v*.8),hitE,.02,-.02,0); P(GEO.cyl,.31,.03,.31,L.trim,hitE+.3,0,.01,0);
          mpush(); mtr(-.06,.08,-.2); mrx(-.9); mrz(.55+Math.sin(t*2.1)*.06); P(GEO.sph,.05,.34,.09,L.feather||[1,.86,.42],hitE+.25,0,.26,0); P(GEO.box,.008,.5,.008,[.95,.92,.85],hitE,0,.22,0); P(GEO.sph,.045,.12,.08,[.95,.35,.15],hitE+.3,0,.5,0); mpop();
          P(GEO.sph,.035,.035,.035,L.trim,hitE+.6,.05,.06,-.27); mpop(); break; }
      case 'cap': P(GEO.cyl,.44,.03,.44,L.hat,hitE,0,.27,0); P(GEO.sph,.3,.22,.3,L.hat,hitE,0,.27,0); break;
      default: if(o.hair){ P(GEO.sph,.29,.22,.29,o.hair,hitE,-.03,.22,0); P(GEO.sph,.2,.26,.26,o.hair,hitE,-.1,.12,0); }
    } }
  mpop();
  // arms
  const sw=o.swing??-1;
  for(const s of [-1,1]){ mpush(); mtr(0,.62,s*.3);
    let a=(s>0?-armA:armA)+Math.sin(t*1.3+o.x+s)*.035*(1-mv), spread=.12+.05*mv, elbow=.25+(L.hunch||0)*.5+mv*(.4+Math.max(0,s>0?-armA:armA)*.6);
    if(o.cast){ const ch=Math.sin(t*4.5+s*1.3); if(s>0&&WUP.has(L.weapon)){ a=.75+ch*.04; elbow=1.05; spread=.2; } else { a=1.05+ch*.08; spread=-.16+ch*.06; elbow=.78+Math.sin(t*3.1+s)*.12; } }
    else if(!(s>0&&sw>=0)){ if(o.ride){a=.6;elbow=.9;spread=.05;} else if(o.swim){ if(mv>.3){ const q=t*5.4+(s>0?0:Math.PI); a=1.55+Math.sin(q)*1.45; spread=.2+Math.max(0,Math.cos(q))*.22; elbow=.18+Math.max(0,-Math.sin(q))*.75; } else { a=1.3+Math.sin(t*4+s)*.6; spread=.7; elbow=.3; } } else if(EM==='dance'){ a=(s>0?2.6:1.2)+Math.sin(t*6+s)*.5; spread=.5; } else if(EM==='wave'&&s>0){ a=2.9; spread=.55+Math.sin(t*9)*.25; elbow=.5; } else if(EM==='cheer'){ a=3.0; spread=.35; elbow=.1; } else if(sitting){ a=.35; spread=.3; } else if(EM==='bow'&&s>0){ a=.9; elbow=1.2; } }
    const isDag=L.weapon==='dagger'||L.weapon==='nightfang', swArm=sw>=0&&(s>0||isDag);
    if(cr>0&&!o.cast&&!EM&&!swArm){ const br=Math.sin(t*3.2+o.x)*.05, aw=(s>0?-armA:armA)*.4, wk=s>0?L.weapon:L.off; let ga=.7,ge=1,gs=.25;
      if(stl){ ga=.55; ge=1.25; gs=.32; } else if(s>0&&WUP.has(L.weapon)){ ga=a; ge=elbow; gs=spread; } else if(s<0&&!L.off&&WUP.has(L.weapon)){ ga=.95; ge=.7; gs=.32; }
      else if(wk==='shield'){ ga=.8; ge=1.05; gs=.08; } else if(wk==='dagger'||wk==='nightfang'){ ga=.65; ge=1.35; gs=.28; } else if(s>0&&wk&&wk!=='none'){ ga=.85; ge=1.35; gs=.22; }
      a=lerp(a,ga+br+aw,cr); elbow=lerp(elbow,ge,cr); spread=lerp(spread,gs,cr); }
    if(o.rel>=0&&o.rel<1&&!o.cast&&sw<0){ const k=Math.sin(Math.PI*o.rel); if(s>0&&!WUP.has(L.weapon)){ a=lerp(a,1.55,k); elbow=lerp(elbow,.05,k); spread=lerp(spread,.05,k); } else if(s<0){ a=lerp(a,1.5,k); elbow=lerp(elbow,.08,k); spread=lerp(spread,-.05,k); } }
    if(o.air&&!o.cast&&!(s>0&&sw>=0)){ a=.9; spread=.38; elbow=.5; }
    if(sw>=0){ const P2=swingPose(sw,o.swv||0,s,L); if(P2){ a=P2[0]; elbow=P2[1]; spread=P2[2]; } }
    if(L.longArms) a+=.15; if(s>0&&WUP.has(L.weapon)&&sw<0&&!o.cast&&!o.ride&&!o.swim&&!EM&&!o.air){ a=.1-armA*.25; elbow=1.2; spread=.16; }
    mrz(a); mrx(-s*spread);
    const ua=L.longArms?.42:.31, la=L.longArms?.4:.29;
    if(!bone&&!L.pauld) P(GEO.sph,limbW*(L.robe||L.lean?1.2:1.45),limbW*(L.robe||L.lean?1.25:1.5),limbW*(L.robe||L.lean?1.2:1.45),armCol,hitE,0,-.03,0); if(bone) P(GEO.limb,limbW*.95,ua,limbW*.95,armCol,hitE); else P(GEO.uarm,limbW*(L.lean?1.08:1.22),ua+.02,limbW*(L.lean?1.05:1.18),armCol,hitE); mtr(0,-ua,0); P(GEO.sph,limbW*.95,limbW*.95,limbW*.95,bone?armCol:(L.metal||armCol),hitE); mrz(elbow);
    const fa=bone?armCol:(L.metal||armCol); if(bone) P(GEO.limb,limbW*.8,la,limbW*.8,fa,hitE); if(!bone){ P(GEO.farm,limbW*(L.lean?1.0:1.1),la+.02,limbW*(L.lean?.98:1.06),fa,hitE); if(L.metal) P(GEO.frus,limbW*1.45,.13,limbW*1.45,L.metal.map(v=>v*1.05),hitE,0,-la+.0,0); else P(GEO.cyl,limbW*1.12,.06,limbW*1.12,L.trim||armCol,hitE,0,-la+.05,0); }
    if(L.robe&&!bone){ P(GEO.frus,limbW*2.5,.3,limbW*2.5,armCol,hitE,0,-la-.03,0); P(GEO.cyl,limbW*2.52,.035,limbW*2.52,L.trim||armCol,hitE+.1,0,-la-.03,0); }
    mtr(0,-la-.04,0);
    const hand=bone||(L.rock?L.arms:(L.gloves||(L.metal?L.metal.map(v=>v*.8):skin)));
    const hw=s>0?L.weapon:((L.off==='dagger'||L.off==='nightfang')?L.off:null), gk=hw?(WUP.has(hw)?1:WBLADE.has(hw)?2:WHAFT.has(hw)?3:0):0;
    if(gk){ const th=a+elbow, up=gk===1&&!(s>0&&sw>=0);
      P(GEO.box,.076,.08,.064,hand,hitE,0,-.036,0); mpush(); mtr(0,-.08,0); mrz(up?-th:(gk===2?-1.87:-1.67));
      drawFist(hand,hitE,s); if(up) mtr(0,-.45,0); if(s>0) drawWeapon(L,o,t); else drawOff(L,o,t); mpop();
      if(o.cast){ P(GEO.sph,.17,.17,.17,o.castCol,2.6,0,-.08,0); if(Math.random()<.3) emitTip('#ffffff',0,-.08,0); } }
    else { drawHand(hand,hitE,s,!!bone);
      if(o.cast){ P(GEO.sph,.17,.17,.17,o.castCol,2.6); if(Math.random()<.3) emitTip('#ffffff',0,0,0); }
      if(s>0) drawWeapon(L,o,t); else drawOff(L,o,t); }
    mpop(); }
  if(L.stars){ for(let k=0;k<5;k++){ const a=t*.7+k*1.256, r=.6+Math.sin(t+k)*.08; P(GEO.sph,.045,.045,.045,[.75,.9,1],3,Math.cos(a)*r,.55+Math.sin(t*1.3+k*2)*.4,Math.sin(a)*r); } }
  if(L.halo&&!L.pauld) for(const s of [-1,1]) for(let k=0;k<4;k++){ mpush(); mtr(-.06,.68-k*.03,s*(.22+k*.035)); mrx(-s*(.55+k*.28)); mrz(-.35); P(GEO.cone,.07,.3-k*.03,.035,k%2?[.98,.96,.9]:L.trim,hitE+.1); mpop(); }
  if(L.orbs){ for(let k=0;k<2;k++){ const a=t*2.2+k*Math.PI; const ox=Math.cos(a)*.55, oz=Math.sin(a)*.55, oy=1.25+Math.sin(t*3+k)*.12;
      P(GEO.sph,.13,.13,.13,k?[.85,.6,1]:[.55,.85,1],2.6,ox,oy,oz); if(Math.random()<.15) emitTip(k?'#d6b3ff':'#9fd8ff',ox,oy,oz); } }
  mpop();
}
function drawHand(c,e,s,bony){ const w=bony?.55:1;
  P(GEO.box,.1*w+.02,.11,.07*w+.01,c,e,.02,-.01,0);
  for(let k=0;k<4;k++){ const z=(k-1.5)*.023*s; mpush(); mtr(.055,-.055,z); mrz(.9); P(GEO.limb,.024*w+.004,.045,.024*w+.004,c,e); mtr(0,-.045,0); mrz(1.1); P(GEO.limb,.022*w+.003,.04,.022*w+.003,c,e); mpop(); }
  mpush(); mtr(.04,-.0,-s*.045); mrx(s*.7); mrz(.5); P(GEO.limb,.028*w+.004,.05,.028*w+.004,c,e); mtr(0,-.05,0); mrz(.5); P(GEO.limb,.025*w+.003,.04,.025*w+.003,c,e); mpop(); }
function HILT(grip,metal,gw){ P(GEO.cyl,.042,.2,.042,grip,0,0,-.1,0); for(let k=0;k<4;k++) P(GEO.cyl,.048,.012,.048,grip.map(v=>v*.7),0,0,-.08+k*.05,0); P(GEO.sph,.065,.065,.065,metal,.2,0,-.125,0); P(GEO.box,gw,.05,.07,metal,.15,0,.115,0); }
const WUP=new Set(['trident','staff','crystal','solace','lantern','spear','staffplain','rod','skullstaff']), WBLADE=new Set(['sword','rustsword','greatsword','spellblade','dawnwarden','dagger','nightfang']), WHAFT=new Set(['wand','cinderheart','hammer','axe','club','morningstar','greataxe']);
function drawFist(c,e,s){ P(GEO.box,.084,.1,.078,c,e,0,0,0); for(let k=0;k<4;k++) P(GEO.sph,.03,.027,.03,c,e,.016,(k-1.5)*.024,s*.036);
  mpush(); mtr(-.008,.038,-s*.034); mrx(-s*.4); P(GEO.limb,.03,.062,.028,c,e); mtr(0,-.062,0); P(GEO.sph,.028,.028,.026,c,e); mpop(); }
function drawWeapon(L,o,t){ const md=MATD; MATD=0; try{ return drawWeapon0(L,o,t); } finally{ MATD=md; } }
function drawWeapon0(L,o,t){
  const w=L.weapon; const rar=o.wr||0;
  if(rar>=4){ const lc=w==='staff'?[1,.86,.45]:w==='wand'?[1,.45,.12]:(w==='dagger'||w==='nightfang')?[.45,1,.6]:w==='axe'?[1,.4,.15]:[1,.78,.35], m=CUR, pul=.75+.25*Math.sin(t*3.1+(o.x||0));
    const at=(x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]; const [X,Y,Z]=at(.5,.1,0); addLight(X,Y,Z,2.6,lc.map(v=>v*.55*pul));
    if(Math.random()<.5){ const k=Math.random(); const [px,py,pz]=at(.15+k*.75,.1,0); P3(px,py,pz,(Math.random()-.5)*.15,.25+Math.random()*.3,(Math.random()-.5)*.15,.6,.07,'#'+lc.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''),{glow:true,drag:.9}); } } const glow=rar>=4?[1,.55,.12]:rar>=3?[.75,.38,1]:rar>=2?[.3,.55,1]:null; const gHex=rar>=4?'#ff8a1a':rar>=3?'#b45cff':'#3d8bff'; if(rar>=4&&Math.random()<.35) emitTip(Math.random()<.5?'#ff8a1a':'#ffd36a',.2+Math.random()*.6,.1,0); const swinging=(o.swing??-1)>=0;
  if(drawGearWeapon(w,L,o,t)) return;
  switch(w){
    case 'sword': HILT([.3,.2,.12],L.trim,.3); mpush(); mtr(.12,.04,0); mrz(Math.PI/2); 
      P(GEO.box,.86,.085,.03,glow||[.86,.89,.93],glow?1.4:.18,.49,.12,0); P(GEO.box,.7,.02,.035,glow||[.6,.62,.66],glow?1:.05,.45,.12,0); P(GEO.cone,.065,.13,.03,glow||[.86,.89,.93],glow?1.4:.18,.93,.12,0);
      if(swinging) for(let k=0;k<3;k++) emitTip(glow?gHex:'#e8f0ff',.3+k*.3,.12,0); if(glow&&Math.random()<.25) emitTip(gHex,.3+Math.random()*.6,.12,0); mpop(); break;
    case 'rustsword': HILT([.3,.24,.16],[.35,.3,.25],.24); P(GEO.box,.07,.7,.03,[.5,.42,.35],0,0,.48,0); P(GEO.cone,.07,.1,.03,[.5,.42,.35],0,0,.83,0); break;
    case 'greatsword': HILT([.25,.2,.3],[.9,.72,.25],.46); P(GEO.cyl,.05,.18,.05,[.25,.2,.3],0,0,-.28,0); P(GEO.box,.13,1.45,.04,[.75,.8,.9],.3,0,.86,0); P(GEO.box,.03,1.2,.05,[.45,.95,1],.9,0,.78,0); P(GEO.cone,.13,.18,.04,[.75,.8,.9],.3,0,1.58,0); P(GEO.sph,.08,.08,.08,[.45,.95,1],2.4,0,-.32,0);
      if(swinging) for(let k=0;k<4;k++) emitTip('#9fe8ff',0,.4+k*.32,0); break;
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
    case 'trident': P(GEO.cyl,.055,2.4,.055,[.22,.34,.32],.15,0,-.85,0); P(GEO.box,.5,.07,.07,[.5,.75,.7],.4,0,1.55,0); for(const q of [-1,0,1]) P(GEO.cone,.07,q?.42:.55,.05,[.6,.9,.85],.6,q*.22,1.58,0); P(GEO.sph,.12,.12,.12,[.3,1,.85],2.6,0,1.5,0); addLight(o.x,o.y+2,o.z,4,[.3,1,.8]); break;
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
  mreset(); mtr(X,gy+.04,Z); mry(t*.4); if(dd<0){ P(GEO.cyl,4.2*sc,.02,4.2*sc,[.4,.8,1],1.3,0,0,0,.35); P(GEO.cyl,3.4*sc,.025,3.4*sc,[.1,.15,.3],.2,0,.005,0,.5); for(let k=0;k<10;k++){ const a=k/10*6.283; mpush(); mtr(Math.cos(a)*1.9*sc,.02,Math.sin(a)*1.9*sc); mry(-a); P(GEO.box,.12,.02,.34,[.55,.9,1],2.2+Math.sin(t*3+k)*.6,0,0,0,.8); mpop(); } }
  const LK=dd>=0?0:lookYaw(m);
  mreset(); mtr(X,y,Z); mry(-(m.rf??m.face??0)); msc(S); if(dd>=0){ mrx(Math.min(1,dd)*1.2); mtr(0,-Math.min(1,dd*.5),0); } else { mrx(Math.sin(t*.9)*.05); mrz(Math.sin(t*.7)*.04); }
  P(GEO.frus,.95,1.6,.95,[.08,.1,.18],e,0,0,0); P(GEO.cyl,.98,.08,.98,[.45,.8,1],1.1,0,0,0); P(GEO.box,.05,1.2,.2,[.45,.8,1],1,.47,.6,0);
  for(let k=0;k<14;k++){ const a=k/14*6.283; mpush(); mtr(Math.cos(a)*.28,1.55,Math.sin(a)*.28); mry(-a); mrz(.2+Math.sin(t*1.2+k)*.04); P(GEO.limb,.12,1.45,.1,k%2?[.07,.09,.16]:[.1,.12,.21],e); mpop(); }
  P(GEO.sph,.62,.85,.62,[.1,.12,.22],e,0,1.75,0); P(GEO.cyl,.75,.16,.75,[.2,.25,.4],e,0,2.05,0);
  P(GEO.sph,.3,.42,.36,[.02,.03,.06],0,.2,1.85,0); for(let k=0;k<4;k++){ const w=.3-Math.abs(k-1.5)*.03; P(GEO.box,.04,.03,w,[.85,.83,.76],e+.2,.27,1.68+k*.09,0); } P(GEO.box,.04,.36,.04,[.85,.83,.76],e,.25,1.82,0); P(GEO.sph,.1,.1,.1,[.45,.95,1],3.6+Math.sin(t*4)*.8,.22,1.85,0);
  for(const s of [-1,1]) for(let k=0;k<3;k++){ P(GEO.sph,.42-k*.04,.2-k*.03,.42-k*.04,[.14+k*.03,.17+k*.03,.3+k*.04],e,0,2.15-k*.1,s*(.4+k*.05)); P(GEO.sph,.43-k*.04,.03,.43-k*.04,[.5,.85,1],1.4,0,2.08-k*.1,s*(.4+k*.05)); }
  mpush(); mtr(.38,1.45+Math.sin(t*2)*.05,0); P(GEO.cyl,.015,.5,.015,[.6,.6,.65],.3,0,.0,0); P(GEO.sph,.12,.18,.12,[.3,1,.6],3.2+Math.sin(t*5)*.6,0,-.05,0); mpop();
  for(const s of [-1,1]){ P(GEO.sph,.34,.26,.34,[.5,.85,1],.8,0,2.1,s*.38); P(GEO.cone,.08,.38,.08,[.7,.95,1],1.4,0,2.25,s*.45); }
  mpush(); mtr(0,2.35,0); mry(-LK*.8); mrz(Math.sin(t*.8)*.06); P(GEO.sph,.32,.35,.31,[.88,.86,.8],e,.02,.15,0); for(const s of [-1,1]){ P(GEO.sph,.08,.08,.07,[0,0,0],0,.13,.18,s*.07); P(GEO.sph,.045,.045,.045,[.5,.95,1],3.5,.16,.18,s*.07); }
    P(GEO.box,.12,.06,.18,[.85,.82,.75],e,.12,.02,0); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; P(GEO.cone,.06,.32+(k%2)*.18,.06,[.65,.95,1],1.8,Math.cos(a)*.17,.3,Math.sin(a)*.17); } mpop();
  const sw=swing>=0?Math.sin(swing*Math.PI):0;
  for(const s of [-1,1]){ mpush(); mtr(0,1.95,s*.42); mrz(s>0?.9+sw*1.2:.4+Math.sin(t*2)*.2); mrx(-s*.25); P(GEO.limb,.12,.55,.12,[.82,.8,.74],e); mtr(0,-.55,0); mrz(.4); P(GEO.limb,.1,.5,.1,[.82,.8,.74],e); mtr(0,-.55,0);
    if(s>0){ P(GEO.cyl,.06,2.4,.06,[.15,.12,.2],0,0,-.9,0); P(GEO.sph,.3,.3,.3,[.5,.9,1],3,0,1.55,0); for(let k=0;k<4;k++){ const a=k*1.57+t; P(GEO.cone,.05,.4,.05,[.6,.9,1],1.5,Math.cos(a)*.18,1.35,Math.sin(a)*.18); } }
    else { P(GEO.sph,.2,.2,.2,[.4,.8,1],2.5,0,.05,0); for(let k=0;k<4;k++){ mpush(); mtr(.03,-.02,(k-1.5)*.05); mrz(.5); P(GEO.limb,.03,.16,.03,[.82,.8,.74],e); mtr(0,-.16,0); mrz(.6); P(GEO.cone,.025,.1,.025,[.9,.88,.8],e,0,-.1,0); mpop(); } } mpop(); }
  for(let k=0;k<7;k++){ const a=t*.9+k*.8976; P(GEO.box,.05,.24,.12,[.6,.95,1],2.8,Math.cos(a)*.6,3.2+Math.sin(t*2+k)*.06,Math.sin(a)*.6,.85); }
  for(let k=0;k<12;k++){ const a=k/12*6.283; mpush(); mtr(Math.cos(a)*.44,-.1-(k%3)*.06+Math.sin(t*2+k)*.03,Math.sin(a)*.44); mry(-a); mrz(Math.sin(t*1.5+k)*.12); P(GEO.box,.04,.34+(k%3)*.12,.24,[.07,.09,.16],e); mpop(); }
  for(let k=0;k<3;k++){ const a=t*1.4+k*2.09; P(GEO.cone,.14,.42,.14,[.55,.9,1],2.4,Math.cos(a)*1.3,1.6+Math.sin(t*2+k)*.3,Math.sin(a)*1.3); }
  addLight(X,y+2.5,Z,16,m.enr?[1.4,.4,1.2]:[.4,.9,1.5]);
  if(Math.random()<.7) P3(X+(Math.random()-.5)*2.5,gy+.2,Z+(Math.random()-.5)*2.5,(Math.random()-.5)*.3,.3+Math.random()*.4,(Math.random()-.5)*.3,2,.5,'#bfe8ff',{big:true,drag:.99});
  if(Math.random()<.4) burst3(X,y+3,Z,m.enr?'#c77dff':'#9fe8ff',1,.6,{glow:true});
}

function drawOff(L,o,t){ const md=MATD; MATD=0; try{ return drawOff0(L,o,t); } finally{ MATD=md; } }
function hitE0(o){ return 0; }
function drawOff0(L,o,t){
  if(L.off==='dagger'||L.off==='nightfang'){ drawGearWeapon(L.off,L,o,t); return; }
  if(L.off==='shield'){ P(GEO.box,.5,.62,.07,L.tabard||[.17,.3,.62],0,.08,-.05,-.1); P(GEO.box,.56,.68,.04,L.trim,.1,.08,-.05,-.13); P(GEO.box,.08,.48,.02,L.trim,.3,.08,-.05,-.063); P(GEO.box,.4,.08,.02,L.trim,.3,.08,.04,-.063);
    for(const [a,b] of [[-.19,-.25],[.35,-.25],[-.19,.21],[.35,.21]]) P(GEO.sph,.04,.04,.03,L.trim,.3,a,b,-.06); P(GEO.sph,.13,.13,.07,L.trim,.3,.08,.04,-.05); P(GEO.sph,.06,.06,.04,L.crest||L.gem||[.5,.7,1],1.8,.08,.04,-.02); }
  else if(L.off==='horn'){ const iv=[.93,.87,.72], gd=L.trim||[.92,.72,.32]; mpush(); mtr(.05,.02,-.12); msc(1.3);
    for(let k=0;k<7;k++){ mpush(); mrz(-.22*k); mtr(0,.09*k,0); P(GEO.cyl,.045+k*.012,.1,.045+k*.012,iv.map(v=>v*(1-k*.03)),hitE0(o),0,0,0); if(k%2===0) P(GEO.cyl,.05+k*.013,.02,.05+k*.013,gd,.4,0,.05,0); mpop(); }
    mpush(); mrz(-1.54); mtr(0,.7,0); P(GEO.cyl,.15,.04,.15,gd,.6,.0,.0,0); P(GEO.cyl,.11,.02,.11,[.1,.06,.03],0,0,.02,0); mpop(); mpop(); }
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
function drawQuad(o){ const md=MATD; MATD=6; try{ return drawQuad0(o); } finally{ MATD=md; } }
function drawQuad0(o){
  const Q=o.Q, t=now(), sc=(Q.scale||1)*(o.sc||1), mv=o.mv||0, ph=o.walk||0, e=o.hit?.9:0;
  const col=Q.col, dark=Q.dark, belly=col.map(v=>Math.min(1,v*1.25+.1)), L=Q.len, H=Q.hgt;
  const canine=!!Q.muzzle, boar=!!Q.tusks, deer=!!Q.antlers, bunny=!!Q.longEars;
  const AN=o.an||null, g=clamp((((AN&&AN.spdS)||0)-2.4)/1,0,1)*mv, qp=ph*1.2;
  const pitch=Math.sin(qp+.6)*.075*g+Math.sin(qp*2)*.02*mv*(1-g), qbank=((AN&&AN.bankS)||0)*.8;
  mreset(); mtr(o.x,o.y+Math.abs(Math.sin(qp))*.04*mv*(1-g)+(.5+.5*Math.sin(qp-1.2))*.13*g*(Q.hgt||.5),o.z); mry(-o.face); msc(sc); mrx(qbank);
  if(o.dead>=0){ const k=Math.min(1,o.dead/.6); mrx(k*1.5); mtr(0,k*.1,0); }
  const sw0=o.swing, lunge=sw0>=0?(sw0<.3?-.1*Math.sin(Math.PI*sw0/.3):Math.sin(Math.PI*clamp((sw0-.3)/.5,0,1))*.42):0; mtr(lunge,0,0); if(sw0>=0) mrz(sw0<.3?.07*Math.sin(Math.PI*sw0/.3):-.09*Math.sin(Math.PI*clamp((sw0-.3)/.5,0,1)));
  const br=1+Math.sin(t*2.3+o.x)*.018, by=H+.12, bw=boar?1.12:deer?.82:1;
  /* legs: shoulder/elbow/paw in front, stifle/hock/paw behind */
  for(const [lx,lz,off0,front,offG] of [[.34,.16,0,1,0],[.34,-.16,Math.PI,1,.6],[-.33,.16,Math.PI,0,Math.PI+.2],[-.33,-.16,0,0,Math.PI+.8]]){ const off=lerp(off0,offG,g);
    mpush(); mtr(lx*L,H+.04+(front?1:-1)*pitch*L*.3,lz*bw); const sw=Math.sin(qp+off)*(.6+.32*g)*mv, lift=Math.max(0,Math.sin(qp+off))*mv*(1+.3*g);
    mrz(sw);
    if(front){ P(GEO.sph,.17,.26,.14,col,e,0,-.06,0); P(GEO.limb,.16*bw,H*.48,.17*bw,col,e); mtr(0,-H*.48,0); P(GEO.sph,.12,.12,.12,col,e); mrz(-lift*.8); P(GEO.limb,.1,H*.42,.1,deer?col:dark,e); mtr(0,-H*.42,0); mrz(lift*.6-sw); }
    else { mrz(.32); P(GEO.limb,.21*bw,H*.4,.21*bw,col,e); mtr(0,-H*.4,0); P(GEO.sph,.13,.13,.13,col,e); mrz(-.85-lift*.5); P(GEO.limb,.1,H*.34,.1,deer?col:dark,e); mtr(0,-H*.34,0); P(GEO.sph,.085,.085,.085,deer?col:dark,e); mrz(.53+lift*.3-sw); P(GEO.limb,.075,H*.2,.075,dark,e); mtr(0,-H*.2,0); }
    if(boar||deer){ P(GEO.box,.1,.07,.09,[.12,.1,.08],0,.02,-.03,0); P(GEO.box,.03,.06,.1,[.06,.05,.04],0,.07,-.03,0); }
    else { P(GEO.sph,.15,.08,.12,dark,e,.04,-.03,0); for(let k=-1;k<=1;k++) P(GEO.sph,.05,.045,.04,dark.map(v=>v*.8),e,.1,-.04,k*.035); }
    mpop(); }
  mpush(); mtr(0,by,0); mrz(pitch); mtr(0,-by,0);
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
  const sniff=Math.pow(Math.max(0,Math.sin(t*.35+o.x*3)),6)*.55*(1-mv)*(o.rdy?0:1);
  const look=(o.swing>=0?(o.swing<.3?.18*Math.sin(Math.PI*o.swing/.3):-.5*Math.sin(Math.PI*clamp((o.swing-.3)/.45,0,1))+(boar?.6*Math.max(0,Math.sin(Math.PI*clamp((o.swing-.6)/.4,0,1))):0)):Math.sin(t*1.3+o.x)*.06-(o.rdy?.12+Math.sin(t*4+o.x)*.03:0))-pitch*.8-sniff-.1*g+Math.sin(qp*2)*.05*mv*(1-g);
  mpush(); mtr(L*.52,by+.1,0); mrz(look); mry(-(o.look||0)*.6+Math.sin(t*.7+o.z)*.12*(1-mv)*(o.rdy?0:1));
  if(canine){ P(GEO.sph,.44,.5,.38,col,e,.1,.12,0); mtr(.28,.3,0); }
  else if(boar){ P(GEO.sph,.46,.48,.5,col,e,.06,.04,0); mtr(.26,.02,0); }
  else if(deer){ mpush(); mrz(-.6); P(GEO.limb,.2,.5,.18,col,e); mpop(); P(GEO.sph,.3,.4,.26,col,e,.1,.15,0); mtr(.26,.5,0); }
  else { P(GEO.sph,.3,.34,.3,col,e,.06,.08,0); mtr(.16,.18,0); }
  if(canine){ const jw=o.swing>=0?Math.sin(o.swing*Math.PI)*.6:.06+Math.max(0,Math.sin(t*1.7+o.x))*.06+g*.22*Math.abs(Math.sin(t*9));
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
  mpop(); mpop();
}
function drawMob3(m,dead){
  const t=now(), mt=m.t; const X=(dead?m.dx:m.rx)/TS, Z=(dead?m.dy:m.ry)/TS; const gy=groundY(dead?m.dx:m.rx,dead?m.dy:m.ry);
  const mv=clamp(m.mvS||0,0,1), ph=m.walkP||0, hit=t-m.hit<.1 && !dead;
  if(!dead){ const hh=(MOBH[mt.key]||1.6); const Xs=m.rx/TS, Zs=m.ry/TS, gs=groundY(m.rx,m.ry);
    if(m.stunU>t){ for(let k=0;k<3;k++){ const a=t*5+k*2.09; mreset(); mtr(Xs+Math.cos(a)*.38,gs+hh+.15,Zs+Math.sin(a)*.38); mry(t*6); P(GEO.box,.13,.13,.03,[1,.9,.3],2.8); mrz(.785); P(GEO.box,.13,.13,.03,[1,.9,.3],2.8); } }
    if(m.rootU>t){ const Rr=(mt.r||14)/TS*1.15+.25; for(let k=0;k<8;k++){ const a=k/8*6.283+m.id; mreset(); mtr(Xs+Math.cos(a)*Rr,gs-.05,Zs+Math.sin(a)*Rr); mrz(Math.cos(a)*.4); mrx(-Math.sin(a)*.4); P(GEO.cone,.22,.55+(k%2)*.3,.22,[.72,.9,1],.9,0,0,0,.85); } } }
  if(m.swingT!==m._swT0){ m._swT0=m.swingT; m.swingN=(m.swingN||0)+1; } const sw=(t-(m.swingT||0))/.55; const swing=sw>=0&&sw<1?sw:-1; const dd=dead?t-m.deathT:-1;
  let sc=1; if(m.spawnT&&t-m.spawnT<.6) sc=.3+.7*(t-m.spawnT)/.6;
  const base={x:X,y:gy,z:Z,face:smoothFace(m,m.face||0),mv,walk:ph,swing,swv:(m.swingN||0)%3,dead:dd,hit,sc,an:m,rdy:(m.tgt&&!dead)?1:0,look:dead?0:lookYaw(m)};
  if(dead && dd>.9) base.y-=(dd-.9)*1.2;
  if(LOOK[mt.key]){ drawHumanoid({...base,L:LOOK[mt.key]}); if((mt.key==='vaelith'||mt.key==='ossric')&&dd<0){ mreset(); mtr(X,gy+.04,Z); mry(t*.15); const R=mt.key==='vaelith'?2.1:1.7; P(GEO.cyl,R,.012,R,[.2,.8,.7],1.1,0,0,0,.35);
    for(let k=0;k<16;k++){ const an=k/16*6.283; P(GEO.box,.22,.012,.05,[.4,1,.85],2,Math.cos(an)*R*.86,.01,Math.sin(an)*R*.86,.7); }
    addLight(X,gy+2.8,Z,mt.key==='vaelith'?10:8,[.3,1,.85]); if(Math.random()<.3) P3(X+(Math.random()-.5)*1.4,gy+2.4+Math.random()*.8,Z+(Math.random()-.5)*1.4,0,-2,0,.6,.06,'#9ff6ea',{glow:true}); }
    if(mt.key==='hking'&&dd<0){ mreset(); mtr(X,gy+3.35+Math.sin(t*2)*.06,Z); mry(t*.8); P(GEO.cyl,.75,.05,.75,[.5,.95,1],2.4,0,0,0,.7); for(let k=0;k<8;k++){ const an=k/8*6.283; P(GEO.cone,.07,.28+(k%2)*.16,.07,[.6,1,1],3,Math.cos(an)*.36,.03,Math.sin(an)*.36,.8); } for(let k=0;k<2;k++){ const an=t*2+k*3.14+Math.random(); P3(X+Math.cos(an)*1.3,gy+Math.random()*2.6,Z+Math.sin(an)*1.3,0,.8,0,.8,.15,'#7ef0ff',{glow:true}); } addLight(X,gy+2.5,Z,9,[.4,.9,1.2]); } }
  else if(QLOOK[mt.key]) drawQuad({...base,Q:QLOOK[mt.key]});
  else switch(mt.key){
    case 'moth': { const fl=Math.sin(t*18+m.id); mreset(); mtr(X,gy+1.4+Math.sin(t*2+m.id)*.2,Z); mry(-(m.rf??m.face??0)); msc(sc*(dead?Math.max(.1,1-dd):1));
      mrx(Math.sin(t*2.3+m.id)*.15+((m.bankS||0)*1.2)); mrz(-.18*mv+Math.sin(t*1.7+m.id)*.06);
      P(GEO.sph,.5,.16,.16,[.35,.3,.4],hit?.9:0,0,0,0); P(GEO.sph,.2,.18,.18,[.42,.36,.48],hit?.9:0,.26,.02,0); P(GEO.sph,.36,.12,.12,[.3,.25,.35],hit?.9:0,-.28,-.01,0);
      for(const s of [-1,1]){ P(GEO.sph,.06,.06,.05,[.15,.1,.2],1.2,.33,.05,s*.06); for(let k=0;k<3;k++){ mpush(); mtr(.1-k*.1,-.05,s*.05); mrx(-s*.5); mrz(Math.sin(t*6+k)*.1); P(GEO.limb,.015,.14,.015,[.3,.25,.3],0); mpop(); } }
      for(const s of [-1,1]){ mpush(); mtr(0,0,s*.05); mrx(s*(.25+fl*.7)); P(GEO.sph,.55,.03,.75,[.85,.78,1],.5,0,0,s*.38); P(GEO.sph,.12,.035,.12,[.4,.2,.6],.3,-.05,0,s*.42);
        P(GEO.sph,.2,.032,.2,[.98,.94,1],.9,.08,.004,s*.45); P(GEO.sph,.1,.036,.1,[.3,.18,.5],1.4,.08,.006,s*.45); P(GEO.sph,.36,.03,.5,[.7,.6,.92],.5,-.25,-.004,s*.3); mpop(); }
      for(const s of [-1,1]){ mpush(); mtr(.34,.08,s*.04); mrz(-.7); mrx(-s*.4); P(GEO.limb,.015,.28,.015,[.8,.7,1],.4); for(let k=0;k<4;k++) P(GEO.box,.012,.03,.09,[.85,.78,1],.4,0,-.08-k*.05,0); mpop(); }
      addLight(X,gy+1.4,Z,4,[.6,.5,1]); if(Math.random()<.15) burst3(X,gy+1.3,Z,'#e8d8ff',1,.3,{glow:true}); break; }
    case 'siltmother': { const LP=LPAL.siltmother, e=hit?.9:0, sh=[.16,.15,.11], pl=[.27,.25,.18], rim=[.42,.38,.27], gl=[.45,1,.7];
      mreset(); mtr(X,gy,Z); mry(-smoothFace(m,m.face||0)); msc(sc*1.55); if(dead) mtr(0,-Math.min(.5,dd*.5),0);
      const rear=swing>=0&&!dead?(swing<.5?eO(swing/.5):1-eIO((swing-.5)/.5)):0, br=Math.sin(t*1.4+m.id)*.025;
      mtr(0,Math.abs(Math.sin(ph*1.5))*.04*mv+br,0); mtr(.3,0,0); mrz(rear*.32); mtr(-.3,0,0);
      for(const sd of [-1,1]) for(let k=0;k<4;k++){ const hx=.5-k*.28, sp=(k-1.5)*.42, lift=Math.max(0,Math.sin(ph*1.5+k*1.57+(sd>0?0:3.14)))*mv, fw=Math.sin(ph*1.5+k*1.57+(sd>0?0:3.14))*.22*mv;
        mpush(); mtr(hx,.46,sd*.4); mry(sd*(1.5708+sp)-fw*sd); mrz(-(2.25+lift*.35-(k===0?rear*.5:0))); P(GEO.limb,.13,.5,.12,sh,e); P(GEO.sph,.14,.14,.14,pl,e,0,0,0); mtr(0,-.48,0); P(GEO.sph,.11,.11,.11,rim,e);
        mrz(1.95+lift*.2); P(GEO.limb,.1,.62,.09,pl,e); mtr(0,-.6,0); P(GEO.cone,.07,.2,.07,[.12,.11,.08],e,0,.07,0); mpop(); }
      mpush(); mtr(0,-.14,0);
      P(GEO.sph,.86,.46,.7,pl,e,.2,.72,0); for(let k=0;k<4;k++) P(GEO.sph,.5-k*.05,.2,.56-k*.06,k%2?rim:pl,e,.55-k*.2,.98-k*.02,0);
      for(let k=0;k<5;k++){ mpush(); mtr(.55-k*.2,1.12,0); mrz(.35); P(GEO.cone,.07,.24+(k%2)*.1,.07,rim,e); mpop(); }
      const pu=.6+Math.sin(t*2.2)*.25; P(GEO.sph,.92,.74,.84,[.34,.42,.26],e+pu*.35,-.78,.92,0); P(GEO.sph,.95,.18,.88,sh,e,-.74,1.28,0);
      for(let k=0;k<9;k++){ const a=k*2.39, rr=.55+.25*Math.sin(k*1.7); P(GEO.sph,.15,.15,.15,[.8,.95,.55],1.1+Math.sin(t*2.5+k)*.6,-.78-Math.cos(a)*rr*.6,.72+Math.sin(k*1.3)*.18,Math.sin(a)*rr*.55); }
      for(let k=0;k<6;k++){ const a=k/6*6.283; P(GEO.sph,.12,.06,.12,sh,e,-.78+Math.cos(a)*.7,1.16,Math.sin(a)*.62); }
      mpush(); mtr(.92,.86,0); mrz(.15+rear*.3+Math.sin(t*.9)*.04); P(GEO.sph,.36,.3,.42,pl,e,0,0,0); P(GEO.sph,.3,.12,.36,rim,e,.02,.18,0);
      for(const [ey,ez] of [[.12,.14],[.12,-.14],[.2,.07],[.2,-.07],[.04,.22],[.04,-.22]]){ P(GEO.sph,.055,.055,.055,[0,0,0],0,.3,ey,ez); P(GEO.sph,.035,.035,.035,LP[3],2.6,.33,ey,ez); }
      const op=.15+(swing>=0?Math.sin(swing*Math.PI)*.5:0)+Math.sin(t*3)*.03; for(const sd of [-1,1]){ mpush(); mtr(.28,-.1,sd*.12); mry(sd*op); mrz(-1.9); P(GEO.cone,.08,.26,.08,[.75,.7,.55],e); mpop(); }
      mpop(); mpop(); addLight(X,gy+2,Z,9,[.5,1,.6]); if(!dead&&Math.random()<.15) P3(X+(Math.random()-.5)*2,gy+1.2,Z+(Math.random()-.5)*2,0,-1.5,0,.7,.07,'#5a5038',{});
      break; }
    case 'lurker': case 'crawler': case 'siltling': { const LP=LPAL[mt.key]||LPAL.lurker; mreset(); mtr(X,gy,Z); mry(-smoothFace(m,m.face||0)); msc(sc*LP[4]); if(swing>=0&&!dead) mrz(swing<.55?Math.sin(Math.PI*swing/.55)*.34:-Math.sin(Math.PI*(swing-.55)/.45)*.2); if(dead) mtr(0,-Math.min(.6,dd*.6),0); const e=hit?.9:0;
      mtr(0,Math.abs(Math.sin(ph*1.5))*.08*mv+Math.sin(t*1.5+m.id)*.03,0); mrx(Math.sin(ph*1.5)*.05*mv); const BL=Math.sin(t*.7+m.id*3)>.97?.15:1;
      for(let k=0;k<6;k++){ mpush(); const a=k/6*Math.PI*2; mtr(Math.cos(a)*.45,.3,Math.sin(a)*.45); mry(-a); for(let s=0;s<3;s++){ mrz(-.6+Math.sin(t*3+k+s)*.35+Math.sin(ph*1.5+k*1.05+s*.4)*.32*mv); P(GEO.limb,.14-s*.03,.35,.14-s*.03,LP[0],e); mtr(0,-.33,0); } mpop(); }
      P(GEO.sph,1.25,.75,1.2,LP[1],e,0,.5,0); P(GEO.sph,1.0,.45,.95,LP[2],e,0,.65,0);
      if(mt.key==='siltmother'){ for(let k=0;k<7;k++){ const a=(k/6-.5)*2.4; mpush(); mtr(-.15+Math.cos(a)*.1,.92,Math.sin(a)*.42); mrx(-Math.sin(a)*.6); mrz(.35); P(GEO.cone,.14,.5,.14,LP[0],e); mpop(); } P(GEO.sph,.78,.62,.78,[.7,.78,.5],.5+Math.sin(t*2)*.2,-.62,.55,0); for(let k=0;k<5;k++) P(GEO.sph,.16,.16,.16,[.85,.95,.6],.9,-.62+Math.cos(k*1.3)*.3,.62+Math.sin(k*2.1)*.16,Math.sin(k*1.3)*.3); addLight(X,gy+2,Z,9,[.5,1,.6]); }
      for(const [ox,oz] of [[.45,-.2],[.5,0],[.45,.2]]){ P(GEO.sph,.14,.14*BL,.14,LP[3],1.5,ox,.75,oz); P(GEO.sph,.06,.06,.06,[0,0,0],0,ox+.06,.76,oz); }
      P(GEO.box,.12,.06+(swing>=0?Math.sin(swing*Math.PI)*.22:0),.5,[.1,.05,.05],0,.58,.55,0); if(swing>=0) P(GEO.box,.1,.04,.44,[.6,.15,.12],.3,.6,.5,0); break; }
    case 'wraith': case 'icewraith': case 'tidewraith': case 'drownedshade': { const ice=mt.key==='icewraith', tide=mt.key==='tidewraith'||mt.key==='drownedshade'; const c1=tide?[.3,.8,.74]:ice?[.6,.82,1]:[.42,.32,.7], c2=tide?[.22,.62,.58]:ice?[.5,.72,.95]:[.35,.25,.6], c3=tide?[.08,.3,.3]:ice?[.25,.4,.6]:[.2,.12,.35];
      mreset(); mtr(X,gy+.5+Math.sin(t*2+m.id)*.15,Z); mry(-(m.rf??m.face??0)); msc(sc*(ice?1.15:mt.key==='drownedshade'?1.25:1)); const al=dead?Math.max(0,.75-dd):.75;
      mrz(-.25*mv+Math.sin(t*1.3+m.id)*.04-(swing>=0?Math.sin(Math.PI*swing)*.35:0)); mrx(Math.sin(t*.9+m.id)*.05);
      for(let k=0;k<7;k++){ const a=k/7*6.283; mpush(); mtr(Math.cos(a)*.28,.3,Math.sin(a)*.28); mry(-a); mrz(.25+mv*.5+Math.sin(t*3+k*1.3)*.18); P(GEO.cone,.12,.55+(k%2)*.2,.05,k%2?c2:c3,.4,0,-.5,0,al*.8); mpop(); }
      if(mv>.2&&Math.random()<.4) P3(X+(Math.random()-.5)*.4,gy+.5+Math.random(),Z+(Math.random()-.5)*.4,0,.2,0,1,.35,tide?'#6affe0':ice?'#bfe8ff':'#8a6acc',{big:true,drag:.97});
      P(GEO.frus,.7,-1.2,.7,c1,.45,0,1.4,0,al); P(GEO.sph,.5,.6,.5,c2,.35,0,1.35,0,al); P(GEO.sph,.36,.4,.36,c3,.3,0,1.85,0,al); P(GEO.sph,.3,.32,.28,[.04,.02,.08],0,.06,1.82,0,al);
      if(ice) for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; P(GEO.cone,.07,.3,.07,[.8,.95,1],1.4,Math.cos(a)*.15-.05,2.05,Math.sin(a)*.15); }
      for(const s of [-1,1]){ P(GEO.sph,.05,.05,.05,tide?[.5,1,.9]:ice?[.7,.95,1]:[.9,.85,1],3,.16,1.86,s*.06); mpush(); mtr(0,1.55,s*.28); mrz(1.0+Math.sin(t*3+s)*.3+(swing>=0?Math.sin(swing*Math.PI)*.9:0)+mv*.3); mrx(-s*.15); P(GEO.limb,.09,.5,.09,c1,.5,0,0,0,al); mtr(0,-.5,0); mrz(.4); P(GEO.limb,.06,.3,.06,c2,.6,0,0,0,al); mtr(0,-.3,0); for(let k=-1;k<=1;k++){ mpush(); mrx(k*.35); mrz(.3); P(GEO.cone,.03,.16,.03,ice?[.85,.95,1]:[.85,.8,1],1.5,0,0,0,.9); mpop(); } mpop(); }
      addLight(X,gy+1.8,Z,4,tide?[.3,1,.85]:ice?[.5,.8,1.2]:[.6,.4,1]); if(Math.random()<.2) burst3(X,gy+.8,Z,tide?'#6affe0':ice?'#bfe8ff':'#a98aff',1,.2,{glow:true}); break; }
    case 'lich': drawLich(m,X,gy,Z,swing,dd,hit,sc); break;
    case 'emberling': { const f=1+Math.sin(t*20+m.id)*.12; const y=gy+.9+Math.sin(t*3+m.id)*.15; mreset(); mtr(X,y,Z); msc(sc*(dead?Math.max(.05,1-dd*1.5):1));
      mrz(-.3*mv); for(let k=0;k<6;k++){ const a=k/6*6.283+t*1.5; P(GEO.cone,.16,.35+Math.sin(t*14+k*2)*.15,.16,k%2?[1,.55,.1]:[1,.8,.3],3,Math.cos(a)*.18,.15,Math.sin(a)*.18); }
      for(let k=0;k<3;k++){ const a=t*3+k*2.09; P(GEO.sph,.08,.08,.08,[1,.7,.25],3.4,Math.cos(a)*.6,.1+Math.sin(t*4+k)*.2,Math.sin(a)*.6); }
      P(GEO.sph,.7*f,.8*f,.7*f,[1,.35,.05],2.4,0,0,0); P(GEO.sph,.5,.6,.5,[1,.65,.15],3,0,.08,0); P(GEO.cone,.4,.6,.4,[1,.8,.3],3,0,.25,0);
      for(const s of [-1,1]) P(GEO.sph,.08,.1,.08,[.15,.03,0],0,.28,.1,s*.12); P(GEO.box,.04,.05+(swing>=0?Math.sin(swing*Math.PI)*.1:0),.16,[.2,.04,0],0,.3,-.06,0);
      addLight(X,y,Z,6,[1.4,.6,.15]); if(Math.random()<.5) burst3(X,y+.3,Z,'#ffb03a',1,.4,{glow:true,up:1.5}); break; }
    case 'wyrm': drawWyrm(m,X,gy,Z,mv,ph,swing,dd,hit,sc); break;
  }
}
function drawWyrm(m,X,gy,Z,mv,ph,swing,dd,hit,sc){ const md=MATD; MATD=2; try{ return drawWyrm0(m,X,gy,Z,mv,ph,swing,dd,hit,sc); } finally{ MATD=md; } }
function drawWyrm0(m,X,gy,Z,mv,ph,swing,dd,hit,sc){
  const t=now(), e=hit?.9:0, col=m.enr?[.85,.22,.1]:[.75,.3,.12], dark=[.3,.1,.05], belly=[1,.6,.2];
  const WB=1+Math.sin(t*1.4)*.025, trk=dd>=0?0:lookYaw(m);
  mreset(); mtr(X,gy,Z); mry(-(m.rf??m.face??0)); msc(sc*1.05); if(dd>=0){ mrx(Math.min(1,dd/.8)*1.3); mtr(0,-Math.min(1.2,dd*.5),0); }
  else { mtr(0,Math.abs(Math.sin(ph*.8))*.12*mv+Math.sin(t*1.4)*.03,0); mrx(Math.sin(ph*.8)*.04*mv); }
  for(const [lx,lz,off] of [[1.1,.8,0],[1.1,-.8,Math.PI],[-1.0,.85,Math.PI],[-1.0,-.85,0]]){ mpush(); mtr(lx,1.6,lz); mrz(Math.sin(ph*.8+off)*.55*mv); P(GEO.limb,.45,.8,.45,col,e); mtr(0,-.8,0); mrz(-.4-Math.max(0,Math.cos(ph*.8+off))*.6*mv); P(GEO.limb,.36,.75,.36,dark,e); mtr(0,-.78,0); P(GEO.box,.5,.16,.42,dark,e,.15,0,0); for(let k=-1;k<=1;k++){ mpush(); mtr(.38,-.02,k*.14); mrz(-Math.PI/2+.3); P(GEO.cone,.07,.22,.07,[.92,.88,.78],0); mpop(); } mpop(); }
  P(GEO.sph,3.4,1.75*WB,2.0*WB,col,e,0,2.15,0);
  P(GEO.sph,2.7,.6,1.3,belly,1.4+Math.sin(t*4)*.5+(m.enr?1:0),0,1.62,0);
  for(let k=0;k<12;k++){ P(GEO.sph,.5,.16,.62,[.55,.2,.08],e,-1.6+k*.3,1.42,0); } for(let k=0;k<7;k++){ P(GEO.cone,.22,.5,.22,dark,e,-1.3+k*.45,2.95-Math.abs(k-3)*.05,0); P(GEO.cone,.08,.18,.08,[1,.55,.15],1.8+Math.sin(t*4+k)*.6+(m.enr?1:0),-1.3+k*.45,3.38-Math.abs(k-3)*.05,0); }
  // tail
  mpush(); mtr(-1.6,2.0,0); for(let k=0;k<16;k++){ mry(Math.sin(t*(2.2+mv*1.5)-k*.4)*(.1+mv*.05)); mrz(-.065+Math.sin(t*1.7-k*.5)*.02); const r=.76-k*.042; P(GEO.sph,.62,r,r,col,e,-.2,0,0); P(GEO.sph,.5,r*.55,r*.8,[.55,.2,.08],e,-.2,-r*.32,0); if(k%2===0) P(GEO.cone,.1,.3-k*.012,.08,dark,e,-.2,r*.42,0); mtr(-.24,0,0); } mpush(); mrz(Math.PI/2); P(GEO.cone,.5,1.1,.1,[.9,.45,.12],1.4,0,0,0); mpop(); for(const s of [-1,1]){ mpush(); mrx(s*1.1); mrz(Math.PI/2+.4); P(GEO.cone,.25,.6,.06,dark,e,0,0,0); mpop(); } mpop();
  // wings
  const flap=(mv>.3?Math.sin(t*4.5)*.5:Math.sin(t*1.5)*.16-.12)+(swing>=0?-Math.sin(swing*Math.PI)*.45:0)+(m.chanT&&t-m.chanT<1.6?-.35:0);
  for(const s of [-1,1]){ mpush(); mtr(.2,2.9,s*.7); mrx(-s*(.12+flap*.55)); P(GEO.wing,2.3,1,2.3*s,[.42,.1,.05],.35,0,0,0); P(GEO.wing,2.0,1,2.0*s,[.75,.25,.08],.6,.1,.02,0); for(const [px,pz,ln] of [[.95,1.15,1.1],[.7,2.1,1.25],[.25,3,1.35],[-.55,1.6,1.1]]){ mpush(); const a=Math.atan2(pz*2.3*s,px*2.3); mry(-a); mrz(Math.PI/2); P(GEO.limb,.07,Math.hypot(px,pz)*2.3*.75,.07,dark,e); mpop(); } mpush(); mtr(.9,0,0); mrx(-s*Math.PI/2); P(GEO.limb,.16,2.6,.16,dark,e); mpop(); mpush(); mrx(-s*Math.PI/2); mry(.5); P(GEO.limb,.1,2.4,.1,dark,e); mpop(); mpop(); }
  // neck & head
  const breath=m.chanT&&now()-m.chanT<1.6; const jaw=swing>=0?Math.sin(swing*Math.PI)*.5:breath?.6:.08;
  mpush(); mtr(1.5,2.5,0); for(let k=0;k<5;k++){ mry(-trk/5+Math.sin(t*1.1-k*.6)*.04); mrz(.22-(swing>=0?Math.sin(Math.PI*swing)*.09:0)+(swing>=0?-Math.sin(swing*Math.PI)*.12:0)); P(GEO.sph,.8,.75-k*.06,.75-k*.06,k%2?col:dark,e,.3,0,0); mtr(.35,0,0); }
  mrz(-1.2); P(GEO.sph,1.1,.7,.8,col,e,.35,0,0); P(GEO.box,.8,.25,.5,col,e,.85,.05,0);
  mpush(); mtr(.4,-.18,0); mrz(-jaw); P(GEO.box,.9,.15,.45,dark,e,.4,0,0); for(let k=0;k<4;k++) for(const s of [-1,1]) P(GEO.cone,.04,.1,.04,[.95,.92,.82],0,.2+k*.18,.08,s*.18); mpop();
  for(const s of [-1,1]){ mpush(); mtr(.05,.3,s*.25); mrz(2.3); mrx(-s*.3); P(GEO.cone,.14,.7,.14,[.2,.08,.04],e); mtr(0,.55,0); mrz(-.6); P(GEO.cone,.08,.45,.08,[.16,.06,.03],e); mpop(); P(GEO.sph,.18,.12,.14,dark,e,.5,.22,s*.2); P(GEO.cone,.05,.16,.05,[.2,.08,.04],e,.7,.2,s*.12); for(let k=0;k<3;k++){ mpush(); mtr(-.1-k*.18,.28-k*.03,s*(.2+k*.06)); mrz(2.5); mrx(-s*.7); P(GEO.cone,.07,.34-k*.06,.07,[.25,.1,.05],e); mpop(); } P(GEO.sph,.12,.08,.1,[1,.95,.5],3,.62,.18,s*.25); }
  if(breath||m.enr){ P(GEO.sph,.25,.2,.25,[1,.6,.1],3,1.25,-.05,0); }
  mpop();
  addLight(X,gy+2,Z,14,m.enr?[1.6,.4,.1]:[1.4,.6,.2]);
  if(Math.random()<.4) burst3(X+(Math.random()-.5)*3,gy+2.5,Z+(Math.random()-.5)*2,'#ff8a2a',1,.3,{glow:true,up:1.2});
  mreset(); mtr(X,gy,Z); mry(-(m.rf??m.face??0)); msc(sc*1.05); for(let k=0;k<10;k++){ const a=k*1.3; P(GEO.box,.5,.05,.07,[1,.45,.1],2+Math.sin(t*3+k)*.8,-1.4+k*.3,2.98+Math.sin(a)*.05,Math.sin(a*2.3)*.5); }
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
function fct(x,y,txt,col,big){ const px=x, py=y+28; texts.push({X:px/TS+(Math.random()-.5)*.5,Y:groundY(px,py)+2.3,Z:py/TS,txt:String(txt),col,t:now(),big,dx:(Math.random()-.5)}); }
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
  else if(v===28){ FXP({k:'wave',x,y,r,col:'#7affc0',dur:.35,h:.5}); for(let i=0;i<16;i++){ const a=i/16*6.283; P3(X,Y+1,Z,Math.cos(a)*R*3.2,.2,Math.sin(a)*R*3.2,.32,.09,'#e8fff4',{glow:true,drag:.93}); } }
  else if(v===29){ for(let i=0;i<26;i++){ const a=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(a)*d,Y+.2+Math.random(),Z+Math.sin(a)*d,Math.cos(a)*.6,.6+Math.random()*.6,Math.sin(a)*.6,1.6,.5,'#5a5468',{big:true,drag:.97}); } }
  else if(v===30){ FXP({k:'portal',x,y,dur:.5,f:0,col:'#2a1a40'}); burst3(X,Y+1,Z,'#3aff9a',14,1.4,{glow:true}); }
  else if(v===18){ fx.push({k:'blizzard',x,y,r,t:now(),dur:2.3}); }
  else if(v===19){ fx.push({k:'phoenix',x,y,r,t:now(),dur:1.0}); burst3(X,Y+.5,Z,'#ff8a2a',70,R*3,{glow:true,up:2}); shake(5); }
  else if(v===20){ FXP({k:'wave',x,y,r,col:'#ffb84a',dur:.6,tall:1.4}); FXP({k:'wave',x,y,r:r*.55,col:'#fff1b0',dur:.45}); ring(x,y,'#ffb84a',r); burst3(X,Y+1,Z,'#ffd36a',40,3,{glow:true,up:1.5}); }
  else if(v===21){ for(let i=0;i<24;i++){ const a=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(a)*d,Y,Z+Math.sin(a)*d,0,1+Math.random(),0,1,.1,'#ffe9a0',{glow:true}); } }
  else if(v===17){ burst3(X,Y+.8,Z,'#d6b3ff',24,3.5,{glow:true}); FXP({k:'portal',x,y,dur:.7}); }
  else if(v===31){ FXP({k:'wave',x,y,r,col:'#ff9a5a',dur:.45,h:.7}); FXP({k:'wave',x,y,r:r*.7,col:'#ffd0a0',dur:.35,h:1.1}); FXP({k:'wave',x,y,r:r*.4,col:'#ff6a3a',dur:.25,h:1.4}); try{ snd('discord',x,y); }catch(e){} }
  else if(v===32){ const S=SONGDEF[Math.round(r-SONG_R)]||SONGDEF[1]; FXP({k:'wave',x,y,r:SONG_R,col:S.col,dur:.8,h:.4}); burst3(X,Y+1.6,Z,S.col,18,1.6,{glow:true,up:1.2}); try{ snd('song',x,y); }catch(e){} }
  else if(v===33){ FXP({k:'wave',x,y,r:r,col:'#ffd36a',dur:.9,h:.5}); burst3(X,Y+2.4,Z,'#ffd36a',30,2.2,{glow:true}); shake(2); try{ snd('horn',x,y); }catch(e){} }
  else if(v===34){ FXP({k:'wave',x,y,r,col:'#ffb84a',dur:.7,tall:1.2}); FXP({k:'dome',x,y,r:1.2,col:'#ffe9a0',dur:.9}); for(let i=0;i<30;i++){ const a=Math.random()*6.283,d=Math.random()*R; P3(X+Math.cos(a)*d,Y,Z+Math.sin(a)*d,0,1.4+Math.random(),0,1,.1,i%2?'#9dffb0':'#ffe9a0',{glow:true}); } try{ snd('horn',x,y); }catch(e){} }
  else if(v===35){ FXP({k:'wave',x,y,r:SONG_R,col:'#fff3b0',dur:.6,tall:1.6}); burst3(X,Y+1.8,Z,'#fff3b0',40,3,{glow:true,up:1.5}); shake(3); try{ snd('horn',x,y,1.2); }catch(e){} }
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
  try{ actSnd(src,a,mine); }catch(e){}
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
  if(!m) return; m.atkT=now(); try{ mobSnd(m,'attack'); }catch(e){} const p=entPos('p',u); m.swingT=now();
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
  if((z==='crypt'||z==='vault')&&rate(6)){ const [X,Y,Z]=rp(14); P3(X,Y+.2,Z,.1,.03,.1,6,1.3,'#5a6a8a',{big:true,drag:1,shrink:false}); }
  if(z==='swamp'&&rate(9)){ const [X,Y,Z]=rp(20); P3(X,Y+.3,Z,.2,.02,.1,7,1.4+Math.random(),'#a6b89a',{big:true,drag:1,shrink:false}); }
  if(z==='ruins'&&rate(5)){ const [X,Y,Z]=rp(18); P3(X,Y+.3,Z,.1,.02,.1,7,1.2,'#9a9ab8',{big:true,drag:1,shrink:false}); }
  if(z==='forest'&&rate(10)){ const [X,Y,Z]=rp(16); P3(X,Y+6,Z,.4+Math.random()*.3,-.7,.2,9,.07,Math.random()<.5?'#d79a3a':'#8fbf4a',{drag:1,shrink:false}); }
  if((z==='meadow'||z==='lake')&&dk<.3&&rate(6)){ const [X,Y,Z]=rp(14); P3(X,Y+.5+Math.random()*2,Z,.3,.05,.1,5,.035,'#ffffff',{glow:true,drag:1,shrink:false}); }
  { for(const c of CHIMNEYS) if(Math.abs(c.x-cx)<45&&Math.abs(c.z-cz)<45&&rate(1.5)) P3(c.x,c.y,c.z,.15+Math.random()*.1,.6+Math.random()*.3,.05,5,.5,'#8a8580',{big:true,drag:.998,shrink:false});
    if(Math.hypot(cx-TOWN.x,cz-TOWN.y)<40&&rate(14)){ const a=Math.random()*6.283; P3(FOUNTAIN.x+Math.cos(a)*.15,2.6,FOUNTAIN.z+Math.sin(a)*.15,Math.cos(a)*.7,1.6,Math.sin(a)*.7,.9,.07,'#cfe8ff',{grav:-6,drag:.99}); } }
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
  if(zn==='vault'){ SKY.sunCol=[.15,.18,.2]; SKY.sky=[.07,.09,.1]; SKY.gnd=[.05,.055,.06]; SKY.zen=[.004,.008,.012]; SKY.fog=[.018,.03,.034]; SKY.hor=SKY.fog; SKY.fogD=.042; SKY.cloud=0; SKY.storm=0; SKY.night=0; }
  SKY.aurora=(zn==='frost'||zn==='crypt')?(1-dayK):0; SKY.hfog=({swamp:.7,lake:.4,forest:.28,frost:.18,crypt:.5,vault:.3}[zn]||.15)+duskK*.25+wet*.3;
  curDark=zn==='vault'?1:1-dayK;
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
  gl.uniform3f(u.uTint,1,1,1); gl.uniform1f(u.uEmis,0); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uTerrain,0); gl.uniform3f(u.uInvS2,1,1,1); if(u.uSpec) gl.uniform1f(u.uSpec,.12); if(u.uFol) gl.uniform1f(u.uFol,0); if(u.uMat) gl.uniform1f(u.uMat,0); }
const LSEL={n:0,p:new Float32Array(64),c:new Float32Array(48)}, DEC={n:0,d:new Float32Array(48),c:new Float32Array(48)};
const IDM=M4.id();
function drawCmd(pr,c){ const u=pr.u; gl.uniformMatrix4fv(u.uM,false,c.m); gl.uniform3fv(u.uInvS2,c.inv); if(u.uTint){ gl.uniform3fv(u.uTint,c.c); gl.uniform1f(u.uEmis,c.e); gl.uniform1f(u.uAlpha,c.a); if(u.uSpec) gl.uniform1f(u.uSpec,c.sp); if(u.uMat) gl.uniform1f(u.uMat,c.mt||0); }
  gl.bindVertexArray(c.g.vao); gl.drawElements(gl.TRIANGLES,c.g.n,gl.UNSIGNED_INT,0); }
function drawStatic(pr,terrain){ const u=pr.u; if(u.uSpec) gl.uniform1f(u.uSpec,.12); if(u.uMat) gl.uniform1f(u.uMat,0); gl.uniformMatrix4fv(u.uM,false,IDM); gl.uniform3f(u.uInvS2,1,1,1);
  if(terrain!==false){ if(u.uTerrain) gl.uniform1f(u.uTerrain,1); drawTerrain(); if(u.uTerrain) gl.uniform1f(u.uTerrain,0); }
  if(u.uFade&&terrain!==true) fadeOn(u,1); gl.bindVertexArray(STATIC.vao); gl.drawElements(gl.TRIANGLES,STATIC.n,gl.UNSIGNED_INT,0); drawStaticChunks(); if(u.uFade) fadeOn(u,0); }
function fadeOn(u,on){ if(on&&me&&!me.dead) gl.uniform4f(u.uFade,me.x/TS,standY(me.x,me.y)+1.1,me.y/TS,1); else gl.uniform4f(u.uFade,0,0,0,0); }
function drawInst(pr,shadow){ if(pr.u.uSpec) gl.uniform1f(pr.u.uSpec,.08); if(pr.u.uMat) gl.uniform1f(pr.u.uMat,0); for(const k of shadow?['broad','pine','snow','rocks']:['broad','pine','snow','rocks','grass','flowers']){ const I=INST[k]; if(!I.count) continue; if(pr.u.uFol) gl.uniform1f(pr.u.uFol,k==='rocks'?2:k==='grass'?3:k==='flowers'?0:1); if(pr.u.uFade) fadeOn(pr.u,!shadow&&(k==='broad'||k==='pine'||k==='snow'));
    if(I.chunks){ const D=GFX.gd; if(pr.u.uGrassD) gl.uniform1f(pr.u.uGrassD,D); for(const c of I.chunks){ const dx=c.cx-CAM.tx, dz=c.cz-CAM.tz; if(dx*dx+dz*dz>(D+9)*(D+9)) continue; gl.bindVertexArray(c.vao); gl.drawElementsInstanced(gl.TRIANGLES,c.n,gl.UNSIGNED_INT,0,c.count); } if(pr.u.uGrassD) gl.uniform1f(pr.u.uGrassD,0); continue; }
    gl.bindVertexArray(I.vao); gl.drawElementsInstanced(gl.TRIANGLES,I.n,gl.UNSIGNED_INT,0,I.count); } }
function updateCamera(dt){
  if(me){ const gy=standY(me.x,me.y)+(me.jumpH||0)+(me.mounted?.75:0); const kx=1-Math.exp(-(dt||.016)*20), ky=1-Math.exp(-(dt||.016)*12); if(Math.hypot(CAM.tx-me.x/TS,CAM.tz-me.y/TS)>8){ CAM.tx=me.x/TS; CAM.tz=me.y/TS; } CAM.tx=lerp(CAM.tx,me.x/TS,kx); CAM.tz=lerp(CAM.tz,me.y/TS,kx); CAM.ty=lerp(CAM.ty,gy+1.55,ky); }
  else { const t=now(); CAM.yaw=-Math.PI/2+Math.sin(t*.05)*.6; CAM.tx=TOWN.x+.5+Math.sin(t*.05)*3; CAM.tz=TOWN.y+5; CAM.ty=2.2; CAM.pitch=.3; CAM.dist=16; }
  const cp=Math.cos(CAM.pitch), sp=Math.sin(CAM.pitch); let d=CAM.dist;
  let ex=CAM.tx-Math.cos(CAM.yaw)*cp*d, ez=CAM.tz-Math.sin(CAM.yaw)*cp*d, ey=CAM.ty+sp*d;
  if(CAM.tz>=OWH){ const n=Math.ceil(d*4); for(let k=2;k<=n;k++){ const f=k/n*d; if(CAM.ty+sp*f>5.5) break; const x=CAM.tx-Math.cos(CAM.yaw)*cp*f, z=CAM.tz-Math.sin(CAM.yaw)*cp*f, tt=tAt(Math.floor(x),Math.floor(z));
    if(tt===T.DWALL||tt===T.VOID||tt===T.COLUMN||(tt===T.DOOR&&doorClosedAt(Math.floor(x),Math.floor(z)))){ d=Math.max(1.1,f-.55); ex=CAM.tx-Math.cos(CAM.yaw)*cp*d; ez=CAM.tz-Math.sin(CAM.yaw)*cp*d; ey=CAM.ty+sp*d; break; } } }
  for(let k=0;k<8;k++){ const gh=hgt(ex,ez)+.45; if(ey>=gh) break; d*=.85; ex=CAM.tx-Math.cos(CAM.yaw)*cp*d; ez=CAM.tz-Math.sin(CAM.yaw)*cp*d; ey=CAM.ty+sp*d; }
  ey=Math.max(ey,hgt(ex,ez)+.45);
  const sh=shakeMag*.04; CAM.ex=ex+(Math.random()-.5)*sh; CAM.ey=ey+(Math.random()-.5)*sh; CAM.ez=ez+(Math.random()-.5)*sh;
}
function toScreen(X,Y,Z){ const v=VP; const x=v[0]*X+v[4]*Y+v[8]*Z+v[12], y=v[1]*X+v[5]*Y+v[9]*Z+v[13], w=v[3]*X+v[7]*Y+v[11]*Z+v[15]; if(w<.2) return null; return [(x/w*.5+.5)*W,(.5-y/w*.5)*H,w]; }
function smoothY(st,y,dt){ if(st._ys==null||Math.abs(y-st._ys)>2.5||!(dt>0)) st._ys=y; else st._ys+=(y-st._ys)*(1-Math.exp(-dt*11)); return st._ys; }
function animState(o,dt,x,y,moving,scale){ const ox=o._ax??x, oy=o._ay??y; const dm=Math.hypot(x-ox,y-oy); o._ax=x; o._ay=y; o.walkP=(o.walkP||0)+dm/TS*3.6/(scale||1);
  { const tg=(moving||dm>.3)?1:0; o.mvS=lerp(o.mvS||0,tg,Math.min(1,dt*(tg?9:7))); }
  const kk=Math.min(1,dt*6), sp=dt>0?Math.min(30,dm/TS/dt):0; o.spdS=lerp(o.spdS||0,sp,kk);
  if(dm>.25){ const hd=Math.atan2(y-oy,x-ox); if(o._hd!=null){ let d=hd-o._hd; d=Math.atan2(Math.sin(d),Math.cos(d)); o.bankS=lerp(o.bankS||0,clamp(d/Math.max(dt,.008)*.05,-.28,.28),kk); } o._hd=hd; } else o.bankS=lerp(o.bankS||0,0,kk); }
const STKb=o=>{ const g=o.swing??-1; return g>=0?Math.sin(Math.PI*clamp((g-.25)/.55,0,1)):0; };
const eO=x=>1-(1-x)*(1-x), eI=x=>x*x*x, eIO=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
/* three melee swings that alternate (overhead chop, horizontal sweep, rising cut) and quick alternating dagger thrusts.
   returns [shoulder, elbow, spread] for the arm, or null to leave the arm alone */
function swingPose(u,v,s,L){ const dag=L.weapon==='dagger'||L.weapon==='nightfang';
  if(dag){ if((s>0)===(v%2===1)) return null;
    if(u<.3){ const k=eO(u/.3); return [lerp(.5,.3,k),lerp(1,1.65,k),lerp(.25,.36,k)]; } if(u<.5){ const k=eI((u-.3)/.2); return [lerp(.3,1.55,k),lerp(1.65,.05,k),lerp(.36,.04,k)]; }
    const k=eIO((u-.5)/.5); return [lerp(1.55,.6,k),lerp(.05,1.2,k),lerp(.04,.28,k)]; }
  if(s<0) return null;
  if(v===1){ if(u<.3){ const k=eO(u/.3); return [lerp(.4,1.45,k),lerp(.3,.9,k),lerp(.15,1.25,k)]; } if(u<.52){ const k=eI((u-.3)/.22); return [1.45,lerp(.9,.18,k),lerp(1.25,-.75,k)]; }
    const k=eIO((u-.52)/.48); return [lerp(1.45,.4,k),lerp(.18,.3,k),lerp(-.75,.15,k)]; }
  if(v===2){ if(u<.28){ const k=eO(u/.28); return [lerp(.4,-.4,k),lerp(.3,.65,k),.2]; } if(u<.5){ const k=eI((u-.28)/.22); return [lerp(-.4,2.45,k),lerp(.65,.12,k),.2]; }
    const k=eIO((u-.5)/.5); return [lerp(2.45,.4,k),lerp(.12,.3,k),lerp(.2,.15,k)]; }
  if(u<.32){ const k=eO(u/.32); return [lerp(.4,2.8,k),lerp(.3,1.2,k),lerp(.15,.3,k)]; } if(u<.52){ const k=eI((u-.32)/.2); return [lerp(2.8,-.15,k),lerp(1.2,.08,k),lerp(.3,.1,k)]; }
  const k=eIO((u-.52)/.48); return [lerp(-.15,.4,k),lerp(.08,.3,k),lerp(.1,.15,k)]; }
function smoothFace(o,target){ const t=now(), dt=Math.min(.1,Math.max(0,t-(o._rft||t))); o._rft=t; if(o.rf==null||!isFinite(o.rf)) o.rf=target;
  const d=Math.atan2(Math.sin(target-o.rf),Math.cos(target-o.rf)); o.rf+=d*(Math.abs(d)>2.6?1:1-Math.pow(.00004,dt)); return o.rf; }
function lookYaw(m){ let d=0; if(m.tgt&&!m.dead){ const tp=m.tgt===MY_U?me:othersByU.get(m.tgt); if(tp){ const tx=tp===me?me.x:tp.rx, ty=tp===me?me.y:tp.ry; d=Math.atan2(ty-m.ry,tx-m.rx)-(m.face||0); d=clamp(Math.atan2(Math.sin(d),Math.cos(d)),-.8,.8); } } m._lk=lerp(m._lk||0,d,.12); return m._lk; }
function npcLook(n){ let d=0; if(me&&!me.dead&&dist(n.x,n.y,me.x,me.y)<150){ d=Math.atan2(me.y-n.y,me.x-n.x)-(n.face??Math.PI/2); d=clamp(Math.atan2(Math.sin(d),Math.cos(d)),-1,1); } n._lk=lerp(n._lk||0,d,.06); return n._lk; }
LOOK.keepere=LOOK.keeperw;
LOOK.bard={torso:[.5,.29,.15],legs:[.28,.2,.14],arms:[.46,.27,.15],boots:[.22,.14,.09],gloves:[.3,.2,.12],cape:[.62,.13,.1],trim:[.92,.72,.32],head:'bardcap',hat:[.55,.12,.1],feather:[1,.86,.42],hair:[.36,.2,.1],weapon:'axe',horn:true,straps:true,strapC:[.24,.15,.08]};
LOOK.assassin={lean:true,torso:[.17,.16,.19],legs:[.12,.11,.13],arms:[.19,.18,.21],boots:[.1,.09,.1],cape:[.09,.08,.11],trim:[.28,.78,.52],head:'rogue',hood:[.11,.1,.13],mask:[.07,.07,.09],weapon:'dagger',off:'dagger',straps:true,strapC:[.2,.13,.08],gloves:[.09,.09,.11],gearX:true,gem:[.3,1,.6]};
Object.assign(LOOK.mender,{torso:[.95,.94,.9],robe:[.95,.94,.9],arms:[.95,.94,.9],legs:[.82,.84,.92],boots:[.85,.72,.42],cape:[.14,.2,.48],trim:[.98,.82,.4],head:'hood',hood:[.97,.95,.9],halo:true,stars:true,stole:true,stoleC:[.16,.24,.55]});
LOOK.warden.spikes=true; LOOK.warden.tassets=true; LOOK.warden.det='w'; LOOK.warden.crest=[.15,.3,.75]; LOOK.mender.det='m'; LOOK.arcanist.det='a'; LOOK.arcanist.weapon='crystal'; if(LOOK.frostgiant) LOOK.frostgiant.iceSpikes=true;
LOOK.vsentry={torso:[.26,.32,.33],legs:[.2,.24,.25],arms:[.3,.36,.37],boots:[.18,.2,.21],gloves:[.36,.42,.42],metal:[.44,.53,.52],pauld:[.42,.5,.49],trim:[.28,.72,.66],head:'helm',crest:[.2,.9,.8],weapon:'sword',off:'shield',tabard:[.08,.28,.3],cape:[.06,.2,.22],spikes:true,tassets:true,scale:1.12};
LOOK.dacolyte={robe:[.09,.22,.24],torso:[.09,.22,.24],arms:[.11,.26,.28],legs:[.07,.16,.18],boots:[.08,.1,.1],trim:[.4,.85,.75],head:'skullhood',hood:[.05,.15,.17],skin:[.5,.66,.62],eyes:[.3,1,.85],weapon:'staff',orb:[.3,1,.85],cape:[.05,.15,.17]};
LOOK.ossric={metal:[.46,.52,.5],pauld:[.44,.5,.48],trim:[.78,.64,.3],torso:[.24,.26,.27],legs:[.2,.21,.22],arms:[.26,.28,.29],boots:[.2,.21,.22],gloves:[.42,.46,.45],head:'helm',crest:[.25,1,.85],tabard:[.08,.3,.32],cape:[.06,.22,.24],weapon:'greatsword',spikes:true,tassets:true,rune:[.3,1,.85],aura:'#4affd8',scale:1.8};
LOOK.vaelith={robe:[.07,.22,.24],torso:[.1,.27,.28],arms:[.09,.24,.25],legs:[.06,.17,.18],boots:[.16,.2,.2],gloves:[.32,.46,.44],metal:[.34,.5,.48],pauld:[.38,.55,.52],trim:[.86,.7,.32],skin:[.64,.76,.74],eyes:[.35,1,.88],head:'drowned',hair:[.05,.13,.12],cape:[.04,.17,.19],tabard:[.06,.3,.3],weapon:'trident',tassets:true,spikes:true,rune:[.3,1,.85],aura:'#4affd8',scale:1.9};
LOOK.selis={torso:[.16,.3,.32],legs:[.2,.18,.15],arms:[.16,.3,.32],boots:[.24,.16,.1],cape:[.1,.22,.24],trim:[.7,.6,.35],head:'hoodopen',hood:[.12,.26,.28],weapon:'lantern',pack:true};
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
    const capeC=tc.map(v=>v*.7), steel=metal.map(v=>v*.92);
    switch(A.b){
      case 'Breastplate': Object.assign(L,clear,{torso:steel,arms:steel,legs:metal.map(v=>v*.62),metal,pauld:metal,tabard:cloth,tassets:true,gloves:metal.map(v=>v*.85),boots:metal.map(v=>v*.7),head:'helm',spikes:true,fur:A.r>=1}); break;
      case 'Warplate':    Object.assign(L,clear,{torso:metal.map(v=>v*.7),arms:metal.map(v=>v*.7),legs:metal.map(v=>v*.5),metal:metal.map(v=>v*.78),pauld:metal.map(v=>v*.82),tabard:dark,tassets:true,spikes:true,fur:true,gloves:metal.map(v=>v*.65),boots:metal.map(v=>v*.6),head:'helm'}); break;
      case 'Hauberk':     Object.assign(L,clear,{torso:steel,arms:steel,legs:dark,metal,pauld:metal,tabard:cloth,chain:true,tassets:true,gloves:metal.map(v=>v*.8),boots:metal.map(v=>v*.66),head:'helm',spikes:true}); break;
      case 'Jerkin':      Object.assign(L,clear,{torso:leather,arms:leather.map(v=>v*.9),legs:[.26,.2,.14],boots:[.2,.13,.08],gloves:[.16,.11,.07],pauld:leather.map(v=>v*.72),straps:true,strapC:[.18,.12,.07],cape:L.cape||[.1,.09,.12]}); break;
      case 'Brigandine':  Object.assign(L,clear,{torso:leather.map(v=>v*.7),arms:leather.map(v=>v*.66),legs:[.2,.17,.15],boots:[.16,.12,.09],gloves:[.12,.1,.08],pauld:leather.map(v=>v*.55),straps:true,strapC:[.38,.3,.2],tassets:true,cape:dark}); break;
      case 'Hide Tunic':  Object.assign(L,clear,{torso:[.4,.33,.25],arms:[.36,.3,.23],legs:[.22,.18,.13],boots:[.26,.18,.1],gloves:[.2,.15,.1],pauld:[.45,.38,.28],fur:true,straps:true,strapC:[.2,.14,.08],cape:[.24,.2,.15]}); break;
      case 'Robes':       Object.assign(L,clear,{torso:cloth,arms:cloth,legs:dark,robe:cloth,boots:[.3,.22,.14],cape:capeC}); break;
      case 'Vestments':   Object.assign(L,clear,{torso:[.93,.91,.85],arms:[.93,.91,.85],legs:dark,robe:[.93,.91,.85],stole:true,stoleC:cloth,boots:[.4,.3,.2],cape:capeC}); break;
      case 'Mantle':      Object.assign(L,clear,{torso:cloth,arms:cloth,legs:dark,robe:cloth,mantle:dark.map(v=>Math.min(1,v*1.4)),cape:dark,boots:[.25,.18,.12]}); break; }
    { const at=Object.keys(ARMT).find(k=>ARMT[k].includes(A.b)); if(at==='cloth'){ L.head=cls==='arcanist'?'hat':'hood'; if(cls==='mender'){ L.halo=true; L.stars=true; } }
      else if(at==='leather'&&cls==='assassin') L.head='rogue'; else if(cls==='bard') L.head='bardcap'; else if(at==='plate'&&cls==='warden') L.head='helm'; }
    L.trim=trim; L.hood=cloth.map(v=>v*.9); if(L.head==='hat') L.hat=dark; if(L.head==='helm'&&!L.metal) L.metal=metal;
    if(A.r>=2&&!L.cape) L.cape=tc.map(v=>v*.7); if(A.r>=2) L.gem=GEAR_GLOW[A.th]||cc; L.crest=GEAR_GLOW[A.th]||cc.map(v=>v*.85);
    if(A.r>=3){ L.rune=GEAR_GLOW[A.th]||cc; L.spikes=!!L.pauld; const rg=L.rune; L.aura='#'+rg.map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).join(''); }  if(L.metal) METALS.add(L.metal); if(L.pauld&&L.metal) METALS.add(L.pauld); if(L.gloves&&L.metal) METALS.add(L.gloves); }
  if(W){ const map={Longsword:'sword',Warstaff:'staff',Spellblade:'spellblade',Morningstar:'morningstar',Wand:'wand',Greataxe:'greataxe',Daggers:'dagger',Dirks:'dagger','Hand Axe':'axe',Warspear:'spear',Lbard:'axe',Lwarden:'dawnwarden',Lmender:'solace',Larcanist:'cinderheart',Lassassin:'nightfang'};
    L.weapon=map[W.b]||L.weapon; L.wcol=GEAR_METAL[W.r]; L.wglow=GEAR_GLOW[W.th]||(W.r>=2?RAR_GLOW[W.r]:null); L.wup=W.up;
    if(['greataxe','staff','solace'].includes(L.weapon)&&L.off) L.off=null; else if(L.weapon==='nightfang') L.off='nightfang'; else if(L.weapon==='dagger') L.off='dagger';
    else if(cls==='warden'&&!L.off&&['sword','spellblade','morningstar','dawnwarden'].includes(L.weapon)) L.off='shield';
    if(L.orbs&&L.weapon!=='wand'&&L.weapon!=='cinderheart') L.orbs=L.weapon==='spellblade'; }
  if(cls==='bard'){ L.off=null; L.horn=true; }
  if(T) L.trink={k:T.b,c:GEAR_GLOW[T.th]||RAR_GLOW[T.r],r:T.r};
  L.gearX=!!(L.straps||L.chain||L.mantle||L.stole||L.trink);
  return LOOKV[key]=L; }
/* extra clothing and trinkets, drawn in the torso's frame (x = forward, y = up from the hips) */
function gearExtras(L,o,t,e){
  if(L.straps){ for(const s of [-1,1]){ mpush(); mtr(.2,.36,0); mrx(s*.6); P(GEO.box,.03,.66,.07,L.strapC,e); mpop(); } P(GEO.sph,.045,.06,.06,L.trim,e+.2,.215,.36,0); for(const s of [-1,1]) P(GEO.box,.14,.12,.06,L.strapC.map(v=>v*1.3),e,.1,.06,s*.22); }
  if(L.horn){ const iv=[.93,.87,.72], gd=L.trim||[.92,.72,.32]; mpush(); mtr(.0,.02,-.31); mrx(.12); mrz(-1.15);
    P(GEO.cone,.075,.36,.075,iv,e,0,.02,0); P(GEO.cyl,.085,.025,.085,gd,e+.3,0,-.15,0); P(GEO.cyl,.06,.02,.06,gd,e+.3,0,.05,0); P(GEO.cyl,.082,.05,.082,[.12,.08,.05],e,0,-.17,0); mpop();
    mpush(); mtr(.02,.1,-.29); mrx(-.2); P(GEO.box,.02,.2,.025,L.strapC||[.24,.15,.08],e); mpop(); }
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
function drawGearWeapon(w,L,o,t){ const md=MATD; MATD=0; try{ return drawGearWeapon0(w,L,o,t); } finally{ MATD=md; } }
function drawGearWeapon0(w,L,o,t){ const c=L.wcol||[.75,.78,.84], gl=L.wglow, ge=gl?1.3+(L.wup||0)*.12:0, gHex=gl?'#'+gl.map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).join(''):'#ffffff', swinging=(o.swing??-1)>=0;
  switch(w){
    case 'dagger': case 'nightfang': { const nf=w==='nightfang', c2=nf?[.16,.2,.22]:(L.wcol||[.8,.84,.9]), g2=nf?[.3,1,.6]:gl;
      P(GEO.cyl,.04,.18,.04,nf?[.1,.12,.12]:[.16,.12,.1],0,0,-.08,0); P(GEO.sph,.045,.045,.045,L.trim||[.6,.5,.3],.2,0,-.1,0); P(GEO.box,.05,.04,.17,L.trim||[.6,.5,.3],.25,0,.1,0);
      mpush(); mtr(.12,.04,0); mrz(Math.PI/2); P(GEO.box,.42,.055,.018,c2,.3,.29,.12,0); mpush(); mtr(.5,.12,0); mrz(-Math.PI/2); P(GEO.cone,.055,.14,.018,c2,.3); mpop();
      if(g2){ P(GEO.box,.38,.012,.022,g2,(nf?2.6:ge+.8),.28,.12,0); if(nf&&Math.random()<.25) emitTip('#5affa8',.2+Math.random()*.3,.12,0); if(nf) addLight(o.x,o.y+1.1,o.z,3,[.3,1,.55]); } mpop();
      return true; }
    case 'spellblade': P(GEO.cyl,.045,.22,.045,[.22,.14,.3],0,0,-.1,0); for(const s of [-1,1]){ mpush(); mtr(0,.1,s*.06); mrx(s*1.9); P(GEO.cone,.04,.16,.03,L.trim||c,.25); mpop(); } P(GEO.sph,.05,.05,.05,gl||[.7,.5,1],2.2,0,.1,0);
      mpush(); mtr(.12,.04,0); mrz(Math.PI/2); P(GEO.box,.8,.07,.024,c,.2,.48,.12,0); P(GEO.box,.68,.016,.03,gl||[.75,.55,1],2+ge,.44,.12,0); P(GEO.cone,.05,.16,.024,c,.2,.92,.12,0);
      if(swinging||Math.random()<.2) emitTip(gHex,.3+Math.random()*.6,.12,0); mpop(); return true;
    case 'morningstar': P(GEO.cyl,.05,.72,.05,[.32,.22,.13],0,0,-.2,0); P(GEO.cyl,.065,.06,.065,L.trim||c,.2,0,-.22,0); P(GEO.cyl,.06,.14,.06,c,.1,0,.36,0);
      P(GEO.sph,.26,.26,.26,c,ge*.5,0,.62,0); for(let k=0;k<10;k++){ const a=k*2.4, b=Math.acos(1-2*(k+.5)/10); mpush(); mtr(0,.62,0); mry(a); mrz(b); P(GEO.cone,.06,.18,.06,c,.15,0,.1,0); mpop(); }
      if(gl) addLight(o.x,o.y+1.6,o.z,3,gl); return true;
    case 'greataxe': P(GEO.cyl,.055,1.65,.055,[.3,.2,.12],0,0,-.55,0); for(let k=0;k<4;k++) P(GEO.cyl,.065,.035,.065,[.2,.13,.08],0,0,-.4+k*.12,0);
      for(const s of [-1,1]){ mpush(); mtr(s*.2,.82,0); P(GEO.sph,.42,.52,.035,c,ge*.4); P(GEO.sph,.36,.46,.04,c.map(v=>v*.75),0,-s*.04,0,0); if(gl) P(GEO.sph,.04,.46,.04,gl,ge,s*.2,0,0); mpop(); } P(GEO.cone,.06,.22,.06,c,.15,0,1.05,0);
      if(swinging) for(let k=0;k<3;k++) emitTip(gHex,.2,.8+k*.1,0); return true;
    case 'dawnwarden': { const gd=[1,.84,.42]; P(GEO.cyl,.055,.3,.055,[.35,.2,.1],0,0,-.16,0); P(GEO.sph,.07,.07,.07,gd,1.2,0,-.18,0);
      mpush(); mtr(0,.12,0); mrz(-Math.PI/2); P(GEO.cyl,.26,.04,.26,gd,1); P(GEO.cyl,.14,.05,.14,[1,.95,.7],3,0,-.005,0); mpop(); for(let k=0;k<8;k++){ const a=k/8*6.283+t*.6; P(GEO.box,.02,.06,.03,gd,2.2,.02,.12+Math.cos(a)*.2,Math.sin(a)*.2); }
      mpush(); mtr(.12,.04,0); mrz(Math.PI/2); P(GEO.box,1.25,.11,.035,[1,.97,.88],1.1,.72,.12,0); P(GEO.box,1.1,.03,.04,[1,.82,.35],3,.66,.12,0); P(GEO.cone,.08,.2,.035,[1,.97,.88],1.1,1.37,.12,0);
      addLight(o.x,o.y+1.3,o.z,6,[1.4,1.1,.5]); if(Math.random()<.4) emitTip(Math.random()<.5?'#ffe28a':'#fff6d0',.3+Math.random()*1,.12,0); mpop(); return true; }
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
  for(const n of NPCS){ if(!near(n.x,n.y,70)) continue; drawHumanoid({x:n.x/TS,y:groundY(n.x,n.y),z:n.y/TS,face:n.face??Math.PI/2,emote:n.emote,mv:0,walk:0,dead:-1,look:npcLook(n),L:LOOK[n.id]||LOOK.oriel,skin:SKIN[n.id==='mira'?1:2]}); }
  drawExtras(near,t);
  for(const m of mobs){ try{
    if(m.dead){ if(m.deathT&&t-m.deathT<1.6&&near(m.dx,m.dy,70)) drawMob3(m,true); continue; }
    animState(m,dt,m.rx,m.ry,false,m.t.boss?2:1);
    if(!near(m.rx,m.ry,m.t.boss?70:55)) continue; drawMob3(m,false); }catch(e){ HALPHA=1; frameErr(e,'mob '+m.t.key); continue; }
    if(m.t.light&&!LOOK[m.t.key]&&m.t.key!=='wyrm'&&m.t.key!=='emberling'&&m.t.key!=='moth'&&m.t.key!=='wraith') addLight(m.rx/TS,groundY(m.rx,m.ry)+1.4,m.ry/TS,5,C3(m.t.light)); }
  const drawP=(o,isMe)=>{ const x=isMe?me.x:o.rx, y=isMe?me.y:o.ry; const cls=isMe?me.c.cls:o.c, u=isMe?MY_U:o.u; const dead=isMe?me.dead:o.d;
    const st=isMe?me:o; animState(st,dt,x,y,isMe?me.moving:o.moving);
    if(dead&&!st.deadAt) st.deadAt=t; if(!dead) st.deadAt=0;
    if(st.swingT!==st._swT0){ st._swT0=st.swingT; st.swingN=(st.swingN||0)+1; } const castF=isMe?!!me.cast:!!(o.b&4); if(castF) st._wasCast=1; else if(st._wasCast){ st._wasCast=0; st.relT=t; }
    const sw=(t-(st.swingT||0))/.5; const spin=st.spinT&&t-st.spinT<.5; const castCol=C3(CLS[cls].col);
    const mt=dead?0:((isMe?me.mounted:o.mt)||0); const swim=!mt&&!onDock(x,y)&&deepWaterAt(x,y);
    const Y0=smoothY(st,standY(x,y),dt)+(isMe?(me.jumpH||0):0), face=smoothFace(st,isMe?me.face:o.f), emo=isMe?me.emote:o.emote;
    const SMv=mt?steedMotion(st.walkP||0,st.mvS||0,!!(MOUNTS[mt]&&MOUNTS[mt].celestial)):null;
    if(mt) drawHorse({x:x/TS,y:Y0,z:y/TS,face,mv:st.mvS||0,walk:st.walkP||0,m:mt,an:st});
    HALPHA=(isMe?me.stealth:o.sl)?(isMe?.4:.22):1;
    drawHumanoid({x:x/TS,y:Y0,z:y/TS,face:face+(spin?(t-st.spinT)*26:0),mv:mt?0:(st.mvS||0),walk:st.walkP||0,swing:sw>=0&&sw<1?sw:-1,lift:mt?.72+SMv.y:(swim?.3*(st.mvS||0):0),pitch:mt?SMv.p:(swim?-1.08*(st.mvS||0):0),rmv:mt?(st.mvS||0):0,ride:!!mt,swim,emote:emo,an:st,swv:(st.swingN||0)%3,rel:(t-(st.relT||-9))/.38,rdy:isMe?(t-me.lastCombat<4?1:0):(t-(o.swingT||0)<4?1:0),stl:isMe?!!me.stealth:!!o.sl,air:isMe?(me.jumpH||0)>.08:0,
      cast:isMe?!!me.cast:!!(o.b&4),castCol,dead:dead?t-st.deadAt:-1,L:playerLook(cls,u,isMe?myGearVis():o.gv),skin:SKIN[hashU(u)%SKIN.length],hair:HAIR[hashU(u)%HAIR.length],big:(isMe?me.avatarU>t:(o.b&64))?1.25:1,wr:isMe?(me.c.eq.weapon?me.c.eq.weapon.rar:0):(o.wr||0)});
    HALPHA=1;
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
  for(const o of others.values()) if(seenO(o)&&near(o.rx,o.ry,60)) try{ drawP(o,false); }catch(e){ HALPHA=1; frameErr(e,'player'); }
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
  if(me){ const te=targetEnt(); if(te){ const col=te.kind==='m'||te.hostile?'#ff3b30':te.kind==='n'?'#ffd34a':'#4cff63', cc=C3(col), R=te.kind==='m'?(te.e.t.r/TS*(te.e.t.boss?2.2:1.4)+.45):.75, pu=1+Math.sin(t*5)*.06;
    D.push([te.x/TS,te.y/TS,R*pu,-1,...cc,1]); D.push([te.x/TS,te.y/TS,R*pu*.86,-1,...cc,.9]); D.push([te.x/TS,te.y/TS,R*1.16,-1,...cc,.45]);
    const X=te.x/TS, Z=te.y/TS, Y=groundY(te.x,te.y)+.06; mreset(); mtr(X,Y,Z); mry(t*.9);
    for(let k=0;k<12;k++){ const a=k/12*6.283; mpush(); mry(-a); P(GEO.box,.07,.05,.3,cc,2.6,R*1.02,0,0); mpop(); }
    mreset(); mtr(X,Y,Z); mry(-t*.6); for(let k=0;k<4;k++){ const a=k/4*6.283, rr=R*1.32+Math.sin(t*5)*.08; mpush(); mry(-a); mtr(rr,0,0); mrz(Math.PI/2); P(GEO.cone,.16,.32,.07,cc,3,0,0,0); mpop(); }
    addLight(X,Y+.6,Z,R*2.2,cc.map(v=>v*1.4)); } }
  if(me&&inArena(me.x,me.y)) for(const [sx,sz] of AR.shr) D.push([sx,sz,5.2,-1,.5,1,.55,.45+Math.sin(t*2)*.1]);
  /* songs: a faint ring shows each song's reach, notes rise around the singer; war banners stand where they were planted */
  { const sing=[], bans=[]; if(me&&me.song&&!me.dead) sing.push([me.x,me.y,me.song,me.encoreU>t]); if(me&&me.banner&&me.banner.until>t) bans.push(me.banner);
    for(const o of others.values()){ if(!seenO(o)||Math.hypot(o.rx/TS-CAM.tx,o.ry/TS-CAM.tz)>50) continue; if(o.sg&&!o.d) sing.push([o.rx,o.ry,o.sg[0],o.sg[1]>1.9]); if(o.bn&&o.bn.until>t) bans.push(o.bn); }
    for(const [x,y,sg,enc] of sing){ const S=SONGDEF[sg]; if(!S) continue; const cc=C3(S.col); D.push([x/TS,y/TS,SONG_R/TS,-1,...cc,enc?.4:.2+Math.sin(t*2.2)*.05]);
      if(Math.random()<(enc?.8:.4)){ const a=Math.random()*6.283, rr=(.3+Math.random()*.7)*TS; const [X,Y,Z]=ph3(x+Math.cos(a)*rr,y+Math.sin(a)*rr,1.5+Math.random()*.7); P3(X,Y,Z,Math.cos(a)*.15,.6+Math.random()*.5,Math.sin(a)*.15,1.6,.1,S.col,{glow:true,drag:.97}); } }
    for(const b of bans){ const S=SONGDEF[b.song]||SONGDEF[1], cc=C3(S.col), X=b.x/TS, Z=b.y/TS, gy=groundY(b.x,b.y), left=b.until-t; D.push([X,Z,SONG_R/TS,-1,...cc,.32+Math.sin(t*3)*.06]);
      mreset(); mtr(X,gy,Z); P(GEO.box,.09,2.7,.09,[.3,.2,.11],0,0,1.35,0); P(GEO.box,.5,.06,.06,[.3,.2,.11],0,.24,2.55,0); P(GEO.sph,.09,.09,.09,[1,.85,.4],2.4,0,2.75,0);
      mpush(); mtr(.25,2.15,0); mrz(Math.sin(t*2.4)*.04); mry(Math.sin(t*1.7)*.18); P(GEO.box,.5,.8,.03,[.72,.14,.08],.15,.25,0,0); P(GEO.box,.5,.06,.035,[.95,.75,.3],.4,.25,.39,0); P(GEO.sph,.1,.1,.03,cc,1.8,.25,.02,.02); mpop();
      P(GEO.cyl,.35,.08,.35,[.32,.3,.28],0,0,.04,0); addLight(X,gy+2.6,Z,7,cc.map(v=>v*1.3)); if(Math.random()<.35){ const [PX,PY,PZ]=ph3(b.x+(Math.random()-.5)*60,b.y+(Math.random()-.5)*60,.3); P3(PX,PY,PZ,0,1.2,0,1.6,.1,S.col,{glow:true}); } if(left<2&&Math.random()<.3) burst3(X,gy+2.2,Z,S.col,2,.6,{glow:true}); } }
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
  float l2=dot(c,vec3(.299,.587,.114)); c=mix(c,c*vec3(1.035,1.0,.95),smoothstep(.45,.95,l2)*.6); c=mix(c,c*vec3(.95,.99,1.06),smoothstep(.35,.0,l2)*.6);
  c=c/(1.+max(c-.92,0.)*1.6);
  vec2 d=vUV-.5; c*=1.-dot(d,d)*.35; c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.; o=vec4(c,1.); }`;
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
  const z=me?zoneAtPx(me.x,me.y):'town'; const tint=z==='frost'?[.96,1,1.06]:z==='ash'?[1.06,.98,.92]:z==='vault'?[.92,1,1.04]:z==='crypt'?[.94,.97,1.08]:z==='swamp'?[.97,1.02,.96]:[1.02,1,.97];
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
  setFrameUniforms(PLI,false); drawInst(PLI,false); if(PLI.u.uFol) gl.uniform1f(PLI.u.uFol,0); if(PLI.u.uFade) fadeOn(PLI.u,0);
  // liquids
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.useProgram(PQ.p); const q=PQ.u; gl.uniformMatrix4fv(q.uVP,false,VP); gl.uniform1f(q.uTime,t); gl.uniform2f(q.uMap,HN/HR,HNZ/HR); gl.uniform3f(q.uCam,CAM.ex,CAM.ey,CAM.ez);
  gl.uniform3fv(q.uSunDir,SKY.dir); gl.uniform3fv(q.uSunCol,SKY.sunCol); gl.uniform3fv(q.uSky,SKY.sky); gl.uniform3fv(q.uFog,SKY.fog); gl.uniform1f(q.uFogD,SKY.fogD);
  gl.uniform1i(q.uNL,LSEL.n); gl.uniform4fv(q.uLP,LSEL.p); gl.uniform3fv(q.uLC,LSEL.c);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,HTEX); gl.uniform1i(q.uHeight,1);
  gl.uniform3fv(q.uZen,SKY.zen); gl.uniform3fv(q.uHor,SKY.hor); gl.uniform3fv(q.uRealSun,SKY.realSun); gl.uniform1f(q.uCloud,SKY.cloud||.45); gl.uniform1f(q.uNight,SKY.night||0); gl.uniform4f(q.uFC,0,0,0,0);
  gl.uniform1f(q.uMode,0); gl.uniform1f(q.uLevel,WATER_Y); gl.bindVertexArray(PLANE.vao); gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0);
  if(Math.hypot(CAM.tx-FOUNTAIN.x,CAM.tz-FOUNTAIN.z)<70){ gl.uniform1f(q.uMode,2);
    gl.uniform4f(q.uFC,FOUNTAIN.x,FOUNTAIN.z,1.27,.3); gl.uniform1f(q.uLevel,1.118); gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0);
    gl.uniform4f(q.uFC,FOUNTAIN.x,FOUNTAIN.z,.46,0); gl.uniform1f(q.uLevel,2.19); gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0); }
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
    if(mark){ const big=mark==='!'||mark==='?'; const s2=toScreen(n.x/TS,Y+1,n.y/TS); const fs=big?clamp(s2?(s[1]-s2[1])*1.5:60,46,150):30; g.save(); g.globalAlpha=a; g.font=`900 ${Math.round(fs)}px Cinzel,serif`; g.textAlign='center'; g.shadowColor=mark==='$'?'#9fe07a':'#ffd34a'; g.shadowBlur=big?22:16; g.lineWidth=big?Math.max(4,fs*.09):4; g.strokeStyle='#000'; const yy=s[1]-(big?30+fs*.18:40)+Math.sin(t*3)*(big?6:4); g.strokeText(mark,s[0],yy); g.fillStyle=mark==='$'?'#9fe07a':'#ffd34a'; g.fillText(mark,s[0],yy); g.restore(); }
    plate(s[0],s[1],n.name,'#ffe680',1,false,'<'+n.title+'>',false,a); if(n.bubbleT>t) bubble(s[0],s[1]-24,n.bubble); }}); }
  for(const m of mobs){ if(m.dead) continue; const X=m.rx/TS, Z=m.ry/TS; if(Math.hypot(X-CAM.tx,Z-CAM.tz)>(m.t.boss?40:24)&&!(me&&me.target&&me.target.id===m.id)) continue; const s=toScreen(X,groundY(m.rx,m.ry)+(MOBH[m.t.key]||1.6)*(m.t.key==='hking'?1:1),Z); if(!s) continue;
    items.push({w:s[2],d:()=>{ const mt=m.t; const a=clamp(1.6-s[2]/24,0,1); const te=me&&me.target&&me.target.kind==='m'&&me.target.id===m.id; const diff=me?m.lv-me.c.lvl:0;
      const tagged=m.tag&&m.tag!==MY_U&&!(me&&me.party&&othersByU.get(m.tag)&&othersByU.get(m.tag).pt===me.party);
      plate(s[0],s[1],mt.name,tagged?'#a0a0a0':m.tgt===MY_U?'#ff6a5a':mt.boss||mt.elite?'#ffd34a':diff>=3?'#ff8a6a':'#f0d8a0',m.hp/m.mhp,te||m.hp<m.mhp,(mt.boss?'☠ Boss · ':mt.elite?'★ Elite · ':'')+'Lv '+m.lv,mt.boss||mt.elite,te?1:a,null,true);
      if(m.flags&2||m.stunU>t){ g.fillStyle='#ffe66a'; g.font='14px sans-serif'; for(let i=0;i<3;i++){ const an=t*4+i*2.1; g.fillText('✦',s[0]+Math.cos(an)*14,s[1]-30+Math.sin(an)*4); } }
      if(m.flags&4||m.rootU>t){ g.fillStyle='#bfe8ff'; g.font='16px sans-serif'; g.fillText('❄',s[0]+40,s[1]-2); } if(m.bubbleT>t) bubble(s[0],s[1]-30,m.bubble); }}); }
  const pl=(x,y,name,hpF,isMe,dead,party,bub,mtd,cls,isgm,cast,title,ncol)=>{ const s=toScreen(x/TS,standY(x,y)+2.15+(mtd?.8:0)+(isMe?(me.jumpH||0):0),y/TS); if(!s) return;
    items.push({w:s[2],d:()=>{ const a=isMe?1:clamp(1.6-s[2]/55,0,1); plate(s[0],s[1],name+(dead?' (spirit)':''),ncol||(CLS[cls]?CLS[cls].col:'#ffffff'),hpF,!isMe,isgm?'<GM>':title?'<'+title+'>':party?'<Party>':'',false,a,isgm?'#ff9a3a':title?'#ffd36a':'#8fc8ff'); if(bub) bubble(s[0],s[1]-12,bub);
      if(cast){ const p=clamp(cast.p0/100+(t-cast.t0)/cast.dur,0,1); if(p<1){ g.globalAlpha=a; g.fillStyle='rgba(0,0,0,.8)'; g.fillRect(s[0]-36,s[1]+13,72,9); const gr=g.createLinearGradient(s[0]-35,0,s[0]+35,0); gr.addColorStop(0,'#b8761a'); gr.addColorStop(1,'#ffe27a'); g.fillStyle=gr; g.fillRect(s[0]-35,s[1]+14,70*p,7); g.font='700 10px "Alegreya Sans",sans-serif'; g.textAlign='center'; g.lineWidth=3; g.strokeStyle='#000'; g.strokeText(cast.nm,s[0],s[1]+32); g.fillStyle='#ffe9a0'; g.fillText(cast.nm,s[0],s[1]+32); g.globalAlpha=1; } } }}); };
  for(const o of others.values()) if(seenO(o)) pl(o.rx,o.ry,o.n+(o.iv?' (invisible)':''),o.hp/o.mhp,false,o.d,!!(o.pt&&me&&o.pt===me.party),o.bubbleT>t?o.bubble:'',o.mt,o.c,o.gm&&isGM,o.cast,pvpFoe(o)?'⚔ Enemy':o.ti,nameCol(o));
  if(me) pl(me.x,me.y,me.c.name,me.hp/me.mhp,true,me.dead,false,me.bubbleT>t?me.bubble:'',me.mounted,me.c.cls,isGM,null,myTitle(),myNameCol());
  items.sort((a,b)=>b.w-a.w); if(OPT.names) for(const it of items) it.d();
  for(let i=texts.length-1;i>=0;i--){ const f=texts[i]; const a=(t-f.t)/1.5; if(a>1){texts.splice(i,1);continue} const s=toScreen(f.X,f.Y+eO(Math.min(1,a*1.6))*1.5,f.Z); if(!s) continue;
    const pop=a<.14?1+(.14-a)*5:1, sz=Math.round((f.big?38:27)*pop*Math.max(.9,OPT.uiScale||1)); g.globalAlpha=a<.75?1:1-(a-.75)/.25; g.font=`900 ${sz}px "Alegreya Sans",sans-serif`; g.textAlign='center'; g.lineJoin='round';
    const xo=s[0]+(f.dx||0)*a*40; g.lineWidth=Math.max(4,sz*.2); g.strokeStyle='rgba(0,0,0,.92)'; g.strokeText(f.txt,xo,s[1]); if(f.big){ g.shadowColor=f.col; g.shadowBlur=14; } g.fillStyle=f.col; g.fillText(f.txt,xo,s[1]); g.shadowBlur=0; g.globalAlpha=1; }
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
const CURS={sword:`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 32 32\"><path d=\"M3 3 L19 19 L16 22 L13 19 L1 1Z\" fill=\"#e8eef6\" stroke=\"#1a1006\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><path d=\"M2 2 L18 18\" stroke=\"#9aa6b4\" stroke-width=\"1.2\"/><path d=\"M14 24 L24 14 L26 16 L16 26Z\" fill=\"#c8962e\" stroke=\"#1a1006\" stroke-width=\"1.4\"/><path d=\"M20 20 L27 27\" stroke=\"#5a3412\" stroke-width=\"4\" stroke-linecap=\"round\"/><circle cx=\"28\" cy=\"28\" r=\"2.6\" fill=\"#c8962e\" stroke=\"#1a1006\" stroke-width=\"1.2\"/></svg>')}") 2 2, crosshair`,
  talk:`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"30\" height=\"30\" viewBox=\"0 0 30 30\"><path d=\"M2 2 L2 20 L7 16 L10 24 L14 22 L11 15 L17 15Z\" fill=\"#f4e6c4\" stroke=\"#1a1006\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><path d=\"M16 4 h11 a2 2 0 0 1 2 2 v6 a2 2 0 0 1 -2 2 h-6 l-3 3 v-3 h-2 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2Z\" fill=\"#ffd34a\" stroke=\"#1a1006\" stroke-width=\"1.3\"/></svg>')}") 2 2, pointer`};
let hoverK='', hoverT=0;
function setHoverCursor(k){ if(k===hoverK) return; hoverK=k; cv.style.cursor=k==='hostile'?CURS.sword:k==='npc'?CURS.talk:k==='friend'?'pointer':''; try{ GCUR.el.dataset.k=k; }catch(e){} }
function hoverCheck(x,y){ const t=performance.now(); if(t-hoverT<70) return; hoverT=t; if(!me||MOUSE.drag){ setHoverCursor(''); return; } let b=null; try{ b=pickUnder(x,y); }catch(e){}
  if(!b) return setHoverCursor(''); if(b.kind==='m') return setHoverCursor('hostile'); if(b.kind==='n') return setHoverCursor('npc'); if(b.kind==='node') return setHoverCursor('friend');
  if(b.kind==='p'){ if(b.id===MY_U) return setHoverCursor(''); const o=othersByU.get(b.id); return setHoverCursor(o&&pvpFoe(o)?'hostile':'friend'); } setHoverCursor(''); }
cv.addEventListener('mousedown',e=>{ MOUSE.both=(e.buttons&3)===3; if(MOUSE.down>=0) return; MOUSE.down=e.button; MOUSE.sx=MOUSE.x=e.clientX; MOUSE.sy=MOUSE.y=e.clientY; MOUSE.drag=false; MOUSE.t0=performance.now(); MOUSE.acc=0; MOUSE.lyaw=CAM.yaw; MOUSE.right=e.button===2; if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); });
addEventListener('mousemove',e=>{ MOUSE.both=(e.buttons&3)===3; if(MOUSE.down<0){ if(e.target===cv) hoverCheck(e.clientX,e.clientY); else if(hoverK&&!(GCUR.on&&e.target===cv)) setHoverCursor(''); return; }
  const lk=!!document.pointerLockElement; const dx=lk?(e.movementX||0):e.clientX-MOUSE.x, dy=lk?(e.movementY||0):e.clientY-MOUSE.y; MOUSE.x=e.clientX; MOUSE.y=e.clientY;
  if(!MOUSE.drag&&(lk?(MOUSE.acc=(MOUSE.acc||0)+Math.abs(dx)+Math.abs(dy))>4:Math.hypot(e.clientX-MOUSE.sx,e.clientY-MOUSE.sy)>4)){ MOUSE.drag=true; setHoverCursor('');
    /* mouse-look: the cursor stays exactly where it was while a button is held (windowed: the pointer is captured, full screen: the game cursor freezes) */
    if(!document.pointerLockElement&&cv.requestPointerLock&&!document.body.classList.contains('touch')&&!document.fullscreenElement&&!windowIsFull()){ MOUSE.lockDrag=true; try{ const p=cv.requestPointerLock(); if(p&&p.catch) p.catch(()=>{ MOUSE.lockDrag=false; }); }catch(_){ MOUSE.lockDrag=false; } } }
  if(MOUSE.drag&&me){ CAM.yaw+=dx*.0065*OPT.sens; CAM.pitch=clamp(CAM.pitch+dy*.005*OPT.sens*(OPT.invertY?-1:1),-.15,1.35); if(MOUSE.right) me.face=CAM.yaw; } });
addEventListener('mouseup',e=>{ MOUSE.both=(e.buttons&3)===3; if(e.buttons&3) return; if(MOUSE.down<0) return; const wasDrag=MOUSE.drag, btn=MOUSE.down; MOUSE.down=-1; MOUSE.right=false; const acc0=MOUSE.acc||0; MOUSE.acc=0; if(MOUSE.lockDrag){ MOUSE.lockDrag=false; if(document.pointerLockElement===cv) document.exitPointerLock(); } const quick=performance.now()-(MOUSE.t0||0)<280&&(document.pointerLockElement?acc0:Math.hypot(e.clientX-MOUSE.sx,e.clientY-MOUSE.sy))<16;
  if((!wasDrag||quick)&&me) pickAt(MOUSE.sx,MOUSE.sy,btn); });
cv.addEventListener('wheel',e=>{ e.preventDefault(); CAM.dist=clamp(CAM.dist*(1+e.deltaY*.0012),3,OPT.camMax); },{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('contextmenu',e=>{ const t=e.target; if(t&&t.closest&&t.closest('input,textarea,[contenteditable]')) return; e.preventDefault(); });
const TOUCHPICK_=()=>document.body.classList.contains('touch'); let TOUCHPICK=false, PICKDRY=false, OCCH=null;
function pickSeen(X,Y,Z){ if(Math.hypot(X-CAM.tx,Z-CAM.tz)>42) return false;
  if(!OCCH){ OCCH={}; OCCH[T.HOUSE]=4.4; OCCH[T.TWALL]=3.2; OCCH[T.WALL]=2.2; if(T.DWALL!=null) OCCH[T.DWALL]=5; if(T.COLUMN!=null) OCCH[T.COLUMN]=5; if(T.DGATE!=null) OCCH[T.DGATE]=4.5; OCCH[T.ROCK]=1; }
  const ex=CAM.ex,ey=CAM.ey,ez=CAM.ez, dx=X-ex,dy=Y-ey,dz=Z-ez, Ld=Math.hypot(dx,dy,dz), n=Math.ceil(Ld/.3);
  const ax=me?me.x/TS:CAM.tx, ay=me?standY(me.x,me.y)+1.1:CAM.ty, az=me?me.y/TS:CAM.tz, sx=ex-ax, sy=ey-ay, sz=ez-az, s2=sx*sx+sy*sy+sz*sz||1;
  for(let k=1;k<n;k++){ const f=k/n; if(Ld*(1-f)<.9) break; const x=ex+dx*f, y=ey+dy*f, z=ez+dz*f; const gh=hgt(x,z); if(y<gh-.2) return false;
    const gx=Math.floor(x*OCC_R), gz=Math.floor(z*OCC_R); let top=OCC&&gx>=0&&gz>=0&&gx<MW*OCC_R&&gz<MH*OCC_R?OCC[gz*MW*OCC_R+gx]:0; const oh=OCCH[tAt(Math.floor(x),Math.floor(z))]; if(oh) top=Math.max(top,gh+oh);
    if(!(top>0)||y>=top) continue;
    /* houses and walls between the camera and your hero are see-through, so they do not block clicks either */
    const u=clamp(((x-ax)*sx+(y-ay)*sy+(z-az)*sz)/s2,0,1); if(Math.hypot(x-ax-sx*u,y-ay-sy*u,z-az-sz*u)<2.1&&u>.03) continue; return false; }
  return true; }
function pickUnder(mx,my){ PICKDRY=true; try{ return pickAt(mx,my,-1); }finally{ PICKDRY=false; } }
function pickAt(mx,my,btn){ TOUCHPICK=TOUCHPICK_(); let best=null,bd=60;
  bd=1e9; let bz=1e9;
  /* every actor is a capsule from its feet to the top of its head; a click anywhere on it counts. Overlaps go to the one nearest the camera. */
  const test=(X,Y0,Z,h,w,cand)=>{ const a=toScreen(X,Y0,Z), b=toScreen(X,Y0+h,Z); if(!a||!b) return; const sx=b[0]-a[0], sy=b[1]-a[1], L2=sx*sx+sy*sy||1;
    const u=clamp(((mx-a[0])*sx+(my-a[1])*sy)/L2,0,1), d=Math.hypot(a[0]+sx*u-mx,a[1]+sy*u-my), ppu=Math.sqrt(L2)/h, lim=TOUCHPICK?Math.max(34,w*ppu+24):Math.max(a[2]>26?8:a[2]>14?12:16,w*ppu+6);
    if(d>lim) return; if(!pickSeen(X,Y0+h*.55,Z)) return; const z=a[2]-(d<lim*.6?2:0); if(z<bz||(Math.abs(z-bz)<.5&&d<bd)){ bz=z; bd=d; best=cand; } };
  for(const m of mobs){ if(m.dead) continue; const h=(MOBH[m.t.key]||1.6), w=Math.max(.42,Math.min(2.6,(m.t.r||14)/TS*1.15,h*.42)); if(Math.hypot(m.rx/TS-CAM.tx,m.ry/TS-CAM.tz)>(m.t.boss?40:26)) continue; test(m.rx/TS,groundY(m.rx,m.ry),m.ry/TS,h*1.04,w,{kind:'m',id:m.id}); }
  for(const o of others.values()) if(seenO(o)) test(o.rx/TS,standY(o.rx,o.ry),o.ry/TS,o.mt?2.9:2.05,.5,{kind:'p',id:o.u});
  for(const n of NPCS) test(n.x/TS,groundY(n.x,n.y),n.y/TS,2.05,.5,{kind:'n',id:n.id});
  for(const n of NODES){ if(n.resp>now()) continue; test(n.x/TS,groundY(n.x,n.y),n.y/TS,.9,.55,{kind:'node',n}); }
  if(PICKDRY) return best;
  if(best&&best.kind==='node'){ const n=best.n; if(dist(me.x,me.y,n.x,n.y)<95) startGather(n); else err('Too far away'); return; }
  if(best){ me.target=best; const n=best.kind==='n'?NPCS.find(q=>q.id===best.id):null; if(n&&dist(me.x,me.y,n.x,n.y)<110) talk(n); if(btn===2&&best.kind==='m') me.auto=true; if(btn===2&&best.kind==='p'&&pvpFoe(othersByU.get(best.id))) me.auto=true; }
  else if(btn===0){ me.target=null; me.auto=false; } }

/* =====================================================================
   OPEN WORLD 3D: landmarks, mounts, wildlife, nodes, weather
   ===================================================================== */
Object.assign(LOOK,{
  doran:{torso:[.42,.28,.18],legs:[.25,.2,.16],arms:[.78,.58,.45],boots:[.18,.12,.08],trim:[.3,.2,.12],tabard:[.32,.2,.12],head:'bald',weapon:'hammer',gloves:[.2,.14,.1]},
  varro:{torso:[.55,.18,.12],legs:[.3,.2,.14],arms:[.62,.42,.3],boots:[.25,.15,.1],cape:[.62,.08,.06],trim:[.92,.72,.32],tabard:[.62,.08,.06],head:'plume',metal:[.72,.62,.42],pauld:[.78,.66,.42],weapon:'greatsword',fur:true,spikes:true,straps:true,strapC:[.25,.15,.08]},
  keeperw:{torso:[.5,.36,.22],legs:[.3,.24,.18],arms:[.5,.36,.22],boots:[.25,.16,.1],trim:[.75,.6,.3],head:'hair',hair:[.5,.48,.45],weapon:'staffplain',cape:[.42,.12,.08]},
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
/* ---------- v22: Sunken Vault architecture (static) ---------- */
function addWilds(d){ const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e); const R=mulberry32(4242);
  const wood=[.34,.22,.12], dark=[.2,.13,.08], stoneC=[.55,.53,.5];
  const okT=(tx,ty)=>{ const t=tAt(tx,ty); return !SOLID.has(t)&&t!==T.WATER&&t!==T.LAVA&&t!==T.PATH&&t!==T.BRIDGE&&ty<OWH-3&&Math.hypot(tx-TOWN.x,ty-TOWN.y)>TOWN.r+5; };
  const farFromNPC=(x,z,r)=>!NPCS.some(n=>Math.hypot(n.x/TS-x,n.y/TS-z)<r)&&!POIS.some(p=>Math.hypot(p.x-x,p.y-z)<(p.r||4)+3);
  // roadside: a lantern post every so often, a mile stone now and then, signposts where roads meet
  let lastL=[], k=0;
  for(let ty=3;ty<OWH-3;ty++)for(let tx=3;tx<MW-3;tx++){ if(tAt(tx,ty)!==T.PATH||Math.hypot(tx-TOWN.x,ty-TOWN.y)<TOWN.r+4) continue;
    let nb=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(tAt(tx+dx,ty+dy)===T.PATH||tAt(tx+dx,ty+dy)===T.BRIDGE) nb++;
    if(lastL.some(([x,y])=>Math.hypot(x-tx,y-ty)<13)) continue;
    let sx=0,sy=0; for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]) if(okT(tx+dx,ty+dy)&&tAt(tx+dx/2,ty+dy/2)!==T.PATH){ sx=dx; sy=dy; break; } if(!sx&&!sy) continue;
    const x=tx+.5+sx*.8, z=ty+.5+sy*.8; if(!farFromNPC(x,z,3)) continue; lastL.push([tx,ty]); const y0=hgt(x,z); k++;
    if(k%3===0){ box(x,y0+.45,z,.45,.9,.3,stoneC.map(v=>v*.9),R()*.4); box(x,y0+.95,z,.38,.12,.26,stoneC); }
    else { gAdd(d,RC,x,y0,z,0,.12,2.3,.12,dark); box(x+.2,y0+2.2,z,.5,.07,.07,dark); box(x+.38,y0+1.95,z,.2,.28,.2,[1,.78,.4],0,1.8); STAT_LIGHTS.push({x:x+.38,y:y0+1.95,z,r:7,c:[1,.72,.38],night:true,lamp:true}); } }
  // signposts at junctions (3+ road neighbours)
  const sp=[]; for(let ty=3;ty<OWH-3;ty++)for(let tx=3;tx<MW-3;tx++){ if(tAt(tx,ty)!==T.PATH||Math.hypot(tx-TOWN.x,ty-TOWN.y)<TOWN.r+6) continue; let nb=0; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) if(Math.abs(dx)+Math.abs(dy)===2&&tAt(tx+dx,ty+dy)===T.PATH) nb++;
    if(nb>=6&&!sp.some(([x,y])=>Math.hypot(x-tx,y-ty)<20)){ sp.push([tx,ty]); for(const [dx,dy] of [[2,2],[-2,2],[2,-2],[-2,-2]]) if(okT(tx+dx,ty+dy)){ const x=tx+dx+.5, z=ty+dy+.5, y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.11,2.4,.11,wood);
      for(let i=0;i<3;i++) box(x+.35,y0+1.9-i*.32,z,.8,.2,.05,[.5,.36,.2],i*1.1+R()*.4); box(x,y0+2.45,z,.16,.16,.16,dark); break; } } }
  // scattered sights in the open
  const place=(n,fn,zones)=>{ let c=0; for(let tries=0;tries<n*60&&c<n;tries++){ const tx=4+Math.floor(R()*(MW-8)), ty=4+Math.floor(R()*(OWH-10)); if(!okT(tx,ty)) continue; const z=zmap[ty*MW+tx]; if(zones&&!zones.includes(z)) continue;
      let clear=true; for(let dy=-2;dy<=2&&clear;dy++)for(let dx=-2;dx<=2;dx++) if(!okT(tx+dx,ty+dy)) { clear=false; break; } if(!clear||!farFromNPC(tx,ty,8)) continue; fn(tx+.5,ty+.5,z,R); c++; } };
  // standing stones
  place(13,(x,z,zn,R)=>{ const n=5+Math.floor(R()*3); for(let i=0;i<n;i++){ const a=i/n*6.283, px=x+Math.cos(a)*2.4, pz=z+Math.sin(a)*2.4, y0=hgt(px,pz), h=1.2+R()*1.2; box(px,y0+h/2-.1,pz,.55,h,.4,zn==='frost'?[.7,.72,.76]:stoneC,-a+R()*.3); }
    if(R()<.5){ const y0=hgt(x,z); box(x,y0+.2,z,1.1,.4,.7,stoneC.map(v=>v*.85)); box(x,y0+.45,z,.3,.06,.3,[.4,.8,1],0,1.4); STAT_LIGHTS.push({x,y:y0+.8,z,r:5,c:[.4,.8,1.3]}); } },['meadow','forest','ruins','frost','swamp']);
  // abandoned carts
  place(12,(x,z,zn,R)=>{ const y0=hgt(x,z), ry=R()*6.28; box(x,y0+.75,z,2,.12,1.1,[.42,.28,.15],ry); for(const s of [-1,1]) box(x+Math.cos(ry)*0,y0+.95,z+s*.0,2,.4,.06,[.36,.24,.12],ry);
    for(const s of [-1,1]){ const wx=x-Math.sin(ry)*s*.6, wz=z-Math.cos(ry)*s*.6; gAdd(d,RC,wx,y0+.42,wz,ry,.42,.08,.42,[.3,.2,.1],0,Math.PI/2); } box(x+Math.cos(ry)*1.1,y0+.6,z-Math.sin(ry)*1.1,1.2,.08,.08,wood,ry+.2);
    for(let i=0;i<3;i++) box(x+(R()-.5),y0+1.0+i*.25,z+(R()-.5)*.6,.5,.35,.4,[.6,.5,.32],R()); },['meadow','forest','ruins','swamp']);
  // cold campfires and bedrolls
  place(18,(x,z,zn,R)=>{ const y0=hgt(x,z); for(let i=0;i<7;i++){ const a=i/7*6.283; gAdd(d,RBL,x+Math.cos(a)*.5,y0+.06,z+Math.sin(a)*.5,0,.26,.18,.26,[.42,.4,.37]); } gAdd(d,RC,x,y0+.02,z,0,.4,.05,.4,[.12,.1,.08]);
    for(let i=0;i<2;i++){ const a=R()*6.28; box(x+Math.cos(a)*1.5,y0+.08,z+Math.sin(a)*1.5,1.6,.12,.6,[.45,.3,.25],a); } },['meadow','forest','frost','ruins','ash']);
  // boulder fields
  place(48,(x,z,zn,R)=>{ const n=2+Math.floor(R()*4); for(let i=0;i<n;i++){ const px=x+(R()-.5)*3, pz=z+(R()-.5)*3, y0=hgt(px,pz), s=.5+R()*1.1; gAdd(d,RBL,px,y0+s*.3,pz,R()*6,s*1.2,s*.8,s,zn==='ash'?[.3,.26,.24]:zn==='frost'?[.72,.74,.78]:[.5,.48,.45]); } });
}
function addWilds2(d){ const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e); const R=mulberry32(9191);
  const wood=[.34,.22,.12], dark=[.2,.13,.08], stoneC=[.55,.53,.5], straw=[.8,.68,.36], plaster=[.88,.82,.7], roofC=[.56,.3,.17];
  const okT=(tx,ty)=>{ const t=tAt(tx,ty); return !SOLID.has(t)&&t!==T.WATER&&t!==T.LAVA&&t!==T.PATH&&t!==T.BRIDGE&&t!==T.ICE&&ty>3&&ty<OWH-4&&tx>3&&tx<MW-4&&Math.hypot(tx-TOWN.x,ty-TOWN.y)>TOWN.r+6; };
  const farFrom=(x,z,r)=>!NPCS.some(n=>Math.hypot(n.x/TS-x,n.y/TS-z)<r)&&!POIS.some(p=>Math.hypot(p.x-x,p.y-z)<(p.r||4)+r*.6)&&!NODES.some(n=>Math.hypot(n.tx-x,n.ty-z)<2)&&Math.hypot(x-LAIR.x,z-LAIR.y)>12;
  const place=(n,fn,zones,cr,sep)=>{ cr=cr||2; let c=0; for(let tries=0;tries<n*90&&c<n;tries++){ const tx=5+Math.floor(R()*(MW-10)), ty=5+Math.floor(R()*(OWH-10)); if(!okT(tx,ty)) continue; const z=zmap[ty*MW+tx]; if(zones&&!zones.includes(z)) continue;
      let clear=true; for(let dy=-cr;dy<=cr&&clear;dy++)for(let dx=-cr;dx<=cr;dx++) if(!okT(tx+dx,ty+dy)){ clear=false; break; } if(!clear||!farFrom(tx,ty,sep||8)) continue; fn(tx+.5,ty+.5,z,R); c++; } return c; };
  const NAMES={farm:['Oldfield Farm','Barrow Croft','Hollin Farmstead','Wheatwhistle Farm','Greywater Croft','Sunnybrook Farm'],hunt:["Hunter's Rest",'Stag Hollow Camp','Fernwatch Camp','Bramble Lodge','Wolfsbane Camp'],
    shrine:['Shrine of the Dawn','Wayfarer Shrine','Moonwell Shrine','Shrine of Embers','Frostlight Shrine','Shrine of Tides'],grave:['Gloamfen Barrows','The Forgotten Graves','Hollow Yard'],tower:['Old Watch','Broken Beacon','The Lonely Spire','Raven Tower'],
    ice:['Shiverglass Field','The Frozen Teeth','Rimeheart Hollow'],ash:['Ashfang Spires','The Ember Vents','Cindermaw'],well:['Wishing Well',"Shepherd's Well"],ruin:['Fallen Colonnade','Gate of Kings','Sunken Plaza']};
  const poi=(k,x,z,r)=>{ const L=NAMES[k]; if(!L||!L.length) return; const nm=L.shift(); POIS.push({id:'w_'+nm.toLowerCase().replace(/[^a-z]+/g,''),name:nm,x:Math.round(x),y:Math.round(z),r:r||5}); };
  const rot=(x,z,ry)=>(a,b)=>[x+a*Math.cos(ry)+b*Math.sin(ry), z-a*Math.sin(ry)+b*Math.cos(ry)];
  const fire=(x,z,big)=>{ const y0=hgt(x,z); for(let i=0;i<8;i++){ const a=i/8*6.283; gAdd(d,RBL,x+Math.cos(a)*.55,y0+.07,z+Math.sin(a)*.55,0,.27,.2,.27,[.42,.4,.37]); }
    for(let i=0;i<3;i++) box(x,y0+.14,z,.9,.12,.12,[.3,.18,.1],i*1.05); gAdd(d,RS,x,y0+.18,z,0,.5,.3,.5,[1,.48,.12],2.6); STAT_LIGHTS.push({x,y:y0+.7,z,r:big?10:8,c:[1.45,.62,.22],fire:true}); };
  // --- farmsteads: a cottage with a lit window and a smoking chimney, crop rows, a fence, hay bales and a scarecrow
  place(6,(x,z,zn,R)=>{ const ry=Math.floor(R()*4)*Math.PI/2, L=rot(x,z,ry); const [hx,hz]=L(-2.4,-1.6), y0=hgt(hx,hz);
    box(hx,y0+1.05,hz,3.2,2.1,2.4,plaster,ry); for(const [a,b] of [[-1.5,-1.1],[1.5,-1.1],[-1.5,1.1],[1.5,1.1]]){ const [px,pz]=rot(hx,hz,ry)(a,b); box(px,y0+1.05,pz,.18,2.15,.18,dark,ry); }
    gAdd(d,RP,hx,y0+2.1,hz,ry+Math.PI/2,2.9,1.5,3.7,roofC); { const [cx,cz]=rot(hx,hz,ry)(1,.6); box(cx,y0+3.1,cz,.45,1.4,.45,[.45,.42,.4],ry); CHIMNEYS.push({x:cx,y:y0+3.9,z:cz}); }
    { const [wx,wz]=rot(hx,hz,ry)(0,1.22); box(wx,y0+1.25,wz,.55,.5,.06,[1,.8,.45],ry,1.4); box(wx,y0+.9,wz-0,.9,.06,.06,dark,ry); STAT_LIGHTS.push({x:wx,y:y0+1.3,z:wz,r:6,c:[1.1,.72,.36],night:true,lamp:true}); }
    { const [dx,dz]=rot(hx,hz,ry)(-.8,1.22); box(dx,y0+.65,dz,.6,1.3,.07,[.38,.24,.12],ry); }
    for(let r=0;r<6;r++){ const [fx,fz]=L(.2+r*.65,1.9), y1=hgt(fx,fz); box(fx,y1+.18,fz,.32,.36,3.4,[.36,.26,.16],ry); for(let k=0;k<5;k++){ const [px,pz]=rot(fx,fz,ry)(0,-1.4+k*.7); gAdd(d,RBL,px,y1+.45,pz,R()*6,.28,.36,.28,r%2?[.42,.64,.2]:straw); } }
    for(let i=0;i<=8;i++) for(const b of [0,3.9]){ const [px,pz]=L(-.3+i*.5,b), y1=hgt(px,pz); gAdd(d,RC,px,y1,pz,0,.09,.8,.09,wood); }
    for(const b of [0,3.9]){ const [px,pz]=L(1.7,b), y1=hgt(px,pz); box(px,y1+.55,pz,4.1,.07,.05,wood,ry); box(px,y1+.3,pz,4.1,.07,.05,wood,ry); }
    for(let k=0;k<3;k++){ const [bx,bz]=L(-3.6+k*.9,1.6+R()), y1=hgt(bx,bz); gAdd(d,RC,bx,y1+.42,bz,ry+R(),.75,.08,.75,straw,0,Math.PI/2); gAdd(d,RC,bx,y1,bz,ry,.82,.8,.82,straw); }
    { const [sx,sz]=L(3,4.6), y1=hgt(sx,sz); gAdd(d,RC,sx,y1,sz,0,.09,1.9,.09,wood); box(sx,y1+1.45,sz,1.3,.09,.09,wood,ry); box(sx,y1+1.35,sz,.5,.7,.3,[.55,.3,.2],ry); gAdd(d,RS,sx,y1+1.95,sz,0,.36,.36,.36,straw); gAdd(d,RCN,sx,y1+2.05,sz,0,.55,.45,.55,[.3,.24,.14]); }
    poi('farm',x,z,7); },['meadow','lake','forest'],4,16);
  // --- hunter camps: tents, a crackling campfire, a drying rack with hides, log seats
  place(6,(x,z,zn,R)=>{ const ry=R()*6.28, L=rot(x,z,ry); fire(x,z,true);
    for(const [a,b,c] of [[-2.2,-.8,[.62,.55,.42]],[1.8,-1.6,[.5,.42,.3]]]){ const [tx,tz]=L(a,b), y1=hgt(tx,tz); gAdd(d,RP,tx,y1-.05,tz,ry+a,2.2,1.6,2.8,c); box(tx,y1+.75,tz,.08,1.5,.08,dark); }
    for(let k=0;k<3;k++){ const a=ry+k*2.1+.6, lx=x+Math.cos(a)*1.6, lz=z+Math.sin(a)*1.6; gAdd(d,RC,lx,hgt(lx,lz)+.22,lz,a,.4,1.3,.4,[.36,.24,.14],0,Math.PI/2); }
    { const [rx,rz]=L(0,2.6), y1=hgt(rx,rz); for(const s of [-1,1]){ const [px,pz]=rot(rx,rz,ry)(s*1,0); gAdd(d,RC,px,y1,pz,0,.1,1.7,.1,wood); } box(rx,y1+1.65,rz,2.2,.08,.08,wood,ry); box(rx,y1+1.2,rz,.7,.8,.04,[.62,.44,.3],ry+.05); box(rx+.4,y1+1.15,rz,.6,.7,.04,[.5,.36,.24],ry-.1); }
    poi('hunt',x,z,6); },['forest','swamp','frost','meadow'],2,14);
  // --- shrines: a stone dais with four pillars around a glowing orb
  place(6,(x,z,zn,R)=>{ const y0=hgt(x,z), oc=zn==='ash'?[1,.5,.15]:zn==='frost'?[.6,.9,1.3]:zn==='swamp'?[.5,1,.6]:[1,.85,.45];
    box(x,y0+.15,z,3,.3,3,stoneC.map(v=>v*.85)); box(x,y0+.42,z,2.2,.25,2.2,stoneC); for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ gAdd(d,RC,x+a*.95,y0+.5,z+b*.95,0,.32,1.9,.32,stoneC); box(x+a*.95,y0+2.45,z+b*.95,.45,.12,.45,stoneC.map(v=>v*.9)); }
    gAdd(d,RC,x,y0+.5,z,0,.5,.7,.5,stoneC.map(v=>v*.8)); gAdd(d,RS,x,y0+1.55,z,0,.5,.5,.5,oc,1.8); STAT_LIGHTS.push({x,y:y0+1.6,z,r:9,c:oc.map(v=>v*1.2)}); poi('shrine',x,z,5); },['meadow','forest','ruins','frost','ash','lake'],3,24);
  // --- graveyards: crooked headstones inside an iron fence, with a pale lantern
  place(3,(x,z,zn,R)=>{ const ry=R()*.6;
    for(let i=-2;i<=2;i++)for(let j=-1;j<=1;j++){ if(R()<.2) continue; const [gx,gz]=rot(x,z,ry)(i*1.1,j*1.3), y1=hgt(gx,gz), tilt=(R()-.5)*.25; gAdd(d,RB,gx,y1+.35,gz,ry+(R()-.5)*.2,.55,.7,.13,[.5,.5,.5].map(v=>v*(.8+R()*.3)),0,tilt); gAdd(d,RS,gx,y1+.7,gz,ry,.55,.25,.13,[.5,.5,.5],0); box(gx,y1+.04,gz+.5,.5,.08,.8,[.25,.22,.16],ry); }
    for(let k=0;k<26;k++){ const t=k/26*6.283, px=x+Math.cos(t)*4.2, pz=z+Math.sin(t)*3.2; gAdd(d,RC,px,hgt(px,pz),pz,0,.07,1.1,.07,[.15,.15,.17]); }
    { const y0=hgt(x+3,z); gAdd(d,RC,x+3,y0,z,0,.1,2.2,.1,[.15,.15,.17]); box(x+3,y0+2.1,z,.3,.38,.3,[.6,1,.7],0,1.6); STAT_LIGHTS.push({x:x+3,y:y0+2.1,z,r:7,c:[.5,1.1,.7],night:true}); }
    poi('grave',x,z,6); },['swamp','ruins'],2,16);
  // --- wells
  place(5,(x,z,zn,R)=>{ const y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,1.6,.85,1.6,stoneC); gAdd(d,RC,x,y0+.8,z,0,1.3,.03,1.3,[.08,.14,.18],0); for(const s of [-1,1]) gAdd(d,RC,x+s*.75,y0+.8,z,0,.12,1.5,.12,wood);
    gAdd(d,RP,x,y0+2.2,z,Math.PI/2,1.5,.7,2,roofC); box(x,y0+1.9,z,1.6,.08,.08,dark); gAdd(d,RC,x,y0+1.25,z,0,.32,.35,.32,[.4,.27,.14]); poi('well',x,z,3); },['meadow','forest','lake'],2,18);
  // --- ruined watchtowers on high ground
  place(4,(x,z,zn,R)=>{ const y0=hgt(x,z), h=4.5+R()*2.5; gAdd(d,RC,x,y0,z,0,3.2,h,3.2,stoneC.map(v=>v*.9)); for(let k=0;k<10;k++){ if(R()<.35) continue; const a=k/10*6.283; box(x+Math.cos(a)*1.45,y0+h+.3,z+Math.sin(a)*1.45,.6,.6,.45,stoneC,-a); }
    box(x+1.62,y0+.8,z,.1,1.6,.9,[.15,.1,.06]); for(let k=0;k<6;k++){ const a=R()*6.28, r=2+R()*2; gAdd(d,RBL,x+Math.cos(a)*r,hgt(x+Math.cos(a)*r,z+Math.sin(a)*r)+.15,z+Math.sin(a)*r,R()*6,.6,.4,.5,stoneC); }
    if(R()<.6){ box(x,y0+h+.15,z,.5,.3,.5,[1,.55,.15],0,2.4); STAT_LIGHTS.push({x,y:y0+h+.7,z,r:12,c:[1.4,.6,.2],fire:true}); } poi('tower',x,z,5); },['meadow','forest','ruins','frost'],3,30);
  // --- glowing mushroom rings
  place(14,(x,z,zn,R)=>{ const col=R()<.5?[.3,.95,.85]:[.75,.45,1]; const n=8+Math.floor(R()*5); for(let i=0;i<n;i++){ const a=i/n*6.283+R()*.2, r=1.4+R()*.3, px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r, y1=hgt(px,pz), s=.6+R()*.8;
      gAdd(d,RC,px,y1,pz,0,.1*s,.35*s,.1*s,[.85,.82,.72]); gAdd(d,RS,px,y1+.35*s,pz,0,.38*s,.16*s,.38*s,col,1.1); } STAT_LIGHTS.push({x,y:hgt(x,z)+.5,z,r:6,c:col.map(v=>v*.9),night:true}); },['forest','swamp'],2,10);
  // --- dead trees and fallen logs
  place(40,(x,z,zn,R)=>{ const y0=hgt(x,z), h=2.6+R()*2.6, c=zn==='ash'?[.12,.1,.09]:zn==='frost'?[.42,.4,.4]:[.24,.21,.17]; gAdd(d,RFR,x,y0-.1,z,R()*6,.45,h,.45,c);
    for(let k=0;k<3;k++){ const a=R()*6.28, by=y0+h*(.5+R()*.4); gAdd(d,RB,x+Math.cos(a)*.55,by,z+Math.sin(a)*.55,-a,1.3,.1,.1,c,0,.5+R()*.4); } },['swamp','ash','frost','ruins'],1,4);
  place(36,(x,z,zn,R)=>{ const y0=hgt(x,z), a=R()*6.28, L2=2+R()*2; gAdd(d,RC,x,y0+.26,z,a,.5,L2,.5,[.36,.25,.15],0,Math.PI/2); gAdd(d,RC,x+Math.cos(a)*L2*.5,y0+.26,z-Math.sin(a)*L2*.5,a,.48,.04,.48,[.62,.5,.32],0,Math.PI/2);
    if(R()<.5) gAdd(d,RBL,x,y0+.55,z,R()*6,.5,.3,.5,[.3,.5,.2]); },['forest','meadow','swamp'],1,4);
  // --- ice crystal fields in the frost
  place(16,(x,z,zn,R)=>{ const n=4+Math.floor(R()*4); for(let i=0;i<n;i++){ const px=x+(R()-.5)*2.4, pz=z+(R()-.5)*2.4, y1=hgt(px,pz), h=1+R()*2.6; gAdd(d,RB,px,y1+h*.4,pz,R()*6,.45,h,.45,[.6,.88,1],.55,(R()-.5)*.5,(R()-.5)*.5); }
    if(R()<.5) STAT_LIGHTS.push({x,y:hgt(x,z)+1.4,z,r:7,c:[.5,.85,1.3]}); if(R()<.3) poi('ice',x,z,5); },['frost'],2,10);
  // --- obsidian spires and glowing vents in the caldera
  place(18,(x,z,zn,R)=>{ const n=2+Math.floor(R()*3); for(let i=0;i<n;i++){ const px=x+(R()-.5)*2.6, pz=z+(R()-.5)*2.6, y1=hgt(px,pz), h=2+R()*4; gAdd(d,RCN,px,y1-.1,pz,R()*6,.9+R()*.6,h,.9+R()*.6,[.1,.08,.1]); box(px,y1+h*.35,pz,.08,h*.5,.6,[1,.4,.08],R()*6,1.6); }
    if(R()<.6){ const y1=hgt(x,z); gAdd(d,RC,x,y1-.05,z,0,1.2,.12,1.2,[1,.45,.1],2.2); STAT_LIGHTS.push({x,y:y1+.6,z,r:8,c:[1.5,.55,.15],fire:true}); } if(R()<.25) poi('ash',x,z,5); },['ash'],2,10);
  // --- broken colonnades and arches in the ruins
  place(14,(x,z,zn,R)=>{ const ry=R()*3.14, L=rot(x,z,ry); for(let k=-2;k<=2;k++){ const [px,pz]=L(k*1.4,0), y1=hgt(px,pz), h=R()<.4?.6+R():2.4+R()*1.8; gAdd(d,RC,px,y1,pz,0,.62,h,.62,[.7,.66,.58]); if(h>2.2&&R()<.5) box(px,y1+h+.1,pz,.8,.2,.8,[.66,.62,.55]); }
    if(R()<.5){ const [ax,az]=L(0,0), y1=hgt(ax,az); box(ax,y1+4.6,az,4.4,.4,.7,[.66,.62,.55],ry); } for(let k=0;k<3;k++){ const [px,pz]=L((R()-.5)*6,1.2+R()); gAdd(d,RC,px,hgt(px,pz)+.3,pz,ry+R(),.6,1.6,.6,[.66,.62,.55],0,Math.PI/2); }
    if(R()<.25) poi('ruin',x,z,5); },['ruins'],3,12);
  // --- wildflower meadows and berry bushes
  place(60,(x,z,zn,R)=>{ const cols=[[.95,.85,.3],[.9,.4,.55],[.6,.55,.95],[1,1,1]]; const c=cols[Math.floor(R()*cols.length)]; for(let i=0;i<9;i++){ const px=x+(R()-.5)*2.6, pz=z+(R()-.5)*2.6; gAdd(d,RS,px,hgt(px,pz)+.12,pz,0,.16,.12,.16,c,.25); }
    if(R()<.5){ const y1=hgt(x+1,z); gAdd(d,RBL,x+1,y1+.35,z,R()*6,.9,.6,.8,[.22,.42,.16]); for(let k=0;k<6;k++) gAdd(d,RS,x+1+(R()-.5)*.8,y1+.4+R()*.3,z+(R()-.5)*.6,0,.1,.1,.1,[.8,.1,.15],.4); } },['meadow','lake','forest'],1,3);
}
function addArena(d){ const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e);
  const stone=[.6,.5,.4], dark=[.3,.24,.18], red=[.62,.1,.07], gold=[.92,.72,.32], iron=[.14,.13,.13];
  const brazier=(x,z)=>{ const y=hgt(x,z); gAdd(d,RC,x,y,z,0,.32,.9,.32,iron); gAdd(d,RC,x,y+.9,z,0,.55,.22,.55,iron); box(x,y+1.15,z,.42,.12,.42,[1,.55,.15],0,2.6); STAT_LIGHTS.push({x,y:y+1.6,z,r:9,c:[1.5,.7,.3],fire:true}); };
  // braziers just inside the walls
  for(let k=0;k<26;k++){ const a=k/26*6.283, c=Math.cos(a), sn=Math.sin(a), f=Math.pow(Math.pow(Math.abs(c),4)+Math.pow(Math.abs(sn),4),-.25); const x=AR.cx+c*(AR.w/2-2.2)*f, z=AR.cy+sn*(AR.h/2-2)*f; if(tAt(Math.floor(x),Math.floor(z))===T.SAND) brazier(x,z); }
  // shrines: four pillars, banners and a portal arch
  for(const [sx,sz] of AR.shr){ for(let k=0;k<4;k++){ const a=k/4*6.283+.785, x=sx+Math.cos(a)*3.6, z=sz+Math.sin(a)*3.6, y=hgt(x,z); gAdd(d,RC,x,y,z,0,.42,3.2,.42,stone); box(x,y+3.25,z,.7,.2,.7,gold); box(x+.36,y+2.4,z,.04,1.6,.6,red); }
    const y=hgt(sx,sz); box(sx,y+.08,sz,2.2,.16,2.2,[.5,.44,.36]); box(sx,y+.2,sz,1.2,.1,1.2,gold,0,.6); STAT_LIGHTS.push({x:sx,y:y+2.5,z:sz,r:11,c:[1.2,1,.6]}); }
  // centre: a sunken ring of blood-red stones
  for(let k=0;k<20;k++){ const a=k/20*6.283, x=AR.cx+Math.cos(a)*5.5, z=AR.cy+Math.sin(a)*3.5; box(x,hgt(x,z)+.08,z,.6,.16,.35,red,-a); }
  // the gate outside, where Varro waits
  { const v=NPCS.find(n=>n.id==='varro'); if(v){ /* a small arena recruiting post: two war banners, a weapon rack and a training dummy */ const vx=v.x/TS, vz=v.y/TS;
      for(const s of [-1,1]){ const bx=vx+s*1.3, bz=vz-1.1, by=hgt(bx,bz); gAdd(d,RC,bx,by,bz,0,.12,3,.12,[.25,.18,.1]); box(bx,by+2.95,bz,.7,.08,.08,[.25,.18,.1]); box(bx,by+2.3,bz,.62,1.2,.04,red); box(bx,by+1.72,bz,.62,.08,.05,gold); }
      { const rx=vx+1.9, rz=vz+.6, ry=hgt(rx,rz); for(const s of [-1,1]) gAdd(d,RC,rx,ry,rz+s*.6,0,.1,1.3,.1,[.3,.2,.1]); box(rx,ry+1.2,rz,.1,.1,1.4,[.3,.2,.1]); for(let k=0;k<3;k++){ box(rx+.05,ry+.75,rz-.45+k*.45,.05,1.1,.06,[.7,.7,.75]); box(rx+.05,ry+.32,rz-.45+k*.45,.14,.06,.2,[.5,.35,.15]); } }
      { const tx=vx-2, tz=vz+.7, ty=hgt(tx,tz); gAdd(d,RC,tx,ty,tz,0,.14,1.6,.14,[.35,.24,.12]); gAdd(d,RC,tx,ty+.7,tz,0,.5,.8,.5,[.72,.6,.36]); box(tx,ty+1.25,tz,1.1,.14,.14,[.35,.24,.12]); gAdd(d,RS,tx,ty+1.75,tz,0,.4,.4,.4,[.72,.6,.36]); } }
    const v2=null; if(v2){ const gx=0, gz=0, y=0; for(const s of [-1,1]){ gAdd(d,RC,gx+s*1.4,y,gz,0,.4,3.4,.4,stone); box(gx+s*1.4,y+2.2,gz+.25,.05,1.8,.7,red); brazier(gx+s*2.4,gz+.6); }
    box(gx,y+3.5,gz,3.4,.4,.5,stone); box(gx,y+3.85,gz,3.6,.15,.6,gold); box(gx,y+1.7,gz-.05,2.4,3.2,.04,[.9,.35,.15],0,1.6); } } }
function addVault(d){ const box=(x,y,z,sx,sy,sz,col,ry,e)=>gAdd(d,RB,x,y,z,ry||0,sx,sy,sz,col,e);
  const stone=[.42,.45,.46], dark=[.22,.24,.25], trim=[.3,.66,.6], iron=[.13,.13,.14], gold=[.72,.6,.3], cloth=[.07,.22,.24];
  const isOpen=t=>t!==T.VOID&&t!==T.DWALL&&t!==T.ROCK;
  const Wp=(lx,ly)=>[VAULT.OX+lx+.5,VAULT.OY+ly+.5];
  const fire=(x,y,z,r,col)=>STAT_LIGHTS.push({x,y,z,r,c:col||[1.35,.7,.3],fire:!col});
  const brazier=(lx,ly,col)=>{ const [x,z]=Wp(lx,ly), y0=.3; gAdd(d,RC,x,y0,z,0,.22,1.05,.22,iron); gAdd(d,RFR,x,y0+1.05,z,0,.85,.42,.85,iron); box(x,y0+1.05,z,.7,.06,.7,gold);
    gAdd(d,RS,x,y0+1.42,z,0,.62,.36,.62,col||[1,.5,.15],2.6); fire(x,y0+1.9,z,9,col?col.map(v=>v*1.4):null); };
  /* ---- the gate in the Ruins of Vael ---- */
  { const gx=99.5+VGO[0], gz=47.3+VGO[1], y0=hgt(gx,gz+1.4);
    for(const s of [-1,1]){ const px=gx+s*2.25; box(px,y0+3.1,gz,1.3,6.2,1.5,stone); box(px,y0+.25,gz,1.65,.5,1.85,dark); box(px,y0+6.25,gz,1.5,.3,1.7,dark);
      for(let k=0;k<4;k++) box(px,y0+1.2+k*1.3,gz+.77,.46,.46,.04,trim,0,1.5);
      gAdd(d,RC,px+s*1.1,y0,gz+1.7,0,.18,1.3,.18,iron); gAdd(d,RFR,px+s*1.1,y0+1.3,gz+1.7,0,.72,.36,.72,iron); gAdd(d,RS,px+s*1.1,y0+1.62,gz+1.7,0,.52,.32,.52,[1,.5,.15],2.4); fire(px+s*1.1,y0+2.1,gz+1.7,8); }
    box(gx,y0+6.95,gz,6.3,1.1,1.8,stone); box(gx,y0+7.6,gz,6.7,.28,2,dark); box(gx,y0+6.95,gz+.92,1.7,.62,.06,trim,0,1.7);
    for(let k=0;k<3;k++) box(gx-.9+k*.9,y0+8.05,gz,.5,.6,.5,stone);
    box(gx,y0+3,gz-.35,3.2,6,.2,[.02,.07,.08],0,.9);
    for(let k=0;k<5;k++) box(gx,y0-.05-k*.2,gz+.7-k*.42,3.2,.3,.45,dark);
    STAT_LIGHTS.push({x:gx,y:y0+2.4,z:gz+.9,r:7,c:[.3,1,.85]}); }
  /* ---- walls, pillars, water kerbs and flagstones ---- */
  let tc=0;
  for(let ty=OWH;ty<MH;ty++)for(let tx=0;tx<MW;tx++){ const t=map[ty*MW+tx]; const x=tx+.5, z=ty+.5, y0=.3;
    if(t===T.DWALL){ let face=null, diag=false; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(isOpen(tAt(tx+dx,ty+dy))){ face=[dx,dy]; break; }
      if(!face) for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) if(isOpen(tAt(tx+dx,ty+dy))) diag=true; if(!face&&!diag) continue;
      const sh=.88+hash2(tx,ty,21)*.2; box(x,y0+2.45,z,1.02,4.9,1.02,stone.map(v=>v*sh)); box(x,y0+.22,z,1.08,.44,1.08,dark); box(x,y0+4.95,z,1.08,.18,1.08,dark);
      if(face){ box(x+face[0]*.515,y0+1.6,z+face[1]*.515,face[0]?.03:1.02,.06,face[1]?.03:1.02,dark); box(x+face[0]*.515,y0+3.4,z+face[1]*.515,face[0]?.03:1.02,.06,face[1]?.03:1.02,dark);
        const k=(tx*7+ty*13)%9;
        if(k===0){ const fx=x+face[0]*.6, fz=z+face[1]*.6; box(fx,y0+2.3,fz,face[0]?.14:.2,.45,face[1]?.14:.2,iron); box(fx+face[0]*.06,y0+2.58,fz+face[1]*.06,.22,.12,.22,iron);
          gAdd(d,RS,fx+face[0]*.08,y0+2.78,fz+face[1]*.08,0,.18,.28,.18,[1,.55,.15],2.8); fire(fx+face[0]*.35,y0+2.9,fz+face[1]*.35,7); tc++; }
        else if(k===4){ const fx=x+face[0]*.54, fz=z+face[1]*.54; box(fx,y0+3,fz,face[0]?.04:.72,1.9,face[1]?.04:.72,cloth); box(fx,y0+3.97,fz,face[0]?.06:.82,.08,face[1]?.06:.82,gold);
          box(fx,y0+3.15,fz,face[0]?.06:.24,.24,face[1]?.06:.24,trim,0,1.3); box(fx,y0+2.08,fz,face[0]?.05:.72,.06,face[1]?.05:.72,gold); } } }
    else if(t===T.COLUMN){ box(x,y0+.2,z,1,.4,1,dark); gAdd(d,RC,x,y0+.4,z,0,.68,4.05,.68,stone); box(x,y0+4.55,z,.98,.3,.98,dark); box(x,y0+4.82,z,1.08,.22,1.08,stone);
      for(let k=0;k<3;k++) gAdd(d,RC,x,y0+1.1+k*1.25,z,0,.72,.06,.72,trim,.7); }
    else if(t===T.WATER&&ty>=OWH){ for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(tAt(tx+dx,ty+dy)===T.DFLOOR) box(x+dx*.5,.36,z+dy*.5,dx?.18:1.02,.3,dy?.18:1.02,dark); }
    else if(t===T.DFLOOR||t===T.DOOR){ const v=.86+hash2(tx,ty,7)*.22; box(x,y0+.01,z,.96,.04,.96,[.36*v,.38*v,.4*v]); } }
  /* ---- rooms ---- */
  { const [x,z]=Wp(2,10); for(let k=0;k<5;k++) box(x+1.2-k*.5,.3+(k+1)*.15,z,.5,(k+1)*.3,3,dark); box(x-.45,2.6,z,.06,2.4,2.4,[.1,.5,.45],0,1.4); STAT_LIGHTS.push({x:x+.4,y:2.4,z,r:8,c:[.3,1,.85]}); }
  for(const [lx,ly] of [[18,4],[32,4],[18,16],[32,16]]) brazier(lx,ly);
  { const [x0,z]=Wp(17,10), [x1]=Wp(33,10); box((x0+x1)/2,.35,z,x1-x0+1,.02,2.2,[.1,.28,.3]); for(const s of [-1,1]) box((x0+x1)/2,.357,z+s*1.1,x1-x0+1,.02,.12,gold); }
  { const [cx,cz]=Wp(47,10); gAdd(d,RC,cx,.335,cz,0,11,.012,11,[.1,.16,.18]); for(let k=0;k<32;k++){ const a=k/32*6.283; box(cx+Math.cos(a)*5.2,.352,cz+Math.sin(a)*5.2,.5,.02,.14,trim,-a,1.2); }
    for(let k=0;k<8;k++){ const a=k/8*6.283+.39; box(cx+Math.cos(a)*2.4,.352,cz+Math.sin(a)*2.4,1.4,.02,.1,trim,-a,1); }
    for(const a of [.785,2.356,3.927,5.498]){ const [bx,bz]=[cx+Math.cos(a)*6.2,cz+Math.sin(a)*6.2]; brazier(bx-VAULT.OX-.5,bz-VAULT.OY-.5); } }
  for(const [lx,ly] of [[61,3],[85,3],[61,18],[85,18]]) brazier(lx,ly);
  { const R=mulberry32(2626); for(let i=0;i<46;i++){ const a=R()*6.283, r=4.5+R()*2.4, [cx,cz]=Wp(81,31), x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; if(tAt(Math.floor(x),Math.floor(z))!==T.DFLOOR) continue;
      const s=.25+R()*.3; gAdd(d,RS,x,.3+s*.35,z,0,s,s*1.3,s,[.62,.7,.46],.35); }
    for(const [lx,ly] of [[76,27],[87,35],[76,35],[84,26]]){ const [x,z]=Wp(lx,ly); gAdd(d,RC,x,.335,z,0,2.2,.02,2.2,[.22,.34,.14],.2); gAdd(d,RS,x,.45,z,0,.4,.5,.4,[.4,1,.6],2.2); STAT_LIGHTS.push({x,y:1.2,z,r:6,c:[.4,1.1,.6]}); } }
  for(const [lx,ly] of [[95,28],[95,34],[116,28],[116,34]]) brazier(lx,ly,[.35,1,.85]);
  { const [x0,z]=Wp(94,31), [x1]=Wp(135,31); box((x0+x1)/2,.35,z,x1-x0+1,.02,2.4,[.1,.28,.3]); for(const s of [-1,1]) box((x0+x1)/2,.357,z+s*1.2,x1-x0+1,.02,.12,gold); }
  { const [x,z]=Wp(138,31); box(x,.45,z,5,.3,9,stone); box(x+.5,.75,z,3.6,.3,6.6,dark); box(x+1.1,1.05,z,2.2,.3,4,stone);
    box(x+1.5,1.6,z,1.1,.8,1.6,[.1,.3,.32]); box(x+2.05,2.9,z,.3,3.2,1.9,[.1,.3,.32]); box(x+2.0,4.6,z,.34,.5,1.2,gold); box(x+1.95,3.4,z,.06,.6,.6,trim,0,2);
    for(const s of [-1,1]){ box(x+1.5,2.15,z+s*.9,1.1,.18,.18,gold); } STAT_LIGHTS.push({x:x+1,y:3,z,r:9,c:[.35,1,.85]}); }
  for(const [lx,ly] of [[124,30],[124,32],[131,23],[131,39]]) brazier(lx,ly,[.35,1,.85]);
  /* lintels over the two portcullis arches */
  for(const D of VAULT.doors){ const cz=(D.y0+D.y1+1)/2; box(D.x+.5,.3+4.15,cz,1.06,1.5,D.y1-D.y0+1,stone); box(D.x+.5,.3+3.45,cz,1.1,.14,D.y1-D.y0+1,dark); }
}
/* ---------- v22: Sunken Vault moving parts: portcullises that lift when their boss falls, the gate's swirl ---------- */
function drawVaultDyn(near,t){
  for(const D of VAULT.doors){ const cx=D.x+.5, cz=(D.y0+D.y1+1)/2; if(!near(cx*TS,cz*TS,40)) continue; const b=VAULT.boss[D.boss]; D.lift=lerp(D.lift||0,b&&b.dead?1:0,.035);
    const y0=.3+D.lift*3.25, W=D.y1-D.y0+1, iron=[.17,.17,.19]; mreset(); mtr(cx,y0,cz);
    for(let k=0;k<=W*3;k++){ const z=-W/2+.12+k*(W-.24)/(W*3); P(GEO.cyl,.075,3.3,.075,iron,0,0,0,z); P(GEO.cone,.1,.18,.1,iron,0,0,-.0,z); }
    for(let h=0;h<5;h++) P(GEO.box,.1,.08,W,iron,0,0,.25+h*.72,0); }
  if(near(VAULT.gate.x,VAULT.gate.y,30)&&Math.random()<.55){ const y=hgt(99.5+VGO[0],48.5+VGO[1]); P3(99.5+VGO[0]+(Math.random()-.5)*2.6,y+.3+Math.random()*4.6,47.05+VGO[1],(Math.random()-.5)*.15,.22,.35,1.7,.12,Math.random()<.5?'#4affd8':'#bffff2',{glow:true,drag:.97}); }
}

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
  OFS(CRO);
  for(const [x,z] of [[132,10],[148,10],[132,22],[148,22],[136,23],[144,23],[140,9]]){ const y0=hgt(x+.5,z+.5); gAdd(d,RC,x+.5,y0,z+.5,0,.22,1.6,.22,[.15,.14,.16]); gAdd(d,RFR,x+.5,y0+1.6,z+.5,0,.7,.3,.7,[.2,.2,.22]); gAdd(d,RS,x+.5,y0+1.9,z+.5,0,.45,.3,.45,[.5,1,.6],2.4); STAT_LIGHTS.push({x:x+.5,y:y0+2.3,z:z+.5,r:9,c:[.4,1.1,.6],fire:true,ghost:true}); }
  { const y0=hgt(140.5,11.5); gAdd(d,RC,140.5,y0,11.5,0,5.4,.3,5.4,[.18,.18,.22]); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; gAdd(d,RB,140.5+Math.cos(a)*2.3,y0+.32,11.5+Math.sin(a)*2.3,-a,.7,.05,.25,[.4,.8,1],1.8); } STAT_LIGHTS.push({x:140.5,y:y0+.6,z:11.5,r:7,c:[.4,.8,1.3]}); }
  OFS(WPT(112.5,59.5).map(Math.round));
  { const x=112.5, z=59.5, y0=hgt(x,z); for(const s of [-1,1]) gAdd(d,RB,x,y0+1.6,z+s*2.8,0,.9,3.2,.9,[.5,.48,.46]); gAdd(d,RB,x,y0+3.35,z,0,1.0,.4,6.6,[.45,.43,.4]); gAdd(d,RB,x+.52,y0+2.6,z,0,.06,.9,1.6,[.25,.35,.6]); }
  OFS(WPT(142,74.5).map(Math.round));
  { const x=142, z=74.5, y0=hgt(x,z); for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; gAdd(d,RCN,x+Math.cos(a)*2,y0-.2,z+Math.sin(a)*2,a,.6,2.2+(k%2),.6,[.7,.9,1],.9); } STAT_LIGHTS.push({x,y:y0+1,z,r:6,c:[.4,.8,1.2]}); }
  OFS(null);
  { const n=NPCS.find(q=>q.id==='doran'); if(n){ const x=n.x/TS, z=n.y/TS-1.3, y0=.55; box(x,y0+.45,z,.9,.9,.6,[.2,.2,.22]); box(x,y0+.95,z,1.2,.2,.45,[.25,.25,.28]);
    box(x+1.6,y0+.6,z,1.2,1.2,1.2,[.45,.42,.4]); box(x+1.6,y0+.7,z+.61,.6,.45,.05,[1,.5,.1],0,2); STAT_LIGHTS.push({x:x+1.6,y:y0+1,z:z+1,r:6,c:[1.4,.55,.15],fire:true});
    for(const s of [-1,1]) gAdd(d,RC,x+s*1.8+.6,y0,z-.9,0,.12,2.4,.12,wood); box(x+.6,y0+2.4,z-.9,4,.12,.12,wood); } }
  /* ---- the Amberfield Stables, outside the East Gate: a timber barn, a fenced paddock, hay, a trough and lanterns ---- */
  { const wood=[.46,.31,.17], dark=[.27,.18,.1], roofC=[.44,.2,.13], stone=[.52,.5,.47], hay=[.86,.72,.36], twine=[.4,.28,.14];
    OFS(STO); const X0=85,X1=97,Z0=64,Z1=73;
    const post=(x,z)=>{ const y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.17,1.28,.17,dark); box(x,y0+1.3,z,.22,.06,.22,wood); };
    const rail=(x0,z0,x1,z1)=>{ const mx=(x0+x1)/2, mz=(z0+z1)/2, y0=hgt(mx,mz), len=Math.hypot(x1-x0,z1-z0), ry=-Math.atan2(z1-z0,x1-x0); for(const h of [.55,1.02]) box(mx,y0+h,mz,len+.02,.1,.07,wood,ry); };
    for(let x=X0;x<X1;x++){ post(x+.5,Z0+.5); rail(x+.5,Z0+.5,x+1.5,Z0+.5); if(x<86||x>89){ post(x+.5,Z1+.5); rail(x+.5,Z1+.5,x+1.5,Z1+.5); } }
    for(let z=Z0;z<Z1;z++){ post(X0+.5,z+.5); rail(X0+.5,z+.5,X0+.5,z+1.5); post(X1+.5,z+.5); rail(X1+.5,z+.5,X1+.5,z+1.5); } post(X1+.5,Z1+.5); post(90.5,Z1+.5);
    { const hx=86.5, hz=Z1+.5, y0=hgt(hx,hz); for(const h of [.5,1.0]) box(hx+.55*Math.cos(1.1),y0+h,hz-.55*Math.sin(1.1),1.15,.1,.07,wood,1.1); gAdd(d,RC,hx+1.1*Math.cos(1.1),y0,hz-1.1*Math.sin(1.1),0,.12,1.1,.12,dark); }
    const bx=95, bz=77, by=hgt(bx,bz);
    box(bx,by+.18,bz,6.3,.36,4.3,stone); for(const s of [-1,1]) box(bx,by+1.6,bz+s*1.95,6,2.55,.16,wood); box(bx+2.92,by+1.6,bz,.16,2.55,3.9,wood);
    for(const s of [-1,1]) box(bx-2.92,by+1.6,bz+s*1.35,.16,2.55,1.2,wood); box(bx-2.92,by+2.68,bz,.16,.42,1.5,wood); box(bx-2.86,by+1.28,bz,.04,1.95,1.5,[.07,.05,.04]);
    for(const s of [-1,1]){ const hx=bx-2.95, hz=bz+s*.75, a=s*1.05; box(hx-.45*Math.sin(Math.abs(a)),by+1.28,hz+s*.45*Math.cos(a),.07,1.95,.9,wood,-s*(Math.PI/2-1.05)); }
    for(const [cx,cz] of [[-3,-2],[3,-2],[-3,2],[3,2]]) box(bx+cx,by+1.65,bz+cz,.26,2.75,.26,dark); for(const s of [-1,1]) box(bx,by+2.92,bz+s*2,6.3,.2,.24,dark);
    for(let k=-2;k<=2;k++) for(const s of [-1,1]) box(bx+k*1.4,by+1.65,bz+s*2.04,.12,2.5,.04,dark);
    gAdd(d,RP,bx,by+3.0,bz,Math.PI/2,4.9,1.75,6.9,roofC); box(bx,by+4.72,bz,7,.14,.2,dark);
    box(bx-3.02,by+3.55,bz,.06,.62,.7,[.07,.05,.04]); box(bx-3.1,by+3.3,bz,.18,.14,.6,hay);
    const bale=(x,z,h,ry)=>{ const y0=hgt(x,z)+h; box(x,y0+.3,z,.95,.6,.62,hay,ry||0); for(const o of [-.25,.25]) box(x+o*Math.cos(ry||0),y0+.3,z-o*Math.sin(ry||0),.05,.62,.64,twine,ry||0); };
    bale(86.4,65.4,0); bale(87.5,65.4,0); bale(86.95,65.4,.6); bale(91,79.3,0,.4); bale(91.1,80.3,0,.1);
    { const tx=93, tz=65.4, y0=hgt(tx,tz); box(tx,y0+.28,tz,2.2,.5,.7,wood); box(tx,y0+.5,tz,2,.04,.5,[.24,.44,.55],0,.15); for(const s of [-1,1]) box(tx+s*1.05,y0+.2,tz,.12,.4,.75,dark); }
    for(const [x,z] of [[91.4,75.6],[91.4,78.4],[88,80.6]]){ const y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.14,2.2,.14,dark); box(x,y0+2.15,z,.5,.08,.08,dark); box(x+.22,y0+1.88,z,.2,.28,.2,[1,.78,.4],0,1.8); STAT_LIGHTS.push({x:x+.22,y:y0+1.9,z,r:6,c:[1,.72,.38],night:true,lamp:true}); }
    { const x=87.2, z=79.6, y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.12,1.9,.12,dark); box(x,y0+1.7,z,1.1,.4,.07,wood,-.3); box(x+.02,y0+1.7,z+.04,.3,.24,.03,[.95,.78,.3],-.3,.7); }
    { const x0=90.2; for(const z of [78.9,80.7]){ const y0=hgt(x0,z); gAdd(d,RC,x0,y0,z,0,.15,1.1,.15,dark); } box(x0,hgt(x0,79.8)+.95,79.8,.09,.09,1.9,wood); }
    for(const [x,z] of [[93.2,79.4],[93.9,79.6]]){ const y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,.6,.85,.6,[.42,.28,.15]); for(const h of [.15,.68]) gAdd(d,RC,x,y0+h,z,0,.62,.06,.62,[.25,.22,.2]); }
    for(const [x,z,r] of [[96.6,79.5,.3],[97.3,79.4,.9]]){ const y0=hgt(x,z); box(x,y0+.3,z,.6,.6,.6,[.5,.36,.2],r); }
    STABLE.y=hgt(91,68.5); STABLE.x=91+OFX; STABLE.z=68.5+OFY; STABLE.ox=OFX; STABLE.oz=OFY; OFS(null);
    /* the old stable yard inside Hearthmere becomes a little well square */
    { const x=TOWN.x+10.5, z=TOWN.y-2.6, y0=hgt(x,z); gAdd(d,RC,x,y0,z,0,1.5,.72,1.5,[.56,.53,.49]); gAdd(d,RC,x,y0+.7,z,0,1.62,.1,1.62,[.44,.42,.4]); gAdd(d,RC,x,y0+.45,z,0,1.18,.3,1.18,[.1,.2,.26],.12);
      for(const s of [-1,1]) gAdd(d,RC,x+s*.66,y0+.7,z,0,.1,1.25,.1,dark); box(x,y0+1.95,z,1.5,.08,.1,dark); gAdd(d,RP,x,y0+2.05,z,Math.PI/2,1.1,.55,1.8,roofC); box(x+.25,y0+1.45,z,.18,.2,.18,wood);
      for(const [bx2,bz2,ry] of [[x+2.3,z-.6,0],[x-2.3,z-.6,0]]){ const yy=hgt(bx2,bz2); box(bx2,yy+.42,bz2,1.4,.08,.42,wood,ry); for(const s of [-1,1]) box(bx2+s*.55,yy+.2,bz2,.08,.4,.38,dark,ry); }
      for(const [px,pz] of [[x+1.6,z+1.1],[x-1.6,z+1.1],[x+3.3,z+.9]]){ const yy=hgt(px,pz); box(px,yy+.22,pz,.8,.44,.5,[.4,.27,.15]); for(let k=0;k<5;k++) gAdd(d,RS,px-.28+k*.14,yy+.52,pz+(k%2?.08:-.08),0,.16,.16,.16,[[.95,.4,.5],[1,.85,.3],[.7,.5,.95],[1,.6,.3],[.95,.95,.9]][k],.15); } } }
}
/* ---------- mount ---------- */
/* ---------- v17: mounts rebuilt with real anatomy and a four-beat gallop ---------- */
function steedMotion(walk,mv,cel){ const t=now(), ph=walk*.45; return {ph, y:.1*mv*(.5+.5*Math.sin(ph+1.0))+(cel?.1+Math.sin(t*2)*.05:0), p:.065*mv*Math.sin(ph+2.6)}; }
function drawCelestial(o){ return drawHorse(o); }
const STEED_LEATHER=[.3,.17,.08], STEED_METAL=[.56,.6,.68]; LEATHERS.add(STEED_LEATHER); METALS.add(STEED_METAL);
function drawHorse(o){ const md=MATD; MATD=6; const M0=MOUNTS[o.m]||MOUNTS[1]; if(M0.mane) HAIRS.add(M0.mane); try{ return drawHorse0(o); } finally{ MATD=md; } }
function drawHorse0(o){ const M=MOUNTS[o.m]||MOUNTS[1]; const cel=!!M.celestial, t=now(), mv=o.mv||0, idle=1-mv, free=!!o.free;
  const SM=steedMotion(o.walk||0,mv,cel), ph=SM.ph, A=cel?.5:1, E=cel?.35:0; if(o.an===me&&mv>.3&&!cel){ const hb=Math.floor(ph/1.5708); if(me._hb!==hb){ me._hb=hb; try{ snd('hoof',null,null,.55); }catch(e){} } }
  const col=cel?[.42,.68,1]:M.col, deep=cel?[.3,.38,.9]:M.col.map(v=>v*.8), lt=cel?[.62,.82,1]:M.col.map(v=>Math.min(1,v*1.16+.03));
  const mane=cel?[.85,.93,1]:M.mane, hoof=cel?[.8,.95,1]:[.09,.07,.06], hoofE=cel?1.6:0;
  const sock=cel?[.36,.5,.95]:M.armor?[.8,.8,.84]:M.elk?M.col.map(v=>v*.55):M.col.map(v=>v*.5);
  const leather=STEED_LEATHER, metal=STEED_METAL, trimC=M.armor?[.86,.7,.32]:M.elk?[.8,.5,.2]:cel?[.98,.86,.45]:[.78,.62,.3];
  const blanket=M.armor?[.5,.07,.09]:M.elk?[.62,.42,.18]:cel?[.25,.3,.62]:[.2,.3,.55];
  const graze=free?Math.pow(Math.max(0,Math.sin(t*.22+o.x*1.3)),3):0, br=1+Math.sin(t*(1.6+mv*3))*.014, bank=(o.an&&o.an.bankS)||0;
  mreset(); mtr(o.x,o.y+SM.y,o.z); mry(-o.face); mtr(0,1.3,0); mrz(SM.p); mrx(bank*.6); mtr(0,-1.3,0);
  /* legs: transverse gallop (hind-left, hind-right, fore-left, fore-right); at rest one hind hoof is cocked */
  for(const [fr,s,of] of [[1,1,.54],[1,-1,.42],[0,1,.12],[0,-1,0]]){ const th=ph-of*6.283, A1=Math.sin(th)*(fr?.78:.62)*mv, lift=Math.max(0,Math.cos(th))*mv;
    const cock=(!fr&&s>0)?idle*Math.pow(Math.max(0,Math.sin(t*.35+o.x)),2):0, paw=(fr&&s>0&&free)?idle*Math.max(0,Math.sin(t*.8+o.z*2))**8:0;
    mpush();
    if(fr){ mtr(.6,1.1,s*.21); mrz(A1-.04+paw*.6); P(GEO.sph,.32,.44,.2,lt,E,0,-.08,0,A); P(GEO.limb,.17,.5,.18,col,E,0,0,0,A); mtr(0,-.5,0); P(GEO.sph,.135,.14,.13,col,E,0,0,0,A);
      mrz(-lift*1.5-paw*1.4); P(GEO.limb,.105,.4,.11,sock,E,0,0,0,A); mtr(0,-.4,0); P(GEO.sph,.12,.12,.12,sock,E,0,0,0,A); mrz(lift*.5-A1*.6+.1+paw*.5); }
    else { mtr(-.62,1.22,s*.22); mrz(A1+.25+cock*.08); P(GEO.sph,.48,.54,.24,lt,E,0,-.12,0,A); P(GEO.limb,.25,.4,.25,col,E,0,0,0,A); mtr(0,-.4,0); P(GEO.sph,.16,.16,.16,col,E,0,0,0,A);
      mrz(-.78-lift*.5-cock*.25); P(GEO.limb,.15,.37,.15,col,E,0,0,0,A); mtr(0,-.37,0); P(GEO.sph,.13,.15,.12,sock,E,0,0,0,A);
      mrz(.53+lift*1.1+cock*.55-A1*.3); P(GEO.limb,.1,.32,.105,sock,E,0,0,0,A); mtr(0,-.32,0); P(GEO.sph,.12,.12,.12,sock,E,0,0,0,A); mrz(-lift*.4+cock*.5); }
    P(GEO.limb,.09,.1,.095,sock,E,0,0,0,A); mtr(0,-.1,0);
    if(M.armor||M.elk) P(GEO.blob,.21,.14,.21,M.armor?[.93,.93,.96]:M.mane,E,0,.03,0,A);
    P(GEO.frus,.18,.085,.19,hoof,hoofE,.012,-.085,0,cel?.9:1); mpop(); }
  /* body: barrel, deep chest, rounded hindquarters, withers and croup, shoulder and haunch muscle */
  P(GEO.sph,1.55,.8*br,.76*br,col,E,-.02,1.32,0,A);
  P(GEO.sph,.9,.95,.72,col,E,.52,1.3,0,A); P(GEO.sph,.95,.94,.78,col,E,-.6,1.36,0,A);
  P(GEO.sph,.7,.36,.62,col,E,-.62,1.6,0,A); P(GEO.sph,.56,.34,.42,col,E,.48,1.6,0,A);
  P(GEO.sph,1.15,.36,.6,deep,E,0,1.03,0,A);
  for(const s of [-1,1]){ P(GEO.sph,.6,.72,.16,lt,E,.55,1.3,s*.3,A); P(GEO.sph,.66,.7,.18,lt,E,-.6,1.36,s*.32,A); }
  if(M.elk) P(GEO.sph,.5,.6,.72,[.86,.8,.66],0,-.9,1.42,0);
  /* tail: streams out behind at the gallop, swishes at rest */
  mpush(); mtr(-1.02,1.64,0); mrz(-1.05+mv*.6+Math.sin(ph*2)*.08*mv); mry(Math.sin(t*1.3+o.x)*.3*idle);
  const tn=M.elk?2:7; for(let k=0;k<tn;k++){ mrx(Math.sin(t*(1.8+mv*3)+k*.7)*(.05+idle*.06+mv*.04)); const w=M.elk?.17:(.12+Math.sin(k/(tn-1)*Math.PI)*.11);
    P(GEO.limb,w,.21,w*.8,cel?(k%2?[.9,.95,1]:[.6,.8,1]):(k%2?mane:mane.map(v=>v*.86)),cel?1:0,0,0,0,cel?.75:1); mtr(0,-.2,0); mrz(.12-mv*.1); }
  mpop();
  /* neck, mane and head */
  const nod=Math.sin(ph*2+.5)*.06*mv+Math.sin(t*1.1+o.x)*.03*idle, na=Math.PI-.62+nod*.6-graze*1.35, hA=-.78+nod*.5-graze*.55;
  mpush(); mtr(.74,1.48,0); mrz(na);
  P(GEO.limb,.44,.9,.36,col,E,0,0,0,A); P(GEO.sph,.52,.62,.42,col,E,-.02,-.12,0,A); P(GEO.sph,.3,.56,.27,lt,E,-.11,-.44,0,A);
  for(let k=0;k<8;k++){ const yy=-.06-k*.1; if(cel){ mpush(); mtr(.17,yy,0); mrz(-na+.4-mv*.4); P(GEO.cone,.1,.3+(k%2)*.12,.05,k%2?[.9,.95,1]:[.7,.86,1],.9,0,0,0,.75); mpop(); continue; }
    P(GEO.box,.07,.12,.07,mane,0,.18,yy,0); mpush(); mtr(.17,yy,.03); mrz(-na-mv*.7); mrx(.45+Math.sin(t*(2+mv*5)+k*.8)*(.08+mv*.16)); P(GEO.limb,.065,.25+(k%3)*.06,.035,k%2?mane.map(v=>v*.85):mane,0); mpop(); }
  if(M.elk) for(let k=0;k<6;k++) P(GEO.blob,.27,.25,.27,[.88,.82,.7],0,-.14,-.15-k*.11,0);
  if(M.armor) for(let k=0;k<4;k++){ P(GEO.box,.12,.2,.43,metal,.15,.13,-.12-k*.19,0); P(GEO.box,.13,.03,.44,trimC,.3,.13,-.03-k*.19,0); }
  mtr(0,-.88,0); mrz(-na+hA);
  P(GEO.sph,.42,.4,.36,col,E,.04,.02,0,A); P(GEO.box,.52,.25,.25,col,E,.32,-.01,0,A); P(GEO.sph,.3,.27,.27,deep,E,.56,-.04,0,A);
  for(const s of [-1,1]){ P(GEO.sph,.3,.28,.12,col,E,.03,-.04,s*.12,A);
    P(GEO.sph,.07,.06,.05,[.04,.03,.03],0,.69,0,s*.07);
    P(GEO.sph,.085,.09,.06,cel?[.6,.95,1]:[.05,.03,.02],cel?4:.1,.14,.08,s*.165); if(!cel) P(GEO.sph,.026,.026,.02,[1,1,1],1,.165,.1,s*.19);
    mpush(); mtr(-.08,.18,s*.09); mrz(.25+Math.sin(t*2.3+s*1.7+o.x)*.1*idle-mv*.35); mrx(-s*(.18+Math.max(0,Math.sin(t*.9+s))*.15*idle)); P(GEO.cone,.09,.24,.06,col,E,0,0,0,A); P(GEO.cone,.05,.16,.02,cel?[.8,.9,1]:[.25,.15,.12],cel?.8:0,.012,.02,0); mpop(); }
  P(GEO.box,.4,.025,.18,[.06,.04,.04],0,.48,-.13,0);
  if(!cel) P(GEO.blob,.2,.12,.18,mane,0,-.02,.2,0);
  P(GEO.box,.05,.28,.28,leather,0,.44,-.02,0); P(GEO.box,.04,.05,.38,leather,0,-.04,.17,0); for(const s of [-1,1]){ P(GEO.box,.38,.035,.02,leather,0,.22,0,s*.135); P(GEO.sph,.05,.05,.02,trimC,.4,.57,-.1,s*.14); }
  if(M.armor){ P(GEO.box,.56,.18,.3,metal,.15,.3,.09,0); P(GEO.box,.04,.17,.04,trimC,.3,.32,.19,0); mpush(); mtr(-.05,.22,0); mrz(.35); P(GEO.cone,.08,.3,.04,trimC,.3); mpop();
    mpush(); mtr(-.12,.2,0); mrz(.9+Math.sin(t*3)*.1+mv*.4); P(GEO.limb,.07,.42,.04,[.85,.1,.1],.2); mpop(); }
  if(M.elk) for(const s of [-1,1]){ const ac=[.92,.86,.7]; mpush(); mtr(-.06,.2,s*.1); mrx(Math.PI-s*.6); mrz(.35); P(GEO.limb,.07,.42,.07,ac,.15); mtr(0,-.42,0);
    for(let k=0;k<3;k++){ mpush(); mrz(-.95); mrx(s*.25); P(GEO.limb,.045,.27-k*.04,.045,ac,.15); mtr(0,-.26+k*.04,0); P(GEO.sph,.055,.055,.055,[1,.55,.15],2.4); mpop(); mrz(.28); P(GEO.limb,.058-k*.008,.25,.058-k*.008,ac,.15); mtr(0,-.25,0); }
    P(GEO.sph,.065,.065,.065,[1,.6,.2],2.6); mpop(); }
  if(M.goat){ const hc=[.42,.36,.28]; for(const s of [-1,1]){ mpush(); mtr(-.04,.24,s*.09); mrx(-s*.3); mrz(1.0);
      for(let k=0;k<8;k++){ P(GEO.limb,.075-k*.007,.11,.075-k*.007,hc.map(v=>v*(1+(k%2)*.12)),0); mtr(0,-.1,0); mrz(.62); mrx(-s*.06); } mpop(); }
    P(GEO.cone,.06,.22,.05,[.96,.94,.9],0,.3,-.26,0); P(GEO.sph,.07,.05,.06,[.96,.94,.9],0,.31,-.13,0); }
  if(cel){ mpush(); mtr(.3,.22,0); mrz(-.95); P(GEO.cone,.07,.55,.07,[1,.92,.7],1.6,0,0,0,.95); mpop(); }
  mpop();
  /* saddle, blanket, girth, stirrups and reins */
  P(GEO.box,.9,.05,.98,blanket,cel?.4:0,-.04,1.705,0); P(GEO.box,.93,.025,1.0,trimC,cel?.6:.15,-.04,1.68,0);
  for(const s of [-1,1]){ P(GEO.box,.86,.26,.03,blanket,cel?.4:0,-.04,1.6,s*.4); P(GEO.box,.87,.03,.035,trimC,cel?.6:.15,-.04,1.47,s*.4); }
  P(GEO.box,.62,.1,.56,leather,0,-.04,1.77,0); P(GEO.sph,.16,.24,.5,leather,0,-.33,1.84,0); P(GEO.sph,.14,.22,.34,leather,0,.27,1.84,0); P(GEO.cyl,.06,.1,.06,trimC,.3,.3,1.97,0);
  P(GEO.sph,.12,.85,.81,leather,0,.2,1.32,0);
  for(const s of [-1,1]){ mpush(); mtr(-.02,1.74,s*.34); mrx(-s*.1+Math.sin(ph+s)*.12*mv); P(GEO.limb,.035,.52,.03,leather,0); mtr(0,-.52,0); P(GEO.cyl,.14,.035,.11,metal,.2,0,-.02,0); mpop(); }
  if(!free){ const tx=.74+.88*Math.sin(na), ty=1.48-.88*Math.cos(na), bx=tx+.57*Math.cos(hA)+.1*Math.sin(hA), by=ty+.57*Math.sin(hA)-.1*Math.cos(hA);
    for(const s of [-1,1]){ const vx=.3-bx, vy=1.9-by, ln=Math.hypot(vx,vy); mpush(); mtr(bx,by,s*.14); mrz(Math.atan2(vx,-vy)); mrx(s*.03); P(GEO.limb,.025,ln,.02,leather,0); mpop(); } }
  if(M.armor){ P(GEO.sph,.6,.82,.86,metal,.12,.74,1.24,0); P(GEO.sph,.62,.05,.88,trimC,.3,.74,1.62,0); P(GEO.sph,1.0,.5,.86,metal,.12,-.62,1.62,0); P(GEO.sph,1.02,.04,.88,trimC,.3,-.62,1.5,0);
    for(const s of [-1,1]){ P(GEO.box,1.7,.5,.03,blanket,0,-.05,1.3,s*.42); P(GEO.box,1.72,.05,.035,trimC,.3,-.05,1.06,s*.42); P(GEO.sph,.16,.16,.03,trimC,.6,-.05,1.32,s*.44); } }
  /* light, magic and hoof dust */
  if(cel){ P(GEO.sph,.28,.24,.24,[1,.95,.8],1.6+Math.sin(t*3)*.4,.15,1.32,0,.9);
    const fl=mv>.2?Math.sin(t*7)*.55:Math.sin(t*2.2)*.25;
    for(const s of [-1,1]){ mpush(); mtr(.15,1.66,s*.3); mrx(-s*(.45+fl)); P(GEO.wing,1.25,.8,1.25*s,[.6,.8,1],.5,0,0,0,.35); P(GEO.wing,.85,.8,.85*s,[.85,.92,1],.8,.05,.02,0,.3); mpop(); }
    addLight(o.x,o.y+1.5,o.z,4.5,[.4,.6,1.1]); if(Math.random()<.6) P3(o.x+(Math.random()-.5)*1.4,o.y+.2+Math.random()*1.4,o.z+(Math.random()-.5)*1.4,0,.3,0,1.3,.08,Math.random()<.5?'#bfe8ff':'#fff3c0',{glow:true,drag:.98});
    if(mv>.2&&Math.random()<.8) P3(o.x,o.y+.1,o.z,(Math.random()-.5)*.5,.4,(Math.random()-.5)*.5,1.6,.14,'#9fd8ff',{glow:true,drag:.95}); }
  else if(M.elk){ addLight(o.x,o.y+2.2,o.z,4,[1,.6,.3]); if(Math.random()<.2) burst3(o.x+(Math.random()-.5),o.y+.3,o.z+(Math.random()-.5),'#ffb03a',1,.4,{glow:true,up:1}); }
  if(!cel&&mv>.6&&Math.random()<.35&&GFX.q!=='low'){ const fx=Math.cos(o.face), fz=Math.sin(o.face); P3(o.x-fx*(.6+Math.random()*.6)+(Math.random()-.5)*.5,o.y+.08,o.z-fz*(.6+Math.random()*.6)+(Math.random()-.5)*.5,-fx*.4,.35+Math.random()*.3,-fz*.4,.9,.32,'#a89a7c',{big:true,drag:.94}); }
}
/* ---------- dynamic world pieces ---------- */
function drawExtras(near,t){
  drawLootBags(near,t); drawVaultDyn(near,t);
  if(STABLE.x&&near(STABLE.x*TS,STABLE.z*TS,70)){ const hs=[[-3.6,-2.2,.3,1,0],[2.4,-1.6,2.6,2,0],[3.6,2,4,3,1],[-1.6,2.1,1,1,1],[.4,-.2,5.4,2,0]];
    hs.forEach(([dx,dz,f,m,walker],i)=>{ let X=STABLE.x+dx, Z=STABLE.z+dz, face=f+Math.sin(t*.3+dx)*.25, mv=0, walk=0;
      if(walker){ const w=t*.12+i*2.1; X+=Math.cos(w)*1.3; Z+=Math.sin(w)*.9; face=Math.atan2(Math.cos(w)*.9,-Math.sin(w)*1.3); mv=.32; walk=w*4.2; }
      drawHorse({x:X,y:hgt(X,Z),z:Z,face,mv,walk,m,free:1}); });
    { const X=95.4+(STABLE.ox||0), Z=77.6+(STABLE.oz||0); drawHorse({x:X,y:hgt(X,Z),z:Z,face:Math.PI+Math.sin(t*.25)*.1,mv:0,walk:0,m:2,free:1}); } }
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
    s.onmouseenter=e=>showTip(e,`<div class="nm">${ab.name}</div><div style="color:var(--dim);font-size:13px">${ab.cost?costLabel(ab):'No cost'}${ab.cast?' · '+ab.cast+'s cast':' · Instant'}${ab.cd?' · '+ab.cd+'s cooldown':''}${ab.rng?' · '+ab.rng+' yd':''}</div><div>${ab.desc}</div>${abilTipStats(ab)}${me.c.lvl<ab.lvl?`<div style="color:#ff7a6a">Learned at level ${ab.lvl}</div>`:''}`);
    s.onmouseleave=hideTip; bar.appendChild(s); });
  const p=document.createElement('div'); p.className='slot'; p.style.background='radial-gradient(circle at 35% 30%,#ff8a8a,#5a0f12)'; p.innerHTML=`<span class="k">Q</span><span class="ic">${iconSVG('potion')}</span><span class="cnt" id="potCnt"></span><div class="cd"></div><div class="cdt"></div>`;
  p.onclick=usePotion; p.onmouseenter=e=>showTip(e,'<div class="nm">Healing Draught</div><div>Restores 38% of your health. 30s cooldown. Buy more from Mira.</div>'); p.onmouseleave=hideTip; bar.appendChild(p);
  buildAuraBar();
  $('pPort').textContent=CLS[me.c.cls].glyph; $('pPort').style.background=`radial-gradient(circle at 35% 30%,${shade(col,.2)},${shade(col,-.55)})`;
  $('pResBar').className='bar '+CLS[me.c.cls].res; $('castbar').style.setProperty('--cc',shade(col,.25)); $('castbar').style.setProperty('--cc2',shade(col,-.45)); $('pPort').style.borderColor=col; $('pPort').style.boxShadow=`inset 0 0 12px rgba(0,0,0,.7),0 0 10px ${col}`;
}
function abilTipStats(ab){ if(!me) return ''; const o=SV_MUL; const out=[]; const R=n=>Math.round(n);
  try{ const tal=1+TAL('ab:'+ab.id), hm=1+TAL('heal')+TAL('ab:'+ab.id); SV_MUL=1;
    const dm=(1+TAL('dmg')+TAL('ab:'+ab.id))*(1+songFx().dmg)*(ab.songBonus&&me.song?1.15+(me.c.eq.weapon&&me.c.eq.weapon.leg==='bard'?.15:0):1);
    const rng=v=>`${R(v*.92)}–${R(v*1.08)}`;
    if(ab.dmg) out.push(`Damage: <b>${rng(scaleV(ab.dmg)*dm)}</b>${ab.songBonus&&me.song?' <span style="color:#ffd34a">(singing)</span>':''}`);
    if(ab.aoeDmg) out.push(`Damage to each enemy: <b>${rng(scaleV(ab.aoeDmg)*dm)}</b>${ab.ticks?` ×${ab.ticks}`:''}`);
    if(ab.heal) out.push(`Heals: <b>${rng(scaleV(ab.heal)*hm)}</b>`);
    if(ab.aoeHeal) out.push(`Heals each ally: <b>${rng(scaleV(ab.aoeHeal)*hm)}</b>`);
    if(ab.hot) out.push(`Heals <b>${R(scaleV(ab.hot)*hm)}</b> every 2s`);
    if(ab.absorb) out.push(`Absorbs: <b>${R(scaleV(ab.absorb)*hm*(1+TAL('absorb')))}</b> damage`);
    if(ab.cryHeal) out.push(`Heals you and nearby allies for <b>${R(scaleV(ab.cryHeal)*hm)}</b> and shields them for <b>${R(scaleV(ab.cryAbs)*hm*(1+TAL('absorb')))}</b>`);
    if(ab.stun) out.push(`Stun: <b>${ab.stun}s</b>`); if(ab.root) out.push(`Roots for <b>${ab.root}s</b>`);
    if(ab.song){ const S=SONGDEF[ab.song], mul=1+TAL('song')+(me.c.eq.weapon&&me.c.eq.weapon.leg==='bard'?.25:0), f=[]; if(S.dmg) f.push(`+${R(S.dmg*mul*100)}% damage`); if(S.mit) f.push(`${R(Math.min(.4,S.mit*mul)*100)}% less damage taken`); if(S.spd) f.push(`+${R(S.spd*mul*100)}% movement speed`); if(S.as) f.push(`+${R(S.as*mul*100)}% attack speed`);
      out.push(`With your talents: <b>${f.join(', ')}</b>${mul>1?` <span style="color:#8f8">(songs ${R((mul-1)*100)}% stronger)</span>`:''}`); }
    if(ab.encore) out.push(`Lasts <b>${ab.encore+(TAL('anthem')?4:0)}s</b>`);
    if(ab.banner) out.push(`Stands for <b>${R(ab.banner*(1+(TAL('anthem')?.5:0)))}s</b>`);
    if(ab.cd>=3&&TAL('cdr')) out.push(`Cooldown with talents: <b>${(ab.cd*(1-TAL('cdr'))).toFixed(1)}s</b>`);
    if(tal>1) out.push(`<span style="color:#8f8">Talents: +${R((tal-1)*100)}% to this ability</span>`);
  }catch(e){} finally{ SV_MUL=o; }
  return out.length?`<div style="margin-top:4px;font-size:13px;color:#e8dcc0;border-top:1px solid rgba(255,255,255,.12);padding-top:3px">${out.join('<br>')}</div>`:''; }
const costLabel=ab=>costOf(ab)+' '+CLS[me.c.cls].res;
function buildAuraBar(){ const ab=$('auraBar'), on=me.c.cls==='bard'; document.body.classList.toggle('bardui',on); ab.classList.toggle('hidden',!on); ab.innerHTML=''; if(!on) return;
  ab.insertAdjacentHTML('beforeend','<span class="albl">SONGS</span>');
  BARD_SONGS.forEach((S,i)=>{ const s=document.createElement('div'); s.className='slot'; const col=SONGDEF[S.song].col; s.style.background=`radial-gradient(circle at 35% 30%,${shade(col,.1)},${shade(col,-.68)})`;
    s.innerHTML=`<span class="k">⇧${i+1}</span><span class="ic">${abilIcon(S)}</span><div class="cd"></div><div class="cdt"></div><div class="lock">🔒<br>Lv ${S.lvl}</div>`;
    s.onclick=()=>useAbility(S); s.onmouseenter=e=>showTip(e,`<div class="nm">${S.name} <span style="color:var(--dim);font-size:12px">(aura)</span></div><div style="color:var(--dim);font-size:13px">Shift+${i+1} · click again to stop</div><div>${S.desc}</div>${abilTipStats(S)}${me.c.lvl<S.lvl?`<div style="color:#ff7a6a">Learned at level ${S.lvl}</div>`:''}`); s.onmouseleave=hideTip; ab.appendChild(s); }); }
function updateAuraBar(){ if(me.c.cls!=='bard') return; const sl=$('auraBar').querySelectorAll('.slot'), t=now(); BARD_SONGS.forEach((S,i)=>{ const s=sl[i]; if(!s) return; s.classList.toggle('on',me.song===S.song); s.classList.toggle('locked',me.c.lvl<S.lvl);
  const rem=(me.cds[S.id]||0)-t; s.children[2].style.height=rem>0?(Math.min(1,rem/S.cd)*100)+'%':'0'; }); }
addEventListener('keydown',e=>{ if(!me||me.c.cls!=='bard'||!e.shiftKey||e.ctrlKey||e.altKey) return; const ae=document.activeElement; if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;
  const m=/^Digit([1-3])$/.exec(e.code||''); if(!m) return; e.preventDefault(); e.stopImmediatePropagation(); if(!e.repeat) useAbility(BARD_SONGS[+m[1]-1]); },true);
function flashSlot(i){ const s=$('bar').children[i]; if(!s) return; s.classList.add('flash'); setTimeout(()=>s.classList.remove('flash'),150); }
function updateBar(){
  const t=now(); { const cb=$('cpBar'); const on=me.c.cls==='assassin'; cb.classList.toggle('hidden',!on); if(on){ cb.querySelectorAll('i').forEach((e,i)=>e.classList.toggle('on',i<(me.cp||0))); cb.classList.toggle('st',!!me.stealth); } const tb=document.querySelector('#menuBtns [data-k="tal"]'); if(tb) tb.classList.toggle('pulse',talPoints()>0); } const slots=$('bar').children; const te=targetEnt(); const ab6=curAbils();
  ab6.forEach((ab,i)=>{ const s=slots[i]; if(!s) return; const cdEnd=Math.max(me.cds[ab.id]||0, ab.noGcd?0:me.gcd); const tot=(me.cds[ab.id]||0)>t?ab.cd:1;
    const rem=cdEnd-t; s.children[2].style.height=rem>0?(Math.min(1,rem/tot)*100)+'%':'0'; s.children[3].textContent=rem>1.5?Math.ceil(rem):'';
    s.classList.toggle('locked',me.c.lvl<ab.lvl);
    s.classList.toggle('nores',me.res<costOf(ab));
    s.classList.toggle('oor',!!(ab.hostile&&te&&te.hostile&&dist(me.x,me.y,te.x,te.y)>ab.rng+(te.e.t?te.e.t.r:12)+(ab.melee?MELEE_SLACK:0))); });
  try{ updateAuraBar(); }catch(e){}
  const p=slots[ab6.length]; if(p){ const rem=me.potCd-t; p.children[3].style.height=rem>0?(rem/30*100)+'%':'0'; p.children[4].textContent=rem>1?Math.ceil(rem):''; $('potCnt').textContent=me.c.pots; }
}
let uiTick=0;
function updateUI(){ try{ arenaHud(); }catch(e){}
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
    else if(te.kind==='p'){ if(te.self){name=c.name;lvl=c.lvl;hp=me.hp;mhp=me.mhp;col=myNameCol();glyph=CLS[c.cls].glyph;tag='You'} else { const o=te.e; name=o.n;lvl=o.l;hp=o.hp;mhp=o.mhp;col=nameCol(o);glyph=CLS[o.c].glyph;tag=CLS[o.c].name+(o.pt?' · Party: '+o.pt:'')+(o.d?' · Dead':'');} tf.classList.add('friendly'); }
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
  const sig=mem.map(o=>o.u+o.n+o.l+(o.pl?1:0)+'c'+(o.nc|0)).join('|')+me.party;
  if(pf.dataset.sig!==sig){ pf.dataset.sig=sig; pf.innerHTML=''; if(me.party){ const h=document.createElement('div'); h.style.cssText='font-family:Cinzel;font-size:12px;color:var(--gold);text-shadow:0 1px 2px #000'; h.textContent='Party: '+me.party; pf.appendChild(h); }
    for(const o of mem){ const d=document.createElement('div'); d.className='pmember panel'; d.dataset.u=o.u; d.innerHTML='<div class="uname"><span></span><span class="lvl"></span></div><div class="bar hp small"><i></i></div>';
      d.querySelector('.uname span').textContent=(o.pl?'♛ ':'')+o.n; d.querySelector('.uname span').style.color=nameCol(o); d.querySelector('.lvl').textContent=CLS[o.c].glyph+' '+o.l; d.onclick=()=>{me.target={kind:'p',id:o.u}}; pf.appendChild(d); } }
  for(const d of pf.querySelectorAll('.pmember')){ const o=othersByU.get(d.dataset.u); if(!o) continue; { let bx=d.querySelector('.pbuffs'); if(!bx){ bx=document.createElement('div'); bx.className='pbuffs'; d.appendChild(bx); } const sl=o.d?[]:songBuffsAt(o.rx,o.ry), h=songIcons(sl); bx._sb=sl; if(bx._h!==h){ bx._h=h; bx.innerHTML=h; } } d.querySelector('i').style.width=(clamp(o.hp/o.mhp,0,1)*100)+'%'; d.classList.toggle('dead',o.d); d.classList.toggle('far',dist(o.rx,o.ry,me.x,me.y)>1200); }
  // zone
  const z=zoneAtPx(me.x,me.y); if(z!==me.zone){ if(me.zone) zoneBanner(z); me.zone=z; } $('zoneName').textContent=ZONES[z].name;
  if(!$('whoWin').classList.contains('hidden')) renderWho();
}
function renderTracker(){
  const el=$('tracker'); const qs=activeQuests();
  const mh=me.c.lvl>=10&&!me.c.mounts.length?'<div class="obj" style="margin-top:6px;color:#ffd34a">🐎 Mounts unlocked! Visit <b>Hilde the Stable Master</b> outside the East Gate of Hearthmere (golden horseshoe on your map).</div>':'';
  if(!qs.length){ el.innerHTML=mh+'<h3>Quests</h3><div class="obj">Look for <b style="color:#ffd34a">!</b> above people\'s heads. Captain Oriel in Hearthmere always has work.</div><div class="obj" style="margin-top:4px;color:var(--dim);font-size:12px">M map · L quest log · R mount</div>'; return; }
  el.innerHTML='<h3>Quests <span style="color:var(--dim);font-size:11px">(L)</span></h3>'+(me.c.lvl>=10&&!me.c.mounts.length?`<div style="margin-top:6px;color:#ffd34a;font-size:13px">🐎 You can buy a mount! Visit <b>Hilde the Stable Master</b> outside the East Gate of Hearthmere (look for the golden horseshoe).</div>`:'')+qs.slice(0,6).map(q=>{ const s=me.c.qs[q.id];
    return `<div style="margin-top:6px"><div style="font-weight:700;color:#f3e6c8">${esc(q.title)}</div><div class="${s.st==='done'?'done':'obj'}" style="font-size:13px">${s.st==='done'?'✔ Return to '+esc(npcName(q.giver)):esc(objText(q,s))}</div></div>`; }).join('')+(qs.length>6?`<div class="obj" style="margin-top:4px">+${qs.length-6} more…</div>`:''); }
function renderBuffs(){ const el=$('buffs'); if(!el||!me) return; let h=''; for(const k in me.c.buffs){ const ms=me.c.buffs[k]-Date.now(); if(ms<=0) continue; h+=`<div class="buff" title="${BUFFNAME[k][0]}">${BUFFNAME[k][1]}<span>${Math.ceil(ms/60000)}m</span></div>`; }
  if(me.mounted) h+=`<div class="buff" title="Mounted">🐎<span>R</span></div>`; if(me.fountain) h+=`<div class="buff" title="Hearthmere Fountain: restoring 4% health and mana every second">⛲</div>`; { const wp=me.c.eq.weapon; if(wp&&wp.rar===4){ const Lg=LEGEND[wp.leg]||{}, eff=String(wp.desc||Lg.desc||'').split('. ').slice(1).join('. ')||'Legendary power'; h+=`<div class="buff legbuff" title="${esc(wp.name)}: ${esc(eff)}">${{warden:'⚜',mender:'☀',arcanist:'🔥',assassin:'🗡',bard:'🎺'}[wp.leg]||'✦'}</div>`; } } const sl=songBuffsAt(me.x,me.y); h+=songIcons(sl); el._sb=sl; if(el._h!==h){ el._h=h; el.innerHTML=h; } }
(function(){ const over=e=>{ const b=e.target.closest&&e.target.closest('.sbuff'); if(!b) return; const box=b.parentNode, it=box&&box._sb&&box._sb[+b.dataset.sb]; if(!it) return; showTip({currentTarget:b},songBuffHTML(it)); };
  addEventListener('mouseover',over); addEventListener('mouseout',e=>{ if(e.target.closest&&e.target.closest('.sbuff')) hideTip(); }); addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('.sbuff')) over(e); }); })();
setInterval(()=>{ try{ if(me) renderBuffs(); }catch(e){} },500);
function showTip(e,html){ const tp=$('tip'); tp.innerHTML=html; tp.classList.remove('hidden'); const r=e.currentTarget.getBoundingClientRect();
  tp.style.left=Math.min(innerWidth-270,r.left)+'px'; tp.style.top=Math.max(8,r.top-tp.offsetHeight-8)+'px'; }
function hideTip(){ $('tip').classList.add('hidden'); }
const upMul=it=>1+.15*(it.up||0);
function itemTip(it,cmp,insp){ const P=Math.round(it.pow*upMul(it)), S=Math.round(it.sta*upMul(it));
  let h=`<div class="nm t${it.rar}">${esc(it.name)}${it.up?' +'+it.up:''}</div><div style="color:var(--dim);font-size:13px">${RAR[it.rar]} ${it.slot==='armor'&&armorType(it)?ARMNAME[armorType(it)]+' armour':it.slot} · Item level ${it.lv}</div>${me&&!insp&&!canUse(it,me.c.cls)?`<div style="color:#ff6a5a;font-size:13px">${esc(useReason(it,me.c.cls))}</div>`:''}<div>+${P} Power<br>+${S} Stamina</div>${it.desc?`<div class="t4" style="font-size:13px;font-style:italic;margin-top:3px">${esc(it.desc)}</div>`:''}${insp?'':`<div style="color:var(--gold);font-size:13px">Sells for ${it.val} gold</div>`}`;
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
function equipItem(it){ const c=me.c; if(!canUse(it,c.cls)){ err(useReason(it,c.cls)); return; } setTimeout(()=>armorySync(true),500); const i=c.inv.indexOf(it); if(i<0) return; const cur=c.eq[it.slot]; c.eq[it.slot]=it; c.inv.splice(i,1); if(cur) c.inv.splice(i,0,cur); chatLine(`Equipped [${it.name}].`,'c-loot t'+it.rar); recalc(); renderInv(); persist(); sendPresence(true); }
function sellItem(it){ const c=me.c; const i=c.inv.indexOf(it); if(i<0) return; if(it.rar>=3&&!it._sellOk){ return askConfirm(`Sell <b class="t${it.rar}">${esc(it.name)}</b> for ${it.val} gold?`,'Sell',()=>{ it._sellOk=1; sellItem(it); }); }
  c.inv.splice(i,1); c.gold+=it.val; coinFx(it.val); chatLine(`Sold [${it.name}] for ${it.val} gold.`,'c-loot'); renderInv(); persist(); }
function destroyItem(it){ const c=me.c; const i=c.inv.indexOf(it); if(i<0) return; c.inv.splice(i,1); chatLine(`Salvaged [${it.name}].`,'c-loot'); renderInv(); persist(); }
function askDestroy(it){ askConfirm(`Salvage <b class="t${it.rar}">${esc(it.name)}</b>? The item is broken down and gone for good.`,'Salvage',()=>destroyItem(it),true); }
function askConfirm(html,label,fn,danger){ const p=$('confirmPop'); p.innerHTML=`<div>${html}</div><div class="btns"><button id="cfNo">Cancel</button><button id="cfYes" class="${danger?'':'gold'}" style="${danger?'background:#8a1a10;color:#fff':''}">${label}</button></div>`; p.classList.remove('hidden');
  $('cfNo').onclick=()=>p.classList.add('hidden'); $('cfYes').onclick=()=>{ p.classList.add('hidden'); fn(); }; }
function itemMenu(e,it,i){ const m=$('ctxMenu'); m.innerHTML=''; const add=(t,fn,cls)=>{ const d=document.createElement('div'); d.textContent=t; if(cls) d.className=cls; d.onclick=()=>{ m.classList.add('hidden'); fn(); }; m.appendChild(d); };
  add('Equip',()=>equipItem(it)); add(`Sell for ${it.val} gold`,()=>sellItem(it)); add('Salvage',()=>askDestroy(it),'dang');
  m.style.left=Math.min(innerWidth-180,e.clientX)+'px'; m.style.top=Math.min(innerHeight-130,e.clientY)+'px'; m.classList.remove('hidden');
  setTimeout(()=>addEventListener('mousedown',function h(ev){ if(!m.contains(ev.target)){ m.classList.add('hidden'); removeEventListener('mousedown',h); } }),0); }
function initBagZones(){ for(const [id,fn] of [['dzSell',sellItem],['dzTrash',askDestroy]]){ const z=$(id);
    z.ondragover=e=>{ if(dragI<0) return; e.preventDefault(); z.classList.add('over'); }; z.ondragleave=()=>z.classList.remove('over');
    z.ondrop=e=>{ e.preventDefault(); z.classList.remove('over'); const it=me&&me.c.inv[dragI]; if(it){ dragOk=true; fn(it); } }; }
  $('bagSort').onclick=()=>{ const c=me.c; c.inv.sort((a,b)=>b.rar-a.rar||SLOTS.indexOf(a.slot)-SLOTS.indexOf(b.slot)||b.pow+b.sta-a.pow-a.sta); renderInv(); persist(); }; }
function toggleWin(id,force){ const w=$(id); const show=force??w.classList.contains('hidden'); w.classList.toggle('hidden',!show); if(id==='whoWin'&&show) renderWho(); if(id==='invWin'&&show) renderInv(); if(id==='mapWin'&&show) drawWorldMap(); if(id==='charWin'&&show){ renderInv(); renderChar(); } if(id==='talWin'&&show) renderTalents(); if(id==='soundWin'&&show) renderSound(); if(id==='partyWin'&&show) renderPartyWin(); if(id==='qlogWin'&&show) renderQlog(); if(id==='invWin'&&!show&&shopOpen){shopOpen=false;$('dlg').classList.add('hidden')} }
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
const DSEL={i:0};
function dlgOpts(){ const d=$('dlg'); if(!d||d.classList.contains('hidden')) return []; return [...d.querySelectorAll('.qline,button:not(.close):not([disabled]),.shoprow button:not([disabled])')].filter((e,i,a)=>a.indexOf(e)===i&&e.offsetParent!==null); }
function dlgMark(i){ const L=dlgOpts(); document.querySelectorAll('#dlg .dsel').forEach(e=>e.classList.remove('dsel')); if(!L.length) return; DSEL.i=((i%L.length)+L.length)%L.length; const el=L[DSEL.i]; el.classList.add('dsel'); try{ el.scrollIntoView({block:'nearest'}); }catch(e){} }
(function(){ const d=document.getElementById('dlg'); if(!d) return; new MutationObserver(()=>{ if(!d.classList.contains('hidden')&&!d.querySelector('.dsel')) setTimeout(()=>{ if(!d.querySelector('.dsel')) dlgMark(0); },0); }).observe(d,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  d.addEventListener('mouseover',e=>{ const L=dlgOpts(); const el=e.target.closest&&e.target.closest('.qline,button'); const i=L.indexOf(el); if(i>=0&&!el.classList.contains('dsel')) dlgMark(i); });
  d.addEventListener('wheel',e=>{ const L=dlgOpts(); if(L.length<2||d.scrollHeight>d.clientHeight+4) return; e.preventDefault(); dlgMark(DSEL.i+(e.deltaY>0?1:-1)); },{passive:false}); })();
addEventListener('keydown',e=>{ if(!me||e.repeat&&!/^arrow/i.test(e.key)) return; const d=$('dlg'); if(!d||d.classList.contains('hidden')) return; const ae=document.activeElement; if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.tagName==='SELECT')) return;
  const k=e.key.toLowerCase(); const L=dlgOpts(); if(!L.length) return;
  if(k==='arrowdown'||k==='arrowup'){ e.preventDefault(); e.stopImmediatePropagation(); keys[k]=false; dlgMark(DSEL.i+(k==='arrowdown'?1:-1)); return; }
  if(KEYMAP[k]==='interact'){ e.preventDefault(); e.stopImmediatePropagation(); const el=L[Math.min(DSEL.i,L.length-1)]; if(el){ el.classList.add('dpress'); setTimeout(()=>el.classList.remove('dpress'),120); el.click(); } } },true);
function dlg(html){ const d=$('dlg'); d.innerHTML='<button class="close" id="dlgX">×</button>'+html; d.classList.remove('hidden'); $('dlgX').onclick=closeDlg; }
function closeDlg(){ $('dlg').classList.add('hidden'); if(shopOpen){shopOpen=false; renderInv();} }
function talk(n){
  if(!n) return; if(dist(me.x,me.y,n.x,n.y)>120) return err('Too far away'); shopOpen=false;
  const lines=[]; for(const q of QUESTS){ if(q.giver!==n.id) continue; const s=me.c.qs[q.id];
    if(s&&s.st==='done') lines.push(['?',q]); else if(qAvail(q)) lines.push(['!',q]); else if(s&&s.st==='active') lines.push(['…',q]); }
  let h=`<div class="nhead">${npcPortrait(n)}<div><h2>${esc(n.name)}</h2><small>&lt;${esc(n.title)}&gt;</small></div></div><p id="npcTxt"></p>`; n.emote={k:'wave',t0:now()}; n.emoteU=now()+2;
  h+=lines.map((l,i)=>`<div class="qline" data-i="${i}"><span class="qm ${l[0]==='…'?'dim':''}">${l[0]}</span> ${esc(l[1].title)} <span style="color:var(--dim);font-size:12px">(Lv ${l[1].lvl||1})</span></div>`).join('');
  const svc={varro:[['arena','⚔ Enter the Bloodsand Arena']],keeperw:[['arenaout','Return to the surface']],keepere:[['arenaout','Return to the surface']],mira:[['shop','Browse goods'],['alch','Alchemy']],doran:[['smith','Upgrade gear']],hilde:me.c.lvl>=10?[['stable','Mounts']]:[]}[n.id]||[];
  if(n.id==='hilde'&&me.c.lvl<10) h+='<p style="color:var(--dim)">"You\'re a bit green to handle one of my horses. Come back when you reach <b>level 10</b> and I\'ll find you a steed."</p>';
  if(!lines.length&&!svc.length&&n.id!=='hilde') h+='<p style="color:var(--dim)">"Nothing for you right now. Come back when you\'ve grown stronger."</p>';
  h+=`<div class="btns" style="margin-top:12px">${svc.map(s=>`<button data-s="${s[0]}">${s[1]}</button>`).join('')}<button id="byeB">Goodbye</button></div>`;
  dlg(h); typeText($('npcTxt'),(NPCGREET[n.id]||'"Well met, traveller."').replace(/<[^>]*>/g,'')); $('byeB').onclick=closeDlg;
  document.querySelectorAll('#dlg .qline').forEach(el=>el.onclick=()=>questDlg(n,lines[+el.dataset.i][1]));
  document.querySelectorAll('#dlg [data-s]').forEach(b=>b.onclick=()=>({shop:openShop,alch:()=>openAlchemy(n),smith:()=>openSmith(n),stable:()=>openStable(n),arena:()=>{ closeDlg(); arenaEnter(); },arenaout:()=>{ closeDlg(); arenaLeave(); }})[b.dataset.s]());
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
    return `<div class="shoprow"><span><b>${m.name}</b><br><span style="font-size:13px;color:var(--dim)">+${Math.round((m.speed-1)*100)}% speed · requires level ${m.lvl}</span></span>${own?`<button data-sel="${id}" ${c.mount===id?'disabled':''}>${c.mount===id?'Riding':'Choose'}</button>`:(m.drop?`<span style="font-size:12px;color:var(--gold);max-width:150px;text-align:right">Rare drop from ${m.drop}</span>`:`<button data-buy="${id}" ${c.gold>=m.cost&&c.lvl>=m.lvl?'':'disabled'}>Buy · ${m.cost} gold</button>`)}</div>`; }).join('')}
    <div style="margin-top:10px;color:var(--gold)">Your gold: ${c.gold}</div><div class="btns" style="margin-top:10px"><button id="bk">Back</button></div>`);
  $('bk').onclick=()=>talk(n);
  document.querySelectorAll('#dlg [data-buy]').forEach(b=>b.onclick=()=>{ const id=+b.dataset.buy, m=MOUNTS[id]; c.gold-=m.cost; c.mounts.push(id); c.mount=id; toast('New mount: '+m.name,'small'); sysMsg(`You bought the ${m.name}. Press R to ride.`); persist(); renderInv(); openStable(n); });
  document.querySelectorAll('#dlg [data-sel]').forEach(b=>b.onclick=()=>{ c.mount=+b.dataset.sel; if(me.mounted) me.mounted=c.mount; persist(); openStable(n); }); }

/* ---------- world map ---------- */
let mapBase=null; const MAPS=5;
const ZCENT={}; (function(){ const acc={}; for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ const z=zmap[y*MW+x]; (acc[z]=acc[z]||[0,0,0]); acc[z][0]+=x; acc[z][1]+=y; acc[z][2]++; } for(const z in acc) ZCENT[z]=[acc[z][0]/acc[z][2],acc[z][1]/acc[z][2]]; ZCENT.ash=WP(56,18); ZCENT.lake=WP(90,93); })();
setInterval(drawWorldMap,50);
function drawMini(){
  const mc=document.getElementById('miniC'), c=mc.getContext('2d'); const S=mc.width; c.clearRect(0,0,S,S);
  c.save(); c.beginPath(); c.arc(S/2,S/2,S/2,0,7); c.clip(); const scale=S/250*1.6*(OPT.miniZ||1); const ox=S/2-(me.x/TS)*scale, oy=S/2-(me.y/TS)*scale;
  if(!mapBase) mapBase=buildMapBase(); c.imageSmoothingEnabled=true; c.drawImage(mapBase,ox,oy,MW*scale,MH*scale); { c.fillStyle='#0f0e0c'; const RG=mapRegion(); c.fillRect(0,0,S,oy+RG.y0*scale); c.fillRect(0,oy+(RG.y0+RG.h)*scale,S,S); }
  const dot=(x,y,col,r)=>{c.fillStyle=col;c.beginPath();c.arc(ox+x/TS*scale,oy+y/TS*scale,r,0,7);c.fill()};
  const t=now(); for(const n of NODES) if(n.resp<t&&dist(n.x,n.y,me.x,me.y)<1100) dot(n.x,n.y,MATS[n.mat].kind==='herb'?'#9dff6a':'#ffb05a',3.2);
  for(const m of mobs) if(!m.dead){ if(m.t.boss){ c.font='bold 22px sans-serif'; c.textAlign='center'; c.fillStyle='#ff5a2a'; c.fillText('☠',ox+m.rx/TS*scale,oy+m.ry/TS*scale+7);} else if(dist(m.rx,m.ry,me.x,me.y)<900) dot(m.rx,m.ry,m.t.elite?'#ffb03a':'#e8453a',m.t.elite?4.5:3); }
  for(const n of NPCS){ const mk=npcMark(n); dot(n.x,n.y,'#ffd34a',4); if(n.id==='hilde'&&mk==='$') drawShoe(c,ox+n.x/TS*scale,oy+n.y/TS*scale-8,.75,1); if(mk==='!'||mk==='?'){ c.font='900 20px Cinzel,serif'; c.textAlign='center'; c.lineWidth=3; c.strokeStyle='#000'; c.strokeText(mk,ox+n.x/TS*scale,oy+n.y/TS*scale-4); c.fillStyle='#ffd34a'; c.fillText(mk,ox+n.x/TS*scale,oy+n.y/TS*scale-4); } }
  for(const bm of mobs) if((bm.t.boss||bm.t.elite)&&!bm.t.summon) mapIcon(c,bm.dead?'bossdead':bm.t.boss?'boss':'elite',ox+(bm.dead?bm.sx:bm.rx)/TS*scale,oy+(bm.dead?bm.sy:bm.ry)/TS*scale,null,.75);
  for(const o of others.values()) if(seenO(o)&&!(me.party&&o.pt===me.party)) dot(o.rx,o.ry,CLS[o.c].col,5);
  if(me.party) for(const o of others.values()){ if(!seenO(o)||o.pt!==me.party) continue; let px=ox+o.rx/TS*scale, py=oy+o.ry/TS*scale; const dx=px-S/2, dy=py-S/2, dd=Math.hypot(dx,dy), R=S/2-12, out=dd>R;
    if(out){ px=S/2+dx/dd*R; py=S/2+dy/dd*R; c.save(); c.translate(px,py); c.rotate(Math.atan2(dy,dx)); c.fillStyle='#4cff63'; c.strokeStyle='#000'; c.lineWidth=2; c.beginPath(); c.moveTo(9,0); c.lineTo(-4,-6); c.lineTo(-4,6); c.closePath(); c.stroke(); c.fill(); c.restore(); }
    else { c.fillStyle=o.d?'#888':'#4cff63'; c.strokeStyle='#0b2a10'; c.lineWidth=2.5; c.beginPath(); c.arc(px,py,8,0,7); c.fill(); c.stroke(); c.fillStyle='#062b0c'; c.font='bold 11px sans-serif'; c.textAlign='center'; c.fillText((o.n||'?')[0].toUpperCase(),px,py+4); } }
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
function npcMark(n){ if(!me) return n.id==='mira'||n.id==='doran'?'$':''; let m='';
  for(const q of QUESTS){ if(q.giver!==n.id) continue; const s=me.c.qs[q.id]; if(s&&s.st==='done') return '?'; if(qAvail(q)) m='!'; }
  if(m) return m; return n.id==='mira'||n.id==='doran'||(n.id==='hilde'&&me.c.lvl>=10)?'$':''; }
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
let WCOMP=null;
function deepWaterAt(px,py){ if(!WCOMP) buildWComp(); const X=Math.floor(px/TS), Y=Math.floor(py/TS); if(tAt(X,Y)!==T.WATER||hgt(px/TS,py/TS)>=-.55) return false;
  return WCOMP[Y*MW+X]>=14; }
function buildWComp(){ { WCOMP=new Int32Array(MW*MH); const st=[]; for(let i=0;i<MW*MH;i++){ if(WCOMP[i]||tAt(i%MW,(i/MW)|0)!==T.WATER) continue; const list=[]; st.push(i); WCOMP[i]=-1;
      while(st.length){ const k=st.pop(); list.push(k); const x=k%MW, y=(k/MW)|0; for(let d=0;d<4;d++){ const nx=x+(d===0?1:d===1?-1:0), ny=y+(d===2?1:d===3?-1:0); if(nx<0||ny<0||nx>=MW||ny>=MH) continue; const q=ny*MW+nx; if(WCOMP[q]||tAt(nx,ny)!==T.WATER) continue; WCOMP[q]=-1; st.push(q); } }
      for(const k of list) WCOMP[k]=list.length; } } }
const isSwimming=()=>me&&!onDock(me.x,me.y)&&deepWaterAt(me.x,me.y);
function blockedP(x,y,r){ const f=(px,py)=>{ const t=tAt(Math.floor(px/TS),Math.floor(py/TS)); return t!==T.WATER&&t!==T.LAVA&&(SOLID.has(t)||(t===T.DOOR&&doorClosedAt(Math.floor(px/TS),Math.floor(py/TS)))); }; return f(x-r,y-r)||f(x+r,y-r)||f(x-r,y+r)||f(x+r,y+r); }
function movePlayer(e,dx,dy,r){ if(e===me&&gm.fly){ e.x=clamp(e.x+dx,20,MW*TS-20); e.y=clamp(e.y+dy,20,MH*TS-20); return; } if(!blockedP(e.x+dx,e.y,r)) e.x+=dx; if(!blockedP(e.x,e.y+dy,r)) e.y+=dy; }
function toggleMount(){ if(!me||me.dead) return; if(me.mounted){ dismount(); return; } if(inArena(me.x,me.y)) return err('No mounts in the arena'); if(me.y>=OWH*TS) return err('You cannot ride inside the Sunken Vault');
  if(!me.c.mount) return err(me.c.mounts.length?'Pick a mount at the stable':'You have no mount. Visit Hilde the Stable Master, just outside the East Gate of Hearthmere');
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
function weatherNow(){ if(typeof me!=='undefined'&&me&&me.y>=OWH*TS) return {kind:0,k:0}; if(typeof gm!=='undefined'&&gm.wx!==null) return {kind:gm.wx,k:gm.wx?1:0}; const P=420000, n=Date.now(); const seg=Math.floor(n/P), ph=(n%P)/P; const h=hash2(seg,7,99); const kind=h<.46?0:h<.64?1:h<.88?2:3; return {kind,k:kind?clamp(Math.min(ph,1-ph)/.04,0,1):0}; }
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
  if(!isSwimming()&&isWaterAt(me.x,me.y)&&me.moving&&Math.random()<dt*7){ P3(me.x/TS+(Math.random()-.5)*.5,WATER_Y+.03,me.y/TS+(Math.random()-.5)*.5,(Math.random()-.5)*.6,.9,(Math.random()-.5)*.6,.5,.08,'#e8f4ff',{drag:.95}); }
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
  if(/^-[eod]$/i.test(txt)) return vaultCmd(txt[1].toLowerCase());
  if(txt[0]==='/'){ const [cmd,...rest]=txt.slice(1).split(' '); const arg=rest.join(' ').trim();
    if(cmd==='p'||cmd==='party'&&!arg){ if(cmd==='party') return partyDlg(); if(!me.party) return sysMsg('You are not in a party. Use /party name','c-err'); return sayChat(arg,1); }
    if(cmd==='color'||cmd==='colour'||cmd==='namecolor'||cmd==='namecolour'){ const a=String(arg||'').trim().toLowerCase();
      if(!a){ const el=document.createElement('div'); el.className='c-sys'; el.append('Name colours (type /color <name or number>, /color off for your class colour): ');
        NAMECOLS.forEach((c,i)=>{ if(!c) return; const b=document.createElement('span'); b.textContent=i+' '+c[0]; b.style.cssText=`color:${c[1]};cursor:pointer;font-weight:700;margin-right:8px;text-shadow:0 1px 2px #000`; b.onclick=()=>sendChat('/color '+i); el.append(b); });
        const log=$('chatlog'); log.appendChild(el); log.scrollTop=log.scrollHeight; return; }
      let i=a==='off'||a==='class'||a==='default'||a==='0'?0:/^\d+$/.test(a)?+a:NAMECOLS.findIndex(c=>c&&c[0].toLowerCase()===a);
      if(!(i>=0&&i<=12)) return sysMsg('Unknown colour. Type /color to see all 12.','c-err');
      me.c.nc=i||undefined; persist(); sendPresence(true); $('party').dataset.sig=''; return i?chatLine('Your name is now '+NAMECOLS[i][0]+'.','c-sys','',{n:me.c.name,col:NAMECOLS[i][1]}):sysMsg('Your name is back to your class colour.'); }
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
  chatLine(txt, ch?'c-party':'c-say', ch?'[Party] ':'', {n:me.c.name,col:myNameCol(),gm:isGM}); if(!ch){ me.bubble=txt; me.bubbleT=now()+6; } sendPresence(true); }

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
Object.assign(ICONS,{
  sinister:['shadow',`<path d="M14 50 L46 18" stroke="#3aff9a" stroke-width="5" opacity=".55" filter="url(#igl)"/><path d="M44 10 L54 10 L54 20 L24 44 L20 40Z" fill="#e8f2f6" ${OL}/><path d="M16 38 L26 48 L22 52 L12 42Z" fill="#2a8a5a" ${OL}/><path d="M15 47 L17 49 L9 57 L7 55Z" fill="#2a1a10" ${OL}/>`],
  evis:['phys',`<path d="M10 14 L54 50" stroke="#ff3a2a" stroke-width="4" opacity=".7"/><path d="M54 14 L10 50" stroke="#ff3a2a" stroke-width="4" opacity=".7"/><path d="M42 8 L50 8 L50 16 L22 40 L18 36Z" fill="#eef3fa" ${OL}/><path d="M22 8 L14 8 L14 16 L42 40 L46 36Z" fill="#dfe8f0" ${OL}/>${[0,1,2,3,4].map(i=>`<circle cx="${14+i*9}" cy="54" r="3.4" fill="#ffd34a" ${OL}/>`).join('')}`],
  stealth:['shadow',`<ellipse cx="32" cy="34" rx="22" ry="12" fill="#0a0610" ${OL}/><path d="M10 34 Q32 14 54 34 Q32 54 10 34Z" fill="#2a1a40" ${OL}/><circle cx="32" cy="34" r="7" fill="#3aff9a" filter="url(#igl)"/><circle cx="32" cy="34" r="3" fill="#081008"/><path d="M8 20 L56 50" stroke="#c0a0d8" stroke-width="3" opacity=".8"/>`],
  ambush:['shadow',`<path d="M40 8 A22 22 0 1 0 40 56 A16 16 0 1 1 40 8Z" fill="#cfe0ff" ${OL}/><path d="M22 46 L48 20" stroke="#ff4a3a" stroke-width="3.5"/><path d="M44 16 L52 16 L52 24 L28 42 L24 38Z" fill="#eef3fa" ${OL}/>`],
  fan:['steel',`${[0,1,2,3,4,5,6,7].map(i=>{ const a=i/8*6.283; const x=32+Math.cos(a)*20, y=32+Math.sin(a)*20; return `<path d="M32 32 L${(32+Math.cos(a)*9).toFixed(1)} ${(32+Math.sin(a)*9).toFixed(1)}" stroke="#7affc0" stroke-width="2" opacity=".6"/><path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(a+2.6)*7).toFixed(1)} ${(Math.sin(a+2.6)*7).toFixed(1)} l${(Math.cos(a-2.6)*7-Math.cos(a+2.6)*7).toFixed(1)} ${(Math.sin(a-2.6)*7-Math.sin(a+2.6)*7).toFixed(1)}Z" fill="#eef3fa" ${OL}/>`; }).join('')}<circle cx="32" cy="32" r="5" fill="#2a8a5a" ${OL}/>`],
  shadowstep:['shadow',`<path d="M8 40 Q20 24 34 30" stroke="#3aff9a" stroke-width="3" fill="none" stroke-dasharray="3 3"/><ellipse cx="18" cy="44" rx="9" ry="3" fill="#000" opacity=".6"/><path d="M40 14 Q50 14 50 26 L50 50 L36 50 L36 26 Q34 18 40 14Z" fill="#1a1028" ${OL}/><circle cx="44" cy="22" r="6" fill="#2a1a40" ${OL}/><path d="M41 22 L47 22" stroke="#3aff9a" stroke-width="2"/>`],
  evasion:['storm',`<path d="M14 18 Q34 10 50 20" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/><path d="M10 32 Q32 24 54 34" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/><path d="M14 46 Q34 38 50 48" stroke="#fff" stroke-width="3" fill="none" opacity=".4"/><path d="M30 14 Q40 24 30 34 Q20 44 30 54" stroke="#3aff9a" stroke-width="5" fill="none" ${OL}/>`],
  vanish:['shadow',`${[[22,40,12],[38,38,13],[30,28,12],[44,26,9],[18,26,9]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#6a6478" opacity=".85" ${OL}/>`).join('')}<circle cx="30" cy="34" r="8" fill="#9a94a8" opacity=".9"/><path d="M26 32 L28 34 M34 32 L32 34" stroke="#3aff9a" stroke-width="2.4"/>`],
});

function iconSVG(id){ const d=ICONS[id]; if(!d) return null; const [a,b]=ISCHOOL[d[0]];
  return `<svg class="sv" viewBox="0 0 64 64"><defs><radialGradient id="ig_${id}" cx="38%" cy="30%" r="85%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="64" height="64" fill="url(#ig_${id})"/>${d[1]}<rect x="0" y="0" width="64" height="64" fill="url(#igloss)"/></svg>`; }
ISCHOOL.song=['#ffe0a8','#6a2408'];
Object.assign(ICONS,{
  ballad:['life',`<path d="M22 46 V20 L44 14 V40" stroke="#fff4d0" stroke-width="3.5" fill="none"/><ellipse cx="17" cy="47" rx="7" ry="5.5" fill="#fff4d0" ${OL}/><ellipse cx="39" cy="41" rx="7" ry="5.5" fill="#fff4d0" ${OL}/><path d="M44 24 c0-5 7-5 7 0 c0-5 7-5 7 0 c0 6-7 9-7 12 c0-3-7-6-7-12Z" fill="#ff6a8a" ${OL}/>`],
  thunder:['storm',`<path d="M10 34 L28 27 L46 13 L46 53 L28 41 L10 41Z" fill="#e8c890" ${OL}/><path d="M10 34 L10 41" stroke="#6a4020" stroke-width="4"/><path d="M51 24 q6 9 0 18 M55 17 q11 16 0 32" stroke="#ffe27a" stroke-width="3.2" fill="none" stroke-linecap="round"/>`],
  lullaby:['frost',`<path d="M36 10 A21 21 0 1 0 54 44 A17 17 0 1 1 36 10Z" fill="#dfe8ff" ${OL}/><text x="40" y="33" font-size="14" font-weight="900" fill="#fff" stroke="#1a2a4a" stroke-width="1" font-family="sans-serif">z</text><text x="48" y="22" font-size="10" font-weight="900" fill="#fff" stroke="#1a2a4a" stroke-width=".8" font-family="sans-serif">z</text>`]});
{ const N=(c,x,y)=>`<path d="M${x+5} ${y} V${y-22} L${x+21} ${y-26} V${y-5}" stroke="${c}" stroke-width="3.2" fill="none"/><ellipse cx="${x}" cy="${y+1}" rx="6.5" ry="5" fill="${c}" ${OL}/><ellipse cx="${x+16}" cy="${y-4}" rx="6.5" ry="5" fill="${c}" ${OL}/>`;
  Object.assign(ICONS,{
  chord:['song',`<path d="M18 52 L40 16" stroke="#6a4020" stroke-width="5" stroke-linecap="round"/><path d="M33 10 Q54 12 50 32 Q42 26 35 24Z" fill="#e6ecf4" ${OL}/><path d="M46 42 q6 6 0 12 M52 37 q11 10 0 21" stroke="#ffd36a" stroke-width="2.6" fill="none"/>`],
  s_embers:['fire',`${N('#fff0c0',18,48)}<path d="M50 30 Q42 20 50 8 Q58 20 50 30Z" fill="#ff6a1a" ${OL}/><path d="M50 27 Q46 21 50 15 Q54 21 50 27Z" fill="#ffd36a"/>`],
  s_stone:['steel',`${N('#e8f0ff',18,48)}<path d="M44 14 L56 20 L56 32 L44 38 L33 32 L33 20Z" fill="#b8a888" ${OL}/><path d="M38 24 L48 30" stroke="#6a5a40" stroke-width="2"/>`],
  s_hunt:['life',`${N('#f0ffe0',16,48)}<path d="M36 34 L58 12" stroke="#f0e6c8" stroke-width="3"/><path d="M52 10 L60 10 L60 18Z" fill="#e8f0ff" ${OL}/><path d="M36 34 l-6 2 2-6 M40 30 l-6 2 2-6" stroke="#7dff8a" stroke-width="2.4" fill="none"/>`],
  discord:['storm',`<circle cx="32" cy="32" r="24" fill="none" stroke="#ffd0a0" stroke-width="1.6" stroke-dasharray="4 4"/><path d="M8 32 L16 22 L22 42 L30 16 L36 46 L42 22 L48 38 L56 30" stroke="#ff9a5a" stroke-width="3.6" fill="none" stroke-linejoin="round"/>`],
  bcry:['holy',`<path d="M10 40 Q12 22 30 20 L50 12 L52 36 L30 34 Q22 36 18 44Z" fill="#f2e6c8" ${OL}/><path d="M48 12 L52 36" stroke="#d8a840" stroke-width="3"/><path d="M28 50 l4 -4 4 4 -4 6Z M24 46 q-4-6 2-8 q4 0 4 4 q0-4 4-4 q6 2 2 8 l-6 6Z" fill="#ff7a7a" ${OL}/>`],
  encore:['song',`<path d="M8 38 Q10 24 26 22 L46 10 L48 40 L26 34 Q18 36 14 44Z" fill="#f2e6c8" ${OL}/><path d="M44 10 L48 40" stroke="#d8a840" stroke-width="3"/><path d="M52 18 q6 7 0 14 M56 13 q11 12 0 24" stroke="#ffd36a" stroke-width="2.6" fill="none"/>`],
  banner:['song',`<path d="M18 58 V8" stroke="#6a4020" stroke-width="4" stroke-linecap="round"/><path d="M20 10 L52 14 L44 24 L52 34 L20 32Z" fill="#c8361e" ${OL}/><path d="M28 20 V28 M28 20 L36 18 V26" stroke="#ffd36a" stroke-width="2.4" fill="none"/><circle cx="18" cy="8" r="4" fill="#ffd36a" ${OL}/>`]}); }
const abilIcon=ab=>iconSVG(ab.id)||ab.icon;
(function(){ const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('width','0'); s.setAttribute('height','0'); s.style.position='absolute';
  s.innerHTML='<defs><filter id="igl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="igloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".42" stop-color="#fff" stop-opacity=".04"/><stop offset=".43" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>';
  document.body.appendChild(s); })();

/* =====================================================================
   GAME MASTER TOOLS — only GMs can use these
   ===================================================================== */
let isGM=false, gmSrc='';
const gm={god:false,nocd:false,fly:false,speed:1,tOff:null,wx:null,tPh:null,wset:0};
/* the Game Master's weather and time of day are shared with every player */
function applyWorldWs(ws){ if(!Array.isArray(ws)||!(+ws[2]>gm.wset)) return; const wx=ws[0]==null?null:clamp(ws[0]|0,0,3), ph=ws[1]==null?null:clamp(+ws[1]||0,0,1);
  const changed=wx!==gm.wx||ph!==gm.tPh; gm.wset=+ws[2]; gm.wx=wx; gm.tPh=ph; gm.tOff=ph==null?null:ph*600-((gm.wset/1000)%600);
  }
function setWorld(wx,ph){ gm.wset=Date.now(); gm.wx=wx; gm.tPh=ph; gm.tOff=ph==null?null:ph*600-((gm.wset/1000)%600); sendPresence(true); }
const GMCMDS=new Set(['tickets','ticket','gift','movegm','boot','ban','unban','aura','invis','makegm','removegm','gmlist','gm','gold','level','levelup','xp','god','nocd','fly','speed','tp','heal','revive','item','mats','mount','kill','time','weather','questdone','announce']);
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
function gmPlaces(){ const out=[{n:'Hearthmere (town)',k:['town','home','hearthmere','spawn'],x:SPAWN.x,y:SPAWN.y},{n:'Sunken Vault (inside)',k:['vaultin','inside','dungeon'],x:VAULT.start.x,y:VAULT.start.y}];
  for(const p of POIS) out.push({n:p.name,k:[p.id,p.name.toLowerCase()],x:p.x*TS+16,y:p.y*TS+16});
  for(const n of NPCS) out.push({n:n.name+' (NPC)',k:[n.id,n.name.toLowerCase()],x:n.x,y:n.y+40});
  for(const m of MOBT) if(m.pos&&(m.boss||m.elite)) out.push({n:m.name+' (boss)',k:[m.key,m.name.toLowerCase()],x:posW(m)[0]*TS+16,y:posW(m)[1]*TS+16+180});
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
    case 'tickets': case 'ticket': openTickets(); return;
    case 'tp': return gmTeleport(arg);
    case 'heal': gmRevive(); me.hp=me.mhp; me.res=me.mres; me.dots=[]; me.rootU=0; healMe(0); return gmOk('Fully healed.');
    case 'revive': if(!me.dead) return gmOk('You are not dead.'); gmRevive(); return gmOk('Revived where you stand.');
    case 'item': { const r=has?clamp(Math.round(n),0,4):Math.max(0,RARN.indexOf(arg.toLowerCase()))||3; if(c.inv.length>=18) return chatLine('Your bags are full.','c-err');
      const it=genItem(c.lvl,r); c.inv.push(it); renderInv(); persist(); chatLine(`You receive: [${it.name}]`,'c-loot t'+it.rar); return; }
    case 'mats': { const v=has?Math.round(n):10; for(const k in MATS) c.mats[k]=Math.max(0,(c.mats[k]||0)+v); renderInv(); persist(); return gmOk(`Added ${v} of every herb and ore.`); }
    case 'mount': c.mounts=MOUNTS.map((m,i)=>i).filter(i=>i>0); c.mount=c.mount||c.mounts[c.mounts.length-1]; persist(); return gmOk('All mounts unlocked. Press R to ride.');
    case 'kill': return gmKill(arg.toLowerCase());
    case 'time': { const a=arg.toLowerCase(); const ph={day:0,noon:0,dusk:.22,evening:.22,night:.5,midnight:.5,dawn:.78,morning:.85}[a];
      if(a==='auto'||a==='reset'||!a){ setWorld(gm.wx,null); return gmOk('Time of day follows the realm clock again for everyone.'); }
      if(ph===undefined) return chatLine('Use /time day, dusk, night, dawn or auto.','c-err'); setWorld(gm.wx,ph); return gmOk(`Time set to ${a} for everyone.`); }
    case 'weather': { const a=arg.toLowerCase(); const k={clear:0,sun:0,cloudy:1,clouds:1,rain:2,storm:3}[a];
      if(a==='auto'||a==='reset'||!a){ setWorld(null,gm.tPh); return gmOk('Weather follows the realm again for everyone.'); }
      if(k===undefined) return chatLine('Use /weather clear, cloudy, rain, storm or auto.','c-err'); setWorld(k,gm.tPh); return gmOk(`Weather set to ${a} for everyone.`); }
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
  <div class="gmsec"><button id="gmTk" class="gold">🎫 Tickets${TK.open?` (${TK.open} open)`:''}</button> <small style="color:var(--dim)">Bug reports and problems from players. Also <code>/tickets</code>.</small></div>
  <div class="gmsec"><h4>Character</h4>${B('gold 1000','+1,000 gold')}${B('gold 10000','+10,000 gold')}${B('levelup 1','Level up')}${B('level '+MAXLVL,'Max level ('+MAXLVL+')')}${B('level 1','Reset to level 1')}${B('xp 5000','+5,000 XP')}${B('heal','Full heal')}${B('revive','Revive')}</div>
  <div class="gmsec"><h4>Cheats</h4>${B('aura','✦ Aura',on(gm.aura))}${B('invis','Invisible',on(gm.invis))}${B('god','God mode',on(gm.god))}${B('nocd','No cooldowns',on(gm.nocd))}${B('fly','Noclip',on(gm.fly))}<span class="gmspd">Speed <input type="range" id="gmSpeed" min="1" max="6" step=".5" value="${gm.speed}"> x<b>${gm.speed}</b></span></div>
  <div class="gmsec"><h4>Items</h4>${B('item 3','<span class="t3">Epic item</span>')}${B('item 2','<span class="t2">Rare item</span>')}${B('mats 10','+10 all herbs & ore')}${B('mount','Unlock all mounts')}</div>
  <div class="gmsec"><h4>World <small>(time and weather change for everyone)</small></h4>${B('kill','Kill target')}${B('kill all','Kill everything nearby')}${B('questdone','Finish quest objectives')}${B('time day','☀ Day')}${B('time dusk','Dusk')}${B('time night','☾ Night')}${B('time auto','Clock')}${B('weather clear','Clear')}${B('weather rain','Rain')}${B('weather storm','Storm')}${B('weather auto','Realm weather')}</div>
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
  $('gmTk').onclick=openTickets;
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
function openLoot(L){ if(!L) return; if(me.mounted) dismount(); lootOpen=L; if(OPT.autoLoot){ takeAll(L); if(!LOOTS.includes(L)){ lootOpen=null; $('lootWin').classList.add('hidden'); return; } } renderLoot(); }
function lootAllKey(){ const L=(lootOpen&&LOOTS.includes(lootOpen))?lootOpen:nearLoot(); if(!L) return err('There is nothing to loot nearby'); if(me.mounted) dismount(); lootOpen=L; takeAll(L); if(!LOOTS.includes(L)){ lootOpen=null; $('lootWin').classList.add('hidden'); } }
function renderLoot(){ const w=$('lootWin'); const L=lootOpen; if(!L||!LOOTS.includes(L)){ w.classList.add('hidden'); lootOpen=null; return; }
  const rows=[]; if(L.gold) rows.push(`<div class="lrow" data-k="g"><span class="lic coin"></span><span class="lnm" style="color:#ffd34a">${L.gold} gold</span></div>`);
  if(L.pots) rows.push(`<div class="lrow" data-k="p"><span class="lic">${iconSVG('potion')}</span><span class="lnm">Healing Draught${L.pots>1?' ×'+L.pots:''}</span></div>`);
  L.items.forEach((it,i)=>rows.push(`<div class="lrow" data-k="i${i}"><span class="lic r${it.rar}">${itemSVG(it)}</span><span class="lnm t${it.rar}">${esc(it.name)}<small>${RAR[it.rar]} ${it.slot}</small></span></div>`));
  w.innerHTML=`<div class="lh"><span>${esc(L.name)}</span><button class="close" id="lootX">×</button></div><div class="lrows">${rows.join('')}</div><button id="lootAll" class="gold">Take all${BIND.lootall?' <small>['+esc(keyName(BIND.lootall))+']</small>':''}</button><label class="lauto"><input type="checkbox" id="lootAuto" ${OPT.autoLoot?'checked':''}> Auto loot (always take all)</label>`; w.classList.remove('hidden');
  $('lootX').onclick=()=>{ lootOpen=null; w.classList.add('hidden'); hideTip(); }; $('lootAll').onclick=()=>{ hideTip(); takeAll(L); }; $('lootAuto').onchange=e=>{ OPT.autoLoot=e.target.checked; saveOpts(); if(OPT.autoLoot) takeAll(L); };
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
    if(t===T.FENCE) col=[120,86,50]; else if(t===T.VOID) col=[34,31,29]; else if(t===T.DWALL||t===T.COLUMN||t===T.DGATE) col=[104,96,86]; else if(t===T.DOOR) col=[70,70,76]; else if(t===T.WATER) col=[86,134,160]; else if(t===T.LAVA) col=[214,96,40]; else if(t===T.TREE) col=z==='swamp'?[78,98,70]:z==='frost'?[120,140,130]:[74,108,62];
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
    if(t===T.HOUSE){ x.fillStyle='#9a4a34'; x.fillRect(i*MAPS,j*MAPS,MAPS,MAPS); } if(t===T.TWALL){ x.fillStyle='#6a6258'; x.fillRect(i*MAPS-.5,j*MAPS-.5,MAPS+1,MAPS+1); } }
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
function mapRegion(){ return me&&inArena(me.x,me.y)?{y0:AR.y0-3,h:MH-AR.y0+3}:me&&me.y>=OWH*TS?{y0:OWH,h:AR.y0-3-OWH}:{y0:0,h:OWH}; }
function mapView(){ const cv2=$('mapC'); const R=mapRegion(); const S=cv2.width/MW*MAPZ.z; let ox=cv2.width/2-MAPZ.cx*S, oy=cv2.height/2-MAPZ.cy*S; ox=Math.min(0,Math.max(cv2.width-MW*S,ox));
  const top=-R.y0*S, bot=cv2.height-(R.y0+R.h)*S; oy=bot>top?(top+bot)/2:Math.min(top,Math.max(bot,oy)); MAPZ.cx=(cv2.width/2-ox)/S; MAPZ.cy=(cv2.height/2-oy)/S; return {S,ox,oy,R}; }
function mapZoomBy(f,px,py){ const cv2=$('mapC'); const v=mapView(); const wx=px==null?MAPZ.cx:(px-v.ox)/v.S, wy=py==null?MAPZ.cy:(py-v.oy)/v.S; const z=Math.max(1,Math.min(6,MAPZ.z*f)); if(z===MAPZ.z) return;
  const S2=cv2.width/MW*z; const sx=px==null?cv2.width/2:px, sy=py==null?cv2.height/2:py; MAPZ.z=z; MAPZ.cx=wx+(cv2.width/2-sx)/S2; MAPZ.cy=wy+(cv2.height/2-sy)/S2; drawWorldMap(); }
function mapCenterMe(){ if(!me) return; MAPZ.init=true; MAPZ.cx=me.x/TS; MAPZ.cy=me.y/TS; drawWorldMap(); }
function drawWorldMap(){ if($('mapWin').classList.contains('hidden')||!me) return; if(!mapBase) mapBase=buildMapBase(); const cv2=$('mapC'), x=cv2.getContext('2d'); { const R0=mapRegion(); if(MAPZ.reg!==R0.y0){ MAPZ.reg=R0.y0; MAPZ.init=false; MAPZ.z=1; } if(!MAPZ.init){ MAPZ.init=true; MAPZ.cx=MW/2; MAPZ.cy=R0.y0+R0.h/2; } } const V=mapView(); const S=V.S, t=now(); mapFeat=[]; MAPZ.ox=V.ox; MAPZ.oy=V.oy;
  x.setTransform(1,0,0,1,0,0); x.fillStyle='#d8c49a'; x.fillRect(0,0,cv2.width,cv2.height); x.translate(V.ox,V.oy); x.imageSmoothingEnabled=true;
  x.drawImage(mapBase,0,0,MW*S,MH*S); { const R=V.R; x.fillStyle=R.y0?'#16140f':'#d8c49a'; if(R.y0) x.fillRect(-10,-4000,MW*S+20,R.y0*S+4000); x.fillRect(-10,(R.y0+R.h)*S,MW*S+20,4000); }
  const txt=(s,px,py,size,col,w,stroke,cz)=>{ x.font=`${w||700} ${size}px ${cz?'Cinzel,serif':'"Alegreya Sans",sans-serif'}`; x.textAlign='center'; x.lineJoin='round'; x.lineWidth=stroke||3.5; x.strokeStyle='rgba(245,232,200,.85)'; x.strokeText(s,px,py); x.fillStyle=col; x.fillText(s,px,py); };
  const txtD=(s,px,py,size,col)=>{ x.font=`700 ${size}px "Alegreya Sans",sans-serif`; x.textAlign='center'; x.lineJoin='round'; x.lineWidth=3; x.strokeStyle='rgba(20,12,4,.85)'; x.strokeText(s,px,py); x.fillStyle=col; x.fillText(s,px,py); };
  for(const z in ZONES){ const c=ZCENT[z]; if(!c) continue; const sub=ZONES[z].sub||'', lv=/^Level\s+(\d+)\s*[–-]\s*(\d+)/.exec(sub); x.save(); x.font='700 16px Cinzel,serif'; if(x.letterSpacing!==undefined) x.letterSpacing='1.5px'; txt(ZONES[z].name.toUpperCase()+(lv?` (Lvl. ${lv[1]}-${lv[2]})`:''),c[0]*S,c[1]*S-2,16,'#4a2c10',700,4,true); x.restore(); if(sub&&!lv) txt(sub,c[0]*S,c[1]*S+13,11,'#7a5226',600,3); }
  if(MAPF.quests) for(const q of activeQuests()){ const s=me.c.qs[q.id]; if(s.st==='done') continue; x.fillStyle='rgba(255,200,40,.16)'; x.strokeStyle='rgba(180,120,10,.8)'; x.lineWidth=1.5; x.setLineDash([5,4]);
    let cx=null,cz=null,r=4;
    if(q.type==='kill'){ const ms=mobs.filter(m=>m.t.key===q.mob); if(ms.length){ cx=ms.reduce((a,m)=>a+m.sx,0)/ms.length/TS; cz=ms.reduce((a,m)=>a+m.sy,0)/ms.length/TS; r=Math.max(3,...ms.map(m=>Math.hypot(m.sx/TS-cx,m.sy/TS-cz)))+2; } }
    if(q.type==='explore'){ const id=q.pois.find(id=>!s.p.includes(id)); const p=POIS.find(o=>o.id===id); if(p){ cx=p.x; cz=p.y; r=p.r; } }
    if(cx!==null){ x.beginPath(); x.arc(cx*S,cz*S,r*S,0,7); x.fill(); x.stroke(); mapFeat.push({x:cx*S,y:cz*S,r:Math.max(14,r*S*.6),tip:'Quest: '+q.title}); }
    x.setLineDash([]); if(q.type==='gather'&&MAPF.gather) for(const n of NODES) if(n.mat===q.mat){ x.fillStyle=MATS[n.mat].col; x.strokeStyle='#2a1a08'; x.lineWidth=1; x.beginPath(); x.arc((n.tx+.5)*S,(n.ty+.5)*S,3.5,0,7); x.fill(); x.stroke(); } }
  for(const p of POIS){ const d=me.c.disc.includes(p.id); mapIcon(x,'poi',p.x*S,p.y*S,d?'#e0a830':'#a89878'); txt(d?p.name:'Unexplored',p.x*S,p.y*S-9,11,d?'#3a2408':'#8a7a5a',700,3); mapFeat.push({x:p.x*S,y:p.y*S,r:10,tip:d?p.name:'An unexplored place'}); }
  for(const n of NPCS){ const m=npcMark(n); const px=n.x/TS*S, py=n.y/TS*S; if(n.id==='hilde'&&m==='$'){ drawShoe(x,px,py-2,.6,1); } else mapIcon(x,'npc',px,py,m==='!'||m==='?'?'#ffd34a':m==='$'?'#9fe07a':'#d8c8a8');
    if(m==='!'||m==='?') txtD(m,px,py-7,16,'#ffd34a'); mapFeat.push({x:px,y:py,r:8,tip:`${n.name} <${n.title}>`+(m==='!'?' · has a quest':m==='?'?' · quest ready to turn in':'')}); }
  if(MAPF.bosses) for(const bm of mobs){ const mt=bm.t; if(!(mt.boss||mt.elite)||mt.summon) continue; const px=bm.sx/TS*S, py=bm.sy/TS*S; let rem=0; if(bm.dead){ rem=Math.max(0,(bm.resp&&bm.resp<1e9?bm.resp:(bm.deathT||t)+(mt.resp||60))-t); }
    mapIcon(x,bm.dead?'bossdead':mt.boss?'boss':'elite',px,py,null,mt.boss?1.15:.95); txtD(mt.name,px,py+(mt.boss?22:19),11,bm.dead?'#cfc4b8':mt.boss?'#ffb08a':'#ffe08a'); if(bm.dead) txtD(mt.vault?'Defeated':'Respawns in '+fmtT(rem),px,py+(mt.boss?34:31),10,'#e8dcc8');
    mapFeat.push({x:px,y:py,r:12,tip:`${mt.boss?'☠ Boss':'★ Elite'}: ${mt.name} · Level ${bm.lv}`+(bm.dead?` · respawns in ${fmtT(rem)}`:' · alive')+(dropText(mt.key)?' · Drops: '+dropText(mt.key):'')}); }
  if(MAPF.players) for(const o of others.values()){ if(!seenO(o)) continue; const party=o.pt&&o.pt===me.party; x.fillStyle=party?'#3a8cff':CLS[o.c].col; x.strokeStyle='#fff'; x.lineWidth=1.5; x.beginPath(); x.arc(o.rx/TS*S,o.ry/TS*S,party?5:4,0,7); x.fill(); x.stroke(); if(party) txtD(o.n,o.rx/TS*S,o.ry/TS*S-8,11,'#bfe0ff'); mapFeat.push({x:o.rx/TS*S,y:o.ry/TS*S,r:8,tip:`${o.n} · Level ${o.l} ${CLS[o.c].name}`+(party?' · party':'')}); }
  for(const L of LOOTS){ x.fillStyle='#ffd34a'; x.beginPath(); x.arc(L.x/TS*S,L.y/TS*S,2.5,0,7); x.fill(); }
  const pr=6+Math.sin(t*4)*2.5; x.strokeStyle='rgba(255,255,255,.7)'; x.lineWidth=2; x.beginPath(); x.arc(me.x/TS*S,me.y/TS*S,pr+6,0,7); x.stroke();
  x.save(); x.translate(me.x/TS*S,me.y/TS*S); x.rotate(me.face+Math.PI/2); x.fillStyle='#ffe27a'; x.strokeStyle='#2a1a08'; x.lineWidth=2; x.beginPath(); x.moveTo(0,-11); x.lineTo(7,8); x.lineTo(0,4); x.lineTo(-7,8); x.closePath(); x.fill(); x.stroke(); x.restore();
  x.setTransform(1,0,0,1,0,0);
  // compass rose
  const cx=cv2.width-46, cy=cv2.height-46; x.save(); x.translate(cx,cy); x.fillStyle='rgba(74,44,16,.85)'; for(let k=0;k<4;k++){ x.beginPath(); x.moveTo(0,-26); x.lineTo(5,0); x.lineTo(-5,0); x.closePath(); x.fill(); x.rotate(Math.PI/2); } x.beginPath(); x.arc(0,0,4,0,7); x.fill(); x.restore(); txt('N',cx,cy-30,13,'#9a2a10',700,3,true); txt('S',cx,cy+40,13,'#4a2c10',700,3,true); txt('E',cx+36,cy+5,13,'#4a2c10',700,3,true); txt('W',cx-36,cy+5,13,'#4a2c10',700,3,true);
  $('mapCoords').textContent=`${ZONES[zoneAtPx(me.x,me.y)].name} · ${Math.round(me.x/TS)}, ${Math.round(me.y/TS)}`; }
function fmtT(s){ s=Math.ceil(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
/* ---------- login / roster ---------- */
function rosterList(){ if(!saves.roster){ saves.roster=Object.values(saves.chars||{}).map(c=>{ c.id=c.id||rid(6); return c; }); delete saves.chars; saveAll(saves); } return saves.roster; }
const CLSICON={warden:'bulwark',mender:'mend',arcanist:'ember',assassin:'ambush',bard:'s_embers'};
const CLSDETAIL={bard:['Songs that power up everyone around you','Heals and shields friends in a pinch','Difficulty: ★★☆'],assassin:['Stealth, combo points and finishers','Huge critical hits','Difficulty: ★★★'],warden:['Plate armour and shield','Holds monsters\' attention','Difficulty: ★☆☆'],mender:['Heals friends and smites foes','Shields, wings and sanctuary','Difficulty: ★★☆'],arcanist:['Fire, frost and lightning','Huge area damage','Difficulty: ★★★']};
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
const AUD={ctx:null,on:false,vol:{master:.8,music:.55,amb:0,sfx:.7,mute:false},track:'',want:'',layers:{},nextNote:0,step:0,bar:0,lastEv:0};
try{ Object.assign(AUD.vol,(saves.audio||{})); if(!saves.audioV2){ AUD.vol.amb=Math.min(AUD.vol.amb,.45); saves.audioV2=1; } if(!saves.audioV3){ AUD.vol.amb=.1; saves.audioV3=1; saves.audio=AUD.vol; } if(!saves.audioV4){ AUD.vol.amb=0; saves.audioV4=1; saves.audio=AUD.vol; } }catch(e){}
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
  battle:[[45,[57,60,64]],[45,[57,60,64]],[41,[53,57,60]],[43,[55,59,62]]],combat:[[50,[62,65,69]],[50,[62,65,69]],[46,[58,62,65]],[48,[60,64,67]]]};
const JIG={A:[[74,78,81,78,74,78],[79,83,79,78,79,76],[76,73,76,81,76,73],[74,76,78,74,0,0],[71,74,78,74,71,74],[79,78,76,74,76,79],[81,79,76,73,76,79],[78,76,73,74,0,0]],
  B:[[81,83,86,83,81,78],[79,81,83,86,83,79],[81,85,88,85,81,76],[78,81,86,81,78,74],[83,81,78,83,86,83],[81,79,78,79,81,83],[85,83,81,79,78,76],[74,78,81,74,0,0]]};
function fiddle(n,t,vol,dur){ const c=AUD.ctx; const o=c.createOscillator(), f=c.createBiquadFilter(), f2=c.createBiquadFilter(), g=c.createGain(), v=c.createOscillator(), vg=c.createGain(); o.type='sawtooth'; o.frequency.value=NOTE(n);
  v.frequency.value=5.6; vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(NOTE(n)*.007,t+dur*.6); v.connect(vg); vg.connect(o.frequency); f.type='lowpass'; f.frequency.value=2600; f2.type='peaking'; f2.frequency.value=1400; f2.Q.value=1.2; f2.gain.value=6;
  o.connect(f); f.connect(f2); f2.connect(g); g.connect(AUD.mbus); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.035); g.gain.setValueAtTime(vol*.85,t+dur*.8); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+.08); o.start(t); v.start(t); o.stop(t+dur+.12); v.stop(t+dur+.12); }
function jingle(t,vol){ const c=AUD.ctx; const s=c.createBufferSource(); s.buffer=AUD.noise; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=7800; f.Q.value=1.5; const g=c.createGain(); s.connect(f); f.connect(g); g.connect(AUD.mbus); env(g,t,.002,vol,.18); s.start(t); s.stop(t+.25); }
function clink(t){ const c=AUD.ctx; for(const fq of [2600,3900]){ const o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.value=fq*(1+Math.random()*.05); o.connect(g); g.connect(AUD.amb); env(g,t,.002,.03,.35); o.start(t); o.stop(t+.4); } }
const SCALE={tavern:[62,64,66,67,69,71,73,74,76,78,79,81],pastoral:[60,62,64,67,69,72,74,76,79],eerie:[57,59,60,62,64,65,68,69,72],frost:[62,64,65,67,69,70,72,74],battle:[57,60,62,64,65,67,69]};
let melPrev=69;
function schedStep(tr,t,step){ const P=PROG[tr]; if(!P) return; const per=tr==='tavern'?6:8; const bar=Math.floor(step/per)%P.length, s=step%per; const [root,ch]=P[bar];
  if(tr==='tavern'){ // a proper 6/8 tavern jig: fiddle tune (A part twice, B part twice), strummed lute, bodhran and tambourine
    const part=Math.floor(step/(per*8))%4<2?'A':'B', mb=JIG[part][bar], n=mb[s];
    if(n){ let dur=.19; for(let k=s+1;k<6&&mb[k]===0;k++) dur+=.19; fiddle(n,t,.075,dur*.95); }
    if(s===0||s===3){ ch.forEach((cn,i)=>pluck(cn-12+(s===3&&i===2?12:0),t+i*.016,.11,.6)); pluck(s===0?root-12:root-5,t,.26,.8); }
    if(s===0) drum(t,.34,true); else if(s===3) drum(t,.22,true); else drum(t,.05,false); if(s===3||(s===5&&Math.random()<.4)) jingle(t,.035);
    if(Math.random()<.004) clink(t+Math.random()*.2);
    if(s===per-1) AUD.bar++; return; }
  if(tr==='combat'){ if(s===0||s===4) drum(t,.34,true); if(s===6&&Math.random()<.5) drum(t,.2,true); if(s%2===1) drum(t,.07,false); if(s===0) pad([root-12,root-5,root],t,.07,1.7,true); pluck(root+[0,3,7,3,0,3,7,10][s]-12,t,.09,.25); if(s===per-1) AUD.bar++; return; }
  if(false){ // old jig
    if(s===0) { pluck(root-12,t,.32,.9); drum(t,.35,true); } if(s===3){ pluck(root-5,t,.22,.7); drum(t,.18,true); } if(s===2||s===5) drum(t,.08,false);
    pluck(ch[[0,1,2,1,2,1][s]]+(s===4?12:0)-12,t,.12,.5);
    if(AUD.bar%4!==3||s<3){ if(Math.random()<.78){ const sc=SCALE.tavern; let i=sc.indexOf(melPrev); if(i<0) i=4; i=clamp(i+[-2,-1,-1,0,1,1,2][Math.random()*7|0],0,sc.length-1); if(s===0) i=sc.indexOf(ch[Math.random()*3|0]+12)>=0?sc.indexOf(ch[Math.random()*3|0]+12):i; melPrev=sc[i]; (AUD.bar%8<4?pluck:flute)(melPrev,t,AUD.bar%8<4?.18:.12,AUD.bar%8<4?.45:.3); } } }
  else if(tr==='battle'){ if(s===0||s===3||s===6) drum(t,.45,true); if(s===2||s===4||s===7) drum(t,.12,false); if(s===0) pad([root-12,root-5],t,.12,2.2,true); if(s%2===0) pluck(root+(s===4?3:0),t,.12,.3); }
  else { if(s===0){ pad(ch,t,tr==='eerie'?.07:.06,5.2,tr==='eerie'); pluck(root,t,.12,2.2); } if(s===4&&Math.random()<.6){ const sc=SCALE[tr]; flute(sc[Math.random()*sc.length|0]+(tr==='frost'?0:0),t,.05,1.6); } }
  if(s===per-1) AUD.bar++; }
function audTick(){ if(!AUD.on||!me) return; const c=AUD.ctx, t=c.currentTime; const z=zoneAtPx(me.x,me.y); const night=curDark>.55;
  let tr=z==='town'?'tavern':z==='meadow'||z==='lake'||z==='forest'?'pastoral':z==='frost'?'frost':'eerie'; const inFight=mobs.some(m=>!m.dead&&!m.evade&&m.tgt===MY_U&&dist(m.rx,m.ry,me.x,me.y)<700)||(me.pvpBy&&now()-me.pvpBy.t<6&&!me.dead);
  if(inFight&&!me.dead) tr='combat'; if(bossEng&&!bossEng.m.dead&&!bossEng.m.evade) tr='battle';
  if(tr!==AUD.track){ if(AUD.want!==tr){ const fast=AUD.track==='combat'||AUD.track==='battle'||tr==='combat'; AUD.want=tr; AUD.mbus.gain.setTargetAtTime(0.0001,t,fast?.35:.5); AUD.switchAt=t+(fast?1.1:1.4); } if(t>=AUD.switchAt){ AUD.track=tr; AUD.step=0; AUD.bar=0; AUD.nextNote=t+.1; AUD.mbus.gain.setTargetAtTime(1,t,.6); } }
  const spb=AUD.track==='tavern'?60/138/2*2:AUD.track==='battle'?60/150/2*2:60/70/2*2; const stepDur=AUD.track==='tavern'?.19:AUD.track==='battle'?.2:AUD.track==='combat'?.21:.42;
  if(AUD.track===AUD.want) while(AUD.nextNote<t+.35){ schedStep(AUD.track,AUD.nextNote,AUD.step); AUD.step++; AUD.nextNote+=stepDur; }
  // ambience levels per zone
  const T0={wind:0,leaves:0,water:0,rumble:0,insects:0,frost:0,cave:0,town:0}; const set=o=>Object.assign(T0,o);
  if(z==='town') set({wind:.025,town:.05}); if(z==='meadow') set({wind:.16,leaves:.03}); if(z==='forest') set({wind:.12,leaves:.07}); if(z==='lake') set({wind:.1,water:.3}); if(z==='swamp') set({insects:.025,water:.12,wind:.05});
  if(z==='ruins') set({wind:.22}); if(z==='ash'||z==='lair') set({rumble:.55,wind:.05}); if(z==='frost') set({frost:.06,wind:.18}); if(z==='crypt'||z==='vault') set({cave:.45});
  if(isWaterAt(me.x,me.y)) T0.water=.4; if(me.inLava) T0.rumble=.8;
  for(const k in T0) AUD.layers[k].g.gain.setTargetAtTime(T0[k],t,1.2);
  // random events
  const r=Math.random();
  if((z==='forest'||z==='meadow'||z==='lake'||z==='town')&&!night&&r<(z==='forest'?.09:.04)) bird(t);
  if((z==='forest')&&!night&&r>.985) woodpecker(t);
  if(night&&(z==='meadow'||z==='forest'||z==='lake'||z==='town')&&r<.12) cricket(t);
  if(night&&z==='forest'&&r>.993) owl(t);
  if(z==='swamp'&&r<.07) frog(t); if((z==='ash'||z==='lair')&&r<.12) crackle(t); if((z==='crypt'||z==='vault')&&r<.05) drip(t); if(z==='frost'&&r>.992) creak(t);
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
/* ---------- v23: a living soundscape: combat, spells, hurt and creature voices, footsteps and wildlife (all synthesised) ---------- */
const SFXCD={};
function sfxSpatial(x,y){ if(!me) return [1,0]; const dx=x-me.x, dy=y-me.y, d=Math.hypot(dx,dy); if(d>760) return [0,0];
  const v=Math.pow(1-d/760,1.4), yaw=typeof CAM!=='undefined'?CAM.yaw:0; const rx=-Math.sin(yaw), ry=Math.cos(yaw); return [v, clamp((dx*rx+dy*ry)/320,-.85,.85)]; }
function sOut(vol,pan){ const c=AUD.ctx, g=c.createGain(); g.gain.value=vol; if(c.createStereoPanner){ const p=c.createStereoPanner(); p.pan.value=pan||0; g.connect(p); p.connect(AUD.sfx); } else g.connect(AUD.sfx); return g; }
function sNz(t,dur,type,f0,f1,q,vol,dest,att){ const c=AUD.ctx, s=c.createBufferSource(); s.buffer=AUD.noise; s.playbackRate.value=.8+Math.random()*.4; const f=c.createBiquadFilter(); f.type=type; f.Q.value=q||.7;
  f.frequency.setValueAtTime(f0,t); f.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur); const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+(att||.005)); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t,Math.random()*1.5,dur+.05); }
function sOsc(t,type,f0,f1,dur,vol,dest,att,vib){ const c=AUD.ctx, o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  if(vib){ const l=c.createOscillator(), lg=c.createGain(); l.frequency.value=vib[0]; lg.gain.value=vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+dur+.05); }
  g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(vol,t+(att||.008)); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+.05); }
function sForm(t,f0,f1,dur,vol,dest,formants){ const c=AUD.ctx, o=c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur); const g=c.createGain();
  g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  for(const [ff,q,a] of formants){ const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=ff; f.Q.value=q; const fg=c.createGain(); fg.gain.value=a; o.connect(f); f.connect(fg); fg.connect(g); } g.connect(dest); o.start(t); o.stop(t+dur+.05); }
function cdOk(k,s){ const n=performance.now()/1000; if(SFXCD[k]&&n-SFXCD[k]<s) return false; SFXCD[k]=n; return true; }
/* the sound bank */
function snd(k,x,y,mul){ if(!AUD.on||!AUD.ctx) return; const [v,pan]=x==null?[1,0]:sfxSpatial(x,y); const vol=v*(mul||1); if(vol<.02) return; const t=AUD.ctx.currentTime+.005, D=sOut(vol,pan), R=Math.random;
  switch(k){
    case 'whoosh': sNz(t,.2,'bandpass',500,2600,1.4,.32,D,.04); break;
    case 'slash': sNz(t,.09,'highpass',2600,4200,.8,.42,D); sOsc(t,'square',1500+R()*300,900,.06,.06,D); sOsc(t,'sine',2300+R()*500,2200,.32,.05,D); sOsc(t,'sine',3400+R()*400,3300,.22,.03,D); sNz(t,.12,'lowpass',700,200,.8,.35,D); break;
    case 'blunt': sNz(t,.14,'lowpass',1000,180,.8,.6,D); sOsc(t,'sine',150,55,.18,.42,D); sOsc(t,'triangle',420,200,.07,.08,D); break;
    case 'stab': sNz(t,.07,'bandpass',2800,1700,2.2,.42,D); sNz(t,.09,'lowpass',600,150,.8,.3,D); break;
    case 'crit': sOsc(t,'sine',1900,1880,.5,.07,D); sOsc(t,'sine',2850,2840,.4,.05,D); sNz(t,.16,'lowpass',900,120,.8,.5,D); break;
    case 'fire': sNz(t,.55,'lowpass',300,2400,.5,.38,D,.05); sOsc(t,'sine',90,45,.45,.3,D); for(let i=0;i<7;i++) sNz(t+.04+R()*.4,.03,'highpass',3500,5000,.7,.12,D); break;
    case 'fireHit': sNz(t,.45,'lowpass',1600,200,.6,.5,D); sOsc(t,'sine',110,40,.4,.35,D); break;
    case 'frost': for(const f of [1760,2350,2960,3520]) sOsc(t+R()*.06,'sine',f*(1+R()*.02),f,.55,.045,D); sNz(t,.35,'highpass',4000,7000,.8,.12,D); break;
    case 'holy': for(const [i,f] of [523,659,784,1047].entries()) sOsc(t+i*.025,'triangle',f,f,.9,.055,D,.04); sNz(t,.6,'highpass',5000,8000,.6,.04,D,.1); break;
    case 'arcane': sOsc(t,'sine',520,1450,.32,.13,D,.02,[18,40]); sOsc(t,'triangle',1040,2900,.25,.04,D); break;
    case 'zap': sNz(t,.28,'highpass',1800,5000,.9,.4,D); for(let i=0;i<5;i++) sNz(t+R()*.2,.025,'bandpass',3000+R()*2000,2000,3,.25,D); break;
    case 'shadow': sNz(t,.4,'bandpass',300,1400,2,.35,D,.06); sOsc(t,'sine',220,80,.4,.15,D); break;
    case 'song': for(const [i,f] of [392,494,587,784].entries()) sOsc(t+i*.09,'triangle',f,f,.75,.06,D,.03,[5,3]); sOsc(t,'sine',196,196,1.1,.05,D,.1); break;
    case 'horn': sOsc(t,'sawtooth',147,156,1.2,.06*(mul||1),D,.14,[5,2]); sOsc(t+.02,'sawtooth',220,233,1.1,.045,D,.16,[5,2]); sOsc(t,'sine',110,112,1.3,.08,D,.12); sNz(t,.5,'bandpass',600,900,2,.035,D,.1); break;
    case 'discord': for(const f of [300,317,449,476]) sOsc(t,'square',f,f*.75,.45,.03,D,.01,[17,9]); sNz(t,.3,'bandpass',900,400,3,.12,D); break;
    case 'heal': for(const [i,f] of [880,1109,1319,1760].entries()) sOsc(t+i*.07,'sine',f,f,.6,.05,D,.03); break;
    case 'shield': sOsc(t,'sine',380,820,.6,.1,D,.05,[9,18]); sNz(t,.5,'bandpass',1200,2400,4,.08,D,.1); break;
    case 'stun': sOsc(t,'sine',320,70,.25,.4,D); sNz(t,.12,'lowpass',800,150,.8,.4,D); sOsc(t+.12,'triangle',1800,1700,.4,.04,D); break;
    case 'root': sNz(t,.5,'bandpass',600,300,3,.3,D,.05); for(let i=0;i<4;i++) sNz(t+i*.09,.05,'bandpass',1200,800,6,.2,D); break;
    case 'boom': sNz(t,.7,'lowpass',900,60,.7,.7,D); sOsc(t,'sine',80,30,.7,.5,D); break;
    case 'castStart': sOsc(t,'sine',300,600,.5,.06,D,.2,[6,12]); sNz(t,.5,'bandpass',1800,3200,5,.05,D,.25); break;
    case 'potion': for(let i=0;i<3;i++) sOsc(t+i*.11,'sine',300+i*40,180,.09,.18,D); sOsc(t+.36,'sine',900,1300,.25,.05,D); break;
    case 'step': sNz(t,.07,'lowpass',(y===1?2200:y===2?800:1200),(y===1?900:200),.8,.1*(mul||1),D); break;
    case 'hoof': sNz(t,.06,'lowpass',900,160,.9,.28,D); sOsc(t,'sine',130,70,.07,.2,D); break;
    case 'hurt': { const m=mul||1; sForm(t,175*m,115*m,.2,.55,D,[[700,4,1],[1150,6,.6],[2600,8,.25]]); sNz(t,.08,'lowpass',600,150,.8,.25,D); break; }
    case 'die': sForm(t,150,70,.7,.45,D,[[600,4,1],[1000,6,.5]]); break;
    /* creatures */
    case 'wolf': sForm(t,260,170,.28,.5,D,[[520,3,1],[1100,5,.5]]); sNz(t,.25,'bandpass',900,500,2,.2,D); break;
    case 'wolfDie': sForm(t,520,240,.55,.4,D,[[900,4,1],[1600,6,.4]]); break;
    case 'boar': sForm(t,520,980,.12,.45,D,[[1300,4,1],[2400,6,.5]]); sForm(t+.12,980,420,.2,.4,D,[[1300,4,1],[2400,6,.5]]); break;
    case 'beast': sForm(t,120,75,.6,.6,D,[[380,3,1],[800,4,.6]]); sNz(t,.6,'lowpass',500,120,.8,.35,D,.05); break;
    case 'ghost': sNz(t,.55,'bandpass',2200,1400,7,.3,D,.08); sOsc(t,'sine',980,560,.55,.08,D,.06,[7,30]); break;
    case 'armor': sOsc(t,'square',280,240,.08,.12,D); sOsc(t,'sine',1600+R()*400,1580,.3,.05,D); sNz(t,.1,'highpass',3000,5000,.8,.2,D); break;
    case 'undead': sForm(t,110,80,.7,.45,D,[[450,3,1],[900,5,.4]]); sNz(t,.6,'bandpass',600,300,3,.15,D,.1); break;
    case 'bug': for(let i=0;i<7;i++) sNz(t+i*.035,.02,'highpass',3200,4500,1,.28,D); break;
    case 'slime': sNz(t,.3,'lowpass',500,140,1.5,.45,D); sOsc(t,'sine',220,80,.28,.25,D,.01,[14,25]); break;
    case 'caster': sForm(t,330,260,.3,.35,D,[[800,4,1],[1300,6,.6],[2800,8,.3]]); break;
    case 'fireMob': sNz(t,.35,'lowpass',600,2600,.6,.35,D,.04); for(let i=0;i<5;i++) sNz(t+R()*.3,.03,'highpass',3500,5000,.7,.12,D); break;
    case 'moth': for(let i=0;i<6;i++) sNz(t+i*.04,.03,'bandpass',300,250,3,.2,D); break;
    case 'plant': sNz(t,.35,'bandpass',500,250,4,.3,D,.04); sNz(t+.05,.2,'highpass',2500,4000,1,.15,D); break;
    case 'roar': sForm(t,95,55,1.3,.7,D,[[300,3,1],[650,4,.6],[1400,5,.25]]); sNz(t,1.3,'lowpass',700,90,.7,.45,D,.12); sOsc(t,'sine',60,35,1.2,.35,D,.1); break;
    case 'bird': { const f=2400+R()*1600; for(let i=0;i<2+(R()*3|0);i++){ const tt=t+i*(.09+R()*.05); sOsc(tt,'sine',f*(1+R()*.2),f*(.75+R()*.2),.07,.06,D); } break; }
    case 'owl': sOsc(t,'sine',420,380,.35,.08,D,.06); sOsc(t+.5,'sine',430,360,.55,.08,D,.06); break;
    case 'howl': sForm(t,330,520,1.1,.18,D,[[700,4,1],[1300,6,.4]]); sForm(t+1.1,520,300,.9,.16,D,[[700,4,1],[1300,6,.4]]); break;
    case 'frog': for(let i=0;i<2;i++) sOsc(t+i*.18,'square',180,120,.09,.05,D); break;
  } }
const MOBVOICE={wolf:'wolf',frostwolf:'wolf',fangmaw:'wolf',boar:'boar',oldtusk:'boar',yeti:'beast',moth:'moth',thornling:'plant',lurker:'slime',siltmother:'slime',siltling:'bug',crawler:'bug',
  bogwitch:'caster',cultist:'caster',cryptmage:'caster',dacolyte:'caster',sentinel:'armor',vsentry:'armor',deathguard:'armor',ossric:'armor',wraith:'ghost',icewraith:'ghost',tidewraith:'ghost',drownedshade:'ghost',
  hking:'undead',thrall:'undead',lich:'undead',vaelith:'undead',magma:'fireMob',emberling:'fireMob',wyrm:'roar',frostgiant:'roar'};
function mobSnd(m,ev){ if(!m||!m.t) return; const k=MOBVOICE[m.t.key]||'beast', big=m.t.boss?1.25:1;
  if(ev==='attack'){ if(!cdOk('ma'+m.id,1.4)) return; if(Math.random()<(m.t.boss?.45:.6)) snd(k,m.rx,m.ry,.75*big); snd(k==='armor'||k==='undead'?'slash':'blunt',m.rx,m.ry,.5); }
  else if(ev==='die'){ snd(k==='wolf'?'wolfDie':k,m.rx,m.ry,.9*big); if(m.t.boss) snd('boom',m.rx,m.ry,.6); }
  else if(ev==='aggro'){ if(!cdOk('mg'+m.id,8)) return; snd(m.t.boss?'roar':k,m.rx,m.ry,m.t.boss?1:.6); } }
function actSnd(src,a,mine){ const kind=a[1], vis=a[4]|0, x=src.x, y=src.y; const tm=mobById[a[2]];
  if(kind===0){ if(vis===0){ const L=mine?playerLook(me.c.cls,MY_U,myGearVis()):null; const w=L?L.weapon:''; const blunt=/morningstar|hammer|club|staff|solace/.test(w||''), stab=/dagger|nightfang/.test(w||'');
      const px=tm?tm.rx:x, py=tm?tm.ry:y; snd('whoosh',x,y,.6); setTimeout(()=>snd(stab?'stab':blunt?'blunt':'slash',px,py,.85),70); }
    else if(vis===1) snd('holy',x,y,.7); else if(vis===2) snd('fire',x,y,.8); else if(vis===3) snd('arcane',x,y,.8); else if(vis===4) snd('arcane',x,y,.55); else if(vis===11) snd('zap',x,y,.8); }
  else if(kind===1||kind===4){ if(cdOk('heal'+(a[2]||''),.25)) snd('heal',x,y,.6); }
  else if(kind===7) snd('shield',x,y,.8); else if(kind===2) snd('stun',tm?tm.rx:x,tm?tm.ry:y,.8); else if(kind===5) snd('root',tm?tm.rx:x,tm?tm.ry:y,.7);
  else if(kind===6){ if(vis===28) snd('whoosh',x,y,1); else if(vis===29) snd('shadow',x,y,.9); else if(vis===30) snd('shadow',x,y,.7); else snd('boom',a.length>5?a[5]:x,a.length>5?a[6]:y,.6); } }
function footSnd(){ if(!me||me.mounted||!cdOk('step',.18)) return; const t=tAt(Math.floor(me.x/TS),Math.floor(me.y/TS)); const hard=[T.COBBLE,T.RUIN,T.DFLOOR,T.BRIDGE,T.PATH,T.DOOR].includes(t)?1:(t===T.SNOW||t===T.ICE)?0:2; snd('step',null,hard===1?1:2,hard===1?1:.8); }
/* wildlife and distant life, mixed into the ambience bus */
function wildTick(){ if(!AUD.on||!me||me.dead) return; const z=zoneAtPx(me.x,me.y), night=curDark>.55, R=Math.random, amb=AUD.vol.amb/.45;
  const at=(k,v)=>{ const a=R()*6.283, d=180+R()*420; snd(k,me.x+Math.cos(a)*d,me.y+Math.sin(a)*d,v*Math.min(1.6,amb)); };
  if(z==='vault'||z==='crypt') return;
  if(!night&&(z==='meadow'||z==='forest'||z==='town'||z==='lake')&&R()<.35) at('bird',z==='forest'?.9:.7);
  if(night&&(z==='forest'||z==='meadow')&&R()<.05) at('owl',.8);
  if(night&&(z==='forest'||z==='frost')&&R()<.015) at('howl',.7);
  if((z==='swamp'||z==='lake')&&R()<.12) at('frog',.8); }
setInterval(()=>{ try{ wildTick(); }catch(e){} },1300);

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
  const st=[['Health',me.mhp],[cl.res[0].toUpperCase()+cl.res.slice(1),me.mres],['Power',me.pow],['Stamina',me.sta],['Damage bonus','+'+Math.round((me.pow*.8)/(10+c.lvl*4)*100)+'%'+(wpn&&wpn.rar===4?' · legendary +10%':'')],['Damage taken',Math.round(cl.mit*100)+'%'],['Mount',c.mount?MOUNTS[c.mount].name:'None'],['Gold',c.gold],['Quests completed',qd],['Places discovered',`${c.disc.length}/${POIS.length}`]];
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
/* (celestial steed now drawn by drawHorse) */

/* ---------- v22: Sunken Vault rules: entering with -e, leaving with -o, finishing with -d ---------- */
Object.assign(BOSSY,{
  ossric:{title:'Warden of the Vault Gate',pull:'None pass the gate of Vael. None.',p50:'This shell has stood a thousand years. It will stand a thousand more!',p20:'The gate... must... hold!',die:'The gate... falls...'},
  siltmother:{title:'Brood Queen of the Deep',pull:'*a wet, chittering shriek fills the cavern*',p50:'*the silt boils as her brood stirs*',p20:'*Mother Silt thrashes in fury*',die:'*the chittering falls silent*'},
  vaelith:{title:'The Drowned King',pull:'You walk my halls with dry feet. Let me change that.',p50:'Rise, my drowned court! Drag them under!',p20:'The tide does not end. The tide NEVER ends!',die:'The water... is so... cold...'}});
Object.assign(BOSSLOOT,{ossric:{n:1,p:[0,0,70,30,0]},siltmother:{n:1,p:[0,0,60,40,0]},vaelith:{n:2,p:[0,0,38,61,1]}});
for(const m of mobs) if(m.t.vault&&m.t.boss) VAULT.boss[m.t.key]=m;
function vaultNear(x,y){ return Math.hypot(x-VAULT.gate.x,y-VAULT.gate.y)<=VAULT.range; }
function vaultCmd(k){ if(!me) return; if(me.dead) return sysMsg('You cannot do that while dead.','c-err');
  if(k==='e'){
    if(inVault(me.x,me.y)) return sysMsg('You are already inside the Sunken Vault. Type -o to leave early, or -d once the Drowned King has fallen.','c-err');
    if(!vaultNear(me.x,me.y)) return sysMsg(`Stand within 6 yards of the Sunken Vault gate to enter. You are ${Math.round(Math.hypot(me.x-VAULT.gate.x,me.y-VAULT.gate.y)/10)} yards away.`,'c-err');
    const mem=partyMembers().filter(o=>!o.d), far=mem.filter(o=>!vaultNear(o.rx,o.ry));
    if(far.length) return sysMsg('Your whole party must stand within 6 yards of the gate. Too far away: '+far.map(o=>o.n).join(', ')+'.','c-err');
    const busy=[...others.values()].filter(o=>seenO(o)&&inVault(o.rx,o.ry)&&!(me.party&&o.pt===me.party));
    if(busy.length) return sysMsg('Another group is inside the Sunken Vault ('+busy.map(o=>o.n).join(', ')+'). Wait until they finish.','c-err');
    if(me.party){ myChat.push([++chSeq,3,'E']); if(myChat.length>3) myChat.shift(); }
    vaultEnter(me.party?`You lead your party into the Sunken Vault.`:'You descend into the Sunken Vault.'); return; }
  if(k==='o'&&inArena(me.x,me.y)){ arenaLeave(); return; }
  if(k==='o'){ if(!inVault(me.x,me.y)) return sysMsg('You are not inside a dungeon.','c-err'); vaultLeave('You climb back out of the Sunken Vault.'); return; }
  if(k==='d'){ if(!inVault(me.x,me.y)) return sysMsg('You are not inside a dungeon.','c-err');
    const b=VAULT.boss.vaelith; if(b&&!b.dead) return sysMsg('Vaelith, the Drowned King, still rules these halls. Defeat him first, or type -o to leave early.','c-err');
    if(me.party){ myChat.push([++chSeq,3,'D']); if(myChat.length>3) myChat.shift(); }
    vaultLeave('Dungeon complete! You and your party return to the surface.'); } }
function vaultEnter(msg){ if(me.mounted) dismount(); const S=VAULT.start; me.x=S.x+(Math.random()-.5)*48; me.y=S.y+(Math.random()-.5)*48; me.face=0; me.target=null; me.auto=false; me.cast=null;
  if(typeof CAM!=='undefined'){ CAM.tx=me.x/TS; CAM.tz=me.y/TS; CAM.yaw=0; } sendPresence(true); sysMsg(msg); sysMsg('Type -o to leave early. When the Drowned King falls, type -d to finish and return together.'); if(!me.c.disc.includes('vault')) me.c.disc.push('vault'); }
function vaultLeave(msg){ if(me.mounted) dismount(); const S=VAULT.exit; me.x=S.x+(Math.random()-.5)*40; me.y=S.y+Math.random()*20; me.face=Math.PI/2; me.target=null; me.auto=false; me.cast=null;
  if(typeof CAM!=='undefined'){ CAM.tx=me.x/TS; CAM.tz=me.y/TS; } sendPresence(true); sysMsg(msg); }
function vaultEvent(o,txt){ if(!me||me.dead) return;
  if(txt==='E'){ if(!inVault(me.x,me.y)&&vaultNear(me.x,me.y)) vaultEnter(`${o.n} leads your party into the Sunken Vault.`); else if(!inVault(me.x,me.y)) sysMsg(`${o.n} entered the Sunken Vault. You were too far from the gate to follow; come to the gate in the Ruins of Vael and type -e.`,'c-party'); }
  else if(txt==='D'){ if(inVault(me.x,me.y)) vaultLeave(`${o.n} completes the dungeon. You return to the surface together.`); } }
/* host: an empty vault resets itself after 20 seconds, so the next group finds it whole */
/* host: nothing in the vault respawns while anyone is inside (dead heroes count, they revive at the entrance stair).
   Once every hero is out, the whole vault resets 20 s later: all bosses, Vaelith included, and every monster. */
function vaultHostTick(players,t){ const inside=(me&&inVault(me.x,me.y))||[...others.values()].some(o=>inVault(o.x,o.y)); if(inside){ VAULT.emptySince=0; return; }
  if(!VAULT.emptySince){ VAULT.emptySince=t; return; } const any=mobs.some(m=>m.t.vault&&!m.t.summon&&(m.dead||m.hp<m.mhp||m.evade));
  if(!any||t-VAULT.emptySince<20) return; VAULT.emptySince=t;
  for(const m of mobs) if(m.t.vault&&!m.t.summon&&(m.dead||m.hp<m.mhp||m.evade)) respawnMob(m); despawnAdds('siltmother'); despawnAdds('vaelith'); }
/* a gentle hint at the gate */
function vaultHint(){ if(!me||me.dead||inVault(me.x,me.y)) return; const n=vaultNear(me.x,me.y); if(n&&!VAULT.hint){ VAULT.hint=true; sysMsg('The Sunken Vault · Level 10 dungeon. Gather your party within 6 yards of the gate and type -e to descend together.'); } else if(!n&&Math.hypot(me.x-VAULT.gate.x,me.y-VAULT.gate.y)>200) VAULT.hint=false; }
setInterval(vaultHint,1000);
const LPAL={lurker:[[.22,.36,.2],[.3,.48,.27],[.42,.6,.32],[1,.95,.4],1.1],crawler:[[.28,.24,.18],[.38,.33,.24],[.5,.46,.32],[.4,1,.8],.72],siltling:[[.3,.28,.2],[.42,.38,.26],[.55,.5,.34],[.4,1,.8],.55],siltmother:[[.2,.19,.14],[.3,.28,.21],[.44,.4,.29],[.3,1,.75],2.5]};
Object.assign(MOBH,{vsentry:2.4,dacolyte:2.2,crawler:1.2,tidewraith:2.6,ossric:3.9,siltmother:3.4,siltling:1,vaelith:4.1,drownedshade:2.8});
NPCGREET.selis='"Below these ruins lies the Sunken Vault, where the last king of Vael still sits his drowned throne. Gather your party within 6 yards of the gate, then any one of you types -e and you all descend together. Inside, -o brings you back up early; once the Drowned King falls, -d returns your whole party to the surface."';
QUESTS.push({id:'vaultking',giver:'selis',title:'The Drowned King',type:'kill',mob:'vaelith',n:1,xp:4000,gold:60,lvl:9,text:'Gather a party, descend into the Sunken Vault beneath the Ruins of Vael and put Vaelith, the Drowned King, to rest. Past his Gatekeeper and the brood of Mother Silt, he waits on his throne.'});

/* =====================================================================
   OPTIONS, KEYBINDS, ESCAPE MENU, QUEST ARROW, TOUCH CONTROLS
   ===================================================================== */
const BIND_DEF={forward:'w',back:'s',left:'a',right:'d',jump:' ',interact:'f',lootall:'g',target:'tab',mount:'r',potion:'q',sit:'x',autorun:'`',
  ab1:'1',ab2:'2',ab3:'3',ab4:'4',ab5:'5',ab6:'6',ab7:'7',ab8:'8',character:'c',talents:'n',bags:'b',map:'m',quests:'l',party:'p',players:'o',help:'h'};
const BIND_LABEL={forward:'Move forward',back:'Move backward',left:'Strafe left',right:'Strafe right',jump:'Jump',autorun:'Auto-run',interact:'Talk / loot / gather',lootall:'Take all loot',target:'Target enemy (attacking you or within 5 yd)',mount:'Mount / dismount',potion:'Drink potion',sit:'Sit',
  ab1:'Ability 1',ab2:'Ability 2',ab3:'Ability 3',ab4:'Ability 4',ab5:'Ability 5',ab6:'Ability 6',ab7:'Ability 7',ab8:'Ability 8',character:'Character panel',talents:'Talents',bags:'Bags',map:'World map',quests:'Quest log',party:'Party',players:'Players online',help:'Help'};
const OPT=Object.assign({sens:1,invertY:false,camMax:30,questArrow:true,uiScale:innerWidth<760?.62:1,shake:true,names:true,gfx:'auto',fullscreen:true,autoLoot:false},saves.opts||{});
let BIND=Object.assign({},BIND_DEF,saves.binds||{}); let KEYMAP={}; function rebuildKeymap(){ KEYMAP={}; for(const a in BIND) if(BIND[a]) KEYMAP[BIND[a]]=a; } rebuildKeymap();
function saveOpts(){ saves.opts=OPT; saves.binds=BIND; saveAll(saves); applyOpts(); }
function applyOpts(){ document.documentElement.style.setProperty('--uis',OPT.uiScale); }
applyOpts();
const keyName=k=>k===' '?'Space':k==='tab'?'Tab':k==='`'?'`':k.startsWith('arrow')?k.replace('arrow','Arrow '):k.length===1?k.toUpperCase():k[0].toUpperCase()+k.slice(1);
let capBind=null, autoRun=false;
addEventListener('keydown',e=>{ if(!capBind) return; e.preventDefault(); e.stopImmediatePropagation(); const k=e.key.toLowerCase();
  if(k!=='escape'){ for(const a in BIND) if(BIND[a]===k) BIND[a]=''; BIND[capBind]=k; rebuildKeymap(); saveOpts(); } capBind=null; renderOptions(); },true);
/* ---------- escape menu ---------- */
function anyWindowOpen(){ const ids=['tkWin','invWin','whoWin','helpWin','mapWin','qlogWin','charWin','partyWin','soundWin','gmWin','optWin','escMenu','lootWin','bugWin']; let open=false;
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
/* ---------- talents ---------- */
let TALC=null;
function talSpent(c){ c=c||me.c; let n=0; for(const k in (c.tal||{})) n+=c.tal[k]|0; return n; }
function talPoints(c){ c=c||me.c; return Math.max(0,(c.lvl-1)-talSpent(c)); }
function talCache(){ const out={}; if(!me) return out; const L=TALENTS[me.c.cls]||[]; const tal=me.c.tal||{}; for(const t of L){ const r=tal[t.id]|0; if(!r) continue; for(const k in t.e) out[k]=(out[k]||0)+t.e[k]*r; } return out; }
function TAL(k){ if(!me) return 0; if(!TALC||TALC.cls!==me.c.cls) { TALC=talCache(); TALC.cls=me.c.cls; } return TALC[k]||0; }
function talChanged(){ TALC=null; recalc(); persist(); renderTalents(); updateBar(); sendPresence(true); }
function talDesc(t,r){ return t.d.replace(/\{([\d.]+)\}/g,(m,v)=>{ const n=+v*Math.max(1,r); return Math.round(n*10)/10; }); }
function talLearn(id){ const c=me.c; const t=(TALENTS[c.cls]||[]).find(x=>x.id===id); if(!t) return; c.tal=c.tal||{}; const r=c.tal[id]|0;
  if(r>=t.max) return err('Already at maximum rank'); if(talPoints()<1) return err('No talent points left. You get one every level.');
  if(talSpent()<TAL_TIERS[t.t]) return err(`Spend ${TAL_TIERS[t.t]} points to unlock this row`);
  c.tal[id]=r+1; sfx('accept'); toast(t.n+' '+(r+1)+'/'+t.max,'small'); talChanged(); }
function talUnlearn(id){ const c=me.c, L=TALENTS[c.cls]||[], t=L.find(x=>x.id===id), r=(c.tal||{})[id]|0; if(!t||!r) return err('You have not learned that talent');
  const after={...c.tal}; after[id]=r-1; const below=tier=>L.filter(x=>x.t<tier).reduce((a,x)=>a+(after[x.id]|0),0);
  for(const u of L) if((after[u.id]|0)>0&&u.t>0&&below(u.t)<TAL_TIERS[u.t]) return err(`Unlearn ${u.n} first: it needs ${TAL_TIERS[u.t]} points in the rows above it`);
  const cost=Math.max(1,c.lvl); askConfirm(`Unlearn one rank of ${t.n} for ${cost} gold? You get the point back.`,'Unlearn',()=>{ if(c.gold<cost) return err('Not enough gold'); c.gold-=cost; if(r-1>0) c.tal[id]=r-1; else delete c.tal[id]; sfx('accept'); toast(`${t.n} ${r-1}/${t.max}`,'small'); talChanged(); }); }
function talReset(){ const c=me.c; if(!talSpent()) return; const cost=Math.max(1,c.lvl*2);
  askConfirm(`Forget all your talents for ${cost} gold? You get every point back.`,'Reset talents',()=>{ if(c.gold<cost) return err('Not enough gold'); c.gold-=cost; c.tal={}; sysMsg('Your talents have been reset.'); talChanged(); }); }
function renderTalents(){ const w=$('talWin'); if(!w||w.classList.contains('hidden')||!me) return; const c=me.c, L=TALENTS[c.cls]||[], sp=talSpent(), pts=talPoints(); const col=CLS[c.cls].col;
  let h=`<div class="talhead"><span>${CLS[c.cls].glyph} ${CLS[c.cls].name} talents</span><b class="${pts?'have':''}">${pts} point${pts===1?'':'s'} to spend</b></div>`;
  for(let tier=0;tier<TAL_TIERS.length;tier++){ const open=sp>=TAL_TIERS[tier]; h+=`<div class="talrow ${open?'':'locked'}"><div class="talreq">${tier?(open?'':'🔒 ')+TAL_TIERS[tier]+' pts':''}</div>`;
    for(const t of L.filter(x=>x.t===tier)){ const r=(c.tal||{})[t.id]|0; const can=open&&pts>0&&r<t.max;
      h+=`<button class="tal ${r?'some':''} ${r>=t.max?'max':''} ${can?'can':''}" data-tal="${t.id}" style="--cc:${col}"><span class="ti">${t.ic}</span><span class="tr">${r}/${t.max}</span><span class="tn">${t.n}</span></button>`; }
    h+='</div>'; }
  h+=`<div class="talfoot"><span>You earn 1 point every level. Hover a talent to read it, click to learn it, right-click to unlearn a rank.</span><button id="talReset" ${sp?'':'disabled'}>Reset (${Math.max(1,c.lvl*2)}g)</button></div>`;
  w.querySelector('.talbody').innerHTML=h;
  w.querySelectorAll('[data-tal]').forEach(b=>{ const t=L.find(x=>x.id===b.dataset.tal); const r=(c.tal||{})[t.id]|0;
    b.onclick=()=>{ hideTip(); talLearn(t.id); }; b.oncontextmenu=e=>{ e.preventDefault(); hideTip(); talUnlearn(t.id); };
    b.onmouseenter=e=>showTip(e,`<b>${t.n}</b> <span style="color:#aaa">rank ${r}/${t.max}</span><br>${r?talDesc(t,r):talDesc(t,1)}${r&&r<t.max?`<br><span style="color:#8f8">Next rank: ${talDesc(t,r+1)}</span>`:''}${!(sp>=TAL_TIERS[t.t])?`<br><span style="color:#f88">Requires ${TAL_TIERS[t.t]} points spent</span>`:''}${r?`<br><span style="color:#ffd34a">Right-click to unlearn a rank (${Math.max(1,c.lvl)}g)</span>`:''}`); b.onmouseleave=hideTip; });
  $('talReset').onclick=talReset; }

/* ---------- options window ---------- */
let optTab='controls';
function renderOptions(){ const w=$('optWin'); if(w.classList.contains('hidden')) return; const tabs=[['controls','Controls'],['gfx','Graphics'],['keys','Keybinds'],['sound','Sound'],['ui','Interface']];
  let h=`<div class="otabs">${tabs.map(([k,l])=>`<button data-tab="${k}" class="${optTab===k?'on':''}">${l}</button>`).join('')}</div><div class="obody">`;
  const sl=(k,l,min,max,step,fmt)=>`<div class="sndrow"><span>${l}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${OPT[k]}" data-o="${k}"><b>${fmt(OPT[k])}</b></div>`;
  const ck=(k,l)=>`<label class="ock"><input type="checkbox" data-c="${k}" ${OPT[k]?'checked':''}> ${l}</label>`;
  if(optTab==='controls') h+=sl('sens','Mouse / touch look speed',.3,2.5,.1,v=>Math.round(v*100)+'%')+sl('camMax','Max camera zoom out',10,40,1,v=>v)+ck('invertY','Invert camera up/down')+ck('shake','Screen shake')+`<div class="onote">Movement: hold both mouse buttons to run forward, right-drag to steer, left-drag to look around, wheel to zoom. On touch screens use the joystick and drag the screen to look.</div>`;
  if(optTab==='keys'){ h+='<div class="okeys">'+Object.keys(BIND_DEF).map(a=>`<div class="okey"><span>${BIND_LABEL[a]}</span><button data-bind="${a}" class="${capBind===a?'cap':''}">${capBind===a?'Press a key…':(BIND[a]?keyName(BIND[a]):'—')}</button></div>`).join('')+'</div><div class="onote">Arrow keys always move too. Esc cancels. <button id="bindReset">Reset to defaults</button></div>'; }
  if(optTab==='gfx'){ const Q=[['auto','Auto'],['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']];
    h+=`<div class="sndrow"><span>Graphics quality</span><select id="gfxSel">${Q.map(([k,l])=>`<option value="${k}" ${OPT.gfx===k?'selected':''}>${l}</option>`).join('')}</select><b>${GFX.q}</b></div>`+ck('fullscreen','Start in full screen')+ck('borderless','Windowed borderless: let the mouse leave the game (multi-monitor)')+sl('curSpd','Game cursor speed (full screen)',.4,2.5,.05,v=>Math.round(v*100)+'%')+`<div class="onote"><button id="fsNow">${document.fullscreenElement?'Leave full screen':'Go full screen now'}</button> Quality changes apply after you press <button id="gfxReload">Restart the game</button> (your character is saved). Low is best for phones and older laptops; Ultra needs a gaming graphics card.</div>`; }
  if(optTab==='sound') h+='<div id="optSound"></div>';
  if(optTab==='ui') h+=sl('uiScale','Interface size',.5,1.3,.02,v=>Math.round(v*100)+'%')+ck('questArrow','Show quest direction arrow')+ck('names','Show player and monster names');
  w.querySelector('.obodywrap').innerHTML=h+'</div>';
  w.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ optTab=b.dataset.tab; capBind=null; renderOptions(); });
  w.querySelectorAll('[data-o]').forEach(i=>i.oninput=()=>{ OPT[i.dataset.o]=+i.value; i.nextElementSibling.textContent=i.dataset.o==='camMax'?i.value:Math.round(i.value*100)+'%'; saveOpts(); });
  w.querySelectorAll('[data-c]').forEach(i=>i.onchange=()=>{ OPT[i.dataset.c]=i.checked; saveOpts(); if(i.dataset.c==='borderless'&&OPT.borderless&&document.pointerLockElement) document.exitPointerLock(); });
  w.querySelectorAll('[data-bind]').forEach(b=>b.onclick=()=>{ capBind=b.dataset.bind; renderOptions(); });
  if($('bindReset')) $('bindReset').onclick=()=>{ BIND=Object.assign({},BIND_DEF); rebuildKeymap(); saveOpts(); renderOptions(); };
  if($('gfxSel')) $('gfxSel').onchange=e=>{ OPT.gfx=e.target.value; saveOpts(); };
  if($('fsNow')) $('fsNow').onclick=()=>{ toggleFullscreen(); setTimeout(renderOptions,300); };
  if($('gfxReload')) $('gfxReload').onclick=()=>{ try{ if(me) persist(); }catch(e){} location.reload(); };
  if(optTab==='sound') renderSound($('optSound')); }
/* ---------- full screen ---------- */
const FS_IOS=/iPhone|iPod/i.test(navigator.userAgent)||!!navigator.standalone;
function windowIsFull(){ return innerWidth>=screen.width-2&&innerHeight>=screen.height-2; }
/* In full screen the real mouse is locked to the game and a game cursor is drawn instead, so it can never wander onto a second monitor.
   Every click, hover, wheel and right-click is passed on to whatever is under the game cursor. Esc frees the mouse; click to capture it again. */
const GCUR={on:false,x:0,y:0,over:null,down:null,btns:0,el:null,rng:null};
function cursorWanted(){ return !document.body.classList.contains('touch')&&!OPT.borderless&&!!(document.fullscreenElement||windowIsFull())&&!!document.documentElement.requestPointerLock; }
addEventListener('resize',()=>{ setTimeout(()=>{ if(!document.fullscreenElement&&!windowIsFull()&&document.pointerLockElement===document.documentElement) document.exitPointerLock(); },120); });
(function(){ const el=document.createElement('div'); el.id='gcur'; el.innerHTML='<svg class="gc-arrow" width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22 L7.5 17 L11 26 L15 24.5 L11.5 16 L19 16Z" fill="#f4e6c4" stroke="#1a1006" stroke-width="1.8" stroke-linejoin="round"/></svg>'; document.body.appendChild(el); GCUR.el=el;
  const fire=(type,tg,e,extra)=>{ if(!tg) return; const init={bubbles:!['mouseenter','mouseleave'].includes(type),cancelable:true,composed:true,view:window,clientX:GCUR.x,clientY:GCUR.y,screenX:GCUR.x,screenY:GCUR.y,button:e?e.button:0,buttons:GCUR.btns,
      movementX:e?e.movementX||0:0,movementY:e?e.movementY||0:0,shiftKey:!!(e&&e.shiftKey),ctrlKey:!!(e&&e.ctrlKey),altKey:!!(e&&e.altKey),metaKey:!!(e&&e.metaKey),...(extra||{})};
    let ev; if(type.startsWith('pointer')) ev=new PointerEvent(type,{...init,pointerId:1,pointerType:'mouse',isPrimary:true}); else if(type==='wheel') ev=new WheelEvent(type,init); else ev=new MouseEvent(type,init); return tg.dispatchEvent(ev); };
  const under=()=>document.elementFromPoint(GCUR.x,GCUR.y)||document.body;
  const hover=tg=>{ const old=GCUR.over; if(old===tg) return; if(old&&old.isConnected){ fire('mouseout',old,null,{relatedTarget:tg}); for(let n=old;n&&n!==document&&!(n.contains&&n.contains(tg));n=n.parentNode) fire('mouseleave',n,null,{relatedTarget:tg}); }
    fire('mouseover',tg,null,{relatedTarget:old}); const path=[]; for(let n=tg;n&&n!==document&&!(old&&n.contains&&n.contains(old));n=n.parentNode) path.unshift(n); for(const n of path) fire('mouseenter',n,null,{relatedTarget:old}); GCUR.over=tg; };
  const setRange=(r)=>{ const b=r.getBoundingClientRect(), f=clamp((GCUR.x-b.left)/b.width,0,1), mn=+r.min||0, mx=+r.max||100, st=+r.step||1; r.value=Math.round((mn+f*(mx-mn))/st)*st; r.dispatchEvent(new Event('input',{bubbles:true})); };
  let pq=0; const place=()=>{ if(pq) return; pq=requestAnimationFrame(()=>{ pq=0; el.style.transform=`translate3d(${GCUR.x}px,${GCUR.y}px,0)`; }); };
  document.addEventListener('pointerlockchange',()=>{ if(document.pointerLockElement===cv) return; GCUR.on=document.pointerLockElement===document.documentElement; el.style.display=GCUR.on?'block':'none'; if(GCUR.on) place(); else { GCUR.btns=0; GCUR.rng=null; } });
  const grab=e=>{ if(!e.isTrusted) return false; if(!GCUR.on){ if(e.type==='mousedown'&&cursorWanted()){ GCUR.x=e.clientX; GCUR.y=e.clientY; try{ const p=document.documentElement.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(_){} } return false; }
    e.stopImmediatePropagation(); if(!e.type.startsWith('pointer')&&e.cancelable) e.preventDefault(); return true; };
  for(const ty of ['pointermove','pointerdown','pointerup','click','dblclick','auxclick','contextmenu']) addEventListener(ty,e=>{ grab(e); },true);
  addEventListener('mousemove',e=>{ if(!grab(e)) return; const sc=(OPT.curSpd||1)/(/Chrome/.test(navigator.userAgent)?(devicePixelRatio||1):1); if(!(MOUSE.down>=0&&MOUSE.drag)){ GCUR.x=clamp(GCUR.x+e.movementX*sc,0,innerWidth-1); GCUR.y=clamp(GCUR.y+e.movementY*sc,0,innerHeight-1); place(); } const tg=under(); hover(tg); if(GCUR.rng) setRange(GCUR.rng); fire('pointermove',tg,e); fire('mousemove',tg,e); if(tg!==cv&&hoverK&&!(MOUSE.down>=0)) setHoverCursor(''); },true);
  addEventListener('mousedown',e=>{ if(!grab(e)) return; GCUR.btns=e.buttons||(1<<e.button); const tg=under(); GCUR.down=tg; fire('pointerdown',tg,e); fire('mousedown',tg,e);
    if(e.button===0){ if(tg.matches&&tg.matches('input[type=range]')){ GCUR.rng=tg; setRange(tg); } else if(tg.matches&&tg.matches('input,textarea,select')){ tg.focus(); if(tg.tagName==='SELECT'&&tg.showPicker) try{ tg.showPicker(); }catch(_){} } else if(document.activeElement&&document.activeElement!==document.body&&!tg.closest('input,textarea')) document.activeElement.blur&&document.activeElement.blur(); } },true);
  addEventListener('mouseup',e=>{ if(!grab(e)) return; GCUR.btns=e.buttons||0; const tg=under(); fire('pointerup',tg,e); fire('mouseup',tg,e);
    if(GCUR.rng){ GCUR.rng.dispatchEvent(new Event('change',{bubbles:true})); GCUR.rng=null; }
    const same=GCUR.down&&(GCUR.down===tg||GCUR.down.contains(tg)||tg.contains(GCUR.down)); if(same){ if(e.button===0) fire('click',tg,e); else if(e.button===2) fire('contextmenu',tg,e); else fire('auxclick',tg,e); } GCUR.down=null; },true);
  addEventListener('wheel',e=>{ if(!GCUR.on||!e.isTrusted) return; e.stopImmediatePropagation(); e.preventDefault(); const tg=under(); fire('wheel',tg,e,{deltaX:e.deltaX,deltaY:e.deltaY,deltaZ:e.deltaZ,deltaMode:e.deltaMode}); },{capture:true,passive:false});
  addEventListener('resize',()=>{ GCUR.x=Math.min(GCUR.x,innerWidth-1); GCUR.y=Math.min(GCUR.y,innerHeight-1); });
  document.addEventListener('fullscreenchange',()=>{ if(!document.fullscreenElement&&document.pointerLockElement) document.exitPointerLock(); });
})();
function goFullscreen(){ const el=document.documentElement; if(document.fullscreenElement||FS_IOS||!el.requestFullscreen) return; const p=el.requestFullscreen({navigationUI:'hide'}); if(p&&p.then) p.then(()=>{ try{ if(navigator.keyboard&&navigator.keyboard.lock) navigator.keyboard.lock(['Escape']); }catch(e){} }).catch(()=>{}); }
function toggleFullscreen(){ if(document.fullscreenElement){ try{ navigator.keyboard&&navigator.keyboard.unlock&&navigator.keyboard.unlock(); }catch(e){} document.exitFullscreen().catch(()=>{}); } else goFullscreen(); }
(function(){ const first=()=>{ removeEventListener('pointerdown',first,true); removeEventListener('keydown',first,true); if(OPT.fullscreen&&!windowIsFull()) goFullscreen(); };
  addEventListener('pointerdown',first,true); addEventListener('keydown',first,true);
  document.addEventListener('fullscreenchange',()=>{ setTimeout(resize,50); }); })();
/* ---------- inspect another hero: right-click (long-press on touch) their portrait ---------- */
function inspectData(){ const e=me.c.eq; return SLOTS.map(sl=>{ const it=e[sl]; return it?[String(it.name).slice(0,46),it.rar|0,it.pow|0,it.sta|0,it.lv|0,it.up|0,it.desc?String(it.desc).slice(0,110):'',it.leg||0]:0; }); }
function ixItem(a,sl){ if(!Array.isArray(a)) return null; return {name:clean(String(a[0])).slice(0,46),slot:sl,rar:clamp(a[1]|0,0,4),pow:a[2]|0,sta:a[3]|0,lv:a[4]|0,up:clamp(a[5]|0,0,10),desc:a[6]?clean(String(a[6])).slice(0,110):'',leg:a[7]||0,val:0}; }
function openInspect(u){ const self=u===MY_U, o=self?null:othersByU.get(u); if(!self&&!o) return err('That player is no longer here');
  const items=self?SLOTS.map(sl=>me.c.eq[sl]):SLOTS.map((sl,i)=>ixItem(o.ix&&o.ix[i],sl));
  const nm=self?me.c.name:o.n, cls=self?me.c.cls:o.c, lv=self?me.c.lvl:o.l, col=self?myNameCol():nameCol(o), ti=self?myTitle():o.ti;
  let w=$('inspWin'); if(!w){ w=document.createElement('div'); w.id='inspWin'; w.className='panel'; document.body.appendChild(w); }
  let pw=0,st=0; for(const it of items) if(it){ pw+=Math.round(it.pow*upMul(it)); st+=Math.round(it.sta*upMul(it)); }
  w.innerHTML=`<div class="insH"><b style="color:${col}">${esc(nm)}</b><button class="insX" title="Close">✕</button></div><div class="insS">${ti?`&lt;${esc(ti)}&gt; · `:''}Level ${lv} ${CLS[cls].glyph} ${CLS[cls].name} · wears ${ARMNAME[CLS_ARMOR[cls]]||''}</div>`+
    SLOTS.map((sl,i)=>{ const it=items[i]; return `<div class="insRow" data-i="${i}"><div class="islot ${it?'r'+it.rar:''}">${it?itemSVG(it):`<span class="eqempty">${SLOTICON[sl]}</span>`}</div><div>${it?`<div class="t${it.rar}" style="font-weight:700">${esc(it.name)}${it.up?' +'+it.up:''}</div><div class="insD">${RAR[it.rar]} ${sl} · item level ${it.lv} · +${Math.round(it.pow*upMul(it))} power, +${Math.round(it.sta*upMul(it))} stamina</div>`:`<div class="insD">No ${sl} equipped</div>`}</div></div>`; }).join('')+
    `<div class="insT">Gear total: +${pw} power, +${st} stamina</div>${!self&&!o.ix?'<div class="insD">This player is on an older version, so their gear can\'t be shown yet.</div>':''}`;
  w.querySelector('.insX').onclick=()=>w.remove();
  w.querySelectorAll('.insRow').forEach(r=>{ const it=items[+r.dataset.i]; if(!it) return; r.onmouseenter=e=>showTip(e,itemTip(it,false,true)); r.onmouseleave=hideTip; r.onclick=e=>showTip(e,itemTip(it,false,true)); }); }
function portraitMenu(e,u){ e.preventDefault(); e.stopPropagation(); if(!me||!u) return; const self=u===MY_U, o=self?null:othersByU.get(u); if(!self&&!o) return;
  let m=$('pMenu'); if(m) m.remove(); m=document.createElement('div'); m.id='pMenu'; m.className='panel'; document.body.appendChild(m);
  const add=(t,fn,cls)=>{ const b=document.createElement('button'); b.textContent=t; if(cls) b.className=cls; b.onclick=ev=>{ ev.stopPropagation(); m.remove(); fn(); }; m.appendChild(b); };
  const h=document.createElement('div'); h.className='pmH'; h.textContent=self?me.c.name:o.n; h.style.color=self?myNameCol():nameCol(o); m.appendChild(h);
  add('🔍 Inspect gear',()=>openInspect(u),'gold'); if(!self){ add('🎯 Target',()=>{ me.target={kind:'p',id:u}; });
    if(!(me.party&&o.pt===me.party)) add('➕ Invite to party',()=>inviteTo(o)); else if(amLeader()) add('➖ Remove from party',()=>kickMember(o)); }
  add('Close',()=>{});
  const x=Math.min(innerWidth-190,(e.touches?e.touches[0].clientX:e.clientX)||100), y=Math.min(innerHeight-200,(e.touches?e.touches[0].clientY:e.clientY)||100); m.style.left=x+'px'; m.style.top=y+'px';
  setTimeout(()=>addEventListener('pointerdown',function cl(ev){ if(!m.contains(ev.target)){ m.remove(); removeEventListener('pointerdown',cl,true); } },true),0); }
(function(){ const tf=$('tframe'), pfm=$('pframe'), party=$('party');
  const tu=()=>{ const tg=me&&me.target; return tg&&tg.kind==='p'?tg.id:null; };
  tf.addEventListener('contextmenu',e=>{ const u=tu(); if(u) portraitMenu(e,u); else e.preventDefault(); });
  pfm.addEventListener('contextmenu',e=>portraitMenu(e,MY_U));
  pfm.addEventListener('click',()=>{ if(me){ me.target={kind:'p',id:MY_U}; me.auto=false; } });
  party.addEventListener('contextmenu',e=>{ const d=e.target.closest('.pmember'); if(d) portraitMenu(e,d.dataset.u); else e.preventDefault(); });
  /* touch: hold a portrait for half a second */
  const hold=(el,getU)=>{ let tm=0; el.addEventListener('touchstart',e=>{ const u=getU(e); if(!u) return; const ev={preventDefault(){},stopPropagation(){},clientX:e.touches[0].clientX,clientY:e.touches[0].clientY}; tm=setTimeout(()=>portraitMenu(ev,u),500); },{passive:true});
    for(const k of ['touchend','touchmove','touchcancel']) el.addEventListener(k,()=>clearTimeout(tm),{passive:true}); };
  hold(tf,tu); hold(pfm,()=>MY_U); hold(party,e=>{ const d=e.target.closest('.pmember'); return d&&d.dataset.u; }); })();
/* ---------- bug reports (beta) ---------- */
function ticketInfo(){ return { ver:String(VERSION), cls:me?me.c.cls:'', lvl:me?me.c.lvl:0, zone:me?((ZONES[zoneAtPx(me.x,me.y)]||{}).name||zoneAtPx(me.x,me.y)):'', pos:me?Math.round(me.x/TS)+','+Math.round(me.y/TS):'',
  info:`${new Date().toISOString()} · ${navigator.userAgent.slice(0,110)} · host:${amHost?1:0} · online:${countOnline()} · fps:${Math.round(1/Math.max(.001,emaDt))}${ERRLOG.length?'\nerrors: '+ERRLOG.join(' | '):''}`.slice(0,880) }; }
const TK={list:[],open:0,filter:'open',form:null};
function ticketOnline(){ return !!(room&&typeof room.ticket==='function'&&(!room.connected||room.connected())); }
function openBug(){ const w=$('bugWin'); w.classList.remove('hidden'); $('bugTxt').value=''; $('bugTxt').focus(); $('bugCat').onkeydown=e=>e.stopPropagation();
  $('bugSend').onclick=()=>{ const txt=$('bugTxt').value.trim().slice(0,1500); if(!txt) return err('Write what happened first');
    const o={text:txt,cat:$('bugCat').value,...ticketInfo()};
    if(ticketOnline()&&room.ticket(o)) sysMsg('Sending your ticket…');
    else { saves.tkQueue=(saves.tkQueue||[]).slice(-4); saves.tkQueue.push(o); saveAll(saves); sysMsg('You are not connected to the realm right now, so your ticket is saved and will be sent automatically the next time you play online.','c-xp'); }
    w.classList.add('hidden'); }; }
setInterval(()=>{ try{ if(saves.tkQueue&&saves.tkQueue.length&&me&&ticketOnline()){ const o=saves.tkQueue.shift(); saveAll(saves); room.ticket(o); } }catch(e){} },25000);
function onTicketNet(d){
  if(d.t==='tkok'){ if(d.err) return sysMsg(d.err,'c-err'); sysMsg(`Thanks! Your report is ticket #${d.id}. A Game Master will look at it, and you will get a reply here when it is handled.`,'c-xp'); toast('Ticket #'+d.id+' sent','small'); return; }
  if(d.t==='tknew'){ TK.open=d.open|0; if(!isGM) return; if(d.id) sysMsg(`🎫 New ticket #${d.id} from ${d.name} (${d.cat}). ${TK.open} open. Type /tickets to read it.`,'c-gm'); else sysMsg(`🎫 ${TK.open===1?'There is 1 open ticket':'There are '+TK.open+' open tickets'}. Type /tickets to read them.`,'c-gm');
    if(!$('tkWin').classList.contains('hidden')) room.tk('list'); renderGMWin(); return; }
  if(d.t==='tklist'){ TK.list=Array.isArray(d.list)?d.list:[]; TK.open=d.open|0; renderTickets(); renderGMWin(); return; }
  if(d.t==='tkreply'){ sysMsg('🎫 '+String(d.msg||'').slice(0,520),'c-gm'); toast('A Game Master answered your ticket','small'); try{ sfx('accept'); }catch(e){} } }
function openTickets(){ if(!isGM) return err('Only Game Masters can read tickets'); const w=$('tkWin'); w.classList.remove('hidden'); TK.form=null;
  if(!(room&&typeof room.tk==='function')){ w.querySelector('.tkbody').innerHTML='<div class="tkempty">Tickets are kept on the realm server. Play online to read and answer them.</div>'; return; }
  w.querySelector('.tkbody').innerHTML='<div class="tkempty">Loading tickets…</div>'; room.tk('list'); }
const tkAgo=ms=>{ const s=Math.max(0,(Date.now()-ms)/1000); return s<90?'just now':s<5400?Math.round(s/60)+' min ago':s<129600?Math.round(s/3600)+' h ago':Math.round(s/86400)+' days ago'; };
function renderTickets(){ const w=$('tkWin'); if(!w||w.classList.contains('hidden')) return; const body=w.querySelector('.tkbody'); const all=TK.list.slice().reverse();
  const nOpen=all.filter(t=>t.st==='open').length, nClosed=all.length-nOpen; const L=all.filter(t=>TK.filter==='all'||t.st===TK.filter);
  if(TK.filter==='open') L.reverse();
  let h=`<div class="tktabs"><button data-tf="open" class="${TK.filter==='open'?'on':''}">Open (${nOpen})</button><button data-tf="closed" class="${TK.filter==='closed'?'on':''}">Closed (${nClosed})</button><button data-tf="all" class="${TK.filter==='all'?'on':''}">All</button><span class="sp"></span><button id="tkRef">↻ Refresh</button></div>`;
  if(!L.length) h+=`<div class="tkempty">${TK.filter==='open'?'No open tickets. All caught up!':'Nothing here.'}</div>`;
  for(const t of L){ const C=CLS[t.cls]; h+=`<div class="tk ${t.st}" data-tk="${t.id}"><div class="tkh"><b>#${t.id}</b><span class="tkcat ${esc(t.cat)}">${esc(t.cat)}</span><b style="color:${C?C.col:'#fff'}">${esc(t.name)}</b><small>Lv ${t.lvl|0} ${C?C.name:esc(t.cls||'')} · ${esc(t.zone||'?')} (${esc(t.pos||'?')}) · ${tkAgo(t.at)} · v${esc(t.ver||'?')}</small>${t.claim?`<span class="tkclaim">· ${esc(t.claim)} is on it</span>`:''}</div>
    <div class="tkt">${esc(t.text)}</div>${(t.notes||[]).map(n=>`<div class="tkn">📝 <b>${esc(n.by)}</b>: ${esc(n.txt)}</div>`).join('')}${t.st==='closed'?`<div class="tkr">✔ Closed by ${esc(t.closedBy||'?')}${t.reply?': “'+esc(t.reply)+'”':''}</div>`:''}
    ${t.info?`<details><summary>Technical details</summary><pre>${esc(t.info)}</pre></details>`:''}
    <div class="tkbtns">${t.pos?`<button data-a="go">➜ Go there</button>`:''}${t.st==='open'?`<button data-a="claim">${t.claim===me.c.name?'Unclaim':'Claim'}</button><button data-a="note">📝 Note</button><button data-a="close" class="gold">✔ Close &amp; reply</button>`:`<button data-a="reopen">Reopen</button>`}${room&&room.master?`<button data-a="delete">🗑 Delete</button>`:''}</div>
    ${TK.form&&TK.form.id===t.id?`<div class="tkin"><textarea id="tkInp" maxlength="400" placeholder="${TK.form.k==='note'?'A note for the other Game Masters (the player does not see it)':'Optional reply to the player (they see it in their chat, now or when they next log in)'}"></textarea><button id="tkOk" class="gold">${TK.form.k==='note'?'Add note':'Close ticket'}</button><button id="tkCancel">Cancel</button></div>`:''}</div>`; }
  body.innerHTML=h;
  body.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{ TK.filter=b.dataset.tf; TK.form=null; renderTickets(); }); $('tkRef').onclick=()=>room.tk('list');
  body.querySelectorAll('.tk').forEach(el=>{ const id=+el.dataset.tk, t=TK.list.find(x=>x.id===id); el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='go'){ const [x,y]=String(t.pos).split(',').map(Number); if(isFinite(x)&&isFinite(y)) gmTpTo(x*TS+16,y*TS+16,'ticket #'+id); }
    else if(a==='note'||a==='close'){ TK.form={id,k:a}; renderTickets(); const ip=$('tkInp'); if(ip){ ip.focus(); ip.onkeydown=e=>e.stopPropagation(); } }
    else if(a==='delete'){ askConfirm(`Delete ticket #${id} for good?`,'Delete',()=>room.tk('delete',{id})); }
    else room.tk(a,{id}); }); });
  if(TK.form){ $('tkCancel').onclick=()=>{ TK.form=null; renderTickets(); }; $('tkOk').onclick=()=>{ const v=$('tkInp').value.trim(); const f=TK.form; TK.form=null; if(f.k==='note'){ if(v) room.tk('note',{id:f.id,txt:v}); else renderTickets(); } else room.tk('close',{id:f.id,reply:v}); }; } }

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
  switch(a){ case 'jump': return jump(); case 'target': return tabTarget(); case 'lootall': return lootAllKey(); case 'potion': return usePotion(); case 'mount': return toggleMount();
    case 'sit': if(me.emote&&me.emote.k==='sit'){ me.emote=null; sendPresence(true); } else doEmote('sit'); return;
    case 'autorun': autoRun=!autoRun; return;
    case 'map': return toggleWin('mapWin'); case 'quests': return toggleWin('qlogWin'); case 'character': return toggleWin('charWin'); case 'talents': return toggleWin('talWin'); case 'bags': return toggleWin('invWin');
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
  {id:"lvl15",n:"Hero of Emberfall",d:"Reach the maximum level, 20",ic:"\ud83d\udc51",f:(c,S,QDONE,EPICALL,FORGE5)=>c.lvl>=MAXLVL},
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
  const att=mobs.filter(m=>!m.dead&&!m.t.critter&&(m.tgt===MY_U||(m.threat&&m.threat[MY_U]>0)));
  let list;
  if(att.length) list=att.sort((a,b)=>dist(a.rx,a.ry,me.x,me.y)-dist(b.rx,b.ry,me.x,me.y));
  else { const f=me.face||0, fx=Math.cos(f), fy=Math.sin(f); list=mobs.filter(m=>{ if(m.dead||m.t.critter) return false; const dx=m.rx-me.x, dy=m.ry-me.y, d=Math.hypot(dx,dy); if(d>60+(m.t.r||0)) return false; return d<(m.t.r||0)+12||(dx*fx+dy*fy)/d>.42; })
      .sort((a,b)=>{ const sc=m=>{ const dx=m.rx-me.x, dy=m.ry-me.y, d=Math.hypot(dx,dy)||1; return d*(1.6-(dx*fx+dy*fy)/d); }; return sc(a)-sc(b); }); }
  if(!list.length) return err(att.length?'No enemies attacking you':'No enemy in front of you within 6 yards'); const cur=me.target&&me.target.kind==='m'?list.findIndex(m=>m.id===me.target.id):-1;
  const m=list[(cur+1)%list.length]; me.target={kind:'m',id:m.id};
}

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>toggleWin(b.dataset.close,false));
{ const mt=$('menuTog'), mb=$('menuBtns'); mt.onclick=e=>{ e.stopPropagation(); document.body.classList.toggle('menuOpen'); };
  addEventListener('pointerdown',e=>{ if(document.body.classList.contains('menuOpen')&&!mb.contains(e.target)&&e.target!==mt&&!mt.contains(e.target)) document.body.classList.remove('menuOpen'); },true);
  new MutationObserver(()=>mt.classList.toggle('pulse',!!mb.querySelector('[data-k="tal"].pulse'))).observe(mb,{subtree:true,attributes:true,attributeFilter:['class']}); }
document.querySelectorAll('#menuBtns button').forEach(b=>b.onclick=()=>{ document.body.classList.remove('menuOpen'); const k=b.dataset.k; if(k==='who') toggleWin('whoWin'); if(k==='char') toggleWin('charWin'); if(k==='tal') toggleWin('talWin'); if(k==='sound'){ audInit(); toggleWin('soundWin'); } if(k==='inv') toggleWin('invWin'); if(k==='help') toggleWin('helpWin'); if(k==='party'){ toggleWin('partyWin'); renderPartyWin(); } if(k==='map') toggleWin('mapWin'); if(k==='qlog') toggleWin('qlogWin'); b.blur(); });
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
    const rooted=me.rootU>t; const yaw=(MOUSE.down===0&&MOUSE.drag&&!MOUSE.both&&MOUSE.lyaw!=null)?MOUSE.lyaw:CAM.yaw;
    let mx=Math.cos(yaw)*f-Math.sin(yaw)*s, my=Math.sin(yaw)*f+Math.cos(yaw)*s;
    const back=f<0&&!s;
    me.moving=!!(mx||my)&&!rooted;
    if(mx||my){ me.face=back?yaw:Math.atan2(my,mx); }
    if(me.moving){ const l=Math.hypot(mx,my), swm=isSwimming(), wade=!swm&&!me.mounted&&isWaterAt(me.x,me.y), sp=(back?95:155)*(wade?.85:1)*(me.mounted?MOUNTS[me.mounted].speed:1)*(swm?.6:1)*(buffOn('swift')?1.2:1)*(gm.speed||1)*(1+TAL('spd'))*(1+songFx().spd)*(me.stealth?.82+TAL('stspd'):1)*dt; { const k=1-Math.exp(-dt*(me.mounted?8:18)), tx=mx/l*sp/dt, ty=my/l*sp/dt; me.vx=(me.vx||0)+(tx-(me.vx||0))*k; me.vy=(me.vy||0)+(ty-(me.vy||0))*k; movePlayer(me,me.vx*dt,me.vy*dt,10); } me.stepT-=dt; if(me.stepT<=0){ me.stepT=me.mounted?.15:.3; if(!swm) footDust(me.x,me.y); } }
    else { if(!rooted&&!me.dead&&!me.dash&&Math.hypot(me.vx||0,me.vy||0)>8){ const k=Math.exp(-dt*(me.mounted?7:24)); me.vx*=k; me.vy*=k; movePlayer(me,me.vx*dt,me.vy*dt,10); } else { me.vx=0; me.vy=0; } }
    if(!me.moving&&!me.dash){ const te=targetEnt(); if(te&&te.kind!=='n'&&!te.self&&(me.cast||me.auto)) me.face=Math.atan2(te.y-me.y,te.x-me.x); }
    if(me.jumpV||me.jumpH>0){ me.jumpV=(me.jumpV||0)-15*dt; me.jumpH=Math.max(0,(me.jumpH||0)+me.jumpV*dt); if(me.jumpH<=0){ me.jumpH=0; me.jumpV=0; footDust(me.x,me.y); } }
    if(me.dash) updateDash(t);
    if(!me.dead){
      updateCast(); updateAuto(dt);
      const cl=CLS[me.c.cls], ic=inCombat();
      if(cl.res==='energy') me.res=Math.min(100,me.res+12*(1+TAL('res'))*dt); else if(cl.res==='mana') me.res=Math.min(me.mres,me.res+me.mres*(t-me.lastSpend>5?.035:.012)*(1+TAL('res'))*dt);
      else if(!ic) me.res=Math.max(0,me.res-3*dt);
      if(Math.hypot(me.x/TS-TOWN.x-.5,me.y/TS-TOWN.y-.5)<4.6){ me.fountain=1; me.hp=Math.min(me.mhp,me.hp+me.mhp*.04*dt); if(cl.res==='mana') me.res=Math.min(me.mres,me.res+me.mres*.04*dt);
        if(Math.random()<dt*3){ const [X,Y,Z]=ph3(me.x+(Math.random()-.5)*20,me.y+(Math.random()-.5)*20,.3); P3(X,Y,Z,0,1.2,0,1.2,.08,'#9fe8ff',{glow:true}); } } else me.fountain=0;
      if(!ic) me.hp=Math.min(me.mhp,me.hp+me.mhp*.025*dt); if(!ic&&me.cp&&t-me.lastCombat>12) me.cp=0;
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
    if(amHost){ m.rx=m.x; m.ry=m.y; } else { const ag=Math.min(.16,now()-(m.tr||0)), tx=m.x+(m.vx||0)*ag, ty=m.y+(m.vy||0)*ag; m.rx=lerp(m.rx,tx,k*.9); m.ry=lerp(m.ry,ty,k*.9); }
    /* personal space: however the network lags, a monster is never drawn inside your hero; it stays at arm's length */
    if(me&&!me.dead&&!m.dead&&!m.t.fly&&!me.mounted){ const dx=m.rx-me.x, dy=m.ry-me.y, d=Math.hypot(dx,dy), md=Math.min(46,(m.t.r||14)+18); if(d<md){ const a=d>.5?Math.atan2(dy,dx):(m.face||0)+Math.PI; m.rx=me.x+Math.cos(a)*md; m.ry=me.y+Math.sin(a)*md; } }
    const mv=dist(ox,oy,m.rx,m.ry);
    if(!amHost){ if(mv>.3) m.face=Math.atan2(m.ry-oy,m.rx-ox); else if(m.tgt){ const p=entPos('p',m.tgt); if(p) m.face=Math.atan2(p.y-m.ry,p.x-m.rx); } }
    if(mv>.8 && !m.t.fly && !m.dead && Math.random()<.04) footDust(m.rx,m.ry);
    if(m.tgt===MY_U&&m._tgS!==MY_U&&!m.dead) try{ mobSnd(m,'aggro'); }catch(e){} m._tgS=m.tgt;
  }
  for(const o of others.values()){ const ox=o.rx, oy=o.ry; if(Math.abs(o.rx-o.x)>300||Math.abs(o.ry-o.y)>300){o.rx=o.x;o.ry=o.y} { const ag=Math.min(.16,now()-(o.tr||0)), tx=o.x+(o.vx||0)*ag, ty=o.y+(o.vy||0)*ag; o.rx=lerp(o.rx,tx,k); o.ry=lerp(o.ry,ty,k); }
    o.moving=dist(ox,oy,o.rx,o.ry)>.4; if(o.moving&&Math.random()<.06) footDust(o.rx,o.ry); }
  ambient(dt); updateParticles(dt);
  shakeMag*=Math.pow(.004,dt); if(shakeMag<.1) shakeMag=0; hurtFlash=Math.max(0,hurtFlash-dt*1.8);
  worldTick(dt);
  if(me) sendPresence(false);
}
let emaDt=.016, rsT=0; const ERRLOG=[];
function frameErr(e,where){ console.error(e); const msg=where+': '+String(e&&e.message||e).slice(0,140)+' @'+String(e&&e.stack||'').split('\n')[1]?.trim().slice(0,90);
  if(!ERRLOG.includes(msg)){ ERRLOG.push(msg); if(ERRLOG.length>8) ERRLOG.shift(); if(ERRLOG.length<=3) try{ sysMsg('⚠ Game hiccup ('+where+'), recovered. If the game misbehaves, use Report a bug: the details are attached automatically.','c-err'); }catch(_){} } }
function frame(){
  const t=now(); const rawDt=t-lastT; const dt=Math.min(.1,rawDt); lastT=t;
  emaDt=lerp(emaDt,Math.min(.2,rawDt),.05); rsT+=dt; if(rsT>1.5){ rsT=0; const old=RSCALE; if(emaDt>.026&&RSCALE>GFX.rmin) RSCALE=Math.max(GFX.rmin,RSCALE-.1); else if(emaDt<.0145&&RSCALE<RSMAX) RSCALE=Math.min(RSMAX,RSCALE+.1); if(Math.abs(old-RSCALE)>.01) resize(); }
  if(rawDt>3&&room&&amHost) HOSTPAUSE=true;
  try{ update(dt); }catch(e){ frameErr(e,'update'); }
  try{ render(dt); }catch(e){ frameErr(e,'render'); }
  try{ if(me){ updateBar(); if(++uiTick%3===0){ updateUI(); drawMini(); } } }catch(e){ frameErr(e,'ui'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
connectRoom();
