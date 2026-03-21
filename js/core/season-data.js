/* ═══ js/core/season-data.js ═══ */

// ★ SEASON_DATA (config.js에서 로드)
const SEASON_DATA = (window.AppConfig && AppConfig.SEASON_DATA) || {domestic:{lead:'',events:[]},overseas:{lead:'',events:[]}};
let _currentSeasonTrack='domestic';
const _SN=['❄️','❄️','🌸','🌸','🌸','☀️','☀️','☀️','🍂','🍂','🍂','❄️'];
const _SL=['겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'];

function switchSeasonTrack(t){
  _currentSeasonTrack=t;
  const d=document.getElementById('season-tab-domestic'),o=document.getElementById('season-tab-overseas');
  [d,o].forEach(b=>{b.style.background='transparent';b.style.color='var(--text-muted)';b.style.borderColor='var(--border)';b.style.fontWeight='600';});
  const a=t==='domestic'?d:o;
  a.style.background='var(--accent)';a.style.color='#fff';a.style.borderColor='var(--accent)';a.style.fontWeight='800';
  renderSeasonPanel(t);
}

function getDaysUntil(m,d){const now=new Date(),y=now.getFullYear();let t=new Date(y,m-1,d||15);if(t<now)t=new Date(y+1,m-1,d||15);return Math.ceil((t-now)/(864e5));}

function renderDailyBrief(track){
  const data=SEASON_DATA[track];
  const up=[...data.events].map(ev=>({...ev,dday:getDaysUntil(ev.m,ev.d)})).filter(e=>e.dday>=0).sort((a,b)=>a.dday-b.dday).slice(0,2);
  if(!up.length)return'';
  return '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">📢 오늘의 소싱 브리핑</div>'+up.map(ev=>{
    const dd=ev.dday===0?'🔥D-DAY':ev.dday<=7?`D-${ev.dday}`:ev.dday<=30?`${ev.dday}일`:`${Math.ceil(ev.dday/7)}주`;
    return `<div class="daily-brief" onclick="briefSearch(this)" data-keywords='${JSON.stringify(ev.kw)}'><div class="brief-icon">${ev.l.substring(0,2)}</div><div class="brief-body"><div class="brief-title">${ev.l} — 지금 소싱하세요!</div><div class="brief-kw">${ev.kw.map(k=>`<span class="brief-chip" onclick="event.stopPropagation();searchByCategory('${k}')">${k}</span>`).join('')}</div></div><div class="brief-dday">${dd}</div></div>`;
  }).join('');
}

function briefSearch(el){
  try {
    const rawData = el.dataset.keywords;
    if (!rawData) return;
    const kwArray = JSON.parse(rawData);
    if(kwArray && kwArray.length > 0) window.triggerUnifiedSearch(kwArray[0]);
  } catch(e) {
    console.error("브리핑 검색 실행 실패:", e);
  }
}

function renderSeasonPanel(track){
  const data=SEASON_DATA[track],cm=new Date().getMonth();
  document.getElementById('season-leadtime').textContent=data.lead;
  const bEl=document.getElementById('season-daily-brief');if(bEl)bEl.innerHTML=renderDailyBrief(track);
  const evm={};data.events.forEach(ev=>{if(!evm[ev.m])evm[ev.m]=[];evm[ev.m].push(ev);});
  let h='<div class="stl-wrap">';
  for(let i=0;i<12;i++){
    const mn=i+1,isN=i===cm,df=Math.min(Math.abs(i-cm),12-Math.abs(i-cm)),isS=df<=1&&!isN;
    const hc=isN?'now':isS?'soon':'';
    h+=`<div class="stl-month" data-month="${i}"><div class="stl-hdr ${hc}">${_SN[i]} ${mn}월${isN?' ◀':''}</div>`;
    h+=`<div class="stl-bar ${hc}">${isN?'<div class="stl-marker"></div>':''}</div>`;
    h+=`<div class="stl-season">${_SL[i]}</div><div class="stl-events">`;
    if(evm[mn])evm[mn].forEach(ev=>{h+=`<div class="stl-ev ${isN?'hot':isS?'warm':'cool'}" onclick="searchBySeasonEvent(this)" data-keywords='${JSON.stringify(ev.kw)}' title="${ev.kw.join(', ')}">${ev.l}</div>`;});
    h+=`</div></div>`;
  }
  document.getElementById('season-timeline-strip').innerHTML=h+'</div>';
  setTimeout(()=>{const sc=document.getElementById('stl-scroll-container'),cur=document.querySelector('.stl-month[data-month="'+cm+'"]');if(sc&&cur)sc.scrollLeft=cur.offsetLeft-sc.offsetWidth/2+cur.offsetWidth/2;},100);
}

function searchBySeasonEvent(btn){
  const kw=JSON.parse(btn.dataset.keywords||'[]');if(!kw.length)return;
  const si=document.getElementById('v5-search-input');if(si)si.value=kw[0];
  if(typeof runIntegratedV5Search==='function')runIntegratedV5Search();
  if(kw.length>1){const cc=document.getElementById('v5-keyword-chips'),wr=document.getElementById('v5-keyword-expansion');
    if(cc&&wr){wr.style.display='flex';cc.innerHTML=kw.slice(1).map(k=>`<span onclick="searchByCategory('${k}')" style="cursor:pointer;padding:4px 10px;border-radius:14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);font-size:11px;color:var(--accent);">${k}</span>`).join('');}}
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>renderSeasonPanel('domestic'),500);});