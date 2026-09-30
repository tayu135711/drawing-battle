(function(){
'use strict';

/* =====================================================================
   ユーティリティ
   ===================================================================== */
const $=(s,el)=>(el||document).querySelector(s);
const $$=(s,el)=>Array.from((el||document).querySelectorAll(s));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);   /* '__proto__' などを はじく ための しらべ */
const lerp=(a,b,t)=>a+(b-a)*t;
const FONT='"Yusei Magic","Hiragino Maru Gothic ProN","Yu Gothic UI",Meiryo,sans-serif';
const INK='#2a2a2e';
const W=800,H=400,GROUND=322;

function mk(tag,props){
  const el=document.createElement(tag);
  if(props){
    for(const k of Object.keys(props)){
      const v=props[k];
      if(k==='class')el.className=v;
      else if(k==='text')el.textContent=v;
      else if(k.length>2&&k.indexOf('on')===0&&typeof v==='function')el.addEventListener(k.slice(2),v);
      else el.setAttribute(k,v);
    }
  }
  for(let i=2;i<arguments.length;i++){ if(arguments[i]!=null)el.append(arguments[i]); }
  return el;
}
function rng(seed){let s=(seed>>>0)||1;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function hashStr(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hashInt(n){n=(n^61)^(n>>>16);n=n+(n<<3);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return n>>>0;}
function hex2rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}

let toastTimer=0;
function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);
}

/* =====================================================================
   データ定義
   ===================================================================== */
const PALETTE=[
  {id:'black', name:'くろ',     hex:'#2a2a2e', hint:'バランスがた。ふちどりにも。まもりが ちょっとアップ'},
  {id:'red',   name:'あか',     hex:'#e5383b', hint:'ちからアップ！ ひっさつ「ほのおパンチ」'},
  {id:'blue',  name:'あお',     hex:'#2f80ed', hint:'HPと まもりアップ！ ひっさつ「みずのたて」'},
  {id:'green', name:'みどり',   hex:'#3aa757', hint:'こうげきが はやくなる！ ひっさつ「かぜのダッシュ」'},
  {id:'yellow',name:'きいろ',   hex:'#f9c80e', hint:'はやさと クリティカルアップ！ ひっさつ「かみなり」'},
  {id:'orange',name:'オレンジ', hex:'#ff8c1a', hint:'ちからアップ！ ひっさつ「ファイアボール」', unlock:1},
  {id:'purple',name:'むらさき', hex:'#8e44ad', hint:'ちから＋どく！ ひっさつ「どくのきり」', unlock:2},
  {id:'pink',  name:'ピンク',   hex:'#ff6fae', hint:'HPアップ！ ひっさつ「いやしのハート」', unlock:3}
];
PALETTE.forEach(p=>{p.rgb=hex2rgb(p.hex);});
const PAL={};PALETTE.forEach(p=>{PAL[p.id]=p;});

const SKILLS={
  black: {name:'ぶんぶんアタック',desc:'てきを1たい つよく なぐる',kind:'smash',mult:3.0},
  red:   {name:'ほのおパンチ',   desc:'てきを1たい とても つよく なぐる',kind:'smash',mult:5.0},
  orange:{name:'ファイアボール', desc:'てきぜんいんに ひのたま',kind:'aoe',mult:2.6},
  yellow:{name:'かみなり',       desc:'てきぜんいんに ダメージ＋しびれさせる',kind:'thunder',mult:1.0},
  green: {name:'かぜのダッシュ', desc:'なかま ぜんいんの こうげきが はやくなる',kind:'haste'},
  blue:  {name:'みずのたて',     desc:'なかま ぜんいんが うけるダメージを へらす',kind:'shield'},
  purple:{name:'どくのきり',     desc:'てきぜんいんを どくにする',kind:'poison'},
  pink:  {name:'いやしのハート', desc:'なかま ぜんいんの HPを かいふく',kind:'heal'}
};
const OFFENSIVE={smash:1,aoe:1,thunder:1,poison:1};

const ENEMY_TYPES={
  slime:{name:'ぷるぷる',hp:34,atk:6,def:0,spd:40,iv:1.7,fly:0,scale:1,hue:130,sat:62,lit:62},
  spiky:{name:'トゲトゲ',hp:26,atk:10,def:0,spd:48,iv:1.5,fly:0,scale:1,hue:12,sat:78,lit:62},
  ghost:{name:'おばけ',  hp:30,atk:7,def:1,spd:58,iv:1.3,fly:14,scale:1,hue:220,sat:55,lit:90},
  bat:  {name:'コウモリ',hp:22,atk:6,def:0,spd:85,iv:1.0,fly:62,scale:0.95,hue:270,sat:55,lit:58},
  golem:{name:'ドロどろ',hp:90,atk:9,def:4,spd:24,iv:2.2,fly:0,scale:1.25,hue:28,sat:32,lit:58}
};

const STAGES=[
  {name:'はじまりの そうげん',sky:['#8fd3ff','#eaf9ff'],hill1:'#b4e59a',hill2:'#86d268',ground:'#6fc250',deco:'tuft',orb:'#ffe066',night:false,mult:0.85,
   waves:[['slime'],['slime','slime'],['slime','bat'],['slime','spiky','slime']],
   boss:{type:'slime',name:'キングぷるぷる',color:'#5ecf7f',hp:200,atk:8,def:2,spd:22,iv:1.6,scale:1.9}},
  {name:'あつあつ さばく',sky:['#ffd38a','#fff2d6'],hill1:'#f5d597',hill2:'#e8b969',ground:'#dba95a',deco:'rock',orb:'#fff3b0',night:false,mult:1,
   waves:[['slime','spiky'],['bat','bat'],['golem'],['spiky','slime','ghost'],['golem','bat']],
   boss:{type:'golem',name:'サボテンだいおう',color:'#6cbf5a',hp:260,atk:10,def:3,spd:20,iv:1.5,scale:1.7}},
  {name:'こおりの やま',sky:['#b6dcff','#f2fbff'],hill1:'#e4f4ff',hill2:'#c3e6ff',ground:'#e9f6ff',deco:'snow',orb:'#fffbe0',night:false,mult:1,
   waves:[['ghost','ghost'],['bat','golem'],['spiky','spiky','slime'],['ghost','golem','bat'],['golem','golem']],
   boss:{type:'ghost',name:'ゆきおばけだいおう',color:'#dbe8ff',hp:320,atk:12,def:3,spd:26,iv:1.5,scale:1.8}},
  {name:'まっくろの もり',sky:['#241a4a','#4b3a7a'],hill1:'#4a3e7c',hill2:'#352b62',ground:'#31285a',deco:'tuft',orb:'#fff6c9',night:true,mult:1,
   waves:[['bat','bat','ghost'],['golem','spiky'],['ghost','ghost','bat'],['golem','golem','spiky'],['bat','spiky','ghost','slime']],
   boss:{type:'bat',name:'よるの じょおう',color:'#7b4fc9',hp:380,atk:14,def:4,spd:30,iv:1.4,scale:1.8}},
  {name:'ラクガキ まおうじょう',sky:['#3b0f2e','#8a2a4a'],hill1:'#5a2046',hill2:'#3f1636',ground:'#2b0f26',deco:'ember',orb:'#ff8a5b',night:true,mult:1,
   waves:[['spiky','spiky','ghost'],['golem','bat','bat'],['ghost','golem','spiky'],['golem','golem','bat'],['spiky','ghost','golem','slime']],
   boss:{type:'demon',name:'ラクガキだいまおう',color:'#8e44ad',hp:520,atk:17,def:6,spd:20,iv:1.3,scale:2.0}}
];

function enemyColor(type,si){
  const d=ENEMY_TYPES[type];
  return 'hsl('+((d.hue+si*28)%360)+' '+d.sat+'% '+d.lit+'%)';
}

const DEFAULT_NAMES=['ラクガキくん','ぽよぽよ','ゴンザレス','ぷりんちゃん','おえかき王子','ミラクルん','ふにゃ太郎','ナゾのいきもの'];
const MAX_LV=10;
const expNeed=lv=>30+lv*20;
const MIN_INK=220;
const DQ_BONUS=0.1;    /* 「きょうのおだい」クリアで そのキャラに +10% */
const EVO_BONUS=0.25;   /* しんか(Lv.MAXで1回だけ・えを かきたす)のボーナス */
const EVO_BONUS=0.25;   /* しんか(Lv.MAXで1回だけ・えを かきたす)のボーナス */

/* =====================================================================
   セーブデータ
   ===================================================================== */
const SAVE_KEY='rakugaki-kingdom-v1';
let state={party:[],cleared:0,dq:'',dqCount:0,dex:{},ach:null,title:'',shared:0,received:0};
function validHero(h){
  return h&&typeof h.img==='string'&&h.img.indexOf('data:image/')===0&&typeof h.name==='string'&&typeof h.skill==='string'&&has(SKILLS,h.skill)&&
    isFinite(h.hp)&&isFinite(h.atk)&&isFinite(h.def)&&isFinite(h.interval)&&isFinite(h.crit);
}
function load(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return;
    const o=JSON.parse(raw);
    if(o&&Array.isArray(o.party)){
      state.party=o.party.filter(validHero).slice(0,3).map(h=>{h.lv=clamp(h.lv|0||1,1,MAX_LV);h.exp=Math.max(0,h.exp|0);h.evo=(h.evo|0)>0?1:0;h.dq=(h.dq|0)>0?1:0;h.item=validItem(h.item)?h.item:null;h.limbs={hands:!!(h.limbs&&h.limbs.hands),feet:!!(h.limbs&&h.limbs.feet)};return h;});
      state.cleared=clamp(o.cleared|0,0,STAGES.length);
      state.shared=Math.max(0,o.shared|0);state.received=Math.max(0,o.received|0);state.title=typeof o.title==='string'?o.title:'';
      state.ach=(o.ach&&typeof o.ach==='object')?Object.keys(o.ach).reduce((r,k)=>{if(o.ach[k])r[k]=1;return r;},{}):null;
      state.dq=typeof o.dq==='string'?o.dq:'';state.dex={};if(o.dex&&typeof o.dex==='object'){Object.keys(o.dex).forEach(k=>{const n=o.dex[k]|0;if(n>0)state.dex[k]=Math.min(n,99999);});}state.dqCount=Math.max(0,o.dqCount|0);
    }
  }catch(e){}
}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(e){}}

/* ---- そうび：じぶんで かいた アイテム。いろで こうかが かわる ---- */
const ITEM_NOUN={red:'つるぎ',orange:'ハンマー',purple:'まどうしょ',blue:'たて',green:'ブーツ',yellow:'かんむり',pink:'おまもり',black:'よろい'};
const ITEM_MIN_INK=120;
function validItem(it){
  return !!(it&&typeof it.img==='string'&&it.img.indexOf('data:image/')===0&&typeof it.kind==='string'&&has(PAL,it.kind)&&isFinite(it.power)&&typeof it.name==='string');
}
function itemFrom(a){
  let kind='black',bv=-1;
  PALETTE.forEach(p=>{const v=a.counts[p.id]||0;if(v>bv){bv=v;kind=p.id;}});
  const fill=a.total/((pad.width/2)*(pad.height/2));
  const power=Math.round(clamp(fill/0.05,0.1,1)*100)/100;
  return {kind:kind,power:power,name:itemName(kind,power)};
}
function itemName(kind,power){
  const size=power>=0.75?'でっかい ':(power<=0.3?'ちいさな ':'');
  return size+PAL[kind].name+'の '+ITEM_NOUN[kind];
}
function itemPct(it){return Math.round((0.05+0.20*it.power)*100);}
function itemDesc(it){
  const n=itemPct(it);
  switch(it.kind){
    case 'red':case 'orange':case 'purple':return 'ちから +'+n+'%';
    case 'blue':return 'まもり +'+n+'%　HP +'+Math.round(n/2)+'%';
    case 'green':return 'こうげきが はやくなる（+'+n+'%）';
    case 'yellow':return 'クリティカル +'+Math.round(n*0.8)+'%';
    case 'pink':return 'HP +'+n+'%';
    default:return 'HP +'+Math.round(n/2)+'%　まもり +'+Math.round(n/2)+'%';
  }
}
function heroStats(h){
  const e=1+EVO_BONUS*(h.evo?1:0)+DQ_BONUS*(h.dq?1:0);   /* しんかボーナス */
  const m=(1+0.1*(h.lv-1))*e;
  let hpK=1,atkK=1,defK=1,iv=h.interval,cr=h.crit;
  if(validItem(h.item)){
    const k=h.item.kind,f=0.05+0.20*h.item.power;
    if(k==='red'||k==='orange'||k==='purple')atkK+=f;
    else if(k==='blue'){defK+=f;hpK+=f/2;}
    else if(k==='green')iv=Math.max(0.6,Math.round(iv*(1-f*0.8)*100)/100);
    else if(k==='yellow')cr=Math.min(0.95,Math.round((cr+f*0.8)*100)/100);
    else if(k==='pink')hpK+=f;
    else{hpK+=f/2;defK+=f/2;}
  }
  return {hp:Math.round(h.hp*m*hpK),atk:Math.round(h.atk*m*atkK),def:Math.round(h.def*(1+0.06*(h.lv-1))*e*defK),interval:iv,crit:cr};
}
function powerOf(st){return Math.round(st.hp/4+st.atk*4+st.def*3+(1.9-st.interval)*30+st.crit*40);}

function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  window.scrollTo(0,0);
  sndScene(id);
}

/* =====================================================================
   ホーム画面
   ===================================================================== */
/* ---- きょうのおだい：まいにち かわる かきかたの しばり ---- */
const DQ_LIST=[
  {text:'3しょく いかで かこう',check:m=>m.colors>=1&&m.colors<=3},
  {text:'おおきく どーんと かこう',check:m=>m.fill>=0.14},
  {text:'ちいさく こぢんまり かこう',check:m=>m.fill<=0.05},
  {text:'4しょく いじょう つかおう',check:m=>m.colors>=4},
  {text:'あかを メインに（5わり いじょう）',check:m=>m.share.red>=0.5},
  {text:'あおを メインに（5わり いじょう）',check:m=>m.share.blue>=0.5},
  {text:'みどりを メインに（5わり いじょう）',check:m=>m.share.green>=0.5},
  {text:'きいろを メインに（5わり いじょう）',check:m=>m.share.yellow>=0.5}
];
function dqKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dqToday(){return DQ_LIST[hashStr('rk-dq-'+dqKey())%DQ_LIST.length];}
function dqMetrics(a){
  const share={};let colors=0;
  PALETTE.forEach(p=>{const v=a.total?a.counts[p.id]/a.total:0;share[p.id]=v;if(v>=0.05)colors++;});
  return {colors:colors,fill:a.total/((pad.width/2)*(pad.height/2)),share:share};
}
function dqPassed(a){return a.total>=MIN_INK&&dqToday().check(dqMetrics(a));}
function dqDone(){return state.dq===dqKey();}
/* ---- モンスターずかん：たおした かずを きろく ---- */
function dexKey(type,isBoss,name){return isBoss?'b:'+name:type;}
function dexRecord(type,isBoss,name){
  if(!state.dex)state.dex={};
  const k=dexKey(type,isBoss,name);
  state.dex[k]=Math.min(99999,(state.dex[k]|0)+1);
}
function dexEntries(){
  const list=Object.keys(ENEMY_TYPES).map(t=>({key:t,type:t,name:ENEMY_TYPES[t].name,color:enemyColor(t,0),boss:false}));
  STAGES.forEach(st=>list.push({key:'b:'+st.boss.name,type:st.boss.type,name:st.boss.name,color:st.boss.color,boss:true}));
  return list;
}
function renderDex(){
  const box=$('#dexList');box.innerHTML='';
  const es=dexEntries();let found=0,total=0;
  es.forEach(e=>{
    const n=(state.dex&&state.dex[e.key])|0;
    if(n>0)found++;
    total+=n;
    const cv=document.createElement('canvas');cv.width=cv.height=96;
    try{cv.getContext('2d').drawImage(getSprite(e.type,e.color,e.boss),0,0,96,96);}catch(_){}
    if(!n)cv.classList.add('unk');
    const stars=n>=30?'★★★':(n>=10?'★★☆':(n>=1?'★☆☆':'☆☆☆'));
    box.append(mk('div',{class:'dex-item'+(n?'':' locked')+(e.boss?' boss':'')},
      cv,
      mk('div',{class:'dex-name',text:n?e.name:'？？？'}),
      mk('div',{class:'dex-meta',text:n?(e.boss?'ボス　':'')+n+'たいたおした':'まだ であってない'}),
      mk('div',{class:'dex-stars',text:stars})
    ));
  });
  $('#dexSummary').textContent='はっけん '+found+' / '+es.length+'　　たおした かず '+total+'\n★ 1たい　★★ 10たい　★★★ 30たい';
}
$('#dexBtn').addEventListener('click',()=>{renderDex();show('dex');});
$('#dexBack').addEventListener('click',()=>{show('home');});
/* ---- しょうごう（じっせき）：じょうけんを みたすと もらえる ---- */
function dexTotal(){return Object.keys(state.dex||{}).reduce((a,k)=>a+(state.dex[k]|0),0);}
function dexFound(){return Object.keys(state.dex||{}).filter(k=>state.dex[k]>0).length;}
const ACH=[
  {id:'first',name:'はじめの いっぽ',desc:'なかまを 1にん つくる',p:()=>[state.party.length,1]},
  {id:'trio',name:'なかま だいしゅうごう',desc:'なかまが 3にんに なる',p:()=>[state.party.length,3]},
  {id:'kill10',name:'みならい ぼうけんしゃ',desc:'てきを 10たい たおす',p:()=>[dexTotal(),10]},
  {id:'kill100',name:'ベテラン ぼうけんしゃ',desc:'てきを 100たい たおす',p:()=>[dexTotal(),100]},
  {id:'kill500',name:'でんせつの ゆうしゃ',desc:'てきを 500たい たおす',p:()=>[dexTotal(),500]},
  {id:'stage3',name:'ぼうけんの とちゅう',desc:'ステージ3まで クリア',p:()=>[state.cleared,3]},
  {id:'stage5',name:'ラクガキ おうこくの えいゆう',desc:'ぜんステージ クリア',p:()=>[state.cleared,STAGES.length]},
  {id:'lvmax',name:'きわめし もの',desc:'Lv.MAXの なかまを つくる',p:()=>[state.party.reduce((m,h)=>Math.max(m,h.lv),0),MAX_LV]},
  {id:'evo',name:'しんかの きせき',desc:'えを かきたして しんかする',p:()=>[state.party.filter(h=>h.evo).length,1]},
  {id:'equip',name:'そうびの たつじん',desc:'3にん ぜんいんに そうびを つける',p:()=>[state.party.filter(h=>validItem(h.item)).length,3]},
  {id:'dq1',name:'おだい ちょうせんしゃ',desc:'きょうの おだいを 1かい クリア',p:()=>[state.dqCount,1]},
  {id:'dq7',name:'おだい マスター',desc:'きょうの おだいを 7かい クリア',p:()=>[state.dqCount,7]},
  {id:'dex5',name:'ずかん はかせ',desc:'てきを 5しゅるい はっけん',p:()=>[dexFound(),5]},
  {id:'dex10',name:'ずかん コンプリート',desc:'てきを ぜんぶ はっけん',p:()=>[dexFound(),10]},
  {id:'share',name:'ともだちの わ',desc:'なかまを ともだちと こうかんする',p:()=>[(state.shared|0)+(state.received|0),1]}
];
function achName(id){const a=ACH.find(x=>x.id===id);return a?a.name:'';}
/* あたらしく かくとくした しょうごうを かえす。はじめて しらべる ときは しずかに きろくだけ */
function checkAch(){
  const quiet=(state.ach===null);
  if(quiet)state.ach={};
  const fresh=[];
  ACH.forEach(a=>{
    if(state.ach[a.id])return;
    const pr=a.p();
    if(pr[0]>=pr[1]){state.ach[a.id]=1;fresh.push(a);}
  });
  if(fresh.length){
    save();
    if(!quiet)toast('🏅 しょうごう「'+fresh.map(a=>a.name).join('」「')+'」を かくとく！');
  }else if(quiet)save();
  return fresh;
}
function updateTitleLabel(){
  const el=$('#titleLabel');if(!el)return;
  const n=state.title&&state.ach&&state.ach[state.title]?achName(state.title):'';
  el.hidden=!n;el.textContent=n?'🏅 '+n:'';
}
function renderAch(){
  const box=$('#achList');box.innerHTML='';
  let got=0;
  ACH.forEach(a=>{
    const pr=a.p(),ok=!!(state.ach&&state.ach[a.id]);
    if(ok)got++;
    const b=mk('button',{class:'ach-item'+(ok?' got':'')+(state.title===a.id?' cur':''),type:'button'},
      mk('div',{class:'ach-name',text:(ok?'🏅 ':'🔒 ')+(ok?a.name:'？？？？')}),
      mk('div',{class:'ach-desc',text:a.desc}),
      mk('div',{class:'ach-prog',text:ok?(state.title===a.id?'✔ いま つけている しょうごう':'タップで しょうごうに する'):Math.min(pr[0],pr[1])+' / '+pr[1]})
    );
    b.disabled=!ok;
    b.addEventListener('click',()=>{state.title=(state.title===a.id)?'':a.id;save();renderAch();updateTitleLabel();});
    box.append(b);
  });
  $('#achSummary').textContent='かくとく '+got+' / '+ACH.length;
}
$('#achBtn').addEventListener('click',()=>{renderAch();show('ach');});
$('#achBack').addEventListener('click',()=>{renderHome();show('home');});

/* ---- ともだちと こうかん：なかまを コードにして おくる・うけとる ---- */
const SHARE_PREFIX='RKG1:';
function b64enc(str){const bytes=new TextEncoder().encode(str);let bin='';bytes.forEach(b=>{bin+=String.fromCharCode(b);});return btoa(bin);}
function b64dec(b64){const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
function heroToCode(h){
  const o={n:h.name,i:h.img,hp:h.hp,a:h.atk,d:h.def,iv:h.interval,c:h.crit,s:h.skill,lv:h.lv,e:h.evo?1:0,l:h.limbs||{},
    it:validItem(h.item)?{i:h.item.img,k:h.item.kind,p:h.item.power}:null};
  return SHARE_PREFIX+b64enc(JSON.stringify(o));
}
const PNG_URL=/^data:image\/png;base64,[A-Za-z0-9+\/]+={0,2}$/;
/* ほかの ひとから きた コードは ぜんぶ ちゃんと チェックして、ありえない かずは おさえる */
function codeToHero(code){
  try{
    code=String(code||'').replace(/\s+/g,'');
    if(code.indexOf(SHARE_PREFIX)!==0||code.length>400000)return null;
    const o=JSON.parse(b64dec(code.slice(SHARE_PREFIX.length)));
    if(!o||typeof o.i!=='string'||o.i.length>250000||!PNG_URL.test(o.i))return null;
    const num=(v,lo,hi,d)=>{v=Number(v);return isFinite(v)?clamp(v,lo,hi):d;};
    const h={
      name:(typeof o.n==='string'&&o.n.trim()?o.n.trim():'ともだち').slice(0,8),
      img:o.i,
      hp:Math.round(num(o.hp,40,300,100)),atk:Math.round(num(o.a,5,40,12)),def:Math.round(num(o.d,0,20,3)),
      interval:Math.round(num(o.iv,0.6,1.9,1.2)*100)/100,crit:Math.round(num(o.c,0,0.45,0.05)*100)/100,
      skill:(typeof o.s==='string'&&has(SKILLS,o.s))?o.s:'black',
      lv:clamp(Math.round(num(o.lv,1,MAX_LV,1)),1,MAX_LV),exp:0,evo:o.e?1:0,dq:0,
      limbs:{hands:!!(o.l&&o.l.hands),feet:!!(o.l&&o.l.feet)},item:null
    };
    if(o.it&&typeof o.it.i==='string'&&o.it.i.length<80000&&PNG_URL.test(o.it.i)&&typeof o.it.k==='string'&&has(PAL,o.it.k)){
      const pw=Math.round(num(o.it.p,0.1,1,0.5)*100)/100;
      h.item={img:o.it.i,kind:o.it.k,power:pw,name:itemName(o.it.k,pw)};
    }
    return h;
  }catch(e){return null;}
}
function copyText(t,ta){
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>toast('コピーしたよ！'),()=>{ta.select();toast('えらんだ ぶんを コピーしてね');});return;}}catch(_){}
  try{ta.select();if(document.execCommand&&document.execCommand('copy')){toast('コピーしたよ！');return;}}catch(_){}
  toast('コードを せんたくしたよ。コピーしてね');
}
function openShare(){
  const m=$('#modal');m.innerHTML='';
  const panel=mk('div',{class:'panel share-panel',role:'dialog','aria-modal':'true'});
  panel.append(mk('div',{class:'rtitle',text:'🤝 ともだちと こうかん'}));
  panel.append(mk('div',{class:'sh-h',text:'📤 なかまを おくる'}));
  const out=mk('textarea',{class:'sh-code',rows:'3',placeholder:'おくりたい なかまを えらんでね'});
  out.readOnly=true;
  const row=mk('div',{class:'sh-row'});
  state.party.forEach(h=>row.append(mk('button',{class:'btn sm',type:'button',text:h.name,onclick:()=>{
    out.value=heroToCode(h);out.select();state.shared=(state.shared|0)+1;save();
    toast(h.name+' の コードを つくったよ！ コピーして おくろう');
  }})));
  if(!state.party.length)row.append(mk('span',{class:'hint',text:'まだ なかまが いないよ'}));
  panel.append(row,out,mk('div',{class:'sh-row'},mk('button',{class:'btn sm',type:'button',text:'📋 コピー',onclick:()=>{if(out.value)copyText(out.value,out);else toast('さきに なかまを えらんでね');}})));
  panel.append(mk('div',{class:'sh-h',text:'📥 なかまを うけとる'}));
  const inp=mk('textarea',{class:'sh-code',rows:'3',placeholder:'ともだちから もらった コードを ここに はりつけてね'});
  const msg=mk('div',{class:'sh-msg'});
  const area=mk('div',{class:'sh-row'});
  const done=(h)=>{state.received=(state.received|0)+1;save();closeModal();renderHome();toast(h.name+' が なかまに くわわった！');};
  panel.append(inp,area,msg);
  area.append(mk('button',{class:'btn sm primary',type:'button',text:'うけとる',onclick:()=>{
    const h=codeToHero(inp.value);
    if(!h){msg.textContent='コードが ただしくないみたい…（さいごまで コピーできてるかな？）';return;}
    if(state.party.length<3){state.party.push(h);done(h);return;}
    msg.textContent='なかまが いっぱい！ だれと いれかえる？';
    area.innerHTML='';
    state.party.forEach((old,i)=>area.append(mk('button',{class:'btn sm',type:'button',text:old.name+' と いれかえる',onclick:()=>{state.party[i]=h;done(h);}})));
    area.append(mk('button',{class:'btn sm',type:'button',text:'やめる',onclick:()=>closeModal()}));
  }}));
  panel.append(mk('div',{class:'rbtns'},mk('button',{class:'btn',type:'button',text:'とじる',onclick:()=>closeModal()})));
  m.append(panel);m.hidden=false;
}
$('#shareBtn').addEventListener('click',openShare);
function skillChip(id){
  const dot=mk('i');dot.style.background=PAL[id].hex;
  return mk('span',{class:'chip'},dot,mk('span',{text:SKILLS[id].name}));
}
function limbBtn(hero,key,label){
  const on=!!(hero.limbs&&hero.limbs[key]);
  const b=mk('button',{class:'btn sm opt'+(on?' on':''),type:'button','aria-pressed':on?'true':'false',title:label+'を つける',text:label});
  b.addEventListener('click',()=>{
    hero.limbs=hero.limbs||{hands:false,feet:false};
    hero.limbs[key]=!hero.limbs[key];
    save();renderHome();
  });
  return b;
}
function renderHome(){
  checkAch();updateTitleLabel();
  const slots=$('#slots');slots.innerHTML='';
  for(let i=0;i<3;i++){
    const hero=state.party[i];
    if(hero){
      const st=heroStats(hero);
      const el=mk('div',{class:'slot'});
      el.append(
        mk('div',{class:'slot-img'},mk('img',{alt:hero.name,src:hero.img})),
        mk('div',{class:'slot-name',text:(hero.evo?'★ ':'')+hero.name}),
        mk('div',{class:'slot-lv',text:'Lv.'+hero.lv+'　パワー '+powerOf(st)+(hero.dq?' 🎨':'')}),
        mk('div',{class:'slot-stats',text:'HP'+st.hp+' ちから'+st.atk+' まもり'+st.def}),
        skillChip(hero.skill),
        mk('div',{class:'opt-row'},limbBtn(hero,'hands','手'),limbBtn(hero,'feet','足')),
        mk('button',{class:'btn sm',type:'button',text:'かきなおす',onclick:()=>openDraw(i)})
      );
      if(validItem(hero.item)){
        const ii=mk('img',{alt:hero.item.name,src:hero.item.img});
        el.append(mk('div',{class:'slot-item'},ii,mk('div',{},mk('b',{text:hero.item.name}),mk('small',{text:itemDesc(hero.item)}))));
      }
      el.append(mk('button',{class:'btn sm',type:'button',text:validItem(hero.item)?'🗡 そうびを かきなおす':'🗡 そうびを かく',onclick:()=>openEquip(i)}));
      if(hero.lv>=MAX_LV&&!hero.evo){
        el.append(mk('button',{class:'btn sm evo-btn',type:'button',title:'えを かきたして パワーアップ！（1かいだけ）',text:'✨ しんかする！',onclick:()=>openEvolve(i)}));
      }
      if(hero.lv>=MAX_LV&&!hero.evo){
        el.append(mk('button',{class:'btn sm evo-btn',type:'button',title:'えを かきたして パワーアップ！（1かいだけ）',text:'✨ しんかする！',onclick:()=>openEvolve(i)}));
      }
      slots.append(el);
    }else{
      slots.append(mk('div',{class:'slot empty'},
        mk('button',{class:'btn add',type:'button',onclick:()=>openDraw(state.party.length)},
          mk('span',{class:'plus',text:'＋'}),mk('span',{text:'ラクガキ'}),mk('span',{text:'する'}))));
    }
  }
  const dqc=$('#dqCard');
  if(dqc){
    dqc.innerHTML='';
    dqc.append(
      mk('b',{text:'🎨 きょうの おだい'}),
      mk('span',{class:'dq-text',text:dqToday().text}),
      mk('span',{class:'dq-state'+(dqDone()?' done':''),text:dqDone()?'✔ クリアずみ！':'クリアで そのキャラが +10%'}),
      mk('small',{text:'これまでの クリア '+state.dqCount+'かい'})
    );
  }
  const list=$('#stages');list.innerHTML='';
  STAGES.forEach((s,i)=>{
    const locked=i>state.cleared,cleared=i<state.cleared;
    const card=mk('div',{class:'stagecard'+(cleared?' cleared':'')});
    card.append(
      mk('span',{class:'st-no',text:'STAGE '+(i+1)}),
      mk('span',{class:'st-name',text:locked?'？？？':s.name}),
      mk('span',{class:'st-sub',text:locked?'まえのステージを クリア':(cleared?'★ クリアずみ':'ボス：'+s.boss.name)})
    );
    const b1=mk('button',{class:'btn sm',type:'button',text:'ステージ',title:'つぎつぎ でてくる てきと たたかう'});
    const b2=mk('button',{class:'btn sm',type:'button',text:'たんけん',title:'3Dの フィールドを あるきまわる'});
    b1.disabled=b2.disabled=locked||state.party.length===0;
    b1.addEventListener('click',()=>startBattle(i));
    b2.addEventListener('click',()=>enterField(i));
    card.append(mk('div',{class:'st-btns'},b1,b2));
    list.append(card);
  });
  $('#homeHint').textContent=state.party.length===0?'まずは「ラクガキする」で なかまを かこう！':'';
  $('#howto').open=state.party.length===0;
}

/* =====================================================================
   お絵かき
   ===================================================================== */
const pad=$('#pad'),pctx=pad.getContext('2d');
let strokes=[],cur=null,drawSlot=0;
const tool={color:'black',size:10,erase:false,sym:false,stamp:null};

function setupStroke(s){
  pctx.lineCap='round';pctx.lineJoin='round';
  pctx.globalCompositeOperation=s.erase?'destination-out':'source-over';
  pctx.strokeStyle=s.erase?'#000':s.color;pctx.fillStyle=s.erase?'#000':s.color;pctx.lineWidth=s.size;
}
/* s.sym が ついた ストロークは まんなかを じくに ひだりみぎ たいしょうにも えがく */
function symFlips(s){return s.sym?[false,true]:[false];}
function mx(x,flip){return flip?pad.width-x:x;}
function drawDot(s){
  for(const f of symFlips(s)){
    pctx.save();setupStroke(s);
    pctx.beginPath();pctx.arc(mx(s.pts[0][0],f),s.pts[0][1],s.size/2,0,Math.PI*2);pctx.fill();
    pctx.restore();
  }
}
function drawSeg(s,a,b){
  for(const f of symFlips(s)){
    pctx.save();setupStroke(s);
    pctx.beginPath();pctx.moveTo(mx(a[0],f),a[1]);pctx.lineTo(mx(b[0],f),b[1]);pctx.stroke();
    pctx.restore();
  }
}
/* ---- スタンプ：かたちを ワンタップで ペタッと ---- */
const STAMPS=[['pen','✏️','ペン'],['star','⭐','ほし'],['heart','❤️','ハート'],['circle','⚫','まる'],['tri','▲','とんがり']];
function stampPoly(kind,cx,cy,r){
  const P=[];
  if(kind==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;P.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}}
  else if(kind==='heart'){for(let i=0;i<40;i++){const t=i/40*Math.PI*2;
    const x=16*Math.pow(Math.sin(t),3),y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));
    P.push([cx+x/17*r,cy+y/17*r+r*0.05]);}}
  else if(kind==='circle'){for(let i=0;i<28;i++){const a=i/28*Math.PI*2;P.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}}
  else{P.push([cx,cy-r],[cx+r*0.9,cy+r*0.75],[cx-r*0.9,cy+r*0.75]);}
  return P;
}
function stampRadius(){return tool.size>=20?44:(tool.size>=10?28:16);}
function drawPoly(s){
  for(const f of symFlips(s)){
    pctx.save();setupStroke(s);
    pctx.beginPath();
    s.poly.forEach((q,i)=>{if(i)pctx.lineTo(mx(q[0],f),q[1]);else pctx.moveTo(mx(q[0],f),q[1]);});
    pctx.closePath();pctx.lineWidth=2;pctx.fill();pctx.stroke();
    pctx.restore();
  }
}
function drawStroke(s){
  if(s.poly){drawPoly(s);return;}
  if(s.pts.length===1){drawDot(s);return;}
  for(const f of symFlips(s)){
    pctx.save();setupStroke(s);
    const p=s.pts;
    pctx.beginPath();pctx.moveTo(mx(p[0][0],f),p[0][1]);
    for(let i=1;i<p.length-1;i++){
      pctx.quadraticCurveTo(mx(p[i][0],f),p[i][1],mx((p[i][0]+p[i+1][0])/2,f),(p[i][1]+p[i+1][1])/2);
    }
    pctx.lineTo(mx(p[p.length-1][0],f),p[p.length-1][1]);
    pctx.stroke();pctx.restore();
  }
}
let baseImg=null,evolveSlot=-1,equipSlot=-1;   /* しんか中は いまの えを した地にして かきたす */
function drawBase(){
  if(!baseImg||!baseImg.complete||!baseImg.naturalWidth)return;
  const box=300,k=Math.min(box/baseImg.naturalWidth,box/baseImg.naturalHeight,2.2);
  const w=baseImg.naturalWidth*k,h=baseImg.naturalHeight*k;
  pctx.save();pctx.globalCompositeOperation='source-over';
  pctx.drawImage(baseImg,(pad.width-w)/2,(pad.height-h)/2,w,h);
  pctx.restore();
}
let baseImg=null,evolveSlot=-1;   /* しんか中は いまの えを した地にして かきたす */
function drawBase(){
  if(!baseImg||!baseImg.complete||!baseImg.naturalWidth)return;
  const box=300,k=Math.min(box/baseImg.naturalWidth,box/baseImg.naturalHeight,2.2);
  const w=baseImg.naturalWidth*k,h=baseImg.naturalHeight*k;
  pctx.save();pctx.globalCompositeOperation='source-over';
  pctx.drawImage(baseImg,(pad.width-w)/2,(pad.height-h)/2,w,h);
  pctx.restore();
}
function redraw(){
  pctx.clearRect(0,0,pad.width,pad.height);
  drawBase();
  for(const s of strokes)drawStroke(s);
}
function padPos(e){
  const r=pad.getBoundingClientRect();
  const w=r.width||pad.width,h=r.height||pad.height;
  return [(e.clientX-r.left)*pad.width/w,(e.clientY-r.top)*pad.height/h];
}
pad.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();
  if(tool.stamp&&!tool.erase){
    const q=padPos(e);
    strokes.push({color:PAL[tool.color].hex,size:tool.size,erase:false,sym:tool.sym,pts:[q],poly:stampPoly(tool.stamp,q[0],q[1],stampRadius())});
    redraw();updatePreview();$('#padHint').hidden=true;
    return;
  }
  try{pad.setPointerCapture(e.pointerId);}catch(_){}
  cur={color:PAL[tool.color].hex,size:tool.size,erase:tool.erase,sym:tool.sym,pts:[padPos(e)]};
  strokes.push(cur);drawDot(cur);
  $('#padHint').hidden=true;
});
pad.addEventListener('pointermove',e=>{
  if(!cur)return;
  e.preventDefault();
  const evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[];
  const list=evs.length?evs:[e];
  for(const ev of list){
    const p=padPos(ev),last=cur.pts[cur.pts.length-1];
    if(Math.hypot(p[0]-last[0],p[1]-last[1])<1.5)continue;
    cur.pts.push(p);drawSeg(cur,last,p);
  }
});
function endStroke(){
  if(!cur)return;
  cur=null;redraw();updatePreview();
}
pad.addEventListener('pointerup',endStroke);
pad.addEventListener('pointercancel',endStroke);

function buildTools(){
  const pal=$('#palette');pal.innerHTML='';
  PALETTE.forEach(p=>{
    const locked=(p.unlock||0)>state.cleared;
    const b=mk('button',{class:'sw'+(locked?' locked':''),type:'button','aria-label':p.name,title:locked?'ステージ'+p.unlock+'を クリアすると つかえるよ':p.name});
    b.style.setProperty('--c',p.hex);
    b.dataset.id=p.id;
    if(locked){b.disabled=true;b.textContent='🔒';}
    b.addEventListener('click',()=>{tool.color=p.id;tool.erase=false;syncTools();});
    pal.append(b);
  });
  const stamps=$('#stamps');stamps.innerHTML='';
  STAMPS.forEach(st=>{
    const b=mk('button',{class:'btn sm stamp-btn',type:'button',title:st[2],'aria-label':st[2],text:st[1]});
    b.dataset.k=st[0];
    b.addEventListener('click',()=>{tool.stamp=st[0]==='pen'?null:st[0];tool.erase=false;syncTools();});
    stamps.append(b);
  });
  const sizes=$('#sizes');sizes.innerHTML='';
  [[5,'ほそい',6],[10,'ふつう',12],[20,'ふとい',20]].forEach(s=>{
    const dot=mk('i');dot.style.width=dot.style.height=s[2]+'px';
    const b=mk('button',{class:'btn sm size-btn',type:'button','aria-label':s[1],title:s[1]},dot);
    b.dataset.size=s[0];
    b.addEventListener('click',()=>{tool.size=s[0];syncTools();});
    sizes.append(b);
  });
  syncTools();
}
function syncTools(){
  $$('#palette .sw').forEach(b=>b.classList.toggle('sel',!tool.erase&&b.dataset.id===tool.color));
  $$('#sizes .size-btn').forEach(b=>b.classList.toggle('on',+b.dataset.size===tool.size));
  $('#eraser').classList.toggle('on',tool.erase);
  $('#symBtn').classList.toggle('on',tool.sym);
  $$('#stamps .stamp-btn').forEach(b=>b.classList.toggle('on',!tool.erase&&(b.dataset.k==='pen'?!tool.stamp:b.dataset.k===tool.stamp)));
  $('.paper-wrap').classList.toggle('sym',tool.sym);
  $('#colorHint').textContent=tool.erase?'けしごむ：かいたところを けせるよ':PAL[tool.color].name+'：'+PAL[tool.color].hint;
}
$('#eraser').addEventListener('click',()=>{tool.erase=!tool.erase;syncTools();});
$('#symBtn').addEventListener('click',()=>{tool.sym=!tool.sym;syncTools();});
$('#undo').addEventListener('click',()=>{
  strokes.pop();redraw();updatePreview();
  if(!strokes.length&&!baseImg)$('#padHint').hidden=false;
});
$('#clear').addEventListener('click',()=>{
  strokes=[];redraw();updatePreview();$('#padHint').hidden=!!baseImg;
});

/* ---- 解析：えからステータスをつくる ---- */
function analyze(){
  const w=pad.width,h=pad.height;
  const d=pctx.getImageData(0,0,w,h).data;
  const counts={};PALETTE.forEach(p=>{counts[p.id]=0;});
  let total=0,minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y+=2){
    for(let x=0;x<w;x+=2){
      const i=(y*w+x)*4;
      if(d[i+3]<100)continue;
      total++;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      const r=d[i],g=d[i+1],b=d[i+2];
      let best=0,bd=1e12;
      for(let k=0;k<PALETTE.length;k++){
        const p=PALETTE[k].rgb,dr=r-p[0],dg=g-p[1],db=b-p[2],dist=dr*dr+dg*dg+db*db;
        if(dist<bd){bd=dist;best=k;}
      }
      counts[PALETTE[best].id]++;
    }
  }
  return {total,counts,minX,minY,maxX,maxY};
}
function computeBase(a){
  const area=(pad.width/2)*(pad.height/2);
  const c=clamp((a.total/area)/0.13,0.12,1);
  const s=id=>a.total?a.counts[id]/a.total:0;
  const sR=s('red'),sO=s('orange'),sY=s('yellow'),sG=s('green'),sB=s('blue'),sP=s('purple'),sK=s('pink'),sBl=s('black');
  const hp=Math.round(70+110*c+60*sB+30*sK);
  const atk=Math.round(9+6*c+20*(sR+0.8*sO+0.5*sP));
  const def=Math.round(2+3*c+10*sB+4*sBl);
  const interval=Math.round(clamp(1.65-0.55*(1-c)-0.7*sG-0.3*sY,0.6,1.9)*100)/100;
  const crit=Math.round((0.05+0.35*sY)*100)/100;
  let skill='black',bv=0.08;
  for(const p of PALETTE){
    if(p.id==='black')continue;
    const v=s(p.id);
    if(v>bv){bv=v;skill=p.id;}
  }
  return {hp,atk,def,interval,crit,skill};
}
function updatePreview(){
  let a;
  try{a=analyze();}catch(e){a={total:0,counts:{}};}
  if(equipSlot>=0){
    const okE=a.total>=ITEM_MIN_INK;
    $('#pvEmpty').hidden=true;$('#pvBody').hidden=true;
    $('#doneBtn').disabled=!okE;
    const dl0=$('#dqLine');if(dl0)dl0.hidden=true;
    const el=$('#eqLine');
    if(el){el.hidden=false;if(okE){const it=itemFrom(a);el.textContent='🗡 '+it.name+'　'+itemDesc(it);el.className='dq-line pass';}else{el.textContent='🗡 そうびを かこう！ あか＝つるぎ・あお＝たて・みどり＝ブーツ・きいろ＝かんむり…（おおきく かくほど つよい）';el.className='dq-line';}}
    return;
  }
  const ok=a.total>=MIN_INK;
  $('#pvEmpty').hidden=ok;$('#pvBody').hidden=!ok;
  $('#doneBtn').disabled=!ok||(evolveSlot>=0&&!strokes.length);
  const dl=$('#dqLine');
  if(dl){
    if(evolveSlot>=0){dl.hidden=true;}
    else{
      dl.hidden=false;
      const pass=ok&&dqPassed(a);
      dl.className='dq-line'+(pass?' pass':'');
      dl.textContent=(dqDone()?'🎨 きょうの おだい（クリアずみ）：':'🎨 きょうの おだい：')+dqToday().text+(pass?'　✔ OK！':'');
    }
  }
  if(!ok)return;
  const b=computeBase(a);
  const spd=clamp((1.9-b.interval)/1.3,0,1);
  $('#bHp').style.width=clamp(b.hp/260,0.04,1)*100+'%';$('#nHp').textContent=b.hp;
  $('#bAtk').style.width=clamp(b.atk/40,0.04,1)*100+'%';$('#nAtk').textContent=b.atk;
  $('#bDef').style.width=clamp(b.def/16,0.04,1)*100+'%';$('#nDef').textContent=b.def;
  $('#bSpd').style.width=clamp(spd,0.04,1)*100+'%';$('#nSpd').textContent=Math.round(spd*100);
  const sk=SKILLS[b.skill];
  $('#pvDot').style.background=PAL[b.skill].hex;
  $('#pvSkill').textContent='ひっさつ：'+sk.name;
  $('#pvSkillDesc').textContent=sk.desc;
  $('#pvPower').textContent=powerOf(b);
}

const drawOpts={hands:false,feet:false};
function syncOpts(){
  [['optHands','hands'],['optFeet','feet']].forEach(pair=>{
    const b=$('#'+pair[0]);b.classList.toggle('on',drawOpts[pair[1]]);b.setAttribute('aria-pressed',drawOpts[pair[1]]?'true':'false');
  });
}
$('#optHands').addEventListener('click',()=>{drawOpts.hands=!drawOpts.hands;syncOpts();});
$('#optFeet').addEventListener('click',()=>{drawOpts.feet=!drawOpts.feet;syncOpts();});
function setDrawTitle(mode){
  const eq=mode==='equip',evo=mode===true;
  const h=$('#draw h2');if(h)h.textContent=eq?'🗡 そうびを かこう':(evo?'✨ しんか！ えを かきたそう':'ラクガキする');
  $('#doneBtn').textContent=eq?'そうびする！':(evo?'しんかする！':$('#doneBtn').dataset.label||$('#doneBtn').textContent);
  $('#nameInput').style.display=eq?'none':'';
  $$('#draw .opt-row,#draw .opt-hint').forEach(e=>{e.style.display=eq?'none':'';});
  const eqL=$('#eqLine');if(eqL)eqL.hidden=!eq;
}
function openDraw(i){
  baseImg=null;evolveSlot=-1;equipSlot=-1;
  if(!$('#doneBtn').dataset.label)$('#doneBtn').dataset.label=$('#doneBtn').textContent;
  setDrawTitle(false);
  drawSlot=Math.min(i,state.party.length);
  const exist=state.party[drawSlot];
  drawOpts.hands=!!(exist&&exist.limbs&&exist.limbs.hands);drawOpts.feet=!!(exist&&exist.limbs&&exist.limbs.feet);syncOpts();
  strokes=[];cur=null;tool.erase=false;
  if((PAL[tool.color].unlock||0)>state.cleared)tool.color='black';
  $('#nameInput').value='';
  $('#padHint').hidden=false;
  buildTools();redraw();updatePreview();
  show('draw');
}
function openEquip(i){
  const hero=state.party[i];
  if(!hero)return;
  if(!$('#doneBtn').dataset.label)$('#doneBtn').dataset.label=$('#doneBtn').textContent;
  drawSlot=i;equipSlot=i;evolveSlot=-1;baseImg=null;
  strokes=[];cur=null;tool.erase=false;
  if((PAL[tool.color].unlock||0)>state.cleared)tool.color='black';
  $('#padHint').hidden=false;
  setDrawTitle('equip');
  buildTools();redraw();updatePreview();
  show('draw');
  toast('そうびを かこう！ いろで こうかが かわるよ');
}
function openEvolve(i){
  const hero=state.party[i];
  if(!hero||hero.lv<MAX_LV||hero.evo)return;
  if(!$('#doneBtn').dataset.label)$('#doneBtn').dataset.label=$('#doneBtn').textContent;
  if(!hero||hero.lv<MAX_LV||hero.evo)return;
  if(!$('#doneBtn').dataset.label)$('#doneBtn').dataset.label=$('#doneBtn').textContent;
  drawSlot=i;evolveSlot=i;equipSlot=-1;
  drawOpts.hands=!!(hero.limbs&&hero.limbs.hands);drawOpts.feet=!!(hero.limbs&&hero.limbs.feet);syncOpts();
  strokes=[];cur=null;tool.erase=false;
  if((PAL[tool.color].unlock||0)>state.cleared)tool.color='black';
  drawOpts.hands=!!(hero.limbs&&hero.limbs.hands);drawOpts.feet=!!(hero.limbs&&hero.limbs.feet);syncOpts();
  strokes=[];cur=null;tool.erase=false;
  if((PAL[tool.color].unlock||0)>state.cleared)tool.color='black';
  $('#nameInput').value=hero.name;
  $('#padHint').hidden=true;
  setDrawTitle(true);
  buildTools();
  baseImg=new Image();
  baseImg.onload=()=>{redraw();updatePreview();};
  baseImg.src=hero.img;
  redraw();updatePreview();
  show('draw');
  toast('いまの えに かきたして パワーアップ！ （1かいだけ）');
}
function finishEquip(){
  let a;
  try{a=analyze();}catch(e){return;}
  if(a.total<ITEM_MIN_INK){toast('もうすこし かいてみよう！');return;}
  const hero=state.party[equipSlot];
  if(!hero){return;}
  const it=itemFrom(a);
  const pad6=6;
  const sx=Math.max(0,a.minX-pad6),sy=Math.max(0,a.minY-pad6);
  const ex=Math.min(pad.width,a.maxX+pad6),ey=Math.min(pad.height,a.maxY+pad6);
  const bw=Math.max(1,ex-sx),bh=Math.max(1,ey-sy);
  const sc=Math.min(1,96/Math.max(bw,bh));
  const out=document.createElement('canvas');
  out.width=Math.max(1,Math.round(bw*sc));out.height=Math.max(1,Math.round(bh*sc));
  out.getContext('2d').drawImage(pad,sx,sy,bw,bh,0,0,out.width,out.height);
  it.img=out.toDataURL('image/png');
  hero.item=it;
  equipSlot=-1;setDrawTitle(false);
  save();renderHome();show('home');
  toast(hero.name+' は '+it.name+' を そうびした！（'+itemDesc(it)+'）');
}
function finishDrawing(){
  if(equipSlot>=0){finishEquip();return;}
  let a;
  try{a=analyze();}catch(e){return;}
  if(a.total<MIN_INK){toast('もうすこし かいてみよう！');return;}
  const b=computeBase(a);
  const pad6=8;
  const sx=Math.max(0,a.minX-pad6),sy=Math.max(0,a.minY-pad6);
  const ex=Math.min(pad.width,a.maxX+pad6),ey=Math.min(pad.height,a.maxY+pad6);
  const bw=Math.max(1,ex-sx),bh=Math.max(1,ey-sy);
  const sc=Math.min(1,220/Math.max(bw,bh));
  const out=document.createElement('canvas');
  out.width=Math.max(1,Math.round(bw*sc));out.height=Math.max(1,Math.round(bh*sc));
  out.getContext('2d').drawImage(pad,sx,sy,bw,bh,0,0,out.width,out.height);
  let name=$('#nameInput').value.trim();
  if(!name)name=DEFAULT_NAMES[Math.floor(Math.random()*DEFAULT_NAMES.length)];
  if(evolveSlot>=0&&state.party[evolveSlot]){
    const old=state.party[evolveSlot];
    if(!strokes.length){toast('なにか かきたしてね！');return;}
    old.img=out.toDataURL('image/png');
    old.name=name.slice(0,8);
    old.hp=Math.max(old.hp,b.hp);old.atk=Math.max(old.atk,b.atk);old.def=Math.max(old.def,b.def);
    old.interval=Math.min(old.interval,b.interval);old.crit=Math.max(old.crit,b.crit);
    old.skill=b.skill;old.evo=1;
    old.limbs={hands:drawOpts.hands,feet:drawOpts.feet};
    baseImg=null;evolveSlot=-1;setDrawTitle(false);
    save();renderHome();show('home');
    toast('★ '+old.name+' が しんかした！ パワーが 25% アップ！');
    return;
  }
  const oldHero=drawSlot<state.party.length?state.party[drawSlot]:null;
  const gotDq=!dqDone()&&dqPassed(a);
  const hero={
    name:name.slice(0,8),img:out.toDataURL('image/png'),
    hp:b.hp,atk:b.atk,def:b.def,interval:b.interval,crit:b.crit,skill:b.skill,lv:1,exp:0,
    limbs:{hands:drawOpts.hands,feet:drawOpts.feet},dq:gotDq?1:0,
    item:(oldHero&&validItem(oldHero.item))?oldHero.item:null   /* かきなおしても そうびは のこる */
  };
  if(gotDq){state.dq=dqKey();state.dqCount=(state.dqCount|0)+1;}
  if(drawSlot<state.party.length)state.party[drawSlot]=hero;else state.party.push(hero);
  save();renderHome();show('home');
  toast(gotDq?'🎨 おだいクリア！ '+hero.name+' が +10% で なかまに なった！':hero.name+' が なかまに なった！');
}
$('#doneBtn').addEventListener('click',finishDrawing);
$('#cancelBtn').addEventListener('click',()=>{baseImg=null;evolveSlot=-1;equipSlot=-1;setDrawTitle(false);renderHome();show('home');});

/* =====================================================================
   てきのスプライト（てがきふうに プログラムで かく）
   ===================================================================== */
function jit(r,a){return (r()-0.5)*a;}
function smoothPath(c,pts){
  const n=pts.length;
  c.beginPath();
  c.moveTo((pts[n-1][0]+pts[0][0])/2,(pts[n-1][1]+pts[0][1])/2);
  for(let i=0;i<n;i++){
    const p=pts[i],q=pts[(i+1)%n];
    c.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2);
  }
  c.closePath();
}
function polyPath(c,pts){
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  c.closePath();
}
function shape(c,r,pts,fill,lw,sharp){
  lw=lw||5;const path=sharp?polyPath:smoothPath;
  const p1=pts.map(p=>[p[0]+jit(r,3),p[1]+jit(r,3)]);
  path(c,p1);c.fillStyle=fill;c.fill();c.lineWidth=lw;c.lineJoin='round';c.strokeStyle=INK;c.stroke();
  const p2=pts.map(p=>[p[0]+jit(r,5),p[1]+jit(r,5)]);
  path(c,p2);c.lineWidth=1.6;c.globalAlpha=0.5;c.stroke();c.globalAlpha=1;
}
function ellipsePts(cx,cy,rx,ry,n,r,amt){
  amt=amt||0.1;const pts=[];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=1+(r()-0.5)*amt;pts.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]);}
  return pts;
}
function eye(c,x,y,rad,lookX){
  c.beginPath();c.arc(x,y,rad,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.lineWidth=3.5;c.strokeStyle=INK;c.stroke();
  c.beginPath();c.arc(x+(lookX||0),y+1,rad*0.45,0,Math.PI*2);c.fillStyle=INK;c.fill();
}
function strokeLine(c,pts,lw){
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  c.lineWidth=lw||4;c.strokeStyle=INK;c.stroke();
}
function curve(c,x0,y0,cx,cy,x1,y1,lw){
  c.beginPath();c.moveTo(x0,y0);c.quadraticCurveTo(cx,cy,x1,y1);c.lineWidth=lw||4;c.strokeStyle=INK;c.stroke();
}
const DRAW={
  slime(c,r,col){
    shape(c,r,ellipsePts(100,150,72,48,18,r,0.1),col);
    c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.ellipse(72,124,16,9,-0.5,0,Math.PI*2);c.fill();
    eye(c,80,146,12,2);eye(c,122,146,12,2);
    curve(c,88,168,101,181,114,168,4);
    return 102;
  },
  spiky(c,r,col){
    const pts=[],n=14;
    for(let i=0;i<n*2;i++){
      const a=i/(n*2)*Math.PI*2-Math.PI/2,rad=(i%2===0)?66:40;
      pts.push([100+Math.cos(a)*rad+jit(r,4),122+Math.sin(a)*rad+jit(r,4)]);
    }
    shape(c,r,pts,col,5,true);
    eye(c,84,120,10);eye(c,116,120,10);
    strokeLine(c,[[68,102],[92,113]],5);strokeLine(c,[[132,102],[108,113]],5);
    strokeLine(c,[[84,146],[92,139],[100,147],[108,139],[116,146]],4);
    return 56;
  },
  ghost(c,r,col){
    const pts=[];
    for(let i=0;i<=10;i++){const a=Math.PI+i/10*Math.PI;pts.push([100+Math.cos(a)*54,92+Math.sin(a)*54]);}
    pts.push([154,150],[150,186],[132,172],[116,188],[100,172],[84,188],[68,172],[50,186],[46,150]);
    shape(c,r,pts,col,5);
    c.fillStyle=INK;
    c.beginPath();c.ellipse(84,100,7,11,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(116,100,7,11,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(100,130,8,11,0,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(255,120,150,.45)';
    c.beginPath();c.arc(70,120,8,0,Math.PI*2);c.fill();c.beginPath();c.arc(130,120,8,0,Math.PI*2);c.fill();
    return 38;
  },
  bat(c,r,col){
    [-1,1].forEach(sx=>{
      shape(c,r,[[100+sx*26,110],[100+sx*88,60],[100+sx*76,104],[100+sx*94,126],[100+sx*60,130],[100+sx*36,138]],'#5b3d99',4,true);
    });
    shape(c,r,ellipsePts(100,124,34,32,14,r,0.08),col);
    shape(c,r,[[80,102],[82,74],[97,94]],col,4,true);
    shape(c,r,[[120,102],[118,74],[103,94]],col,4,true);
    eye(c,89,120,8);eye(c,111,120,8);
    c.fillStyle='#fff';c.lineWidth=2;c.strokeStyle=INK;
    c.beginPath();c.moveTo(91,138);c.lineTo(95,151);c.lineTo(99,138);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(101,138);c.lineTo(105,151);c.lineTo(109,138);c.closePath();c.fill();c.stroke();
    return 74;
  },
  golem(c,r,col){
    shape(c,r,ellipsePts(28,142,20,26,10,r),col);
    shape(c,r,ellipsePts(172,142,20,26,10,r),col);
    shape(c,r,[[44,190],[34,130],[52,72],[100,54],[148,72],[166,130],[156,190]],col,5);
    strokeLine(c,[[70,82],[78,102],[70,114]],3);strokeLine(c,[[132,150],[124,166],[134,178]],3);
    eye(c,100,118,24,3);
    strokeLine(c,[[80,160],[92,166],[108,166],[120,160]],4);
    return 56;
  },
  demon(c,r,col){
    shape(c,r,[[54,84],[38,28],[86,66]],'#f5e6c8',4,true);
    shape(c,r,[[146,84],[162,28],[114,66]],'#f5e6c8',4,true);
    shape(c,r,ellipsePts(100,130,74,60,20,r,0.08),col);
    eye(c,72,112,13);eye(c,128,112,13);
    strokeLine(c,[[54,90],[88,106]],6);strokeLine(c,[[146,90],[112,106]],6);
    shape(c,r,[[62,140],[100,132],[138,140],[130,172],[100,182],[70,172]],'#3b0f2e',4);
    c.fillStyle='#fff';
    for(let i=0;i<4;i++){
      const x=76+i*16;
      c.beginPath();c.moveTo(x,140);c.lineTo(x+8,154);c.lineTo(x+16,140);c.closePath();c.fill();
    }
    return 66;
  }
};
function drawCrown(c,r,top){
  const y=top+8,cx=100;
  shape(c,r,[[cx-28,y],[cx-32,y-30],[cx-14,y-14],[cx,y-38],[cx+14,y-14],[cx+32,y-30],[cx+28,y]],'#ffd23f',4,true);
  c.fillStyle='#e5383b';c.beginPath();c.arc(cx,y-10,4.5,0,Math.PI*2);c.fill();
}
const spriteCache={};
function getSprite(type,color,boss){
  const key=type+'|'+color+'|'+(boss?1:0);
  if(spriteCache[key])return spriteCache[key];
  const S=200,cv=document.createElement('canvas');cv.width=S;cv.height=S;
  const c=cv.getContext('2d');c.lineJoin='round';c.lineCap='round';
  const r=rng(hashStr(key));
  const top=DRAW[type](c,r,color);
  if(boss&&type!=='demon')drawCrown(c,r,top);
  spriteCache[key]=cv;
  return cv;
}

/* =====================================================================
   バトルシミュレーション … 見た目とは完全にきりはなす
   ・シード付き乱数 + 固定ステップ(1/60秒)
   ・おなじ「パーティ・ステージ・シード・入力」なら、かならずおなじ結果になる
   ・出来事はすべて S.events に出し、描画がわがそれを読みとる
   ===================================================================== */
const DT=1/60;
const GAUGE_RATE=9;
const BAL={   // バランス調整用のつまみ（headlessシミュレーションで調整ずみ）
  hp:0.5,atk:0.28,bossHp:1,bossAtk:1,
  fh:[5.9,3.01,2.2,1.27,0.88],fa:[2.9,1.94,1.6,1.15,0.93],   // ステージごとのてきの強さ補正
  size:[0.55,0.8,1],                                          // なかまが少ないほど てきは よわくなる
  shield:0.75,shieldT:6,heal:0.05,healAtk:0.4,hasteMul:1.4,hasteT:5,stun:1.2,poison:0.4
};

function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a=(a+0x6D2B79F5)>>>0;
    let t=a;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function createSim(party,stageIdx,seed,opts){
  const S={
    seed:seed>>>0,rand:mulberry32(seed),stageIdx:stageIdx,stage:STAGES[stageIdx],
    waves:(opts&&opts.waves)?opts.waves:STAGES[stageIdx].waves,boss:(opts&&('boss' in opts))?!!opts.boss:true,
    tick:0,t:0,phase:'walk',phaseT:1.2,waveIdx:-1,clearT:0,endT:0,
    units:[],projs:[],events:[],inputs:[],
    buff:{L:{haste:0,shield:0},R:{haste:0,shield:0}},
    auto:false,nextId:1,kills:0,result:null,nHeroes:party.length
  };
  party.forEach((hero,i)=>{
    const st=heroStats(hero);
    S.units.push({
      id:S.nextId++,side:'L',kind:'hero',slot:i,name:hero.name,hero:hero,
      x:250-i*80,hp:st.hp,maxHp:st.hp,atk:st.atk,def:st.def,interval:st.interval,crit:st.crit,
      skillId:hero.skill,cd:0.5+S.rand()*0.5,gauge:i*12,alive:true,
      stun:0,poisonT:0,poisonDps:0,poisonAcc:0
    });
  });
  return S;
}

function foesOf(S,u){return S.units.filter(o=>o.alive&&o.side!==u.side);}
function alliesOf(S,u){return S.units.filter(o=>o.alive&&o.side===u.side);}
function nearestFoe(S,u){
  let best=null,bd=1e9;
  for(const o of S.units){
    if(!o.alive||o.side===u.side||o.x>=W-20||o.x<=20)continue;
    const d=Math.abs(o.x-u.x);
    if(d<bd){bd=d;best=o;}
  }
  return best;
}

function hurt(S,t,amount,opt){
  if(!t.alive)return 0;
  opt=opt||{};
  let d=amount;
  if(!opt.trueDmg)d*=1-t.def/(t.def+24);
  if(S.buff[t.side].shield>0)d*=BAL.shield;
  d=Math.max(1,Math.round(d));
  t.hp-=d;
  S.events.push({e:'hit',u:t,dmg:d,crit:!!opt.crit,poison:!!opt.poison});
  if(t.hp<=0){
    t.hp=0;t.alive=false;t.gauge=0;
    if(t.kind==='mon')S.kills++;
    S.events.push({e:'kill',u:t});
  }else if(t.boss&&!t.enraged&&t.hp<=t.maxHp*0.5){
    t.enraged=true;
    S.events.push({e:'enrage',u:t});
  }
  return d;
}

function makeMonster(S,type,isBoss,k){
  const si=S.stageIdx,s=S.stage;
  const d=isBoss?s.boss:ENEMY_TYPES[type];
  const bm=s.mult<1?s.mult+0.15:1;
  const ps=BAL.size[Math.min(3,Math.max(1,S.nHeroes))-1];   // 人数がすくないほど てきは よわくなる
  const hpM=(isBoss?bm*BAL.bossHp:(1+BAL.hp*si)*s.mult)*BAL.fh[si]*ps;
  const atkM=(isBoss?bm*BAL.bossAtk:(1+BAL.atk*si)*s.mult)*BAL.fa[si]*Math.sqrt(ps);
  const hp=Math.round(d.hp*hpM);
  return {
    id:S.nextId++,side:'R',kind:'mon',boss:isBoss,name:d.name,
    spriteType:isBoss?d.type:type,color:isBoss?d.color:enemyColor(type,si),
    x:W+60+k*80+(isBoss?60:0),yOff:(k%2?6:-4),
    hp:hp,maxHp:hp,atk:d.atk*atkM,def:d.def,spd:d.spd,interval:d.iv,fly:d.fly||0,
    size:200*0.56*(d.scale||1),cd:0.6+S.rand()*0.8,
    alive:true,gauge:0,stun:0,poisonT:0,poisonDps:0,poisonAcc:0,enraged:false,arrived:false,deadT:0
  };
}
function spawnWave(S,idx){
  const isBoss=S.boss&&idx>=S.waves.length;
  const list=isBoss?['BOSS']:S.waves[idx];
  list.forEach((t,k)=>S.units.push(makeMonster(S,t==='BOSS'?null:t,isBoss,k)));
  S.clearT=0;
  S.events.push({e:'wave',idx:idx,boss:isBoss});
}
function healParty(S,ratio){
  for(const u of S.units){
    if(u.side!=='L'||!u.alive)continue;
    const a=Math.round(u.maxHp*ratio);
    u.hp=Math.min(u.maxHp,u.hp+a);
    S.events.push({e:'heal',u:u,amt:a});
  }
}
function endSim(S,win){
  S.phase=win?'won':'lost';S.endT=0;
  S.result={win:win,reached:Math.max(0,S.waveIdx),ticks:S.tick};
  S.events.push({e:'end',win:win});
}

function fireProj(S,u,t){
  const crit=S.rand()<u.crit;
  const raw=u.atk*(0.9+S.rand()*0.2)*(crit?2:1);
  S.projs.push({from:u,target:t,t:0,dur:0.38,raw:raw,crit:crit,done:false});
  S.events.push({e:'attack',u:u});
}
function updateProjs(S,dt){
  for(const p of S.projs){
    p.t+=dt/p.dur;
    if(p.t>=1){
      p.done=true;
      if(p.target.alive){
        hurt(S,p.target,p.raw,{crit:p.crit});
        if(p.from.alive)p.from.gauge=Math.min(100,p.from.gauge+3);
      }else S.events.push({e:'fizzle',p:p});
    }
  }
  S.projs=S.projs.filter(p=>!p.done);
}
function updateHeroes(S,dt){
  for(const u of S.units){
    if(u.kind!=='hero'||!u.alive)continue;
    const b=S.buff[u.side];
    u.gauge=Math.min(100,u.gauge+GAUGE_RATE*dt*(b.haste>0?1.3:1));
    u.cd-=dt*(b.haste>0?BAL.hasteMul:1);
    const t=nearestFoe(S,u);
    if(t&&u.cd<=0){fireProj(S,u,t);u.cd=u.interval;}
  }
}
function monsterAttack(S,e){
  const al=S.units.filter(u=>u.side==='L'&&u.alive);
  if(!al.length)return;
  const target=(S.rand()<0.7)?al[0]:al[Math.floor(S.rand()*al.length)];
  S.events.push({e:'swing',u:e});
  hurt(S,target,e.atk*(0.85+S.rand()*0.3));
}
function updateMonsters(S,dt){
  for(const u of S.units){if(u.kind==='mon'&&!u.alive)u.deadT+=dt;}
  S.units=S.units.filter(u=>u.alive||u.kind==='hero'||u.deadT<0.6);
  const front=S.units.find(u=>u.side==='L'&&u.alive);
  if(!front)return;
  const list=S.units.filter(u=>u.kind==='mon'&&u.alive).sort((a,b)=>(a.x-b.x)||(a.id-b.id));
  let limit=front.x+38;
  for(const e of list){
    if(e.poisonT>0){
      e.poisonT-=dt;e.poisonAcc+=dt;
      if(e.poisonAcc>=0.5){
        e.poisonAcc-=0.5;
        hurt(S,e,e.poisonDps*0.5,{poison:true,trueDmg:true});
        if(!e.alive)continue;
      }
    }
    const stunned=e.stun>0;
    if(stunned)e.stun-=dt;
    const stand=limit+e.size*0.32;
    if(!stunned&&e.x>stand)e.x=Math.max(stand,e.x-e.spd*dt);
    e.arrived=e.x<=stand+3;
    limit=e.x+e.size*0.32;
    if(!stunned){
      e.cd-=dt*(e.enraged?1.5:1);
      if(e.arrived&&e.cd<=0){monsterAttack(S,e);e.cd=e.interval*(0.9+S.rand()*0.2);}
    }
  }
}

function canSkill(S,u){return u.alive&&u.kind==='hero'&&u.gauge>=100&&S.phase==='fight';}
function simSkill(S,u){
  if(!canSkill(S,u))return false;
  const sk=SKILLS[u.skillId],kind=sk.kind;
  const foes=foesOf(S,u).sort((a,b)=>(Math.abs(a.x-u.x)-Math.abs(b.x-u.x))||(a.id-b.id));
  if(OFFENSIVE[kind]&&!foes.length)return false;
  u.gauge=0;
  const allies=alliesOf(S,u);
  if(kind==='smash'){
    S.events.push({e:'skill',u:u,kind:kind,targets:[foes[0]]});
    hurt(S,foes[0],u.atk*sk.mult,{crit:true});
  }else if(kind==='aoe'){
    S.events.push({e:'skill',u:u,kind:kind,targets:foes.slice()});
    foes.forEach(t=>hurt(S,t,u.atk*sk.mult));
  }else if(kind==='thunder'){
    S.events.push({e:'skill',u:u,kind:kind,targets:foes.slice()});
    foes.forEach(t=>{hurt(S,t,u.atk*sk.mult);t.stun=BAL.stun;});
  }else if(kind==='poison'){
    S.events.push({e:'skill',u:u,kind:kind,targets:foes.slice()});
    foes.forEach(t=>{t.poisonT=6;t.poisonDps=Math.max(2,u.atk*BAL.poison);});
  }else if(kind==='haste'){
    S.events.push({e:'skill',u:u,kind:kind,targets:allies});
    S.buff[u.side].haste=BAL.hasteT;
  }else if(kind==='shield'){
    S.events.push({e:'skill',u:u,kind:kind,targets:allies});
    S.buff[u.side].shield=BAL.shieldT;
  }else if(kind==='heal'){
    S.events.push({e:'skill',u:u,kind:kind,targets:allies});
    allies.forEach(a=>{
      const amt=Math.round(a.maxHp*BAL.heal+u.atk*BAL.healAtk);
      a.hp=Math.min(a.maxHp,a.hp+amt);
      S.events.push({e:'heal',u:a,amt:amt});
    });
  }
  return true;
}
function simInput(S,u){
  const tick=S.tick;
  if(simSkill(S,u)){S.inputs.push({tick:tick,id:u.id});return true;}
  return false;
}
function tryAuto(S,u){
  if(!canSkill(S,u))return;
  const kind=SKILLS[u.skillId].kind;
  if(!S.units.some(o=>o.alive&&o.side!==u.side))return;
  if(kind==='heal'&&!S.units.some(o=>o.alive&&o.side===u.side&&o.hp<o.maxHp*0.65))return;
  simInput(S,u);
}

function simTick(S){
  const dt=DT;
  if(S.auto&&S.phase==='fight'){
    for(const u of S.units.slice()){if(u.kind==='hero'&&u.side==='L')tryAuto(S,u);}
  }
  S.t+=dt;
  for(const side of ['L','R']){
    const b=S.buff[side];
    if(b.haste>0)b.haste=Math.max(0,b.haste-dt);
    if(b.shield>0)b.shield=Math.max(0,b.shield-dt);
  }
  updateProjs(S,dt);
  if(S.phase==='won'||S.phase==='lost'){S.endT+=dt;S.tick++;return;}
  const total=S.waves.length+(S.boss?1:0);
  if(S.phase==='walk'){
    S.phaseT-=dt;
    for(const u of S.units){if(u.kind==='hero'&&u.alive)u.gauge=Math.min(100,u.gauge+GAUGE_RATE*dt);}
    if(S.phaseT<=0){S.waveIdx++;spawnWave(S,S.waveIdx);S.phase='fight';}
  }else if(S.phase==='fight'){
    updateHeroes(S,dt);updateMonsters(S,dt);
    const lAlive=S.units.some(u=>u.side==='L'&&u.alive);
    const rAlive=S.units.some(u=>u.side==='R'&&u.alive);
    if(!lAlive)endSim(S,false);
    else if(!rAlive){
      S.clearT+=dt;
      if(S.clearT>0.9){
        S.units=S.units.filter(u=>u.side==='L');
        if(S.waveIdx>=total-1)endSim(S,true);
        else{healParty(S,0.15);S.phase='walk';S.phaseT=1.4;}
      }
    }
  }
  S.tick++;
}

/* きろくした入力から、おなじバトルを再現する（対戦のサーバー検証にも使える） */
function replaySim(party,stageIdx,seed,inputs,maxTicks,opts){
  const S=createSim(party,stageIdx,seed,opts);
  let i=0;
  while(!S.result&&S.tick<maxTicks){
    while(i<inputs.length&&inputs[i].tick===S.tick){
      const u=S.units.find(x=>x.id===inputs[i].id);
      if(u)simSkill(S,u);
      i++;
    }
    simTick(S);
    S.events.length=0;
  }
  return S;
}

/* =====================================================================
   ポケモンバトルふうの ターンせいバトル（じゅんすいな けいさん部分）
   ・DOMやThree.jsに いっさい ふれない。だから ノードだけで バランス調整できる
   ・1たい1。グループの てきは じゅんばんに でてくる（トレーナー戦ふう）
   ===================================================================== */
const VS_TYPE_ORDER=['red','green','blue','orange','yellow','purple','pink'];  /* 火→草→水→つち→でんき→どく→フェアリー→(火) */
function vsTypeMult(atkColor,defColor){
  if(!atkColor||!defColor||atkColor==='black'||defColor==='black'||atkColor===defColor)return 1;
  const ai=VS_TYPE_ORDER.indexOf(atkColor),di=VS_TYPE_ORDER.indexOf(defColor);
  if(ai<0||di<0)return 1;
  if((ai+1)%7===di)return 1.5;
  if((di+1)%7===ai)return 2/3;
  return 1;
}
const VS_MON_COLOR={slime:'blue',spiky:'red',ghost:'purple',bat:'black',golem:'orange',demon:'purple'};
const VS_TACKLE={name:'たいあたり',desc:'からだで まっすぐ ぶつかる',kind:'smash',mult:1.7,color:'black'};
const VS_MULT_FIX={yellow:1.9};   /* 群れがけ用に ひかえめだった いろを、1たい1むけに ちょうせい */
/* ---- こうげきジャンケン：かった ほうだけ こうげき できる ---- */
const VS_HANDS=[{id:'gu',emoji:'✊',name:'グー'},{id:'choki',emoji:'✌️',name:'チョキ'},{id:'pa',emoji:'✋',name:'パー'}];
function vsJankenBeats(a,b){return (a==='gu'&&b==='choki')||(a==='choki'&&b==='pa')||(a==='pa'&&b==='gu');}
function vsJankenJudge(p,e){if(p===e)return'tie';return vsJankenBeats(p,e)?'win':'lose';}
/* モンスターごとの てのくせ（ボスは くせなし＝よみにくい）。れんぞく おなじ手も でにくくする */
const VS_HAND_BIAS={slime:{gu:1.6,choki:0.7,pa:0.7},golem:{gu:1.6,choki:0.6,pa:0.8},
  spiky:{gu:0.7,choki:1.6,pa:0.7},bat:{gu:0.7,choki:1.5,pa:0.8},ghost:{gu:0.7,choki:0.7,pa:1.6}};
function vsHandBiasFor(mon){return(mon&&!mon.isBoss)?(VS_HAND_BIAS[mon.type]||null):null;}
function vsHandHint(mon){
  const b=vsHandBiasFor(mon);if(!b)return'';
  let top='gu',tv=b.gu;if(b.choki>tv){top='choki';tv=b.choki;}if(b.pa>tv){top='pa';tv=b.pa;}
  return '　（'+mon.name+'は　'+VS_HANDS.find(h=>h.id===top).name+'を　だしやすいかも…）';
}
function vsPickEnemyHand(S,mon){
  const b=vsHandBiasFor(mon)||{gu:1,choki:1,pa:1};
  const w={gu:b.gu,choki:b.choki,pa:b.pa};
  if(S.lastMonHand)w[S.lastMonHand]*=0.4;   /* さっきと おなじ手は でにくい */
  const total=w.gu+w.choki+w.pa;let r=S.rand()*total;
  for(const id of['gu','choki','pa']){if(r<w[id])return id;r-=w[id];}
  return'pa';
}
const VSBAL={baseHp:1,baseAtk:1,hpPerStage:0.4,atkPerStage:0.26,bossHp:2.5,bossAtk:1.55,fh:[1,1,1,1,1],fa:[1,1,1,1,1],monMult:1.5,bossMonMult:1.9,
  poisonPct:0.09,poisonTurns:4,shieldCut:0.35,shieldTurns:3,hasteTurns:3,paraTurns:3,paraChance:0.32,healPct:0.32,healAtkMul:0.6};

function vsHeroSpeed(st){return 60/st.interval;}
function vsFreshStatus(){return {shieldT:0,hasteT:0,poisonT:0,poisonDmg:0,paraT:0,alive:true};}
function vsMakeHero(hero,slot){
  const st=heroStats(hero);
  return Object.assign({kind:'hero',slot:slot,hero:hero,name:hero.name,color:hero.skill,
    hp:st.hp,maxHp:st.hp,atk:st.atk,def:st.def,spd:vsHeroSpeed(st),crit:st.crit,
    moves:[VS_TACKLE,Object.assign({},SKILLS[hero.skill],VS_MULT_FIX[hero.skill]?{mult:VS_MULT_FIX[hero.skill]}:null)]},vsFreshStatus());
}
function vsMakeMon(type,isBoss,stageIdx){
  const s=STAGES[stageIdx],d=isBoss?s.boss:ENEMY_TYPES[type];
  const hpM=isBoss?VSBAL.bossHp*VSBAL.fh[stageIdx]:(1+VSBAL.hpPerStage*stageIdx)*VSBAL.baseHp;
  const atkM=isBoss?VSBAL.bossAtk*VSBAL.fa[stageIdx]:(1+VSBAL.atkPerStage*stageIdx)*VSBAL.baseAtk;
  const hp=Math.max(6,Math.round(d.hp*hpM));
  return Object.assign({kind:'mon',type:isBoss?d.type:type,isBoss:!!isBoss,name:d.name,
    color:VS_MON_COLOR[isBoss?d.type:type]||'black',
    spriteColor:isBoss?d.color:enemyColor(type,stageIdx),size:200*0.56*(d.scale||1),
    hp:hp,maxHp:hp,atk:Math.max(1,d.atk*atkM),def:d.def,spd:d.spd,
    moves:[Object.assign({},VS_TACKLE,{mult:isBoss?VSBAL.bossMonMult:VSBAL.monMult})]},vsFreshStatus());
}
function vsCreate(party,queue,isBoss,stageIdx,seed){
  return {rand:mulberry32(seed>>>0),stageIdx:stageIdx,isBoss:!!isBoss,
    heroes:party.map((h,i)=>vsMakeHero(h,i)),active:0,
    queue:queue.slice(),idx:-1,mon:null,total:queue.length,defeated:0,
    turn:0,result:null,janken:null,lastMonHand:null};
}
function vsCurHero(S){return S.heroes[S.active];}
function vsAliveHeroes(S){return S.heroes.filter(h=>h.alive);}
function vsNextMon(S){
  S.idx++;
  if(S.idx>=S.queue.length){S.mon=null;return null;}
  S.mon=vsMakeMon(S.queue[S.idx],S.isBoss,S.stageIdx);
  S.lastMonHand=null;   /* あいてが かわったら てのくせよみを リセット */
  return S.mon;
}
function vsSwitchTo(S,slot){
  const h=S.heroes[slot];
  if(!h||!h.alive)return false;
  S.active=slot;
  return true;
}

function vsDmg(S,atkU,defU,move){
  const raw=atkU.atk*(move.mult||1)*(0.9+S.rand()*0.2);
  const soften=raw*(1-defU.def/(defU.def+24));
  const tm=vsTypeMult(move.color||atkU.color,defU.color);
  const crit=S.rand()<(atkU.crit||0.05);
  let d=soften*tm*(crit?1.7:1);
  if(defU.shieldT>0)d*=(1-VSBAL.shieldCut);
  return {dmg:Math.max(1,Math.round(d)),crit:crit,tm:tm};
}
function vsApplyMove(S,ev,atkU,defU,move){
  const kind=move.kind;
  if(kind==='smash'||kind==='aoe'||kind==='thunder'){
    const r=vsDmg(S,atkU,defU,move);
    defU.hp=Math.max(0,defU.hp-r.dmg);
    ev.push({t:'hit',unit:defU,amount:r.dmg,crit:r.crit,tm:r.tm,hpAfter:defU.hp});
    if(kind==='thunder'&&defU.hp>0&&defU.paraT<=0&&S.rand()<VSBAL.paraChance){
      defU.paraT=VSBAL.paraTurns;ev.push({t:'status',unit:defU,text:'しびれて うごきにくく なった！'});
    }
  }else if(kind==='poison'){
    if(defU.hp>0){
      const r=vsDmg(S,atkU,defU,{mult:0.7,color:move.color});
      defU.hp=Math.max(0,defU.hp-r.dmg);
      ev.push({t:'hit',unit:defU,amount:r.dmg,crit:r.crit,tm:r.tm,hpAfter:defU.hp});
      if(defU.hp>0&&defU.poisonT<=0){
        defU.poisonT=VSBAL.poisonTurns;defU.poisonDmg=Math.max(1,Math.round(atkU.atk*0.32));
        ev.push({t:'status',unit:defU,text:'どくを あびた！'});
      }
    }
  }else if(kind==='haste'){
    atkU.hasteT=VSBAL.hasteTurns;ev.push({t:'buff',unit:atkU,text:atkU.name+'は すばやく なった！'});
  }else if(kind==='shield'){
    atkU.shieldT=VSBAL.shieldTurns;ev.push({t:'buff',unit:atkU,text:atkU.name+'は みを まもった！'});
  }else if(kind==='heal'){
    const amt=Math.max(1,Math.round(atkU.maxHp*VSBAL.healPct+atkU.atk*VSBAL.healAtkMul));
    const before=atkU.hp;atkU.hp=Math.min(atkU.maxHp,atkU.hp+amt);
    ev.push({t:'heal',unit:atkU,amount:atkU.hp-before,hpAfter:atkU.hp});
  }
}
function vsTickStatus(S,ev,u){
  if(!u.alive)return;
  if(u.poisonT>0){
    u.poisonT--;
    if(u.hp>0){
      u.hp=Math.max(0,u.hp-u.poisonDmg);
      ev.push({t:'poison',unit:u,amount:u.poisonDmg,hpAfter:u.hp});
    }
  }
  if(u.shieldT>0)u.shieldT--;
  if(u.hasteT>0)u.hasteT--;
}
function vsFaintCheck(S,ev,u){
  if(u.alive&&u.hp<=0){u.alive=false;ev.push({t:'ko',unit:u});return true;}
  return false;
}

/* こうどう いっかい分（ムーブ or こうたい）を まとめる */
function vsAct(S,ev,side,action){
  if(side==='hero'){
    const h=vsCurHero(S);
    if(action.type==='switch'){vsSwitchTo(S,action.slot);ev.push({t:'switch',unit:vsCurHero(S)});return;}
    const move=h.moves[action.idx||0];
    if(h.paraT>0&&S.rand()<VSBAL.paraChance){ev.push({t:'para',unit:h});return;}
    ev.push({t:'move',unit:h,move:move});
    vsApplyMove(S,ev,h,S.mon,move);
  }else{
    const m=S.mon;if(!m||!m.alive)return;
    const move=m.moves[0];
    if(m.paraT>0&&S.rand()<VSBAL.paraChance){ev.push({t:'para',unit:m});return;}
    ev.push({t:'move',unit:m,move:move});
    vsApplyMove(S,ev,m,vsCurHero(S),move);
  }
}
/* 1ラウンド：プレイヤーの こうどうを うけとって、けっかの できごとを かえす */
function vsRound(S,heroAction){
  const ev=[];
  if(S.result)return ev;
  const hero=vsCurHero(S),mon=S.mon;
  if(heroAction.type==='switch'){
    /* こうたいは ジャンケンに かんけいなく いつも せいこうする。あいての こうげきは そのまま とんでくる */
    vsAct(S,ev,'hero',heroAction);
    if(mon&&mon.alive&&hero.alive)vsAct(S,ev,'mon',null);
    if(vsFaintCheck(S,ev,mon))S.defeated++;
    vsFaintCheck(S,ev,hero);
  }else{
    const jk=S.janken;S.janken=null;   /* このターンの ジャンケンけっかは 1かいだけ つかう */
    if(jk==='win'){
      vsAct(S,ev,'hero',heroAction);
      if(vsFaintCheck(S,ev,mon))S.defeated++;
    }else if(jk==='lose'){
      vsAct(S,ev,'mon',null);
      vsFaintCheck(S,ev,hero);
    }else{
      /* あいこ：りょうほう こうげきする（はやいほうが さきに）*/
      const heroFirst=(hero.hasteT>0&&mon.hasteT<=0)?true:(mon.hasteT>0&&hero.hasteT<=0)?false:hero.spd>=mon.spd;
      const order=heroFirst?[['hero',heroAction],['mon',null]]:[['mon',null],['hero',heroAction]];
      for(const [side,action] of order){
        if(side==='hero'&&!hero.alive)continue;
        if(side==='mon'&&(!mon||!mon.alive))continue;
        vsAct(S,ev,side,action);
        if(vsFaintCheck(S,ev,mon)){S.defeated++;break;}
        if(vsFaintCheck(S,ev,hero))break;
      }
    }
  }
  if(mon&&mon.alive&&hero.alive){vsTickStatus(S,ev,hero);vsTickStatus(S,ev,mon);vsFaintCheck(S,ev,mon)&&S.defeated++;vsFaintCheck(S,ev,hero);}
  S.turn++;
  if(mon&&!mon.alive){
    if(S.idx+1<S.queue.length){ev.push({t:'nextFoeReady'});}
    else{S.result={win:true};ev.push({t:'end',win:true});}
  }else if(!hero.alive){
    if(vsAliveHeroes(S).length>0)ev.push({t:'needSwitch'});
    else{S.result={win:false};ev.push({t:'end',win:false});}
  }
  return ev;
}
function vsRunAway(S){S.result={win:null};return [{t:'ran'}];}

/* オートせん用の かんたんな AI */
function vsAutoChoice(hero){
  const kind=hero.moves[1].kind;
  if(kind==='heal')return hero.hp<hero.maxHp*0.55?1:0;
  if(kind==='haste')return hero.hasteT<=0?1:0;
  if(kind==='shield')return hero.shieldT<=0?1:0;
  return 1;
}
function vsAutoSwitch(S){
  const alive=vsAliveHeroes(S);
  return alive.length?alive[0].slot:-1;
}

/* =====================================================================
   せんとう（描画・演出） … 3D(Three.js) と 2D(Canvas) の両対応
   ・シミュレーション(S)は共通。見た目だけを切りかえる
   ・エフェクト/ダメージ数字/HUD は「ワールド座標→画面座標」に変換して上にかさねる
   ===================================================================== */
const cv=$('#stageCv'),ctx=cv.getContext('2d');
const glCv=$('#glCv'),wrap=$('#stageWrap');
const B={S:null,stageIdx:0,stage:STAGES[0],auto:false,speed:1,acc:0,finished:false,resultShown:false,result:null,cards:[],mode:'3d',puffy:true,field:null};
const R={t:0,scroll:0,fx:[],texts:[],banner:null,shake:0,flash:0,zoom:0,camX:400,camZ:640};
const GL={tried:false,ok:false,on:false,renderer:null,scene:null,camera:null,amb:null,sun:null,v:null,
  bg:null,stage:null,units:new Map(),projs:[],tex:new WeakMap(),lastW:0,lastH:0,avg:0,frames:0,reduced:false,warned:false};
let rafId=0,lastTs=0;

const STARS=[];{const r=rng(99);for(let i=0;i<46;i++)STARS.push({x:r()*W,y:r()*230,r:0.8+r()*1.8,p:r()*6});}
const CLOUDS=[{x:60,y:60,s:1},{x:260,y:110,s:0.8},{x:470,y:50,s:1.2},{x:640,y:120,s:0.9},{x:820,y:70,s:1.1},{x:980,y:105,s:0.8}];

/* ---- ステッカー（白ぶちつきの絵）---- */
function makeSticker(src,radius){
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
  const pad=radius+2;
  const out=document.createElement('canvas');out.width=w+pad*2;out.height=h+pad*2;
  const oc=out.getContext('2d');
  const sil=document.createElement('canvas');sil.width=w;sil.height=h;
  const sc=sil.getContext('2d');
  sc.drawImage(src,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle='#fff';sc.fillRect(0,0,w,h);
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    oc.drawImage(sil,pad+Math.cos(a)*radius,pad+Math.sin(a)*radius);
  }
  oc.drawImage(src,pad,pad);
  return {cv:out,pad:pad,w:w,h:h};
}
const heroArt={};
function heroArtFor(hero){
  let a=heroArt[hero.img];
  if(!a){const im=new Image();a={im:im,st:null};im.src=hero.img;heroArt[hero.img]=a;}
  if(!a.st&&a.im.complete&&a.im.naturalWidth){
    try{a.filled=fillHoles(a.im);a.st=makeSticker(a.filled,4);a.pf=puffSource(a.filled);}catch(e){a.st=null;}
  }
  return a;
}
const spStickers=new WeakMap();
function spriteSticker(spr){
  let st=spStickers.get(spr);
  if(!st){st=makeSticker(spr,3);spStickers.set(spr,st);}
  return st;
}

/* ---- 線画の すきまを うめる（中が すけないように）---- */
function boxDilate(m,w,h,R,outside){
  const tmp=new Uint8Array(w*h),out=new Uint8Array(w*h);
  const pre=new Int32Array(Math.max(w,h)+1);
  for(let y=0;y<h;y++){
    pre[0]=0;for(let x=0;x<w;x++)pre[x+1]=pre[x]+m[y*w+x];
    for(let x=0;x<w;x++){
      const lo=x-R,hi=x+R;
      if(outside&&(lo<0||hi>=w)){tmp[y*w+x]=1;continue;}
      const a=Math.max(lo,0),b=Math.min(hi,w-1);
      tmp[y*w+x]=(pre[b+1]-pre[a])>0?1:0;
    }
  }
  for(let x=0;x<w;x++){
    pre[0]=0;for(let y=0;y<h;y++)pre[y+1]=pre[y]+tmp[y*w+x];
    for(let y=0;y<h;y++){
      const lo=y-R,hi=y+R;
      if(outside&&(lo<0||hi>=h)){out[y*w+x]=1;continue;}
      const a=Math.max(lo,0),b=Math.min(hi,h-1);
      out[y*w+x]=(pre[b+1]-pre[a])>0?1:0;
    }
  }
  return out;
}
function fillHoles(src){
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');g.drawImage(src,0,0);
  let id;
  try{id=g.getImageData(0,0,w,h);}catch(e){return c;}
  const d=id.data,n=w*h,R=3;
  const m0=new Uint8Array(n);
  for(let i=0;i<n;i++)m0[i]=d[i*4+3]>=100?1:0;
  const m1=boxDilate(m0,w,h,R,0);                 /* すきま(3px)を ふさぐ */
  const reach=new Uint8Array(n),stk=new Int32Array(n);let sp=0;
  const push=i=>{if(!reach[i]&&!m1[i]){reach[i]=1;stk[sp++]=i;}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(sp>0){
    const i=stk[--sp],x=i%w,y=(i/w)|0;
    if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);
  }
  const notInside=new Uint8Array(n);
  for(let i=0;i<n;i++)notInside[i]=reach[i]?1:0;    /* 外から たどりつけた = 外がわ */
  const shrunk=boxDilate(notInside,w,h,R,1);         /* ふくらませた ぶんを もとに もどす */
  for(let i=0;i<n;i++){
    if(shrunk[i])continue;
    const a=d[i*4+3];
    if(a>=255)continue;
    const t=a/255,j=i*4;
    d[j]=d[j]*t+255*(1-t);d[j+1]=d[j+1]*t+254*(1-t);d[j+2]=d[j+2]*t+249*(1-t);d[j+3]=255;
  }
  g.putImageData(id,0,0);
  return c;
}

/* ---- ぷっくり立体（ふうせん みたいに ふくらませる）---- */
const PUFF=0.95;
function distField(mask,w,h){                       /* 外がわまでの きょり(px) */
  const INF=1e9,d=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)d[i]=mask[i]?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(!d[i])continue;
    let v=d[i];
    if(x>0)v=Math.min(v,d[i-1]+3);
    if(y>0){v=Math.min(v,d[i-w]+3);if(x>0)v=Math.min(v,d[i-w-1]+4);if(x<w-1)v=Math.min(v,d[i-w+1]+4);}
    d[i]=v;
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const i=y*w+x;if(!d[i])continue;
    let v=d[i];
    if(x<w-1)v=Math.min(v,d[i+1]+3);
    if(y<h-1){v=Math.min(v,d[i+w]+3);if(x<w-1)v=Math.min(v,d[i+w+1]+4);if(x>0)v=Math.min(v,d[i+w-1]+4);}
    d[i]=v;
  }
  for(let i=0;i<w*h;i++)d[i]=d[i]>=INF/2?0:d[i]/3;
  return d;
}
function blurField(f,w,h,r){
  const tmp=new Float32Array(w*h),pre=new Float32Array(Math.max(w,h)+1);
  for(let y=0;y<h;y++){
    pre[0]=0;for(let x=0;x<w;x++)pre[x+1]=pre[x]+f[y*w+x];
    for(let x=0;x<w;x++){const a=Math.max(0,x-r),b=Math.min(w-1,x+r);tmp[y*w+x]=(pre[b+1]-pre[a])/(b-a+1);}
  }
  for(let x=0;x<w;x++){
    pre[0]=0;for(let y=0;y<h;y++)pre[y+1]=pre[y]+tmp[y*w+x];
    for(let y=0;y<h;y++){const a=Math.max(0,y-r),b=Math.min(h-1,y+r);f[y*w+x]=(pre[b+1]-pre[a])/(b-a+1);}
  }
}
function puffSource(src){
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height,P=3;
  const cv=document.createElement('canvas');cv.width=w+P*2;cv.height=h+P*2;
  cv.getContext('2d').drawImage(src,P,P);
  return {cv:cv,pad:P,w:w,h:h};
}
const spPuff=new WeakMap();
function puffSpriteFor(spr){
  let p=spPuff.get(spr);
  if(!p){p=puffSource(spr);spPuff.set(spr,p);}
  return p;
}
function buildPuffData(st){
  if(st.puff)return st.puff;
  const cv=st.cv,cw=cv.width,ch=cv.height,n=cw*ch;
  const mask=new Uint8Array(n);
  try{
    const d=cv.getContext('2d').getImageData(0,0,cw,ch).data;
    for(let i=0;i<n;i++)mask[i]=d[i*4+3]>=110?1:0;
  }catch(e){}
  const dist=distField(mask,cw,ch);
  blurField(dist,cw,ch,2);
  const R=clamp(Math.min(st.w,st.h)*0.3,8,34);        /* ふちの まるみ（px）*/
  const iw=cw+1,ii=new Int32Array(iw*(ch+1));         /* 積分画像：セルに えが あるか しらべる */
  for(let y=0;y<ch;y++){let row=0;for(let x=0;x<cw;x++){row+=mask[y*cw+x];ii[(y+1)*iw+x+1]=ii[y*iw+x+1]+row;}}
  const cell=Math.max(4,Math.ceil(Math.max(cw,ch)/44));
  const GX=Math.ceil(cw/cell),GY=Math.ceil(ch/cell),nvG=(GX+1)*(GY+1);
  const px=new Float32Array(nvG),py=new Float32Array(nvG),hgt=new Float32Array(nvG),rowOf=new Uint16Array(nvG);
  for(let j=0;j<=GY;j++)for(let i=0;i<=GX;i++){
    const k=j*(GX+1)+i,x=Math.min(cw,i*cell),y=Math.min(ch,j*cell);
    px[k]=x;py[k]=y;rowOf[k]=j;
    const dd=dist[Math.min(ch-1,y)*cw+Math.min(cw-1,x)],t=Math.min(1,dd/R);
    hgt[k]=R*Math.sqrt(Math.max(0,1-(1-t)*(1-t)));
  }
  const front=[];
  for(let j=0;j<GY;j++)for(let i=0;i<GX;i++){
    const x0=i*cell,x1=Math.min(cw,x0+cell),y0=j*cell,y1=Math.min(ch,y0+cell);
    const cnt=ii[y1*iw+x1]-ii[y0*iw+x1]-ii[y1*iw+x0]+ii[y0*iw+x0];
    if(!cnt)continue;
    const a=j*(GX+1)+i,b=a+1,c=a+GX+1,d=c+1;
    front.push(a,c,b,b,c,d);
  }
  const L=front.length,idx=new Uint16Array(L*2);
  for(let k=0;k<L;k+=3){
    idx[k]=front[k];idx[k+1]=front[k+1];idx[k+2]=front[k+2];
    idx[L+k]=front[k]+nvG;idx[L+k+1]=front[k+2]+nvG;idx[L+k+2]=front[k+1]+nvG;
  }
  st.puff={cw:cw,ch:ch,nvG:nvG,px:px,py:py,hgt:hgt,rowOf:rowOf,idx:idx,rows:GY+1,tris:L/3};
  return st.puff;
}
function makePuffy(st,sc,footOff){
  const pd=buildPuffData(st),nvG=pd.nvG,nv=nvG*2;
  const pos=new Float32Array(nv*3),uv=new Float32Array(nv*2),vrow=new Uint16Array(nv);
  for(let k=0;k<nvG;k++){
    const x=pd.px[k],y=pd.py[k],hh=pd.hgt[k]*sc*PUFF;
    const X=(x-pd.cw/2)*sc,Y=(pd.ch-y)*sc-st.pad*sc-footOff;
    const u=x/pd.cw,v=1-y/pd.ch,f=k*3,b=(nvG+k)*3;
    pos[f]=X;pos[f+1]=Y;pos[f+2]=hh;
    pos[b]=X;pos[b+1]=Y;pos[b+2]=-hh*0.85;
    uv[k*2]=u;uv[k*2+1]=v;uv[(nvG+k)*2]=u;uv[(nvG+k)*2+1]=v;
    vrow[k]=pd.rowOf[k];vrow[nvG+k]=pd.rowOf[k];
  }
  const geo=new THREE.BufferGeometry();
  const pa=new THREE.BufferAttribute(pos,3);pa.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position',pa);
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geo.setIndex(new THREE.BufferAttribute(pd.idx,1));
  geo.computeVertexNormals();
  const mat=new THREE.MeshLambertMaterial({map:texFor(st.cv),alphaTest:0.4,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;
  const group=new THREE.Group();group.add(mesh);
  const shadow=new THREE.Mesh(GL.shadowGeo,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  shadow.rotation.x=-Math.PI/2;
  return {group:group,geo:geo,base:Float32Array.from(pos),mats:[mat],shadow:shadow,rows:pd.rows,vrow:vrow,bodyH:st.h*sc,w:st.w*sc,h:st.h*sc,bubble:null,puffy:true};
}

/* ---- 位置（ワールド座標：x=よこ, y=たかさ, z=おくゆき）---- */
const FORM_Z=[12,-48,38];   // 3Dでの ならびかた（まえ・うしろ・てまえ）
function zOf(u){return u.kind==='hero'?(GL.on?FORM_Z[u.slot%3]:-u.slot*25):u.yOff*3.5;}
function vis(u){
  if(!u.v)u.v={ph:Math.random()*6,atk:0,atkDur:0.35,hit:0,cast:0,dead:0,lastW:0,h:0};
  return u.v;
}
function centerW(u){
  if(u.kind==='hero')return [u.x,(vis(u).h||104)/2,zOf(u)];
  return [u.x,u.fly+u.size*0.4,zOf(u)];
}
function topW(u){
  if(u.kind==='hero')return [u.x,(vis(u).h||104)+8,zOf(u)];
  return [u.x,u.fly+u.size*0.95,zOf(u)];
}
function feetY(u){return u.kind==='hero'?338-u.slot*7:338+u.yOff;}   // 2D用
function heroColor(u){return PAL[u.skillId].hex;}

/* ワールド → 画面(800x400)。[x,y,ちかさ]。3Dならカメラで、2Dなら平行移動で */
function project(x,y,z){
  if(GL.on){
    const c=GL.camera,v=GL.v.set(x,y,z);
    const dx=x-c.position.x,dy=y-c.position.y,dz=z-c.position.z;
    const dist=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    v.project(c);
    return [(v.x+1)/2*W,(1-v.y)/2*H,640/dist];
  }
  return [x,338-y+z*0.28,1];
}
/* こうげきの たま（ワールド座標） */
function projW(p){
  const u=p.from,c=centerW(p.target),q=Math.min(1,p.t);
  return [lerp(u.x+30,c[0],q),lerp(55,c[1],q)+Math.sin(q*Math.PI)*50,lerp(zOf(u),c[2],q)];
}

/* ---- フロー ---- */
function startBattle(si,opts){
  if(!state.party.length)return;
  cancelAnimationFrame(rafId);
  closeModal();
  opts=opts||null;
  const seed=(Math.random()*4294967296)>>>0;
  const S=createSim(state.party,si,seed,opts);
  S.auto=B.auto;
  B.S=S;B.stageIdx=si;B.stage=STAGES[si];B.field=(opts&&opts.field)?opts:null;B.acc=0;B.finished=false;B.resultShown=false;B.result=null;
  R.t=0;R.scroll=0;R.fx=[];R.texts=[];R.banner=null;R.shake=0;R.flash=0;R.zoom=0;R.camX=400;R.camZ=640;
  buildCards();
  $('#stageTitle').textContent=(B.field?'たんけん　':'')+'STAGE '+(si+1)+'　'+STAGES[si].name;
  $('#autoBtn').classList.toggle('on',B.auto);
  $('#speedBtn').textContent='×'+B.speed;
  mountWrap('battle');
  show('battle');
  if(opts&&opts.boss)sndScene('boss');
  setMode(B.mode);
  lastTs=performance.now();
  rafId=requestAnimationFrame(loop);
}
function leaveBattle(){
  cancelAnimationFrame(rafId);F.pending=null;
  closeModal();clearUnits3D();renderHome();show('home');
}
function closeModal(){const m=$('#modal');m.hidden=true;m.innerHTML='';}

function buildCards(){
  const box=$('#cards');box.innerHTML='';B.cards=[];
  B.S.units.filter(u=>u.kind==='hero').forEach(u=>{
    const hpFill=mk('i'),skFill=mk('i'),hpn=mk('div',{class:'hpn'});
    const btn=mk('button',{class:'card',type:'button'},
      mk('img',{alt:'',src:u.hero.img}),
      validItem(u.hero.item)?mk('img',{class:'citem',alt:u.hero.item.name,title:u.hero.item.name,src:u.hero.item.img}):document.createTextNode(''),
      mk('div',{class:'cname',text:u.name}),
      mk('div',{class:'bar'},hpFill),
      hpn,
      mk('div',{class:'bar sk'},skFill),
      mk('div',{class:'csk',text:SKILLS[u.skillId].name})
    );
    btn.addEventListener('click',()=>{if(B.S)simInput(B.S,u);});
    B.cards.push({u:u,btn:btn,hp:hpFill,sk:skFill,hpn:hpn});
    box.append(btn);
  });
}
function updateCards(){
  const S=B.S;if(!S)return;
  for(const c of B.cards){
    const u=c.u;
    c.hp.style.width=clamp(u.hp/u.maxHp,0,1)*100+'%';
    c.sk.style.width=u.gauge+'%';
    c.hpn.textContent=Math.max(0,Math.ceil(u.hp))+' / '+u.maxHp;
    c.btn.classList.toggle('ready',canSkill(S,u));
    c.btn.classList.toggle('dead',!u.alive);
  }
}

/* ---- けっか（けいけんち・レベルアップ）---- */
function giveExp(gain){
  const rows=[];
  state.party.forEach(hero=>{
    const before=hero.lv;
    if(hero.lv<MAX_LV){
      hero.exp+=gain;
      while(hero.lv<MAX_LV&&hero.exp>=expNeed(hero.lv)){hero.exp-=expNeed(hero.lv);hero.lv++;}
      if(hero.lv>=MAX_LV)hero.exp=0;
    }
    rows.push({hero:hero,before:before,after:hero.lv});
  });
  return rows;
}
function applyRewards(){
  const S=B.S,res=S.result,win=res.win,fld=B.field;
  let gain;
  if(fld&&!fld.boss)gain=win?Math.round((8+5*S.stageIdx)*(0.7+0.3*fld.waves[0].length)):Math.round(3+2*S.stageIdx);
  else gain=win?(40+20*(S.stageIdx+1)):(12+6*res.reached);
  const rows=giveExp(gain);
  let unlocks=[];
  if(win&&(!fld||fld.boss)&&S.stageIdx===state.cleared&&state.cleared<STAGES.length){
    state.cleared++;
    unlocks=PALETTE.filter(p=>p.unlock===state.cleared);
  }
  save();
  B.result={win:win,gain:gain,rows:rows,unlocks:unlocks};
}
function showResult(){
  const r=B.result;if(!r)return;
  sndScene('none');sfx(r.win?'win':'lose');
  if(r.rows.some(x=>x.after>x.before))setTimeout(()=>sfx('levelup'),1000);
  const m=$('#modal');m.innerHTML='';
  const si=B.S.stageIdx,fld=B.field,lastStage=si===STAGES.length-1;
  const panel=mk('div',{class:'panel',role:'dialog','aria-modal':'true'});
  let title,sub;
  if(fld){
    if(fld.boss&&r.win){title='ボスを たおした！';sub=lastStage?'ラクガキだいまおうを たおした！ ラクガキ王国に へいわが もどったよ！':'「'+STAGES[si].name+'」を クリア！';}
    else if(r.win){title='しょうり！';sub='てきを やっつけた！ フィールドへ もどろう。';}
    else{title='ざんねん…';sub='みんな たおれちゃった…。スタートちかくへ もどるよ。でも けいけんちは もらえたよ。';}
  }else{
    title=r.win?'クリア！':'ざんねん…';
    sub=r.win?(lastStage?'ラクガキだいまおうを たおした！ ラクガキ王国に へいわが もどったよ！':'「'+STAGES[si].name+'」を クリア！'):'みんな たおれちゃった…。でも けいけんちは もらえたよ。';
  }
  panel.append(
    mk('h2',{class:'rtitle',text:title}),
    mk('p',{class:'rsub',text:sub}),
    mk('p',{class:'rexp',text:'けいけんち +'+r.gain})
  );
  const list=mk('div',{class:'rlist'});
  r.rows.forEach(row=>{
    const up=row.after>row.before;
    const txt=mk('span',{text:up?row.hero.name+'　Lv.'+row.before+' → Lv.'+row.after+'！':row.hero.name+'　Lv.'+row.after});
    if(up)txt.className='up';
    list.append(mk('div',{class:'rrow'},mk('img',{alt:'',src:row.hero.img}),txt));
  });
  panel.append(list);
  r.unlocks.forEach(p=>panel.append(mk('p',{class:'runlock',text:'あたらしい えのぐ「'+p.name+'」が つかえるよ！'})));
  if(!r.win&&!fld)panel.append(mk('p',{class:'rtip',text:'ヒント：なかまを ふやしたり、ちがう いろで かいてみよう！'}));
  const btns=mk('div',{class:'rbtns'});
  if(fld){
    if(fld.boss&&r.win&&si+1<STAGES.length)btns.append(mk('button',{class:'btn primary',type:'button',text:'つぎの たんけんへ',onclick:()=>enterField(si+1)}));
    btns.append(mk('button',{class:(fld.boss&&r.win&&si+1<STAGES.length)?'btn':'btn primary',type:'button',text:'フィールドへ もどる',onclick:()=>returnToField(r.win)}));
    btns.append(mk('button',{class:'btn',type:'button',text:'おしろへ もどる',onclick:leaveBattle}));
  }else{
    if(r.win&&si+1<STAGES.length)btns.append(mk('button',{class:'btn primary',type:'button',text:'つぎのステージへ',onclick:()=>startBattle(si+1)}));
    btns.append(mk('button',{class:'btn',type:'button',text:'もういちど',onclick:()=>startBattle(si)}));
    btns.append(mk('button',{class:'btn',type:'button',text:'おしろへ もどる',onclick:leaveBattle}));
  }
  panel.append(btns);
  m.append(panel);m.hidden=false;
}

/* ---- メインループ ---- */
function loop(ts){
  rafId=requestAnimationFrame(loop);
  const raw=(ts-lastTs)/1000;
  const real=Math.min(0.05,Math.max(0,raw)||0);lastTs=ts;
  const S=B.S;if(!S)return;
  B.acc+=real*B.speed;
  let steps=0;
  while(B.acc>=DT&&steps<8){simTick(S);B.acc-=DT;steps++;}
  if(steps>=8)B.acc=0;
  processEvents();
  updateVisuals(real*B.speed);
  if(S.result&&!B.finished){B.finished=true;applyRewards();}
  if(B.finished&&!B.resultShown&&S.endT>1.2){B.resultShown=true;showResult();}
  if(!$('#battle').classList.contains('active'))return;
  if(GL.on)perfCheck(raw);
  render();updateCards();
}
/* 3Dがおもいときは、しぜんに かるくする */
function perfCheck(dt){
  if(!(dt>0)||dt>0.5)return;
  GL.avg=GL.avg?GL.avg*0.95+dt*0.05:dt;
  GL.frames++;
  if(GL.frames===150&&GL.avg>0.034&&!GL.reduced){
    GL.reduced=true;GL.renderer.setPixelRatio(1);GL.lastW=0;
  }else if(GL.frames===400&&GL.avg>0.034&&!GL.warned){
    GL.warned=true;toast('おもいときは 「3D」ボタンで 2Dに かえられるよ');
  }
}

/* ---- エフェクト（ワールド座標）---- */
function addText(x,y,z,txt,color,size){R.texts.push({x:x,y:y,z:z,txt:txt,color:color||'#fff',size:size||22,t:0,life:0.9});}
function burst(x,y,z,color,n,spread){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,sp=(0.4+Math.random())*(spread||160);
    R.fx.push({k:'p',x:x,y:y,z:z,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp+80,t:0,life:0.5+Math.random()*0.3,size:3+Math.random()*4,color:color});
  }
}
function ring(x,y,z,color,r,life){R.fx.push({k:'ring',x:x,y:y,z:z,t:0,life:life||0.5,color:color,r:r});}
function stepDust(x,z){
  for(let i=0;i<2;i++)R.fx.push({k:'dust',x:x+(i?10:-10),y:2,z:z,t:0,life:0.4});
}
function processEvents(){
  const S=B.S;
  for(const ev of S.events){
    switch(ev.e){
      case 'wave':
        R.banner={text:ev.boss?'ボス とうじょう！\n'+B.stage.boss.name:(B.field?'バトル かいし！':'WAVE '+(ev.idx+1)),t:0,dur:ev.boss?2.2:1.4};
        if(ev.boss){R.zoom=1;sfx('boss');sndScene('boss');}else sfx('wave');
        break;
      case 'attack':{const v=vis(ev.u);v.atk=v.atkDur=0.34;sfx('shot');break;}
      case 'swing':{const v=vis(ev.u);v.atk=v.atkDur=0.42;sfx('swing');break;}
      case 'hit':{
        const u=ev.u,v=vis(u),c=centerW(u),t=topW(u);
        v.hit=0.28;
        if(u.kind==='hero')sfx('hurt');else if(ev.crit)sfx('crit');else if(!ev.poison)sfx('hit');
        if(u.kind==='hero'){
          addText(u.x,t[1]+4,c[2],String(ev.dmg),'#ff5a5a',22);
          burst(c[0],c[1],c[2],'#ff8a8a',4,120);
          R.shake=Math.max(R.shake,4);
        }else{
          addText(u.x+(Math.random()-0.5)*20,c[1]+u.size*0.3,c[2],String(ev.dmg),ev.crit?'#ff3b3b':(ev.poison?'#c084fc':'#fff'),ev.crit?30:(ev.poison?17:22));
          burst(c[0],c[1],c[2],ev.poison?'#c084fc':'#fff',ev.poison?2:5,140);
        }
        break;
      }
      case 'kill':{
        const u=ev.u,c=centerW(u);
        if(u.kind==='mon')dexRecord(u.spriteType,u.boss,u.name);
        sfx(u.kind==='hero'?'down':'kill');
        if(u.kind==='hero'){burst(c[0],c[1],c[2],'#ccc',12,200);}
        else{
          burst(c[0],c[1],c[2],'#ffd23f',14,240);
          ring(c[0],c[1],c[2],'#fff',60,0.5);
          addText(c[0],c[1]+u.size*0.5,c[2],'ぽふっ','#ffd23f',20);
          if(u.boss){R.shake=14;R.zoom=1;}
        }
        break;
      }
      case 'enrage':
        sfx('enrage');
        R.banner={text:'ボスが おこった！',t:0,dur:1.3};R.shake=10;
        break;
      case 'heal':{
        const u=ev.u,c=centerW(u),t=topW(u);
        addText(u.x,t[1]+6,c[2],'+'+ev.amt,'#7ee081',20);
        if(u.kind==='hero')burst(c[0],c[1],c[2],'#ff9ccd',5,130);
        break;
      }
      case 'fizzle':{
        const q=projW(ev.p);
        burst(q[0],q[1],q[2],heroColor(ev.p.from),4,90);
        break;
      }
      case 'skill':{
        const u=ev.u,v=vis(u),col=heroColor(u),sk=SKILLS[u.skillId],uc=topW(u);
        v.cast=0.6;
        addText(u.x,uc[1]+26,uc[2],sk.name+'！',col==='#2a2a2e'?'#fff':col,26);
        R.zoom=Math.max(R.zoom,0.6);
        sfx(ev.kind);
        if(ev.kind==='smash'){
          const c=centerW(ev.targets[0]);
          ring(c[0],c[1],c[2],col,90,0.5);burst(c[0],c[1],c[2],col,18,300);
          R.shake=Math.max(R.shake,9);R.flash=0.25;
        }else if(ev.kind==='aoe'){
          ev.targets.forEach(t=>{const c=centerW(t);ring(c[0],c[1],c[2],col,80,0.55);burst(c[0],c[1],c[2],col,14,260);});
          R.shake=Math.max(R.shake,10);R.flash=0.25;
        }else if(ev.kind==='thunder'){
          ev.targets.forEach(t=>{
            const c=centerW(t),pts=[];let x=t.x,y=380;
            const endY=Math.max(0,c[1]-t.size*0.4);
            while(y>endY+30){pts.push([x,y,c[2]]);x=t.x+(Math.random()-0.5)*40;y-=42;}
            pts.push([t.x,endY,c[2]]);
            R.fx.push({k:'bolt',pts:pts,t:0,life:0.35});
          });
          R.shake=Math.max(R.shake,8);R.flash=0.3;
        }else if(ev.kind==='poison'){
          ev.targets.forEach(t=>{const c=centerW(t);burst(c[0],c[1],c[2],'#c084fc',10,120);});
        }else if(ev.kind==='haste'||ev.kind==='shield'){
          const cc=ev.kind==='haste'?'#7ee081':'#7fb8ff';
          ev.targets.forEach(t=>{const c=centerW(t);burst(c[0],c[1],c[2],cc,10,160);});
        }
        break;
      }
      default:break;
    }
  }
  S.events.length=0;
}
function updateVisuals(vdt){
  const S=B.S;
  R.t+=vdt;
  if(S.phase==='walk')R.scroll+=150*vdt;
  R.shake=Math.max(0,R.shake-40*vdt);R.flash=Math.max(0,R.flash-vdt);R.zoom=Math.max(0,R.zoom-vdt*1.6);
  /* カメラ：ぶつかっている ところへ すこし よる */
  let tx=400,tz=640;
  if(S.phase==='fight'){
    let ex=null;
    for(const u of S.units){if(u.kind==='mon'&&u.alive&&(ex===null||u.x<ex))ex=u.x;}
    const fh=S.units.find(u=>u.kind==='hero'&&u.alive);
    if(ex!==null&&fh)tx=400+clamp(((fh.x+Math.min(ex,760))/2-400)*0.45,-45,45);
    tz=600;
  }else if(S.phase==='won'||S.phase==='lost')tz=575;
  const kk=1-Math.exp(-vdt*2.2);
  R.camX+=(tx-R.camX)*kk;R.camZ+=(tz-R.camZ)*kk;
  if(R.banner){R.banner.t+=vdt;if(R.banner.t>R.banner.dur)R.banner=null;}
  for(const f of R.fx){
    f.t+=vdt;
    if(f.k==='p'){f.vy-=600*vdt;f.x+=f.vx*vdt;f.y=Math.max(0,f.y+f.vy*vdt);}
  }
  R.fx=R.fx.filter(f=>f.t<f.life);
  for(const t of R.texts){t.t+=vdt;t.y+=38*vdt;}
  R.texts=R.texts.filter(t=>t.t<t.life);
  for(const u of S.units){
    const v=vis(u);
    v.atk=Math.max(0,v.atk-vdt);v.hit=Math.max(0,v.hit-vdt);v.cast=Math.max(0,v.cast-vdt);
    if(!u.alive)v.dead+=vdt;
  }
}

/* =====================================================================
   ぷるぷる動くポーズ（2D・3D共通）
   ===================================================================== */
function easeOut(k){return 1-Math.pow(1-k,3);}
function attackPose(p,dir,reach){
  if(p<0.4){
    const k=easeOut(p/0.4);
    return {lean:-0.2*k*dir,ox:-8*k*dir,sx:1+0.08*k,sy:1-0.1*k};
  }
  const k=(p-0.4)/0.6,e=Math.sin(k*Math.PI),back=1-k;
  return {lean:(0.3*e-0.2*back)*dir,ox:(-8*back+reach*e)*dir,sx:1+0.08*back-0.1*e,sy:1-0.1*back+0.14*e};
}
function poseFor(u){
  const S=B.S,v=vis(u),hero=u.kind==='hero',dir=hero?1:-1;
  const p={ox:0,oy:0,rot:0,spin:0,sx:1,sy:1,lean:0,wob:0.25,alpha:1,ph:v.ph};
  const bob=Math.sin(R.t*4+v.ph);
  p.sx=1-bob*0.03;p.sy=1+bob*0.04;
  let moving=false,freq=10,hop=11;
  if(hero)moving=u.alive&&S.phase==='walk';
  else if(u.alive){moving=!u.arrived&&u.stun<=0;freq=u.fly?6:8;hop=u.fly?3:6;}
  if(moving){
    const w=Math.sin(R.t*freq+v.ph);
    p.oy-=Math.abs(w)*hop;p.rot=w*(hero?0.09:0.07);p.wob=0.55;
    if(Math.abs(w)<0.18)p.sy*=0.92;
    if(!u.fly&&v.lastW>0&&w<=0)stepDust(u.x,zOf(u));
    v.lastW=w;
  }
  if(!hero&&u.fly){p.oy-=u.fly;p.oy+=Math.sin(R.t*3+v.ph)*8;}
  if(v.atk>0){
    const q=attackPose(1-v.atk/v.atkDur,dir,hero?24:26);
    p.lean+=q.lean;p.ox+=q.ox;p.sx*=q.sx;p.sy*=q.sy;p.wob=Math.max(p.wob,0.6);
  }
  if(v.hit>0){
    const q=v.hit/0.28;
    p.ox-=dir*12*q;p.wob=Math.max(p.wob,1.3*q+0.3);p.sx*=1+0.15*q;p.sy*=1-0.15*q;
    if(Math.floor(v.hit*40)%2===0)p.alpha=0.45;
  }
  if(hero&&v.cast>0){
    const q=1-v.cast/0.6;
    p.oy-=Math.sin(q*Math.PI)*34;p.spin=q*Math.PI*2;
  }
  if(!hero&&u.alive&&u.stun>0){p.ox+=Math.sin(R.t*45)*2.5;p.wob=1.2;}
  if(!u.alive){
    if(hero){
      p.ox=0;p.oy=0;p.lean=0;p.spin=0;p.sx=1;p.sy=1;p.wob=0;
      p.rot=Math.min(1,v.dead*4)*Math.PI*0.45;p.alpha=0.5;
    }else{
      const q=clamp(v.dead/0.5,0,1);
      p.lean=0;p.wob=0;p.alpha=1-q;p.sx=1+0.3*q;p.sy=1-0.5*q;
    }
  }
  return p;
}

/* =====================================================================
   2Dモード（フォールバック）
   ===================================================================== */
function outlineText(txt,x,y,size,fill,stroke,align){
  ctx.font=size+'px '+FONT;ctx.textAlign=align||'center';ctx.textBaseline='middle';
  ctx.lineJoin='round';ctx.lineWidth=Math.max(3,size/5);ctx.strokeStyle=stroke||'#fff';
  ctx.strokeText(txt,x,y);ctx.fillStyle=fill;ctx.fillText(txt,x,y);
}
function drawCloud(x,y,s,night){
  const c=ctx;
  const parts=[[0,0,26],[28,-10,32],[60,0,26],[30,8,26]];
  c.lineWidth=5;c.strokeStyle=night?'rgba(20,10,50,.5)':INK;
  parts.forEach(p=>{c.beginPath();c.arc(x+p[0]*s,y+p[1]*s,p[2]*s,0,Math.PI*2);c.stroke();});
  c.fillStyle=night?'#6e5fa8':'#ffffff';
  parts.forEach(p=>{c.beginPath();c.arc(x+p[0]*s,y+p[1]*s,p[2]*s,0,Math.PI*2);c.fill();});
}
function hill(par,base,amp,color){
  const c=ctx,off=R.scroll*par;
  c.beginPath();c.moveTo(0,GROUND);
  for(let x=0;x<=W;x+=10){
    const wx=x+off;
    const y=GROUND-base-(Math.sin(wx*0.007)*amp*0.6+Math.sin(wx*0.017+1.3)*amp*0.4+amp*0.5);
    c.lineTo(x,y);
  }
  c.lineTo(W,GROUND);c.closePath();c.fillStyle=color;c.fill();c.lineWidth=3;c.strokeStyle=INK;c.stroke();
}
function drawDeco(s){
  const c=ctx,step=71,base=Math.floor(R.scroll/step);
  c.lineWidth=3;c.strokeStyle=INK;c.lineJoin='round';c.lineCap='round';
  for(let i=0;i<14;i++){
    const idx=base+i,hs=hashInt(idx*7+3);
    const x=idx*step-R.scroll+(hs%40),y=GROUND+16+((hs>>3)%56);
    if(s.deco==='tuft'){
      c.beginPath();c.moveTo(x-7,y);c.lineTo(x-3,y-11);c.lineTo(x,y);c.lineTo(x+3,y-14);c.lineTo(x+6,y);c.lineTo(x+10,y-9);c.stroke();
    }else if(s.deco==='rock'){
      c.fillStyle='rgba(0,0,0,.14)';c.beginPath();c.ellipse(x,y,12,7,0,0,Math.PI*2);c.fill();c.stroke();
    }else if(s.deco==='snow'){
      c.fillStyle='#fff';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();c.stroke();
    }else{
      c.fillStyle='#ff8a3d';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();c.stroke();
    }
  }
}
function drawBackground(){
  const s=B.stage,c=ctx;
  const g=c.createLinearGradient(0,0,0,GROUND);g.addColorStop(0,s.sky[0]);g.addColorStop(1,s.sky[1]);
  c.fillStyle=g;c.fillRect(0,0,W,H);
  if(s.night){
    c.fillStyle='#fff';
    for(const st of STARS){
      c.globalAlpha=0.3+0.55*(0.5+0.5*Math.sin(R.t*2+st.p));
      c.beginPath();c.arc(st.x,st.y,st.r,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
  }
  c.beginPath();c.arc(660,74,34,0,Math.PI*2);c.fillStyle=s.orb;c.fill();c.lineWidth=3;c.strokeStyle=INK;c.stroke();
  const span=W+300;
  for(const cl of CLOUDS){
    const x=(((cl.x-R.scroll*0.12-R.t*5)%span)+span)%span-150;
    drawCloud(x,cl.y,cl.s,s.night);
  }
  hill(0.25,120,50,s.hill1);
  hill(0.5,70,38,s.hill2);
  c.fillStyle=s.ground;c.fillRect(0,GROUND,W,H-GROUND);
  c.strokeStyle=INK;c.lineWidth=4;c.beginPath();c.moveTo(0,GROUND);c.lineTo(W,GROUND);c.stroke();
  drawDeco(s);
}
function drawShadow(x,y,rx,alpha){
  ctx.fillStyle='rgba(0,0,0,'+alpha+')';ctx.beginPath();ctx.ellipse(x,y+2,Math.max(2,rx),8,0,0,Math.PI*2);ctx.fill();
}
function drawJelly(st,sc,x,y,pose){
  const c=ctx,N=14;
  const cw=st.cv.width,ch=st.cv.height;
  const fw=cw*sc,fh=ch*sc,bodyH=st.h*sc;
  const topY=-(st.h+st.pad)*sc;
  const sh=ch/N,dh=fh/N;
  c.save();
  c.translate(x+pose.ox,y+pose.oy);
  c.rotate(pose.rot);
  if(pose.spin){c.translate(0,-bodyH/2);c.rotate(pose.spin);c.translate(0,bodyH/2);}
  c.scale(pose.sx,pose.sy);
  c.globalAlpha=pose.alpha;
  for(let i=0;i<N;i++){
    const hf=1-(i+0.5)/N;
    const off=pose.lean*bodyH*Math.pow(hf,1.4)+Math.sin(R.t*9-hf*3+pose.ph)*pose.wob*bodyH*0.035*hf;
    c.drawImage(st.cv,0,i*sh,cw,Math.min(sh+0.6,ch-i*sh),-fw/2+off,topY+i*dh,fw,dh+0.7);
  }
  c.restore();
}
const itemArt={};
function itemImgFor(it){
  if(!validItem(it))return null;
  let im=itemArt[it.img];
  if(!im){im=new Image();im.src=it.img;itemArt[it.img]=im;}
  return (im.complete&&im.naturalWidth)?im:null;
}
function drawItem2D(u,pose,feet,dw,dh){
  const im=itemImgFor(u.hero.item);
  if(!im)return;
  const k=Math.min(38/im.naturalWidth,38/im.naturalHeight,1.6),w=im.naturalWidth*k,h=im.naturalHeight*k;
  const bob=Math.sin(R.t*3+u.slot)*2;
  ctx.save();
  ctx.globalAlpha=u.alive?1:0.4;
  ctx.drawImage(im,u.x+pose.ox+dw/2-w*0.35,feet+pose.oy-dh*0.28-h/2+bob,w,h);
  ctx.restore();
}
function drawHero2D(u){
  const S=B.S,art=heroArtFor(u.hero);
  if(!art.st)return;
  const st=art.st,feet=feetY(u);
  const sc=Math.min(112/st.w,104/st.h,1.6),dw=st.w*sc,dh=st.h*sc;
  vis(u).h=dh;
  const pose=poseFor(u);
  drawShadow(u.x,feet,dw*0.4*(1+pose.oy/60),u.alive?0.22:0.12);
  drawJelly(st,sc,u.x,feet,pose);
  drawItem2D(u,pose,feet,dw,dh);
  if(S.buff[u.side].shield>0&&u.alive){
    const c=ctx;
    c.save();c.translate(u.x+pose.ox,feet+pose.oy);
    c.strokeStyle='rgba(60,140,255,.85)';c.lineWidth=4;c.fillStyle='rgba(90,160,255,.16)';
    c.beginPath();c.ellipse(0,-dh/2,dw/2+12,dh/2+10,0,0,Math.PI*2);c.fill();c.stroke();
    c.restore();
  }
}
function drawMonster2D(u){
  const feet=feetY(u);
  const spr=getSprite(u.spriteType,u.color,u.boss);
  const st=spriteSticker(spr);
  const pose=poseFor(u);
  drawShadow(u.x,feet,u.size*0.32,u.alive?0.22:0.1);
  drawJelly(st,u.size/200,u.x,feet+u.size*0.05,pose);
}
function render2D(){
  const c=ctx,S=B.S;
  c.save();
  if(R.shake>0)c.translate((Math.random()-0.5)*R.shake,(Math.random()-0.5)*R.shake);
  drawBackground();
  const mons=S.units.filter(u=>u.kind==='mon').sort((a,b)=>b.x-a.x);
  for(const u of mons)drawMonster2D(u);
  const heroes=S.units.filter(u=>u.kind==='hero');
  for(let i=heroes.length-1;i>=0;i--)drawHero2D(heroes[i]);
  drawExtras();drawFxLayer();
  c.restore();
  drawHUD();
}

/* =====================================================================
   画面にかさねる部分（2D・3D共通）
   ===================================================================== */
function drawStar(x,y,r,rot,fill){
  const c=ctx;
  c.beginPath();
  for(let i=0;i<10;i++){const rad=i%2?r*0.45:r,a=rot+i*Math.PI/5;c.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad);}
  c.closePath();c.fillStyle=fill;c.fill();c.lineWidth=3;c.strokeStyle=INK;c.lineJoin='round';c.stroke();
}
function drawExtras(){
  const c=ctx,S=B.S;
  for(const u of S.units){
    if(u.kind!=='mon'||!u.alive)continue;
    const t=topW(u),q=project(t[0],t[1],t[2]),sc=clamp(q[2],0.6,1.4),cy=q[1];
    if(u.hp<u.maxHp&&!u.boss){
      const bw=44*sc;
      c.fillStyle='rgba(0,0,0,.55)';c.fillRect(q[0]-bw/2-1,cy-9*sc,bw+2,9*sc);
      c.fillStyle='#ff5a5a';c.fillRect(q[0]-bw/2,cy-8*sc,bw*clamp(u.hp/u.maxHp,0,1),7*sc);
    }
    if(u.stun>0){
      for(let i=0;i<3;i++){const a=R.t*5+i*2.1;outlineText('★',q[0]+Math.cos(a)*22*sc,cy+4+Math.sin(a)*6,16*sc,'#ffd23f',INK);}
    }
    if(u.poisonT>0){
      c.fillStyle='rgba(180,110,240,.85)';
      for(let i=0;i<3;i++){c.beginPath();c.arc(q[0]-14*sc+i*14*sc,cy+8-((R.t*30+i*11)%20),3.5*sc,0,Math.PI*2);c.fill();}
    }
  }
}
function drawFxLayer(){
  const c=ctx,S=B.S;
  if(!GL.on){
    for(const p of S.projs){
      const w=projW(p),q=project(w[0],w[1],w[2]);
      drawStar(q[0],q[1],p.crit?15:11,R.t*12+p.raw,heroColor(p.from));
    }
  }
  for(const f of R.fx){
    const a=clamp(1-f.t/f.life,0,1);c.globalAlpha=a;
    if(f.k==='bolt'){
      c.lineJoin='round';c.strokeStyle='#fff36b';c.lineWidth=9;
      c.beginPath();
      f.pts.forEach((p,i)=>{const q=project(p[0],p[1],p[2]);if(i)c.lineTo(q[0],q[1]);else c.moveTo(q[0],q[1]);});
      c.stroke();c.strokeStyle='#fff';c.lineWidth=3;c.stroke();
    }else{
      const q=project(f.x,f.y,f.z),sc=clamp(q[2],0.6,1.4);
      if(f.k==='p'){
        c.fillStyle=f.color;c.beginPath();c.arc(q[0],q[1],f.size*sc*(0.5+0.5*a),0,Math.PI*2);c.fill();
      }else if(f.k==='ring'){
        c.strokeStyle=f.color;c.lineWidth=6*a+1;c.beginPath();c.arc(q[0],q[1],(f.r*(1-a)+10)*sc,0,Math.PI*2);c.stroke();
      }else if(f.k==='dust'){
        c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(q[0],q[1]-3,(4+9*(1-a))*sc,0,Math.PI*2);c.fill();
      }
    }
    c.globalAlpha=1;
  }
  for(const t of R.texts){
    const q=project(t.x,t.y,t.z),sc=clamp(q[2],0.75,1.3);
    c.globalAlpha=clamp(1-Math.pow(t.t/t.life,2),0,1);
    const pop=t.t<0.12?1+(0.12-t.t)*4:1;
    outlineText(t.txt,q[0],q[1],t.size*pop*sc,t.color,INK);
  }
  c.globalAlpha=1;
}
function drawHUD(){
  const c=ctx,S=B.S,total=S.waves.length+(S.boss?1:0);
  const isBoss=S.boss&&S.waveIdx>=S.waves.length;
  outlineText(isBoss?'BOSS':'WAVE '+Math.max(1,S.waveIdx+1)+' / '+total,14,22,20,'#fff',INK,'left');
  let y=48;
  const b=S.buff.L;
  if(b.haste>0){outlineText('⚡ こうげき はやい '+Math.ceil(b.haste),14,y,15,'#b8ffb0',INK,'left');y+=22;}
  if(b.shield>0){outlineText('🛡 ダメージ へる '+Math.ceil(b.shield),14,y,15,'#b8dcff',INK,'left');y+=22;}
  const boss=S.units.find(e=>e.boss&&e.alive);
  if(boss){
    const bw=300,bx=(W-bw)/2,by=14;
    c.fillStyle='rgba(20,20,30,.75)';c.fillRect(bx-3,by-3,bw+6,20);
    c.fillStyle='#e5383b';c.fillRect(bx,by,bw*clamp(boss.hp/boss.maxHp,0,1),14);
    c.strokeStyle=INK;c.lineWidth=2;c.strokeRect(bx-3,by-3,bw+6,20);
    outlineText(boss.name,W/2,by+30,16,'#fff',INK);
  }
  if(R.banner){
    const bn=R.banner,p=bn.t/bn.dur;
    const a=p<0.15?p/0.15:(p>0.8?(1-p)/0.2:1);
    c.globalAlpha=clamp(a,0,1);
    const lines=bn.text.split('\n');
    const pop=p<0.15?0.8+p/0.15*0.2:1;
    lines.forEach((ln,i)=>outlineText(ln,W/2,150+i*52,(i===0?46:34)*pop,'#fff36b',INK));
    c.globalAlpha=1;
  }
  if(R.flash>0){c.fillStyle='rgba(255,255,255,'+R.flash*1.2+')';c.fillRect(0,0,W,H);}
}

/* =====================================================================
   3Dモード（Three.js）… 紙工作のジオラマ
   ・キャラは「厚みのある切りぬき」。ぷるぷる変形は頂点を動かしている
   ・かげは板ポリ、光は2つだけ、影マップなし → かるい
   ===================================================================== */
function initGL(){
  if(GL.ok)return true;
  if(typeof THREE==='undefined'){GL.reason='lib';return false;}
  if(GL.tried)return GL.ok;
  GL.tried=true;
  try{
    const r=new THREE.WebGLRenderer({canvas:glCv,antialias:true,alpha:false});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    r.setClearColor(0x87ceeb,1);
    GL.renderer=r;
    GL.scene=new THREE.Scene();
    GL.camera=new THREE.PerspectiveCamera(36,2,10,5000);
    GL.v=new THREE.Vector3();
    GL.shadowGeo=new THREE.CircleGeometry(1,20);
    GL.limbGeo=new THREE.SphereGeometry(1,12,9);
    GL.amb=new THREE.AmbientLight(0xffffff,0.72);GL.scene.add(GL.amb);
    GL.sun=new THREE.DirectionalLight(0xffffff,0.55);GL.sun.position.set(300,600,500);GL.scene.add(GL.sun);
    glCv.addEventListener('webglcontextlost',ev=>{
      ev.preventDefault();GL.ok=false;
      if(GL.on){setMode('2d');toast('3Dが とまったので 2Dに きりかえたよ');}
    });
    GL.ok=true;
  }catch(e){GL.ok=false;GL.reason='webgl';}
  return GL.ok;
}
function updateModeBtn(){
  const btn=$('#modeBtn'),note=$('#modeNote');
  btn.hidden=false;
  btn.textContent=GL.on?(B.puffy?'ぷっくり3D':'切りぬき3D'):'2D';
  btn.classList.toggle('on',GL.on);
  let msg='';
  if(!GL.on){
    if(GL.reason==='lib')msg=GL.loading?'3Dを よみこみ中…（それまで 2Dで ひょうじ）':'3Dの ライブラリが よみこめなかったので 2Dで ひょうじ中';
    else if(GL.reason==='webgl')msg='この たんまつでは WebGLが つかえないので 2Dで ひょうじ中';
  }
  note.textContent=msg;note.hidden=!msg;
  const lib=(typeof THREE==='undefined')?(GL.loading?'よみこみ中':'なし'):(GL.tried&&!GL.ok?'WebGLなし':'OK');
  $('#verLabel').textContent='v5.4　3D：'+lib;
}
/* ライブラリが よみこめなかったときの 2つめの きょてん */
function ensureThree(){
  if(typeof THREE!=='undefined'){GL.reason='';return;}
  GL.reason='lib';GL.loading=true;
  const done=ok=>{
    GL.loading=false;
    if(ok&&typeof THREE!=='undefined'){
      GL.reason='';B.mode='3d';
      if(B.S&&$('#battle').classList.contains('active'))setMode('3d');else updateModeBtn();
    }else updateModeBtn();
  };
  const sc=document.createElement('script');
  sc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
  sc.onload=()=>done(true);sc.onerror=()=>done(false);
  document.head.appendChild(sc);
}
function setMode(m){
  if(m==='3d'&&!initGL()){toast('3Dが つかえないので 2Dで ひょうじするよ');m='2d';}
  B.mode=m;GL.on=(m==='3d');
  wrap.classList.toggle('mode2d',!GL.on);
  updateModeBtn();
  clearUnits3D();
  if(GL.on){buildStage3D();sizeGL(true);}
}
function sizeGL(force){
  const cw=glCv.clientWidth,ch=glCv.clientHeight;
  if(!cw||!ch)return;
  if(force||cw!==GL.lastW||ch!==GL.lastH){
    GL.renderer.setSize(cw,ch,false);
    GL.camera.aspect=cw/ch;GL.camera.updateProjectionMatrix();
    if(typeof F!=='undefined'&&F.cam){F.cam.aspect=cw/ch;F.cam.updateProjectionMatrix();}
    GL.lastW=cw;GL.lastH=ch;
  }
}
function disposeGroup(g){
  g.traverse(o=>{
    if(o.geometry)o.geometry.dispose();
    if(o.material){
      (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
        if(m.map&&m.map.__own)m.map.dispose();
        m.dispose();
      });
    }
  });
}
function canvasTex(c,own){
  const t=new THREE.CanvasTexture(c);
  t.__own=!!own;
  return t;
}

/* ---- 背景づくり ---- */
function makeGroundTex(s,plain,rep){
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const g=c.getContext('2d');
  g.fillStyle=s.ground;g.fillRect(0,0,512,256);
  if(!plain){g.fillStyle='rgba(0,0,0,.07)';for(let i=0;i<4;i++)g.fillRect(i*128+64,0,64,256);}
  const r=rng(hashStr(s.name));
  g.strokeStyle=INK;g.lineWidth=3;g.lineJoin='round';g.lineCap='round';
  for(let i=0;i<16;i++){
    const x=24+r()*464,y=20+r()*216;
    if(s.deco==='tuft'){
      g.beginPath();g.moveTo(x-7,y);g.lineTo(x-3,y-11);g.lineTo(x,y);g.lineTo(x+3,y-14);g.lineTo(x+6,y);g.lineTo(x+10,y-9);g.stroke();
    }else if(s.deco==='rock'){
      g.fillStyle='rgba(0,0,0,.14)';g.beginPath();g.ellipse(x,y,12,7,0,0,Math.PI*2);g.fill();g.stroke();
    }else if(s.deco==='snow'){
      g.fillStyle='#fff';g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();g.stroke();
    }else{
      g.fillStyle='#ff8a3d';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.fill();g.stroke();
    }
  }
  const t=canvasTex(c,true);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(rep?rep[0]:12,rep?rep[1]:9.4);
  try{const cap=GL.renderer.capabilities;if(cap&&cap.getMaxAnisotropy)t.anisotropy=Math.min(8,cap.getMaxAnisotropy());}catch(e){}   // ななめから見てもボケない
  return t;
}
function makeCloudTex(night){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const g=c.getContext('2d');
  const parts=[[70,70,34],[108,58,42],[148,70,34],[110,84,32]];
  g.lineWidth=7;g.strokeStyle=night?'rgba(20,10,50,.6)':INK;
  parts.forEach(p=>{g.beginPath();g.arc(p[0],p[1],p[2],0,Math.PI*2);g.stroke();});
  g.fillStyle=night?'#6e5fa8':'#ffffff';
  parts.forEach(p=>{g.beginPath();g.arc(p[0],p[1],p[2],0,Math.PI*2);g.fill();});
  return canvasTex(c,true);
}
function makeHill(base,amp,ph,color,z,par){
  const P=1200,span=4800;
  const shape=new THREE.Shape();
  shape.moveTo(0,-300);
  for(let x=0;x<=span;x+=40){
    const y=base+amp*(0.6*Math.sin(2*Math.PI*x/P+ph)+0.4*Math.sin(4*Math.PI*x/P+1.3+ph)+0.5);
    shape.lineTo(x,y);
  }
  shape.lineTo(span,-300);shape.lineTo(0,-300);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:20,bevelEnabled:false,steps:1});
  const grp=new THREE.Group();
  const edge=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x2a2a2e}));
  edge.position.set(0,5,-3);
  const body=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:color}));
  grp.add(edge,body);
  grp.position.set(-1900,0,z);
  return {grp:grp,par:par};
}
function makeProp(deco,night,i,r){
  const g=new THREE.Group();
  const lam=c=>new THREE.MeshLambertMaterial({color:c});
  if(deco==='tuft'){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(30,84,6),lam(night?0x4a3b86:0x3fae4f));cone.position.y=82;
    const cone2=new THREE.Mesh(new THREE.ConeGeometry(22,60,6),lam(night?0x5a4a9a:0x4fc25f));cone2.position.y=124;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(6,8,40,6),lam(0x7a4b2a));trunk.position.y=20;
    g.add(trunk,cone,cone2);
  }else if(deco==='rock'){
    if(i%2){
      const body=new THREE.Mesh(new THREE.CylinderGeometry(11,13,96,8),lam(0x5fae4a));body.position.y=48;
      const a1=new THREE.Mesh(new THREE.CylinderGeometry(7,7,34,8),lam(0x5fae4a));a1.position.set(-20,60,0);
      const a2=new THREE.Mesh(new THREE.CylinderGeometry(7,7,28,8),lam(0x5fae4a));a2.position.set(20,50,0);
      g.add(body,a1,a2);
    }else{
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(30,0),lam(0xb08a5a));rock.position.y=22;rock.scale.y=0.8;
      g.add(rock);
    }
  }else if(deco==='snow'){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(28,90,6),lam(0xe9f6ff));cone.position.y=48;
    const ball=new THREE.Mesh(new THREE.SphereGeometry(16,10,8),lam(0xffffff));ball.position.y=100;
    g.add(cone,ball);
  }else{
    const cr=new THREE.Mesh(new THREE.OctahedronGeometry(26,0),new THREE.MeshLambertMaterial({color:0xff7a3d,emissive:0x66220a}));
    cr.position.y=30;cr.scale.y=1.6;
    g.add(cr);
  }
  return g;
}
function buildStage3D(){
  const s=B.stage,scene=GL.scene;
  if(GL.bg){scene.remove(GL.bg);disposeGroup(GL.bg);GL.bg=null;}
  if(scene.background&&scene.background.dispose){scene.background.dispose();}
  const bg=new THREE.Group();GL.bg=bg;scene.add(bg);
  const st={hills:[],clouds:[],props:[],stars:null,groundTex:null};
  GL.stage=st;

  /* そら（画面いっぱいのグラデーション） */
  const sk=document.createElement('canvas');sk.width=4;sk.height=256;
  const sg=sk.getContext('2d'),grad=sg.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,s.sky[0]);grad.addColorStop(0.65,s.sky[1]);grad.addColorStop(1,s.sky[1]);
  sg.fillStyle=grad;sg.fillRect(0,0,4,256);
  scene.background=canvasTex(sk,true);
  scene.fog=new THREE.Fog(new THREE.Color(s.sky[1]),1000,2600);
  GL.amb.intensity=s.night?0.5:0.72;

  /* たいよう / つき */
  const orbFill=new THREE.Mesh(new THREE.CircleGeometry(42,32),new THREE.MeshBasicMaterial({color:new THREE.Color(s.orb),fog:false}));
  const orbEdge=new THREE.Mesh(new THREE.RingGeometry(42,48,32),new THREE.MeshBasicMaterial({color:0x2a2a2e,fog:false}));
  orbFill.position.set(1060,514,-900);orbEdge.position.set(1060,514,-899);
  bg.add(orbFill,orbEdge);

  /* 星（よるのステージ） */
  if(s.night){
    const pts=new Float32Array(60*3),r=rng(7);
    for(let i=0;i<60;i++){pts[i*3]=-900+r()*2600;pts[i*3+1]=300+r()*550;pts[i*3+2]=-1400;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pts,3));
    const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:4,sizeAttenuation:false,transparent:true,fog:false}));
    bg.add(stars);st.stars=stars;
  }

  /* くも */
  const ctex=makeCloudTex(s.night);
  [{x:0,y:600,s:1},{x:430,y:470,s:0.8},{x:900,y:640,s:1.2},{x:1350,y:440,s:0.9},{x:1800,y:580,s:1.1},{x:2200,y:500,s:0.8}].forEach(cl=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(300*cl.s,150*cl.s),new THREE.MeshBasicMaterial({map:ctex,transparent:true,depthWrite:false,fog:false}));
    m.position.set(cl.x,cl.y,-1100);
    bg.add(m);st.clouds.push({m:m,x0:cl.x+900});
  });

  /* 山（紙をかさねたような3そう） */
  const nearColor=new THREE.Color(s.hill2).lerp(new THREE.Color(s.ground),0.55);
  [
    makeHill(175,35,0.4,new THREE.Color(s.hill1),-900,0.35),
    makeHill(105,35,2.1,new THREE.Color(s.hill2),-520,0.6),
    makeHill(45,25,4.0,nearColor,-260,0.85)
  ].forEach(h=>{bg.add(h.grp);st.hills.push(h);});

  /* じめん */
  const gt=makeGroundTex(s);st.groundTex=gt;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,2400),new THREE.MeshBasicMaterial({map:gt}));
  ground.rotation.x=-Math.PI/2;ground.position.set(400,0,-500);
  bg.add(ground);

  /* 木・岩・サボテンなど */
  for(let i=0;i<12;i++){
    const hs=hashInt(i*31+7);
    const g=makeProp(s.deco,s.night,i,rng(hs));
    g.position.z=-(200+(hs%250));
    g.scale.setScalar(0.85+((hs>>4)%30)/100);
    bg.add(g);
    st.props.push({g:g,bx:i*150+(hs%60)});
  }
}
function animateStage3D(){
  const st=GL.stage;if(!st)return;
  st.groundTex.offset.x=(R.scroll/500)%1;   // タイル1まい=500ワールド単位
  for(const h of st.hills)h.grp.position.x=-1900-((R.scroll*h.par)%1200);
  for(const c of st.clouds){
    const span=2600;
    c.m.position.x=(((c.x0-R.scroll*0.12-R.t*5)%span)+span)%span-900;
  }
  for(const p of st.props){
    const span=1800;
    p.g.position.x=(((p.bx-R.scroll)%span)+span)%span-350;
  }
  if(st.stars)st.stars.material.opacity=0.65+0.3*Math.sin(R.t*2);
}

/* ---- キャラ（厚みのある切りぬき） ---- */
function texFor(cvs){
  let t=GL.tex.get(cvs);
  if(!t){
    t=new THREE.CanvasTexture(cvs);
    t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;
    GL.tex.set(cvs,t);
  }
  return t;
}
function makeStandee(st,sc,footOff){
  const N=12,fw=st.cv.width*sc,fh=st.cv.height*sc;
  const geo=new THREE.PlaneGeometry(fw,fh,1,N);
  geo.translate(0,fh/2-st.pad*sc-footOff,0);
  const base=Array.from(geo.attributes.position.array);
  const vrow=new Uint16Array((N+1)*2);
  for(let r=0;r<=N;r++){vrow[r*2]=r;vrow[r*2+1]=r;}
  const tex=texFor(st.cv);
  const group=new THREE.Group(),mats=[];
  const LAYERS=4;
  for(let i=LAYERS-1;i>=0;i--){
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:false,alphaTest:0.4,side:THREE.DoubleSide,color:i===0?0xffffff:0x8a8a96});
    const m=new THREE.Mesh(geo,mat);
    m.position.z=-i*3.2;m.frustumCulled=false;
    group.add(m);mats.push(mat);
  }
  const shadow=new THREE.Mesh(GL.shadowGeo,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  shadow.rotation.x=-Math.PI/2;
  return {group:group,geo:geo,base:base,mats:mats,shadow:shadow,N:N,rows:N+1,vrow:vrow,bodyH:st.h*sc,w:st.w*sc,h:st.h*sc,bubble:null};
}
function makeHeroObj(hero){
  const art=heroArtFor(hero);
  if(!art.st)return null;
  const st=art.st,sc=Math.min(112/st.w,104/st.h,1.6);
  const o=(B.puffy&&art.pf)?makePuffy(art.pf,sc,0):makeStandee(st,sc,0);
  const lm=hero.limbs;
  if(GL.limbGeo&&lm&&(lm.hands||lm.feet))makeLimbs(o,analyzeLimbs(art),sc,lm);
  if(validItem(hero.item)&&typeof THREE!=='undefined'){
    try{
      const cv=document.createElement('canvas');cv.width=cv.height=64;
      const tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;
      const im=new Image();
      im.onload=()=>{const c=cv.getContext('2d'),k=Math.min(60/im.naturalWidth,60/im.naturalHeight);c.clearRect(0,0,64,64);c.drawImage(im,(64-im.naturalWidth*k)/2,(64-im.naturalHeight*k)/2,im.naturalWidth*k,im.naturalHeight*k);tex.needsUpdate=true;};
      im.src=hero.item.img;
      const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:0.1,side:THREE.DoubleSide});
      const m=new THREE.Mesh(new THREE.PlaneGeometry(36,36),mat);
      m.position.set(o.w/2+4,o.h*0.3,10);m.frustumCulled=false;
      o.group.add(m);o.itemMesh=m;o.itemTex=tex;
    }catch(e){}
  }
  return o;
}
function makeMonsterObj(spriteType,color,boss,size){
  const spr=getSprite(spriteType,color,boss);
  const o=B.puffy?makePuffy(puffSpriteFor(spr),size/200,size*0.05):makeStandee(spriteSticker(spr),size/200,size*0.05);
  o.w=size;o.h=size;
  return o;
}
function getObj3(u){
  let o=GL.units.get(u.id);
  if(o)return o;
  if(u.kind==='hero'){o=makeHeroObj(u.hero);if(!o)return null;vis(u).h=o.h;}
  else o=makeMonsterObj(u.spriteType,u.color,u.boss,u.size);
  GL.scene.add(o.group);GL.scene.add(o.shadow);
  GL.units.set(u.id,o);
  return o;
}
/* ---- 手足（ふわふわ うかぶ 手と あし）---- */
function analyzeLimbs(art){
  if(art.limb)return art.limb;
  const cv=art.filled,w=cv.width,h=cv.height;
  const spec={w:w,h:h,xl:w*0.05,xr:w*0.95,ymid:h*0.55,bl:w*0.28,br:w*0.72,yb:h-1,color:'rgb(58,58,68)'};
  let data=null;
  try{data=cv.getContext('2d').getImageData(0,0,w,h).data;}catch(e){}
  if(!data){art.limb=spec;return spec;}
  let r=0,g=0,b=0,n=0,yt=h,yb=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=data[i+3];
    if(a<128)continue;
    if(y<yt)yt=y;
    if(y>yb)yb=y;
    if(a<200)continue;
    const r0=data[i],g0=data[i+1],b0=data[i+2];
    if(0.299*r0+0.587*g0+0.114*b0>235)continue;   /* 紙いろは かぞえない */
    r+=r0;g+=g0;b+=b0;n++;
  }
  if(yb<0){art.limb=spec;return spec;}
  if(n>30){r/=n;g/=n;b/=n;}else{r=g=b=90;}
  if(0.299*r+0.587*g+0.114*b<55){r=g=b=68;}       /* まっくろだけは すこし あかるく */
  spec.color='rgb('+Math.round(r*0.92)+','+Math.round(g*0.92)+','+Math.round(b*0.92)+')';
  const bodyH=Math.max(1,yb-yt);
  const span=(y0,y1)=>{
    let lo=w,hi=-1;
    for(let y=Math.max(0,Math.round(y0));y<=Math.min(h-1,Math.round(y1));y++){
      for(let x=0;x<w;x++){if(data[(y*w+x)*4+3]>128){if(x<lo)lo=x;if(x>hi)hi=x;}}
    }
    return hi<0?null:[lo,hi];
  };
  const ym=yb-bodyH*0.42,mid=span(ym-3,ym+3),bot=span(yb-bodyH*0.1,yb);
  spec.yb=yb;spec.ymid=ym;
  if(mid){spec.xl=mid[0];spec.xr=mid[1];}
  if(bot&&bot[1]-bot[0]>6){spec.bl=bot[0]+(bot[1]-bot[0])*0.28;spec.br=bot[0]+(bot[1]-bot[0])*0.72;}
  else{spec.bl=spec.xl+(spec.xr-spec.xl)*0.3;spec.br=spec.xl+(spec.xr-spec.xl)*0.7;}
  art.limb=spec;
  return spec;
}
function makeLimbs(o,spec,sc,lm){
  const T=THREE,r=clamp(Math.max(spec.w,spec.h)*sc*0.085,6,13);
  const col=new T.Color(spec.color),parts=[];
  const mkp=(sx,sy,sz)=>{
    const g=new T.Group();
    const body=new T.Mesh(GL.limbGeo,new T.MeshLambertMaterial({color:col}));
    const out=new T.Mesh(GL.limbGeo,new T.MeshBasicMaterial({color:0x2a2a2e,side:T.BackSide}));
    out.scale.setScalar(1.22);
    g.add(out);g.add(body);g.scale.set(sx,sy,sz);
    o.group.add(g);parts.push(g);
    return g;
  };
  const cx=spec.w/2;
  const L={r:r,bodyH:o.bodyH,parts:parts,z:5};
  if(lm.hands){L.hL=mkp(r,r,r*0.9);L.hR=mkp(r,r,r*0.9);}
  if(lm.feet){L.fL=mkp(r*1.25,r*0.7,r*1.35);L.fR=mkp(r*1.25,r*0.7,r*1.35);}
  L.hxL=(spec.xl-cx)*sc-r*0.55;L.hxR=(spec.xr-cx)*sc+r*0.55;L.hy=(spec.h-spec.ymid)*sc;
  L.fxL=(spec.bl-cx)*sc;L.fxR=(spec.br-cx)*sc;L.fy=(spec.h-spec.yb)*sc+r*0.42;
  o.limbs=L;
}
function animLimbsCore(o,pose,st){
  const L=o.limbs;if(!L)return;
  const t=R.t,alive=st.alive,ph=st.ph,bodyH=L.bodyH;
  const roff=hf=>{const q=clamp(hf,0,1);return pose.lean*bodyH*Math.pow(q,1.4)+Math.sin(t*9-q*3+ph)*pose.wob*bodyH*0.035*q;};
  const hfH=L.hy/bodyH;
  let hLx=L.hxL,hLy=L.hy,hLz=L.z,hRx=L.hxR,hRy=L.hy,hRz=L.z;
  let fLx=L.fxL,fLy=L.fy,fRx=L.fxR,fRy=L.fy;
  const bob=Math.sin(t*3+ph)*1.8;
  hLy+=bob;hRy-=bob;
  if(st.walking){
    const w=Math.sin(t*10+ph),c=Math.cos(t*10+ph);
    hLy+=w*3;hRy-=w*3;hLz+=w*5;hRz-=w*5;
    fLx+=w*6;fRx-=w*6;
    fLy+=Math.max(0,c)*5;fRy+=Math.max(0,-c)*5;
  }
  if(st.atk>0){                                   /* なぐる：手を ひいて、ぐっと つきだす */
    const q=1-st.atk/st.atkDur;let ext,up;
    if(q<0.4){const k=easeOut(q/0.4);ext=-7*k;up=4*k;}
    else{const k=(q-0.4)/0.6,e=Math.sin(k*Math.PI);ext=-7*(1-k)+30*e;up=4*(1-k)+6*e;}
    hRx+=ext;hRy+=up;hLx-=ext*0.25;
  }
  if(st.hit>0){const k=st.hit/0.28;hLy+=9*k;hRy+=9*k;hLx-=5*k;hRx+=5*k;fLx-=3*k;fRx+=3*k;}
  if(st.cast>0){const q=1-st.cast/0.6,e=Math.sin(q*Math.PI);hLy+=bodyH*0.55*e;hRy+=bodyH*0.55*e;hLx+=4*e;hRx-=4*e;}
  if(!alive){hLy=L.r;hRy=L.r;hLx*=0.7;hRx*=0.7;}
  if(L.hL){L.hL.position.set(hLx+roff(hfH),hLy,hLz);L.hR.position.set(hRx+roff(hfH),hRy,hRz);}
  if(L.fL){L.fL.position.set(fLx,fLy,L.z+4);L.fR.position.set(fRx,fRy,L.z+4);}
}
function animLimbs(u,o,pose){
  if(!o.limbs)return;
  const v=vis(u);
  animLimbsCore(o,pose,{walking:u.alive&&B.S.phase==='walk',alive:u.alive,atk:v.atk,atkDur:v.atkDur,hit:v.hit,cast:v.cast,ph:v.ph});
}
function disposeObj3(o){
  GL.scene.remove(o.group);GL.scene.remove(o.shadow);
  o.geo.dispose();
  o.mats.forEach(m=>m.dispose());
  o.shadow.material.dispose();
  if(o.bubble){o.bubble.geometry.dispose();o.bubble.material.dispose();}
  if(o.itemMesh){o.itemMesh.geometry.dispose();o.itemMesh.material.dispose();if(o.itemTex)o.itemTex.dispose();}
  if(o.limbs)o.limbs.parts.forEach(g=>g.traverse(m=>{if(m.material)m.material.dispose();}));
}
function clearUnits3D(){
  if(!GL.scene)return;
  GL.units.forEach(o=>disposeObj3(o));
  GL.units.clear();
  for(const m of GL.projs){GL.scene.remove(m);m.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}
  GL.projs.length=0;
}
function applyPoseObj(o,pose,x,y,z,rotY){
  const g=o.group;
  g.position.set(x+pose.ox,y-pose.oy,z);
  g.rotation.set(0,rotY,-pose.rot);
  g.scale.set(pose.sx,pose.sy,1);
  /* ぷるぷる変形：うえの列ほど大きくゆらす */
  const arr=o.geo.attributes.position.array,base=o.base,rows=o.rows,vrow=o.vrow,bodyH=o.bodyH;
  const roff=o.roff||(o.roff=new Float32Array(rows));
  for(let r=0;r<rows;r++){
    const hf=1-r/(rows-1);
    roff[r]=pose.lean*bodyH*Math.pow(hf,1.4)+Math.sin(R.t*9-hf*3+pose.ph)*pose.wob*bodyH*0.035*hf;
  }
  for(let i=0,nv=vrow.length;i<nv;i++)arr[i*3]=base[i*3]+roff[vrow[i]];
  o.geo.attributes.position.needsUpdate=true;
  const tr=pose.alpha<1;
  for(const m of o.mats){m.opacity=pose.alpha;m.transparent=tr;}
}
function applyPose3D(u,o,pose){
  const hero=u.kind==='hero',g=o.group,wz=zOf(u);
  applyPoseObj(o,pose,u.x,0,wz,(hero?0.4:-0.4)+(pose.spin?pose.spin*(hero?1:-1):0));
  /* かげ */
  const rx=Math.max(2,(hero?o.w*0.4:u.size*0.32)*(1+pose.oy/60));
  o.shadow.position.set(u.x,0.6,wz);
  o.shadow.scale.set(rx,9,1);
  o.shadow.material.opacity=u.alive?0.22:0.1;
  /* シールドのあわ */
  if(hero){
    const on=B.S.buff[u.side].shield>0&&u.alive;
    if(on&&!o.bubble){
      o.bubble=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:0x5fa0ff,transparent:true,opacity:0.2,depthWrite:false}));
      o.bubble.position.y=o.h/2;o.bubble.scale.set(o.w/2+14,o.h/2+12,26);
      g.add(o.bubble);
    }
    if(o.bubble)o.bubble.visible=on;
    animLimbs(u,o,pose);
  }
}
function syncUnits3D(){
  const S=B.S,alive=new Set();
  for(const u of S.units){
    alive.add(u.id);
    const o=getObj3(u);
    if(!o)continue;
    applyPose3D(u,o,poseFor(u));
  }
  GL.units.forEach((o,id)=>{
    if(!alive.has(id)){disposeObj3(o);GL.units.delete(id);}
  });
}

/* ---- こうげきの星（3D） ---- */
function starShape(r){
  const sh=new THREE.Shape();
  for(let i=0;i<10;i++){
    const rad=i%2?r*0.45:r,a=-Math.PI/2+i*Math.PI/5;
    const x=Math.cos(a)*rad,y=Math.sin(a)*rad;
    if(i)sh.lineTo(x,y);else sh.moveTo(x,y);
  }
  sh.closePath();
  return sh;
}
function makeStarMesh(){
  const geo=new THREE.ExtrudeGeometry(starShape(11),{depth:5,bevelEnabled:false});
  geo.center();
  const grp=new THREE.Group();
  const edge=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x2a2a2e}));edge.scale.set(1.3,1.3,0.7);
  const fill=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff}));
  grp.add(edge,fill);
  grp.userData.fill=fill.material;
  return grp;
}
function updateProjs3D(){
  const S=B.S,pool=GL.projs;
  let i=0;
  for(const p of S.projs){
    let m=pool[i];
    if(!m){m=makeStarMesh();pool.push(m);GL.scene.add(m);}
    const w=projW(p);
    m.position.set(w[0],w[1],w[2]);
    m.rotation.set(0,R.t*6,R.t*10);
    m.scale.setScalar(p.crit?1.4:1);
    m.userData.fill.color.set(heroColor(p.from));
    m.visible=true;i++;
  }
  for(;i<pool.length;i++)pool[i].visible=false;
}

/* ---- カメラ ---- */
function updateCamera3D(){
  const cam=GL.camera;
  const sway=Math.sin(R.t*0.4)*10;
  cam.position.set(R.camX+sway,97+Math.sin(R.t*0.31)*3,R.camZ);
  if(R.shake>0){
    cam.position.x+=(Math.random()-0.5)*R.shake*1.2;
    cam.position.y+=(Math.random()-0.5)*R.shake*0.9;
  }
  cam.lookAt(R.camX+sway*0.3,137,0);
  cam.fov=36-R.zoom*3;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}
function render3D(){
  sizeGL(false);
  updateCamera3D();
  animateStage3D();
  syncUnits3D();
  updateProjs3D();
  GL.renderer.render(GL.scene,GL.camera);
  ctx.clearRect(0,0,W,H);
  drawExtras();drawFxLayer();drawHUD();
}
function render(){
  if(GL.on)render3D();else render2D();
}

/* =====================================================================
   おと（ファイルなし。WebAudioで その場で つくる）
   ・右上の ボタンで  全部あり ／ こうかおん だけ ／ ミュート
   ===================================================================== */
const SND_KEY='rakugaki-kingdom-sound';
const SND={ctx:null,master:null,sfx:null,bgm:null,noiseBuf:null,mode:2,last:{},want:'calm',cur:null,curName:'',step:0,nextT:0,timer:0};
try{const v=localStorage.getItem(SND_KEY);if(v!==null)SND.mode=clamp(parseInt(v,10)||0,0,2);}catch(e){}
const mtof=m=>440*Math.pow(2,(m-69)/12);

function sndInit(){
  if(SND.ctx)return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return false;
  try{
    const c=new AC();
    const comp=c.createDynamicsCompressor();
    comp.threshold.value=-14;comp.ratio.value=6;
    const master=c.createGain();master.gain.value=0.85;
    master.connect(comp);comp.connect(c.destination);
    const sfx=c.createGain();sfx.gain.value=SND.mode>=1?0.75:0;sfx.connect(master);
    const bgm=c.createGain();bgm.gain.value=SND.mode>=2?0.2:0;bgm.connect(master);
    const nb=c.createBuffer(1,c.sampleRate,c.sampleRate),d=nb.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    SND.ctx=c;SND.master=master;SND.sfx=sfx;SND.bgm=bgm;SND.noiseBuf=nb;
    return true;
  }catch(e){SND.ctx=null;return false;}
}
function sndUnlock(){
  if(!SND.ctx&&!sndInit())return;
  try{if(SND.ctx.state==='suspended')SND.ctx.resume();}catch(e){}
  if(SND.mode>=2&&SND.want&&!SND.curName)bgmPlay(SND.want);
}
['pointerdown','touchend','click','keydown'].forEach(ev=>document.addEventListener(ev,sndUnlock,{passive:true}));

function sndOn(){return !!SND.ctx&&SND.mode>=1&&SND.ctx.state!=='closed';}
function tone(f,dur,type,vol,o){
  if(!sndOn())return;
  o=o||{};
  const c=SND.ctx,t0=c.currentTime+(o.d||0);
  const osc=c.createOscillator(),g=c.createGain();
  osc.type=type||'sine';
  osc.frequency.setValueAtTime(f,t0);
  if(o.to)osc.frequency.exponentialRampToValueAtTime(Math.max(30,o.to),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+(o.a||0.008));
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  osc.connect(g);g.connect(o.dest||SND.sfx);
  osc.start(t0);osc.stop(t0+dur+0.03);
}
function noiseBurst(dur,vol,freq,o){
  if(!sndOn())return;
  o=o||{};
  const c=SND.ctx,t0=c.currentTime+(o.d||0);
  const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  src.buffer=SND.noiseBuf;
  f.type=o.type||'lowpass';f.frequency.setValueAtTime(freq,t0);
  if(o.to)f.frequency.exponentialRampToValueAtTime(Math.max(40,o.to),t0+dur);
  g.gain.setValueAtTime(Math.max(0.0002,vol),t0);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  src.connect(f);f.connect(g);g.connect(o.dest||SND.sfx);
  src.start(t0);src.stop(t0+dur+0.03);
}
const SFX_GAP={hit:40,crit:60,hurt:60,shot:70,swing:80,kill:60,tap:40};
const SFX={
  tap(){tone(720,0.06,'sine',0.18,{to:980});},
  shot(){tone(520,0.09,'triangle',0.1,{to:880});},
  hit(){noiseBurst(0.07,0.22,1800);tone(240,0.08,'triangle',0.2,{to:120});},
  crit(){noiseBurst(0.09,0.3,3000);tone(300,0.1,'square',0.14,{to:140});tone(1320,0.12,'square',0.09,{d:0.03});tone(1760,0.14,'sine',0.09,{d:0.07});},
  hurt(){noiseBurst(0.1,0.25,900);tone(170,0.14,'sawtooth',0.15,{to:70});},
  swing(){noiseBurst(0.08,0.12,2200,{type:'bandpass',to:600});},
  kill(){tone(420,0.14,'sine',0.2,{to:1100});noiseBurst(0.12,0.12,2500);},
  down(){tone(360,0.4,'triangle',0.2,{to:70});},
  wave(){noiseBurst(0.35,0.12,400,{type:'bandpass',to:2400});},
  boss(){tone(90,0.9,'sawtooth',0.2,{to:60});tone(140,0.9,'square',0.07,{to:90});noiseBurst(0.5,0.2,300);},
  enrage(){tone(110,0.5,'sawtooth',0.18,{to:220});},
  smash(){noiseBurst(0.2,0.35,1200);tone(140,0.25,'sawtooth',0.24,{to:50});tone(700,0.2,'square',0.09,{to:200});},
  aoe(){noiseBurst(0.5,0.35,900,{to:200});tone(90,0.5,'sawtooth',0.24,{to:40});},
  thunder(){noiseBurst(0.12,0.3,5000);tone(1400,0.25,'sawtooth',0.14,{to:120});tone(1000,0.25,'square',0.09,{to:90,d:0.06});},
  haste(){[523,659,784,1047].forEach((f,i)=>tone(f,0.12,'triangle',0.15,{d:i*0.06}));},
  shield(){tone(660,0.5,'sine',0.14);tone(990,0.5,'sine',0.1,{d:0.05});tone(1320,0.4,'sine',0.06,{d:0.1});},
  poison(){[300,260,220,190].forEach((f,i)=>tone(f,0.16,'sine',0.14,{d:i*0.08,to:f*0.8}));},
  heal(){[523,659,784].forEach((f,i)=>tone(f,0.3,'sine',0.16,{d:i*0.09}));tone(1568,0.4,'sine',0.08,{d:0.3});},
  encounter(){tone(880,0.12,'square',0.15);tone(660,0.16,'square',0.15,{d:0.11});tone(990,0.2,'square',0.13,{d:0.24});},
  chest(){[784,988,1175,1568].forEach((f,i)=>tone(f,0.18,'triangle',0.15,{d:i*0.07}));},
  levelup(){[523,659,784,1047,1319].forEach((f,i)=>tone(f,0.16,'triangle',0.16,{d:i*0.08}));},
  win(){[523,523,523,659,784,1047].forEach((f,i)=>tone(f,i===5?0.6:0.13,'square',0.12,{d:i*0.13}));},
  lose(){[392,349,311,262].forEach((f,i)=>tone(f,0.3,'triangle',0.15,{d:i*0.22}));}
};
function sfx(name){
  if(!sndOn())return;
  const now=performance.now(),gap=SFX_GAP[name]||30;
  if(now-(SND.last[name]||0)<gap)return;
  SND.last[name]=now;
  const fn=SFX[name];
  if(fn){try{fn();}catch(e){}}
}

/* ---- BGM（ちいさな くりかえしの きょく）---- */
function bgmNote(m,dur,type,vol,t,a){
  const d=Math.max(0,t-SND.ctx.currentTime);
  tone(mtof(m),dur,type,vol,{dest:SND.bgm,d:d,a:a||0.015});
}
function bgmHat(t,vol){noiseBurst(0.04,vol,7000,{type:'highpass',dest:SND.bgm,d:Math.max(0,t-SND.ctx.currentTime)});}
function bgmKick(t,vol){tone(130,0.12,'sine',vol,{to:45,dest:SND.bgm,d:Math.max(0,t-SND.ctx.currentTime)});}
const BGM_PATTERNS={
  calm:{bpm:92,len:32,play(s,t,dur){
    const bar=(s>>3)&3,roots=[48,43,45,41];
    if(s%4===0)bgmNote(roots[bar],dur*3.6,'triangle',0.34,t,0.02);
    if(s%2===0&&((s*7+bar)%5)!==0){const sc=[72,74,76,79,81,84];bgmNote(sc[(s*5+bar*3)%6],dur*1.9,'sine',0.17,t,0.02);}
  }},
  field:{bpm:84,len:32,play(s,t,dur){
    const bar=(s>>3)&3,roots=[53,48,50,46];
    if(s%8===0||s%8===4)bgmNote(roots[bar]-12,dur*3.7,'triangle',0.3,t,0.02);
    if(s%4===2){const sc=[65,67,69,72,74,77];bgmNote(sc[(s*3+bar*2)%6],dur*2.2,'sine',0.15,t,0.02);}
    if(s%8===6)bgmNote(roots[bar]+7,dur*1.4,'sine',0.1,t,0.02);
  }},
  battle:{bpm:140,len:32,play(s,t,dur){
    const bar=(s>>3)&3,roots=[45,41,43,40];
    bgmNote(roots[bar]-12+((s%4===2)?12:0),dur*0.9,'square',0.12,t,0.005);
    if(s%4===0)bgmKick(t,0.3);
    if(s%2===1)bgmHat(t,0.07);
    if([0,3,6,10,12,15,18,22,24,27,30].indexOf(s)>=0){const sc=[69,72,74,76,79];bgmNote(sc[(s+bar)%5],dur*1.4,'triangle',0.16,t);}
  }},
  boss:{bpm:152,len:32,play(s,t,dur){
    const bar=(s>>3)&3,roots=[38,34,36,33];
    bgmNote(roots[bar]-12+((s%2)?12:0),dur*0.85,'sawtooth',0.1,t,0.004);
    if(s%4===0||s%8===6)bgmKick(t,0.34);
    if(s%2===1)bgmHat(t,0.08);
    if([0,2,5,8,10,13,16,18,21,24,26,29].indexOf(s)>=0){const sc=[62,65,67,69,72];bgmNote(sc[(s*2+bar)%5],dur*1.2,'square',0.1,t);}
  }}
};
function bgmSchedule(){
  const c=SND.ctx,p=SND.cur;
  if(!c||!p||SND.mode<2||c.state!=='running')return;
  const stepDur=60/p.bpm/2;
  if(SND.nextT<c.currentTime)SND.nextT=c.currentTime+0.05;
  let guard=0;
  while(SND.nextT<c.currentTime+0.35&&guard++<8){
    p.play(SND.step%p.len,SND.nextT,stepDur);
    SND.nextT+=stepDur;SND.step++;
  }
}
function bgmPlay(name){
  if(!name){bgmStop();return;}
  if(!SND.ctx||SND.mode<2)return;
  if(SND.curName===name&&SND.cur)return;
  SND.cur=BGM_PATTERNS[name]||null;SND.curName=SND.cur?name:'';
  SND.step=0;SND.nextT=SND.ctx.currentTime+0.1;
  if(!SND.timer)SND.timer=setInterval(bgmSchedule,110);
}
function bgmStop(){SND.cur=null;SND.curName='';}
const BGM_MAP={home:'calm',dex:'calm',ach:'calm',draw:'calm',field:'field',battle:'battle',vs:'battle',boss:'boss'};
function sndScene(name){
  SND.want=BGM_MAP[name]||null;
  if(SND.ctx&&SND.mode>=2)bgmPlay(SND.want);
}
function updateSndBtn(){
  const b=$('#sndBtn');if(!b)return;
  b.textContent=SND.mode>=2?'🔊':(SND.mode===1?'🔉':'🔇');
  b.title=SND.mode>=2?'おと：ぜんぶ':(SND.mode===1?'おと：こうかおん だけ':'おと：ミュート');
  b.setAttribute('aria-label',b.title);
}
function sndApplyMode(){
  updateSndBtn();
  try{localStorage.setItem(SND_KEY,String(SND.mode));}catch(e){}
  if(!SND.ctx)return;
  const c=SND.ctx;
  try{
    SND.bgm.gain.setTargetAtTime(SND.mode>=2?0.2:0,c.currentTime,0.08);
    SND.sfx.gain.setTargetAtTime(SND.mode>=1?0.75:0,c.currentTime,0.02);
  }catch(e){}
  if(SND.mode>=2)bgmPlay(SND.want);else bgmStop();
}
$('#sndBtn').addEventListener('click',()=>{
  SND.mode=(SND.mode+2)%3;      /* 2 → 1 → 0 → 2 */
  sndUnlock();sndApplyMode();
  if(SND.mode>=1)sfx('tap');
});
document.addEventListener('click',e=>{
  const t=e.target;
  if(t&&t.closest&&t.closest('.btn,.sw,.card:not(.dead)'))sfx('tap');
});

/* =====================================================================
   フィールドたんけん（3Dの せかいを あるきまわる）
   ・スティック/キーで あるく → てきに ふれると バトル → もどってくる
   ・ボスは ちずの いちばん おく。たおすと ステージ クリア
   ===================================================================== */
const FIELD={half:950,zMin:-900,zMax:900,start:[0,780],boss:[0,-780],speed:175,aggro:250,contact:86};
const F={
  scene:null,cam:null,root:null,sky:null,amb:null,sun:null,
  si:0,px:0,pz:780,camX:0,camZ:780,face:0,moving:false,
  trail:[],party:[],enemies:[],blockers:[],
  joy:{x:0,z:0,active:false,id:-1},keys:{},
  t:0,protect:0,enc:null,pending:null,bossDown:false,total:0,chests:[]
};
const miniCv=$('#fieldMini'),joyEl=$('#joy'),joyKnob=$('#joyKnob');

function initFieldScene(){
  if(F.scene)return;
  F.scene=new THREE.Scene();
  F.cam=new THREE.PerspectiveCamera(58,0.8,10,7000);
  F.amb=new THREE.AmbientLight(0xffffff,0.72);F.scene.add(F.amb);
  F.sun=new THREE.DirectionalLight(0xffffff,0.55);F.sun.position.set(300,600,500);F.scene.add(F.sun);
}
function disposeFieldObj(o){
  if(!o)return;
  F.scene.remove(o.group);F.scene.remove(o.shadow);
  disposeObj3(o);
}
function clearFieldObjs(){
  for(const m of F.party){if(m.o){disposeFieldObj(m.o);m.o=null;}}
  for(const e of F.enemies){for(const mm of e.members){if(mm.o){disposeFieldObj(mm.o);mm.o=null;}}}
  F.party=[];F.enemies=[];F.blockers=[];
}

/* ---- じめん・山・木など ---- */
function fieldProps(deco,night){
  const lam=(c,em)=>new THREE.MeshLambertMaterial(em?{color:c,emissive:em}:{color:c});
  if(deco==='tuft')return {r:26,parts:[
    {v:0,geo:new THREE.CylinderGeometry(6,8,40,6),mat:lam(0x7a4b2a),off:[0,20,0],sc:[1,1,1]},
    {v:0,geo:new THREE.ConeGeometry(30,84,6),mat:lam(night?0x4a3b86:0x3fae4f),off:[0,82,0],sc:[1,1,1]},
    {v:0,geo:new THREE.ConeGeometry(22,60,6),mat:lam(night?0x5a4a9a:0x4fc25f),off:[0,124,0],sc:[1,1,1]}]};
  if(deco==='rock')return {r:24,parts:[
    {v:0,geo:new THREE.CylinderGeometry(11,13,96,8),mat:lam(0x5fae4a),off:[0,48,0],sc:[1,1,1]},
    {v:0,geo:new THREE.CylinderGeometry(7,7,34,8),mat:lam(0x5fae4a),off:[-20,60,0],sc:[1,1,1]},
    {v:0,geo:new THREE.CylinderGeometry(7,7,28,8),mat:lam(0x5fae4a),off:[20,50,0],sc:[1,1,1]},
    {v:1,geo:new THREE.DodecahedronGeometry(30,0),mat:lam(0xb08a5a),off:[0,22,0],sc:[1,0.8,1]}]};
  if(deco==='snow')return {r:26,parts:[
    {v:0,geo:new THREE.ConeGeometry(28,90,6),mat:lam(0xe9f6ff),off:[0,48,0],sc:[1,1,1]},
    {v:0,geo:new THREE.SphereGeometry(16,10,8),mat:lam(0xffffff),off:[0,100,0],sc:[1,1,1]}]};
  return {r:22,parts:[
    {v:0,geo:new THREE.OctahedronGeometry(26,0),mat:lam(0xff7a3d,0x66220a),off:[0,30,0],sc:[1,1.6,1]}]};
}
function buildFieldProps(root,s,avoid,r){
  const def=fieldProps(s.deco,s.night);
  const N=64,items=[];
  let guard=0;
  while(items.length<N&&guard++<900){
    const x=(r()*2-1)*(FIELD.half-40),z=FIELD.zMin+r()*(FIELD.zMax-FIELD.zMin);
    let ok=true;
    for(const a of avoid){if(Math.hypot(x-a[0],z-a[1])<a[2]){ok=false;break;}}
    if(!ok)continue;
    for(const it of items){if(Math.hypot(x-it.x,z-it.z)<70){ok=false;break;}}
    if(!ok)continue;
    items.push({x:x,z:z,s:0.85+r()*0.55,yaw:r()*Math.PI*2,v:(s.deco==='rock')?(items.length%2):0});
  }
  const q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3(),m4=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0);
  def.parts.forEach(part=>{
    const mine=items.filter(it=>it.v===part.v);
    if(!mine.length)return;
    const im=new THREE.InstancedMesh(part.geo,part.mat,mine.length);
    mine.forEach((it,k)=>{
      const c=Math.cos(it.yaw),sn=Math.sin(it.yaw);
      const ox=part.off[0]*it.s,oz=part.off[2]*it.s;
      pos.set(it.x+ox*c+oz*sn,part.off[1]*it.s,it.z-ox*sn+oz*c);
      q.setFromAxisAngle(up,it.yaw);
      scl.set(part.sc[0]*it.s,part.sc[1]*it.s,part.sc[2]*it.s);
      m4.compose(pos,q,scl);im.setMatrixAt(k,m4);
    });
    im.instanceMatrix.needsUpdate=true;
    im.frustumCulled=false;
    root.add(im);
  });
  items.forEach(it=>F.blockers.push([it.x,it.z,def.r*it.s]));
}
function buildFieldMountains(root,s,r){
  const n=30,geo=new THREE.ConeGeometry(1,1,7,1);
  const im=new THREE.InstancedMesh(geo,new THREE.MeshPhongMaterial({flatShading:true,shininess:0,specular:0x000000}),n);
  const q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3(),m4=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0);
  const c1=new THREE.Color(s.hill1),c2=new THREE.Color(s.hill2),col=new THREE.Color();
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2+r()*0.1,rad=1500+r()*160,w=230+r()*200,h=280+r()*260;
    pos.set(Math.cos(a)*rad,h/2-20,Math.sin(a)*rad);
    q.setFromAxisAngle(up,r()*6);
    scl.set(w,h,w);
    m4.compose(pos,q,scl);im.setMatrixAt(i,m4);
    col.copy(i%2?c1:c2).lerp(new THREE.Color(s.ground),0.12*r());
    im.setColorAt(i,col);
  }
  im.instanceMatrix.needsUpdate=true;
  if(im.instanceColor)im.instanceColor.needsUpdate=true;
  im.frustumCulled=false;
  root.add(im);
}

/* ---- てきの グループを ちらす ---- */
const CLUSTER=[[0,0],[-46,14],[46,-10],[0,42]];
function makeFieldEnemy(si,types,boss,x,z){
  const s=STAGES[si];
  const members=types.map((t,i)=>{
    const d=boss?s.boss:ENEMY_TYPES[t];
    const size=200*0.56*(d.scale||1);
    return {type:boss?d.type:t,color:boss?d.color:enemyColor(t,si),boss:boss,size:size,fly:boss?0:(d.fly||0),dx:CLUSTER[i%4][0]*(boss?0:1),dz:CLUSTER[i%4][1]*(boss?0:1),o:null};
  });
  const top=Math.max.apply(null,members.map(m=>m.size*0.95+m.fly));
  return {types:types.slice(),boss:!!boss,hx:x,hz:z,x:x,z:z,tx:x,tz:z,wt:Math.random()*2,state:'wander',moving:false,members:members,top:top,shown:false,ph:Math.random()*6,face:0,name:boss?s.boss.name:''};
}
function scatterEnemies(si,r){
  const s=STAGES[si];
  const pool=[];
  s.waves.forEach(w=>w.forEach(t=>{if(pool.indexOf(t)<0)pool.push(t);}));
  const groups=[];
  const nG=9+si,maxN=Math.min(3,2+(si>1?1:0));
  let guard=0;
  while(groups.length<nG&&guard++<1200){
    const x=(r()*2-1)*(FIELD.half-120),z=-620+r()*1300;
    if(Math.hypot(x-FIELD.start[0],z-FIELD.start[1])<430)continue;
    if(Math.hypot(x-FIELD.boss[0],z-FIELD.boss[1])<380)continue;
    let ok=true;
    for(const g of groups){if(Math.hypot(x-g.x,z-g.z)<300){ok=false;break;}}
    if(!ok)continue;
    const n=1+Math.floor(r()*maxN),types=[];
    for(let i=0;i<n;i++)types.push(pool[Math.floor(r()*pool.length)]);
    groups.push({x:x,z:z,types:types});
  }
  const list=groups.map(g=>makeFieldEnemy(si,g.types,false,g.x,g.z));
  list.push(makeFieldEnemy(si,[s.boss.type],true,FIELD.boss[0],FIELD.boss[1]));
  return list;
}

/* ---- せかいを つくる ---- */
function buildField(si){
  initFieldScene();
  const s=STAGES[si],sc=F.scene;
  if(F.root){sc.remove(F.root);disposeGroup(F.root);F.root=null;}
  if(sc.background&&sc.background.dispose)sc.background.dispose();
  clearFieldObjs();
  const r=rng((Math.random()*4294967296)>>>0);
  F.si=si;
  const root=new THREE.Group();F.root=root;sc.add(root);
  /* そら */
  const sk=document.createElement('canvas');sk.width=4;sk.height=256;
  const sg=sk.getContext('2d'),grad=sg.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,s.sky[0]);grad.addColorStop(0.5,s.sky[1]);grad.addColorStop(1,s.sky[1]);
  sg.fillStyle=grad;sg.fillRect(0,0,4,256);
  sc.background=canvasTex(sk,true);
  sc.fog=new THREE.Fog(new THREE.Color(s.sky[1]),900,3000);
  F.amb.intensity=s.night?0.5:0.72;
  /* じめん */
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),new THREE.MeshBasicMaterial({map:makeGroundTex(s,true,[14,28])}));
  ground.rotation.x=-Math.PI/2;root.add(ground);
  /* まわりの 山 */
  buildFieldMountains(root,s,r);
  /* たいよう・くも（カメラに ついてくる） */
  const sky=new THREE.Group();F.sky=sky;root.add(sky);
  const orbFill=new THREE.Mesh(new THREE.CircleGeometry(110,32),new THREE.MeshBasicMaterial({color:new THREE.Color(s.orb),fog:false}));
  const orbEdge=new THREE.Mesh(new THREE.RingGeometry(110,124,32),new THREE.MeshBasicMaterial({color:0x2a2a2e,fog:false}));
  orbFill.position.set(520,430,-1900);orbEdge.position.set(520,430,-1899);
  sky.add(orbFill,orbEdge);
  const ctex=makeCloudTex(s.night);
  [[-900,620,1],[-450,760,0.8],[80,650,1.2],[600,780,0.9],[1000,610,1.1],[-200,860,0.8]].forEach(c=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(420*c[2],210*c[2]),new THREE.MeshBasicMaterial({map:ctex,transparent:true,depthWrite:false,fog:false}));
    m.position.set(c[0],c[1],-1700);sky.add(m);
  });
  /* てき */
  F.enemies=scatterEnemies(si,r);
  F.total=F.enemies.length;
  F.bossDown=false;
  /* 木・岩・サボテンなど（てき・スタート地点の まわりは あける） */
  const avoid=[[FIELD.start[0],FIELD.start[1],260]];
  F.enemies.forEach(e=>avoid.push([e.hx,e.hz,e.boss?260:170]));
  buildFieldProps(root,s,avoid,r);
  buildFieldDeco(root,s,avoid,r);
  buildFieldChests(root,si,r);
  /* なかま（スタート地点の うしろから ならぶ） */
  F.px=FIELD.start[0];F.pz=FIELD.start[1];F.camX=F.px;F.camZ=F.pz;F.face=0;F.moving=false;
  F.trail=[];
  for(let k=0;k<=24;k++)F.trail.push({x:F.px,z:F.pz+(24-k)*14});
  F.party=state.party.map((hero,i)=>({hero:hero,o:null,x:F.px,z:F.pz+i*72,moving:false,face:0}));
  F.protect=1.5;F.enc=null;F.pending=null;
}

/* ---- じゅんび・でいり ---- */
function mountWrap(kind){
  const host=$(kind==='field'?'#fieldHost':(kind==='vs'?'#vsHost':'#battleHost'));
  if(wrap.parentNode!==host)host.appendChild(wrap);
  wrap.classList.toggle('field',kind==='field');
  wrap.classList.toggle('vs',kind==='vs');
  if(kind==='field')wrap.classList.remove('mode2d');
  else if(kind==='battle'){/* setMode() が このあと 2D/3D を きめる */}
  else{cv.width=W;cv.height=H;}
  GL.lastW=0;
}
function updateFieldHud(){
  const left=F.enemies.filter(e=>!e.boss).length;
  $('#fieldHint').textContent=F.bossDown?'ボスを たおしたよ！ ほかの てきと たたかっても いいし、おしろへ もどっても いいよ。':
    'スティック（キーボードなら 矢印/WASD）で あるこう。てきに ふれると バトル！　のこり '+left+'グループ ／ たからばこ '+F.chests.length+'こ ／ ボスは ちずの いちばん おく。';
}
function enterField(si){
  if(!state.party.length||si>state.cleared)return;
  if(!initGL()){toast(GL.reason==='lib'?'たんけんは 3Dが ひつようだよ（よみこみ中かも）':'この たんまつでは 3Dが つかえないので たんけんは できないよ');return;}
  cancelAnimationFrame(rafId);closeModal();
  buildField(si);
  $('#fieldTitle').textContent='たんけん　STAGE '+(si+1)+'　'+STAGES[si].name;
  updateFieldHud();
  showFieldScreen();
}
function showFieldScreen(){
  cancelAnimationFrame(rafId);
  mountWrap('field');
  show('field');
  sizeGL(true);
  lastTs=performance.now();
  rafId=requestAnimationFrame(floop);
}
function leaveField(){
  cancelAnimationFrame(rafId);
  F.joy.active=false;F.joy.x=F.joy.z=0;
  renderHome();show('home');
}
function startFieldBattle(e){
  F.pending=e;
  cancelAnimationFrame(rafId);
  startBattle(F.si,{field:true,boss:e.boss,waves:e.boss?[]:[e.types.slice()],ent:e});
}
function returnToField(win){
  closeModal();
  const e=F.pending;F.pending=null;
  if(e){
    if(win===true){
      for(const mm of e.members){if(mm.o){disposeFieldObj(mm.o);mm.o=null;}}
      F.enemies=F.enemies.filter(x=>x!==e);
      if(e.boss)F.bossDown=true;
    }else if(win===false){
      /* まけたら スタートちかくへ もどされる */
      F.px=FIELD.start[0]+(F.px>0?60:-60);F.pz=FIELD.start[1];F.camX=F.px;F.camZ=F.pz;
      F.trail=[];for(let k=0;k<=24;k++)F.trail.push({x:F.px,z:F.pz+(24-k)*14});
      F.party.forEach((m,i)=>{m.x=F.px;m.z=F.pz+i*72;});
      e.x=e.hx;e.z=e.hz;e.state='wander';
    }
    /* win==='ran'（にげた） の ときは いちも てきも そのまま */
  }
  F.protect=2.2;F.enc=null;
  updateFieldHud();
  showFieldScreen();
}

/* ---- にゅうりょく ---- */
function joyMove(e){
  const r=joyEl.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2,R0=(r.width/2)*0.8||1;
  let dx=e.clientX-cx,dy=e.clientY-cy;
  const d=Math.hypot(dx,dy);
  if(d>R0){dx*=R0/d;dy*=R0/d;}
  F.joy.x=dx/R0;F.joy.z=dy/R0;
  joyKnob.style.transform='translate(calc(-50% + '+dx.toFixed(1)+'px),calc(-50% + '+dy.toFixed(1)+'px))';
}
function joyEnd(e){
  if(e&&F.joy.id!==e.pointerId)return;
  F.joy.active=false;F.joy.x=0;F.joy.z=0;
  joyKnob.style.transform='translate(-50%,-50%)';
}
joyEl.addEventListener('pointerdown',e=>{
  e.preventDefault();
  try{joyEl.setPointerCapture(e.pointerId);}catch(_){}
  F.joy.active=true;F.joy.id=e.pointerId;joyMove(e);
});
joyEl.addEventListener('pointermove',e=>{if(F.joy.active&&e.pointerId===F.joy.id){e.preventDefault();joyMove(e);}});
joyEl.addEventListener('pointerup',joyEnd);
joyEl.addEventListener('pointercancel',joyEnd);
window.addEventListener('keydown',e=>{
  if(!$('#field').classList.contains('active'))return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].indexOf(k)>=0){F.keys[k]=true;e.preventDefault();}
});
window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;F.keys[k]=false;});
$('#fieldBack').addEventListener('click',leaveField);

/* ---- こうしん ---- */
function trailPoint(d){
  let acc=0,px=F.px,pz=F.pz;
  for(let k=F.trail.length-1;k>=0;k--){
    const p=F.trail[k],seg=Math.hypot(px-p.x,pz-p.z);
    if(acc+seg>=d){const t=(d-acc)/(seg||1);return [px+(p.x-px)*t,pz+(p.z-pz)*t];}
    acc+=seg;px=p.x;pz=p.z;
  }
  return [px,pz];
}
function pushOut(x,z,rad){
  for(const b of F.blockers){
    const dx=x-b[0],dz=z-b[1],rr=b[2]+rad,d2=dx*dx+dz*dz;
    if(d2<rr*rr){const d=Math.sqrt(d2)||1;x=b[0]+dx/d*rr;z=b[1]+dz/d*rr;}
  }
  return [x,z];
}
function updateField(dt){
  R.t+=dt;F.t+=dt;
  F.protect=Math.max(0,F.protect-dt);
  if(F.enc){
    F.enc.t+=dt;
    if(F.enc.t>0.6){const e=F.enc.e;F.enc=null;startVsBattle(e);return;}
    updateFieldCamera(dt);
    return;
  }
  /* プレイヤー */
  let ix=F.joy.x,iz=F.joy.z;
  const k=F.keys;
  if(k.ArrowLeft||k.a)ix-=1;
  if(k.ArrowRight||k.d)ix+=1;
  if(k.ArrowUp||k.w)iz-=1;
  if(k.ArrowDown||k.s)iz+=1;
  let mag=Math.hypot(ix,iz);
  if(mag>1){ix/=mag;iz/=mag;mag=1;}
  if(mag<0.12){ix=0;iz=0;mag=0;}
  const sp=FIELD.speed*mag;
  let nx=clamp(F.px+ix*sp*dt,-FIELD.half,FIELD.half),nz=clamp(F.pz+iz*sp*dt,FIELD.zMin,FIELD.zMax);
  const pp=pushOut(nx,nz,24);nx=pp[0];nz=pp[1];
  F.moving=Math.hypot(nx-F.px,nz-F.pz)>0.4;
  F.px=nx;F.pz=nz;
  F.face+=(clamp(ix,-1,1)*0.7-F.face)*(1-Math.exp(-dt*10));
  const last=F.trail[F.trail.length-1];
  if(!last||Math.hypot(F.px-last.x,F.pz-last.z)>14){F.trail.push({x:F.px,z:F.pz});if(F.trail.length>90)F.trail.shift();}
  /* なかま（あとを ついてくる） */
  F.party.forEach((m,i)=>{
    if(i===0){m.x=F.px;m.z=F.pz;m.moving=F.moving;m.face=F.face;return;}
    const tp=trailPoint(i*72),kk=1-Math.exp(-dt*9);
    const ox=m.x,oz=m.z;
    m.x+=(tp[0]-m.x)*kk;m.z+=(tp[1]-m.z)*kk;
    m.moving=Math.hypot(m.x-ox,m.z-oz)>0.35;
    m.face+=(clamp((m.x-ox)/Math.max(dt,0.001)/FIELD.speed,-1,1)*0.7-m.face)*(1-Math.exp(-dt*8));
  });
  /* てき */
  for(const e of F.enemies){
    const dx=F.px-e.x,dz=F.pz-e.z,d=Math.hypot(dx,dz);
    if(F.protect<=0&&d<FIELD.aggro*(e.boss?1.15:1))e.state='chase';
    else if(e.state==='chase'&&(d>FIELD.aggro*1.6||F.protect>0))e.state='wander';
    let mx=0,mz=0;
    if(e.state==='chase'){
      const spd=e.boss?66:92;
      mx=dx/(d||1)*spd*dt;mz=dz/(d||1)*spd*dt;
    }else{
      e.wt-=dt;
      if(e.wt<=0){
        const a=Math.random()*Math.PI*2,rr=Math.random()*150;
        e.tx=e.hx+Math.cos(a)*rr;e.tz=e.hz+Math.sin(a)*rr;e.wt=2+Math.random()*3;
      }
      const wx=e.tx-e.x,wz=e.tz-e.z,wd=Math.hypot(wx,wz);
      if(wd>6){const spd=e.boss?0:34;mx=wx/wd*spd*dt;mz=wz/wd*spd*dt;}
    }
    e.moving=Math.abs(mx)+Math.abs(mz)>0.02;
    e.x=clamp(e.x+mx,-FIELD.half,FIELD.half);e.z=clamp(e.z+mz,FIELD.zMin,FIELD.zMax);
    e.face+=(clamp(mx/Math.max(dt,0.001)/92,-1,1)*0.6-e.face)*(1-Math.exp(-dt*6));
    const reach=FIELD.contact+(e.members.length>1?26:0)+(e.boss?30:0);
    if(F.protect<=0&&d<reach){F.enc={e:e,t:0};F.joy.x=0;F.joy.z=0;break;}
  }
  /* たからばこ */
  for(const ch of F.chests.slice()){
    ch.g.position.y=Math.sin(F.t*2+ch.ph)*3;ch.g.rotation.y+=dt*0.8;
    if(!ch.taken&&Math.hypot(F.px-ch.x,F.pz-ch.z)<72)openChest(ch);
  }
  updateFieldCamera(dt);
}
function updateFieldCamera(dt){
  const kk=1-Math.exp(-dt*6);
  F.camX+=(F.px-F.camX)*kk;F.camZ+=(F.pz-F.camZ)*kk;
  const cam=F.cam;
  const ez=F.enc?Math.min(1,F.enc.t/0.6):0;   /* ぶつかる しゅんかん：ぐっと よる */
  cam.position.set(F.camX+(Math.random()-0.5)*ez*8,250-ez*40,F.camZ+450-ez*150);
  cam.lookAt(F.camX,45,F.camZ-225);
  cam.updateMatrixWorld();
  if(F.sky)F.sky.position.set(F.camX*0.92,0,F.camZ);
}

/* ---- えがく ---- */
function fieldPose(ph,moving,lean,freq){
  const t=R.t;
  const p={ox:0,oy:0,rot:0,spin:0,sx:1,sy:1,lean:0,wob:0.25,alpha:1,ph:ph};
  const bob=Math.sin(t*4+ph);
  p.sx=1-bob*0.03;p.sy=1+bob*0.04;
  if(moving){
    const w=Math.sin(t*freq+ph);
    p.oy-=Math.abs(w)*9;p.rot=w*0.08;p.wob=0.5;p.lean=lean;
    if(Math.abs(w)<0.18)p.sy*=0.93;
  }
  return p;
}
function syncFieldObjs(){
  F.party.forEach((m,i)=>{
    if(!m.o){
      const o=makeHeroObj(m.hero);if(!o)return;
      m.o=o;F.scene.add(o.group);F.scene.add(o.shadow);
    }
    const o=m.o,ph=i*1.7;
    const pose=fieldPose(ph,m.moving,m.face*0.35,10);
    applyPoseObj(o,pose,m.x,0,m.z,0.12+m.face*0.8);
    o.shadow.position.set(m.x,0.6,m.z);
    o.shadow.scale.set(Math.max(2,o.w*0.4*(1+pose.oy/60)),9,1);
    o.shadow.material.opacity=0.22;
    animLimbsCore(o,pose,{walking:m.moving,alive:true,atk:0,atkDur:1,hit:0,cast:0,ph:ph});
  });
  for(const e of F.enemies){
    const d=Math.hypot(e.x-F.px,e.z-F.pz);
    e.shown=d<1600;
    for(const mm of e.members){
      if(!e.shown){if(mm.o){mm.o.group.visible=false;mm.o.shadow.visible=false;}continue;}
      if(!mm.o){
        mm.o=makeMonsterObj(mm.type,mm.color,mm.boss,mm.size);
        F.scene.add(mm.o.group);F.scene.add(mm.o.shadow);
      }
      const o=mm.o;
      o.group.visible=true;o.shadow.visible=true;
      const ph=e.ph+mm.dx*0.05;
      const chase=e.state==='chase';
      const pose=fieldPose(ph,e.moving,e.face*0.2,chase?12:7);
      if(mm.fly){pose.oy-=mm.fly;pose.oy+=Math.sin(R.t*3+ph)*8;}
      const x=e.x+mm.dx,z=e.z+mm.dz;
      applyPoseObj(o,pose,x,0,z,-0.15+e.face*0.6);
      o.shadow.position.set(x,0.6,z);
      o.shadow.scale.set(Math.max(2,mm.size*0.32),9,1);
      o.shadow.material.opacity=0.22;
    }
  }
}
function projectF(x,y,z){
  const v=GL.v.set(x,y,z).project(F.cam);
  return [(v.x+1)/2*cv.width,(1-v.y)/2*cv.height];
}
function keepClearOfMinimap(q,w){
  const boxL=w-118,boxB=118;               /* ミニマップの はんい（8pxの よゆう こみ） */
  if(q[0]>boxL-30&&q[1]<boxB+26){q[1]=boxB+26;q[0]=Math.min(q[0],w-58);}
  return q;
}
function drawFieldOverlay(){
  const c=ctx,w=cv.width,h=cv.height;
  c.clearRect(0,0,w,h);
  for(const e of F.enemies){
    if(!e.shown)continue;
    let q=projectF(e.x,e.top+26,e.z);
    if(q[0]<-40||q[0]>w+40||q[1]<-40||q[1]>h+40)continue;
    q=keepClearOfMinimap(q,w);
    if(e.boss)outlineText('♛ '+e.name,q[0],q[1]-8,15,'#ffd23f',INK);
    else if(e.members.length>1)outlineText('×'+e.members.length,q[0],q[1]-4,14,'#fff',INK);
    if(e.state==='chase'||(F.enc&&F.enc.e===e))outlineText('!',q[0],q[1]-(e.boss?28:24),(F.enc&&F.enc.e===e)?34:24,'#ff4d4d',INK);
  }
  if(F.enc){
    const a=Math.min(0.75,F.enc.t/0.6*0.75);
    c.fillStyle='rgba(255,255,255,'+a+')';c.fillRect(0,0,w,h);
  }
}
function drawMinimap(){
  const m=miniCv,c=m.getContext('2d'),S0=m.width,sx=S0/(FIELD.half*2),sz=S0/(FIELD.zMax-FIELD.zMin);
  c.clearRect(0,0,S0,S0);
  c.fillStyle='rgba(22,28,48,.94)';c.fillRect(0,0,S0,S0);   /* うしろの 3Dが すけない ように */
  c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=2;c.strokeRect(1,1,S0-2,S0-2);
  const mx=x=>(x+FIELD.half)*sx,mz=z=>(z-FIELD.zMin)*sz;
  for(const e of F.enemies){
    c.fillStyle=e.boss?'#ffd23f':'#ff5a5a';
    c.beginPath();c.arc(mx(e.x),mz(e.z),e.boss?6:3.5,0,Math.PI*2);c.fill();
  }
  c.fillStyle='#ffd23f';
  for(const ch of F.chests)c.fillRect(mx(ch.x)-3,mz(ch.z)-3,6,6);
  c.fillStyle='#5cf07a';c.strokeStyle='#fff';c.lineWidth=2;
  c.beginPath();c.arc(mx(F.px),mz(F.pz),5,0,Math.PI*2);c.fill();c.stroke();
}
function renderField(){
  const cw=glCv.clientWidth,ch=glCv.clientHeight;
  if(cw&&ch&&(cv.width!==cw||cv.height!==ch)){cv.width=cw;cv.height=ch;}
  sizeGL(false);
  syncFieldObjs();
  GL.renderer.render(F.scene,F.cam);
  drawFieldOverlay();
  drawMinimap();
}
function floop(ts){
  rafId=requestAnimationFrame(floop);
  const raw=(ts-lastTs)/1000;
  const dt=Math.min(0.05,Math.max(0,raw)||0);lastTs=ts;
  updateField(dt);
  if(!$('#field').classList.contains('active'))return;   /* このtickの あいだに べつのがめんへ うつっていたら、ここで やめる */
  renderField();
  perfCheck(raw);
}

/* ---- じめんの かざり（草・花・小石など。1つの 描画で まとめて）---- */
function buildFieldDeco(root,s,avoid,r){
  const lam=(c,em)=>new THREE.MeshLambertMaterial(em?{color:c,emissive:em}:{color:c});
  let sets;
  if(s.deco==='tuft')sets=[
    {geo:new THREE.ConeGeometry(3.2,17,4),mat:lam(s.night?0x6a5aa8:0x55b846),n:260,y:8,sy:1,cols:null},
    {geo:new THREE.SphereGeometry(4.2,6,5),mat:lam(0xffffff),n:70,y:4.5,sy:1,cols:[0xff7fb0,0xffd23f,0xffffff,0xb58cff]}];
  else if(s.deco==='rock')sets=[
    {geo:new THREE.DodecahedronGeometry(7,0),mat:lam(0xb98d5a),n:140,y:4,sy:0.6,cols:null},
    {geo:new THREE.ConeGeometry(3,14,4),mat:lam(0x8fa84a),n:60,y:7,sy:1,cols:null}];
  else if(s.deco==='snow')sets=[
    {geo:new THREE.SphereGeometry(10,8,6),mat:lam(0xffffff),n:110,y:4,sy:0.4,cols:null},
    {geo:new THREE.OctahedronGeometry(6,0),mat:lam(0xa8ddff),n:40,y:8,sy:1.8,cols:null}];
  else sets=[
    {geo:new THREE.OctahedronGeometry(5,0),mat:lam(0xff8a3d,0x66300a),n:120,y:5,sy:1,cols:null},
    {geo:new THREE.DodecahedronGeometry(7,0),mat:lam(0x3a2030),n:80,y:4,sy:0.6,cols:null}];
  const q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3(),m4=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),col=new THREE.Color();
  sets.forEach(set=>{
    const im=new THREE.InstancedMesh(set.geo,set.mat,set.n);
    for(let i=0;i<set.n;i++){
      let x=0,z=0,g=0;
      do{x=(r()*2-1)*(FIELD.half-30);z=FIELD.zMin+r()*(FIELD.zMax-FIELD.zMin);g++;}
      while(g<20&&avoid.some(a=>Math.hypot(x-a[0],z-a[1])<Math.min(a[2],140)));
      const k=0.7+r()*0.9;
      pos.set(x,set.y*k*set.sy,z);
      q.setFromAxisAngle(up,r()*6.28);
      scl.set(k,k*set.sy,k);
      m4.compose(pos,q,scl);im.setMatrixAt(i,m4);
      if(set.cols){col.setHex(set.cols[Math.floor(r()*set.cols.length)]);im.setColorAt(i,col);}
    }
    im.instanceMatrix.needsUpdate=true;
    if(im.instanceColor)im.instanceColor.needsUpdate=true;
    im.frustumCulled=false;
    root.add(im);
  });
}

/* ---- たからばこ（ふれると けいけんち）---- */
function makeChestMesh(){
  const lam=c=>new THREE.MeshLambertMaterial({color:c});
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(46,28,34),lam(0x9a6a3a));body.position.y=14;
  const lid=new THREE.Mesh(new THREE.BoxGeometry(48,14,36),lam(0xb5804a));lid.position.y=35;
  const band=new THREE.Mesh(new THREE.BoxGeometry(9,42,38),lam(0xffd23f));band.position.y=21;
  const lock=new THREE.Mesh(new THREE.SphereGeometry(5,8,6),lam(0xffe98a));lock.position.set(0,28,19);
  g.add(body,lid,band,lock);
  return g;
}
function buildFieldChests(root,si,r){
  F.chests=[];
  const n=4+(si>2?1:0),pts=[];
  let guard=0;
  while(pts.length<n&&guard++<800){
    const x=(r()*2-1)*(FIELD.half-100),z=-700+r()*1400;
    if(Math.hypot(x-FIELD.start[0],z-FIELD.start[1])<320)continue;
    if(Math.hypot(x-FIELD.boss[0],z-FIELD.boss[1])<300)continue;
    if(F.enemies.some(e=>Math.hypot(x-e.hx,z-e.hz)<240))continue;
    if(pts.some(p=>Math.hypot(x-p[0],z-p[1])<420))continue;
    if(F.blockers.some(b=>Math.hypot(x-b[0],z-b[1])<b[2]+50))continue;
    pts.push([x,z]);
  }
  pts.forEach(p=>{
    const g=makeChestMesh();g.position.set(p[0],0,p[1]);root.add(g);
    F.chests.push({x:p[0],z:p[1],g:g,ph:Math.random()*6,taken:false});
  });
}
function openChest(ch){
  if(ch.taken)return;
  ch.taken=true;
  if(F.root)F.root.remove(ch.g);
  disposeGroup(ch.g);
  F.chests=F.chests.filter(c=>c!==ch);
  const gain=8+5*F.si;
  const rows=giveExp(gain);save();
  const ups=rows.filter(x=>x.after>x.before);
  toast('たからばこを みつけた！ けいけんち +'+gain+(ups.length?'　'+ups.map(x=>x.hero.name+' Lv.'+x.after+'！').join(' '):''));
  sfx('chest');
  if(ups.length)setTimeout(()=>sfx('levelup'),500);
  updateFieldHud();
}

/* =====================================================================
   ポケモンバトルふうの ターンせいバトル（がめん・えんしゅつ）
   ・たんけんで てきに ふれたときの せんとうは、これに なる
   ===================================================================== */
const VS={S:null,e:null,scene:null,cam:null,groundMesh:null,heroO:null,monO:null,heroHeroRef:null,
  vHero:null,vMon:null,auto:false,speed:1,steps:[],si:-1,onDone:null,timer:0};

function makeArenaFloorTex(groundColor){
  const S=512,c=document.createElement('canvas');c.width=S;c.height=S;
  const g=c.getContext('2d'),cx=S/2,cy=S/2;
  g.fillStyle=groundColor;g.fillRect(0,0,S,S);
  const glow=g.createRadialGradient(cx,cy,0,cx,cy,S*0.5);
  glow.addColorStop(0,'rgba(255,255,255,.32)');glow.addColorStop(0.62,'rgba(255,255,255,.06)');glow.addColorStop(1,'rgba(0,0,0,.28)');
  g.fillStyle=glow;g.fillRect(0,0,S,S);
  g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=S*0.018;g.beginPath();g.arc(cx,cy,S*0.487,0,Math.PI*2);g.stroke();
  return c;
}
function makeArenaGlowTex(){
  const S=256,c=document.createElement('canvas');c.width=S;c.height=S;
  const g=c.getContext('2d'),cx=S/2,cy=S/2;
  const grad=g.createRadialGradient(cx,cy,S*0.30,cx,cy,S*0.5);
  grad.addColorStop(0,'rgba(255,255,255,.5)');grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grad;g.fillRect(0,0,S,S);
  return c;
}
function initVsScene(){
  if(VS.scene)return;
  VS.scene=new THREE.Scene();
  VS.cam=new THREE.PerspectiveCamera(42,2,10,3000);
  const amb=new THREE.AmbientLight(0xffffff,0.8);VS.scene.add(amb);
  const sun=new THREE.DirectionalLight(0xffffff,0.55);sun.position.set(220,420,320);VS.scene.add(sun);
  const rim=new THREE.DirectionalLight(0xbfe0ff,0.32);rim.position.set(-260,180,-200);VS.scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(300,40),new THREE.MeshLambertMaterial({color:0xffffff}));
  ground.rotation.x=-Math.PI/2;VS.scene.add(ground);
  VS.groundMesh=ground;
  const glowRing=new THREE.Mesh(new THREE.RingGeometry(280,430,40),new THREE.MeshBasicMaterial({map:canvasTex(makeArenaGlowTex(),true),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  glowRing.rotation.x=-Math.PI/2;glowRing.position.y=0.5;VS.scene.add(glowRing);
  VS.cam.position.set(0,120,340);VS.cam.lookAt(0,80,0);VS.cam.updateMatrixWorld();
}
function vsSetScenery(stageIdx){
  const s=STAGES[stageIdx];
  const sk=document.createElement('canvas');sk.width=4;sk.height=256;
  const sg=sk.getContext('2d'),grad=sg.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,s.sky[0]);grad.addColorStop(0.55,s.sky[1]);grad.addColorStop(1,s.sky[1]);
  sg.fillStyle=grad;sg.fillRect(0,0,4,256);
  if(VS.scene.background&&VS.scene.background.dispose)VS.scene.background.dispose();
  VS.scene.background=canvasTex(sk,true);
  if(VS.groundMesh.material.map)VS.groundMesh.material.map.dispose();
  VS.groundMesh.material.map=canvasTex(makeArenaFloorTex(s.ground),true);
  VS.groundMesh.material.needsUpdate=true;
}
function disposeVsObj(o){if(!o)return;VS.scene.remove(o.group);VS.scene.remove(o.shadow);disposeObj3(o);}
function vsTeardown(){
  disposeVsObj(VS.heroO);disposeVsObj(VS.monO);
  VS.heroO=null;VS.monO=null;VS.heroHeroRef=null;VS.S=null;VS.e=null;
  clearTimeout(VS.timer);VS.timer=0;
}
function vsFreshVis(){return {ph:Math.random()*6,atk:0,atkDur:0.4,hit:0,dead:0};}
function vsPlaceUnits(){
  const S=VS.S,hero=vsCurHero(S);
  if(hero.hero!==VS.heroHeroRef){
    disposeVsObj(VS.heroO);
    VS.heroO=makeHeroObj(hero.hero);VS.heroHeroRef=hero.hero;
    if(VS.heroO){VS.scene.add(VS.heroO.group);VS.scene.add(VS.heroO.shadow);}
    VS.vHero=vsFreshVis();
  }
  disposeVsObj(VS.monO);
  const m=S.mon;
  VS.monO=m?makeMonsterObj(m.type,m.spriteColor,m.isBoss,m.size):null;
  if(VS.monO){VS.scene.add(VS.monO.group);VS.scene.add(VS.monO.shadow);}
  VS.vMon=vsFreshVis();
}
function vsTickVis(v,dt){v.atk=Math.max(0,v.atk-dt);v.hit=Math.max(0,v.hit-dt);if(v.dead>0)v.dead=Math.min(0.6,v.dead+dt);}
function vsPoseFor(v,alive){
  const p={ox:0,oy:0,rot:0,spin:0,sx:1,sy:1,lean:0,wob:0.22,alpha:1,ph:v.ph};
  const bob=Math.sin(R.t*3.4+v.ph);
  p.sx=1-bob*0.03;p.sy=1+bob*0.04;
  if(v.atk>0){
    const q=1-v.atk/v.atkDur;
    if(q<0.4){const k=easeOut(q/0.4);p.ox=-8*k;p.sx=1+0.06*k;}
    else{const k=(q-0.4)/0.6,e=Math.sin(k*Math.PI);p.ox=-8*(1-k)+22*e;p.sx=1+0.06*(1-k)-0.08*e;p.wob=0.5;}
  }
  if(v.hit>0){const k=v.hit/0.3;p.ox-=10*k;p.wob=Math.max(p.wob,1.1*k);p.sx*=1+0.1*k;p.sy*=1-0.1*k;if(Math.floor(v.hit*40)%2===0)p.alpha=0.45;}
  if(!alive){p.rot=Math.min(1,v.dead/0.5)*Math.PI*0.42;p.alpha=Math.max(0.2,1-v.dead/0.5*0.85);}
  return p;
}
function vloop(ts){
  rafId=requestAnimationFrame(vloop);
  const dt=Math.min(0.05,Math.max(0,(ts-lastTs)/1000)||0);lastTs=ts;
  R.t+=dt;
  if(VS.vHero){vsTickVis(VS.vHero,dt);
    if(VS.heroO)applyPoseObj(VS.heroO,vsPoseFor(VS.vHero,vsCurHero(VS.S).alive),-90,0,0,0.3);}
  if(VS.vMon){vsTickVis(VS.vMon,dt);
    if(VS.monO)applyPoseObj(VS.monO,vsPoseFor(VS.vMon,VS.S.mon?VS.S.mon.alive:true),90,0,0,-0.3);}
  sizeGL(false);
  GL.renderer.render(VS.scene,VS.cam);
}

/* ---- HP表示 ---- */
function vsHpColor(u){
  const r=clamp(u.hp/u.maxHp,0,1);
  return r>0.5?'#4CC26B':(r>0.2?'#F2C438':'#E85B4D');
}
function vsSetBar(u){
  if(!u)return;
  const pct=clamp(u.hp/u.maxHp,0,1)*100+'%',col=vsHpColor(u);
  if(u.kind==='hero'){const b=$('#vsHeroBar');b.style.width=pct;b.style.background=col;$('#vsHeroHpNum').textContent=Math.max(0,u.hp)+' / '+u.maxHp;}
  else{const b=$('#vsFoeBar');b.style.width=pct;b.style.background=col;}
}
function vsRefreshPlates(){
  const S=VS.S,h=vsCurHero(S),m=S.mon;
  $('#vsHeroName').textContent=h.name+'　Lv.'+h.hero.lv+(validItem(h.hero.item)?'　🗡'+h.hero.item.name:'');
  $('#vsHeroThumb').src=h.hero.img;
  vsSetBar(h);
  if(m){
    $('#vsFoeName').textContent=(S.isBoss?'♛ ':(S.total>1?'('+(S.idx+1)+'/'+S.total+') ':''))+m.name;
    try{$('#vsFoeThumb').src=getSprite(m.type,m.spriteColor,m.isBoss).toDataURL();}catch(e){}
    vsSetBar(m);
  }
}

/* ---- メッセージと できごと ---- */
const VS_KIND_TAG={smash:'こうげき',aoe:'こうげき',thunder:'こうげき',poison:'どく',haste:'みかた強化',shield:'ぼうぎょ',heal:'かいふく'};
function vsEventText(ev){
  switch(ev.t){
    case 'move':return (ev.unit.kind==='hero'?ev.unit.name:'てきの　'+ev.unit.name)+'の　'+ev.move.name+'！';
    case 'hit':{
      let s=(ev.unit.kind==='hero'?ev.unit.name:'てき')+'に　'+ev.amount+'の　ダメージ！';
      if(ev.crit)s='きゅうしょに　あたった！\n'+s;
      if(ev.tm>1.2)s+='\nこうかは　ばつぐんだ！';else if(ev.tm<0.9)s+='\nこうかは　いまひとつ　のようだ…';
      return s;
    }
    case 'status':return ev.unit.name+'は　'+ev.text;
    case 'buff':return ev.text;
    case 'heal':return ev.unit.name+'の　HPが　'+ev.amount+'　かいふくした！';
    case 'poison':return (ev.unit.kind==='hero'?ev.unit.name:'てき')+'は　どくの　ダメージ！';
    case 'para':return ev.unit.name+'は　からだが　しびれて　うごけない！';
    case 'ko':return (ev.unit.kind==='hero'?ev.unit.name:'てきの　'+ev.unit.name)+'は　たおれた！';
    case 'switch':return 'いけっ、'+ev.unit.name+'！';
    case 'appear':return ev.text;
    case 'runaway':return 'うまく　にげきれた！';
    default:return '';
  }
}
function vsSfxFor(ev){
  switch(ev.t){
    case 'move':return null;
    case 'hit':return ev.crit||ev.tm>1.2?'crit':'hit';
    case 'ko':return ev.unit.kind==='hero'?'down':'kill';
    case 'heal':return 'heal';
    case 'buff':return 'shield';
    case 'status':return 'poison';
    case 'poison':return 'hit';
    case 'appear':return 'encounter';
    case 'janken':return ev.result==='win'?'haste':ev.result==='lose'?'hurt':'tap';
    default:return null;
  }
}
function vsApplyVisual(ev){
  const u=ev.unit;
  if(ev.t==='move'&&u){
    const v=u.kind==='hero'?VS.vHero:VS.vMon;v.atk=v.atkDur=0.4;
    sfx(u.kind==='hero'?'shot':'swing');
  }else if(ev.t==='hit'&&u){
    const v=u.kind==='hero'?VS.vHero:VS.vMon;v.hit=0.3;vsSetBar(u);
  }else if(ev.t==='heal'&&u){
    vsSetBar(u);
  }else if(ev.t==='poison'&&u){
    vsSetBar(u);
  }else if(ev.t==='ko'&&u){
    const v=u.kind==='hero'?VS.vHero:VS.vMon;if(v.dead<=0)v.dead=0.001;
  }
  const f=vsSfxFor(ev);if(f)sfx(f);
}
function vsPushSteps(steps,onDone){
  clearTimeout(VS.timer);
  VS.steps=steps;VS.si=-1;VS.onDone=onDone;
  $('#vsMenu').hidden=true;
  vsNextStep();
}
function vsNextStep(){
  clearTimeout(VS.timer);
  VS.si++;
  if(VS.si>=VS.steps.length){const cb=VS.onDone;VS.onDone=null;VS.steps=[];if(cb)cb();return;}
  const s=VS.steps[VS.si];
  $('#vsMsg').textContent=s.text;
  vsApplyVisual(s.ev);
  const wait=(VS.auto?520:900)/VS.speed;
  VS.timer=setTimeout(vsNextStep,wait);
}
function vsSkipTap(){if(VS.steps.length&&VS.si<VS.steps.length)vsNextStep();}

/* ---- メニュー ---- */
function vsMoveBtn(mv,colorId,idx){
  const dot=mk('i',{class:'dot'});dot.style.background=PAL[colorId].hex;
  const btn=mk('button',{class:'btn',type:'button'},
    dot,
    mk('span',{class:'mv-text'},mk('b',{text:mv.name}),mk('small',{text:PAL[colorId].name+'・'+(VS_KIND_TAG[mv.kind]||'')}))
  );
  btn.addEventListener('click',()=>vsPlayerMove(idx));
  return btn;
}
function vsShowMenu(){
  if(VS.S.result)return;
  const S=VS.S,h=vsCurHero(S);
  if(!h.alive){
    if(VS.auto){const slot=vsAutoSwitch(S);if(slot>=0){vsPlayerSwitch(slot,true);return;}}
    vsOpenSwitch(true);return;
  }
  vsShowJankenMenu();
}
/* ---- こうげきジャンケン：わざを えらぶ まえに 1かい ---- */
function vsShowJankenMenu(){
  const S=VS.S;
  const menu=$('#vsMenu');menu.innerHTML='';
  menu.append(mk('p',{class:'hint',text:'こうげきジャンケン！ かった ほうだけ こうげき できる！'}));
  const row=mk('div',{class:'vs-janken'});
  VS_HANDS.forEach(hd=>{
    const b=mk('button',{class:'btn',type:'button'},mk('span',{class:'jk-emoji',text:hd.emoji}),mk('span',{text:hd.name}));
    b.addEventListener('click',()=>vsPlayerJanken(hd.id));
    row.append(b);
  });
  menu.append(row);
  menu.hidden=false;
  $('#vsRunBtn').hidden=true;
  if(VS.auto)vsPlayerJanken(VS_HANDS[Math.floor(S.rand()*3)].id);
}
function vsPlayerJanken(pid){
  if(VS.steps.length)return;
  $('#vsMenu').hidden=true;
  const S=VS.S;
  const eid=vsPickEnemyHand(S,S.mon);
  S.lastMonHand=eid;
  const result=vsJankenJudge(pid,eid);
  S.janken=result;
  const pn=VS_HANDS.find(x=>x.id===pid),en=VS_HANDS.find(x=>x.id===eid);
  const msg=result==='win'?'せんせいの　かち！　こうげき　できる！':
             result==='lose'?'せんせいの　まけ…　こうげき　できない！':
             'あいこ！　りょうほう　こうげき！';
  vsPushSteps([{ev:{t:'janken',result:result},text:pn.emoji+' vs '+en.emoji+'　'+msg}],vsShowMoveMenu);
}
function vsShowMoveMenu(){
  if(VS.S.result)return;
  const S=VS.S,h=vsCurHero(S);
  if(!h.alive){
    if(VS.auto){const slot=vsAutoSwitch(S);if(slot>=0){vsPlayerSwitch(slot,true);return;}}
    vsOpenSwitch(true);return;
  }
  const menu=$('#vsMenu');menu.innerHTML='';
  menu.append(vsMoveBtn(h.moves[0],'black',0));
  menu.append(vsMoveBtn(h.moves[1],h.color,1));
  if(vsAliveHeroes(S).some(x=>x.slot!==S.active)){
    const b=mk('button',{class:'btn full',type:'button',text:'こうたい'});
    b.addEventListener('click',()=>vsOpenSwitch(false));
    menu.append(b);
  }
  menu.hidden=false;
  $('#vsRunBtn').hidden=!!S.isBoss;
  if(VS.auto)vsTryAuto();
}
function vsOpenSwitch(forced){
  const S=VS.S;
  const menu=$('#vsMenu');menu.innerHTML='';
  S.heroes.forEach(h=>{
    if(!h.alive||h.slot===S.active)return;
    const bar=mk('i',{style:'width:'+Math.round(100*clamp(h.hp/h.maxHp,0,1))+'%'});
    const info=mk('div',{style:'flex:1;text-align:left;min-width:0'},
      mk('div',{text:h.name}),mk('div',{class:'bar hp'},bar));
    const row=mk('button',{class:'btn vs-sw-row',type:'button'},mk('img',{src:h.hero.img,alt:''}),info);
    row.addEventListener('click',()=>vsPlayerSwitch(h.slot,forced));
    menu.append(row);
  });
  if(!forced){
    const back=mk('button',{class:'btn full',type:'button',text:'もどる'});
    back.addEventListener('click',vsShowMoveMenu);
    menu.append(back);
  }else{
    menu.append(mk('p',{class:'hint',text:'つぎの　なかまを　えらんでね！'}));
  }
  menu.hidden=false;
}

/* ---- プレイヤーの こうどう ---- */
function dexFromEvents(events){
  events.forEach(e=>{if(e&&e.t==='ko'&&e.unit&&e.unit.kind==='mon')dexRecord(e.unit.type,e.unit.isBoss,e.unit.name);});
}
function vsRunEvents(events){
  dexFromEvents(events);   /* ずかんは できごとが うまれた時点で きろく（えんしゅつの とちゅうで ぬけても OK） */
  const steps=[];
  events.forEach(e=>{
    if(['nextFoeReady','needSwitch','end','ran'].indexOf(e.t)>=0)return;
    const text=vsEventText(e);
    if(text)steps.push({ev:e,text:text});
  });
  vsPushSteps(steps,()=>vsRouteAfter(events));
}
function vsRouteAfter(events){
  const last=events[events.length-1];
  const marker=events.find(e=>['nextFoeReady','needSwitch','end','ran'].indexOf(e.t)>=0);
  if(!marker){vsShowMenu();return;}
  if(marker.t==='nextFoeReady'){
    vsNextMon(VS.S);vsPlaceUnits();vsRefreshPlates();
    vsPushSteps([{ev:{t:'appear'},text:(VS.S.isBoss?'':'つぎに　')+VS.S.mon.name+'が　でてきた！'+vsHandHint(VS.S.mon)}],vsShowMenu);
  }else if(marker.t==='needSwitch'){
    vsOpenSwitch(true);
  }else if(marker.t==='end'){
    vsFinish(marker.win);
  }else if(marker.t==='ran'){
    vsFinish(null);
  }
}
function vsPlayerMove(idx){
  if(VS.steps.length)return;
  $('#vsMenu').hidden=true;
  vsRunEvents(vsRound(VS.S,{type:'move',idx:idx}));
}
function vsPlayerSwitch(slot,forced){
  if(VS.steps.length&&!forced)return;
  $('#vsMenu').hidden=true;
  if(forced){
    VS.S.active=slot;vsPlaceUnits();vsRefreshPlates();
    vsPushSteps([{ev:{t:'switch',unit:vsCurHero(VS.S)},text:vsEventText({t:'switch',unit:vsCurHero(VS.S)})}],vsShowMenu);
  }else{
    vsRunEvents(vsRound(VS.S,{type:'switch',slot:slot}));
  }
}
function vsDoRunAway(){
  if(!VS.S||VS.S.isBoss||VS.steps.length)return;
  vsRunEvents(vsRunAway(VS.S));
}
function vsTryAuto(){
  if(!VS.auto||!VS.S||VS.S.result||VS.steps.length)return;
  const h=vsCurHero(VS.S);
  if(!h.alive){const slot=vsAutoSwitch(VS.S);if(slot>=0)vsPlayerSwitch(slot,true);return;}
  vsPlayerMove(vsAutoChoice(h));
}

/* ---- けっか ---- */
function vsFinish(win){
  const S=VS.S,e=VS.e;
  if(win===null){vsTeardown();returnToField('ran');return;}
  const groupLen=e.boss?1:e.types.length;
  const gain=win?(e.boss?(40+20*(S.stageIdx+1)):Math.round((8+5*S.stageIdx)*(0.7+0.3*groupLen)))
                :(e.boss?(12+6*S.defeated):Math.round(3+2*S.stageIdx));
  const rows=giveExp(gain);
  let unlocks=[];
  if(win&&e.boss&&S.stageIdx===state.cleared&&state.cleared<STAGES.length){
    state.cleared++;unlocks=PALETTE.filter(p=>p.unlock===state.cleared);
  }
  save();
  sfx(win?'win':'lose');
  if(rows.some(r=>r.after>r.before))setTimeout(()=>sfx('levelup'),700);
  vsShowResult({win:win,gain:gain,rows:rows,unlocks:unlocks,stageIdx:S.stageIdx,boss:e.boss});
}
function vsShowResult(r){
  vsTeardown();
  const m=$('#modal');m.innerHTML='';
  const lastStage=r.stageIdx===STAGES.length-1;
  const panel=mk('div',{class:'panel',role:'dialog','aria-modal':'true'});
  let title,sub;
  if(r.boss&&r.win){title='かちぬいた！';sub=lastStage?'ラクガキだいまおうを たおした！ ラクガキ王国に へいわが もどったよ！':'「'+STAGES[r.stageIdx].name+'」の ボスに かった！';}
  else if(r.win){title='しょうり！';sub='てきを やっつけた！ フィールドへ もどろう。';}
  else{title='ざんねん…';sub='みんな たおれちゃった…。スタートちかくへ もどるよ。でも けいけんちは もらえたよ。';}
  panel.append(mk('h2',{class:'rtitle',text:title}),mk('p',{class:'rsub',text:sub}),mk('p',{class:'rexp',text:'けいけんち +'+r.gain}));
  const list=mk('div',{class:'rlist'});
  r.rows.forEach(row=>{
    const up=row.after>row.before;
    const txt=mk('span',{text:up?row.hero.name+'　Lv.'+row.before+' → Lv.'+row.after+'！':row.hero.name+'　Lv.'+row.after});
    if(up)txt.className='up';
    list.append(mk('div',{class:'rrow'},mk('img',{alt:'',src:row.hero.img}),txt));
  });
  panel.append(list);
  r.unlocks.forEach(p=>panel.append(mk('p',{class:'runlock',text:'あたらしい えのぐ「'+p.name+'」が つかえるよ！'})));
  const btns=mk('div',{class:'rbtns'});
  const canNext=r.win&&r.boss&&r.stageIdx+1<STAGES.length;
  if(canNext)btns.append(mk('button',{class:'btn primary',type:'button',text:'つぎの たんけんへ',onclick:()=>enterField(r.stageIdx+1)}));
  btns.append(mk('button',{class:canNext?'btn':'btn primary',type:'button',text:'フィールドへ もどる',onclick:()=>returnToField(r.win)}));
  btns.append(mk('button',{class:'btn',type:'button',text:'おしろへ もどる',onclick:vsLeaveToHome}));
  panel.append(btns);
  m.append(panel);m.hidden=false;
}
function vsLeaveToHome(){
  F.pending=null;
  closeModal();renderHome();show('home');
}

/* ---- きどう ---- */
function startVsBattle(e){
  cancelAnimationFrame(rafId);
  vsTeardown();
  F.pending=e;VS.e=e;
  initVsScene();vsSetScenery(F.si);
  VS.S=vsCreate(state.party,e.boss?[true]:e.types,e.boss,F.si,(Math.random()*4294967296)>>>0);
  VS.auto=false;VS.speed=1;
  vsNextMon(VS.S);
  vsPlaceUnits();
  $('#vsTitle').textContent=(e.boss?'ボスせん！　':'たたかい！　')+STAGES[F.si].name;
  $('#vsAutoBtn').classList.remove('on');
  $('#vsSpeedBtn').textContent='×1';
  $('#vsRunBtn').hidden=!!e.boss;
  mountWrap('vs');
  ctx.clearRect(0,0,cv.width,cv.height);   /* まえの がめんの かきのこりを けす */
  show('vs');
  if(e.boss)sndScene('boss');
  sizeGL(true);
  vsRefreshPlates();
  const introText=(e.boss?'ボスの　':'やせいの　')+VS.S.mon.name+(e.boss?'が　たちふさがった！':'が　あらわれた！')+vsHandHint(VS.S.mon);
  vsPushSteps([
    {ev:{t:'appear'},text:introText},
    {ev:{t:'switch',unit:vsCurHero(VS.S)},text:vsEventText({t:'switch',unit:vsCurHero(VS.S)})}
  ],vsShowMenu);
  lastTs=performance.now();
  rafId=requestAnimationFrame(vloop);
}
$('#vsMsg').addEventListener('click',vsSkipTap);
$('#vsRunBtn').addEventListener('click',vsDoRunAway);
$('#vsAutoBtn').addEventListener('click',()=>{
  VS.auto=!VS.auto;
  $('#vsAutoBtn').classList.toggle('on',VS.auto);
  vsTryAuto();
});
$('#vsSpeedBtn').addEventListener('click',()=>{
  VS.speed=VS.speed===1?2:1;
  $('#vsSpeedBtn').textContent='×'+VS.speed;
});

/* =====================================================================
   ボタンまわり・きどう
   ===================================================================== */
$('#quitBtn').addEventListener('click',leaveBattle);
$('#autoBtn').addEventListener('click',()=>{
  B.auto=!B.auto;
  if(B.S)B.S.auto=B.auto;
  $('#autoBtn').classList.toggle('on',B.auto);
});
$('#speedBtn').addEventListener('click',()=>{
  B.speed=B.speed===1?2:1;
  $('#speedBtn').textContent='×'+B.speed;
});
$('#modeBtn').addEventListener('click',()=>{
  if(!GL.on&&GL.reason==='lib'){toast(GL.loading?'3Dを よみこみ中だよ':'この たんまつでは 3Dを よみこめなかったよ');return;}
  if(GL.on&&B.puffy){B.puffy=false;clearUnits3D();updateModeBtn();toast('切りぬき 3D');}      // ぷっくり → 切りぬき
  else if(GL.on){setMode('2d');}                                                            // 切りぬき → 2D
  else{B.puffy=true;setMode('3d');if(GL.on)toast('ぷっくり 3D');}                           // 2D → ぷっくり
});
{
  const btn=$('#resetBtn');let armed=false,tm=0;
  btn.addEventListener('click',()=>{
    if(!armed){
      armed=true;btn.textContent='ほんとうに けす？ もういちど おしてね';
      tm=setTimeout(()=>{armed=false;btn.textContent='データをぜんぶけす';},3500);
      return;
    }
    clearTimeout(tm);armed=false;btn.textContent='データをぜんぶけす';
    state={party:[],cleared:0};save();renderHome();toast('さいしょから はじめよう！');
  });
}

if(typeof THREE==='undefined'){B.mode='2d';ensureThree();}
load();
renderHome();
updateModeBtn();
updateSndBtn();
if(typeof window!=='undefined'&&window.__RK_TEST__){
  window.__RK_TEST__({createSim:createSim,simTick:simTick,simSkill:simSkill,simInput:simInput,replaySim:replaySim,heroStats:heroStats,BAL:BAL,STAGES:STAGES,expNeed:expNeed,MAX_LV:MAX_LV,SKILLS:SKILLS,F:F,FIELD:FIELD,SND:SND,sfx:sfx,keepClearOfMinimap:keepClearOfMinimap,VS:VS,vsCreate:vsCreate,vsRound:vsRound,vsRunAway:vsRunAway,vsNextMon:vsNextMon,vsAutoChoice:vsAutoChoice,vsAutoSwitch:vsAutoSwitch,vsCurHero:vsCurHero,vsTypeMult:vsTypeMult,VSBAL:VSBAL,startVsBattle:startVsBattle,enterField:enterField,returnToField:returnToField,B:B,state:function(){return state;},fillHoles:fillHoles,analyzeLimbs:analyzeLimbs,buildPuffData:buildPuffData,makePuffyTest:function(st,sc){if(!GL.shadowGeo)GL.shadowGeo=new THREE.CircleGeometry(1,20);return makePuffy(st,sc,0);}});
}
})();
