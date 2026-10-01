import { REPORT_TYPES, REPORT_AREAS } from './api/traffic-schema.js?v=20260929-12';
const OWNER_KEY='qt-traffic-report-owners-v1';
const COOLDOWN_KEY='qt-traffic-last-shared-v1';
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
export function initCommunity({toast,onReports}) {
  const $=selector=>document.querySelector(selector);
  const dialog=$('#report-dialog'),form=$('#report-form'),status=$('#report-status'),list=$('#community-report-list');
  let reports=[],pending=false,loadGeneration=0;
  let owners={};try {owners=JSON.parse(localStorage.getItem(OWNER_KEY)||'{}');if(!owners || typeof owners!=='object' || Array.isArray(owners))owners={};}catch{}
  for(const [id,label] of REPORT_AREAS){const option=text('option',label);option.value=id;$('#report-place').append(option);}
  for(const [id,{label}] of Object.entries(REPORT_TYPES)){const option=text('option',label);option.value=id;$('#report-type').append(option);}
  function expiryNote(){const hours=REPORT_TYPES[$('#report-type').value].hours;$('#report-expiry').textContent=`This report expires ${hours===72?'3 days':hours+' hours'} after you saw the problem. You can mark it resolved sooner from this browser.`;}
  $('#report-type').onchange=expiryNote;expiryNote();
  async function api(path,body) {
    const response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok || !data.ok)throw Error(data.error || 'Community reports are unavailable.');return data;
  }
  function draw() {
    const now=Date.now();reports=reports.filter(r=>Date.parse(r.expiresAt)>now);onReports(reports);
    list.replaceChildren();
    if (!reports.length) {list.append(text('p','No recent community reports. This does not mean every route is clear.'));return;}
    for(const r of reports){
      const article=document.createElement('article');article.className='community-report';
      article.append(text('strong',REPORT_TYPES[r.type]?.label || 'Traffic problem'));
      const area=REPORT_AREAS.find(([id])=>id===r.placeId)?.[1] || r.placeId;
      article.append(text('p',`${area} · ${r.location}`),text('p',r.note));
      const minutes=Math.max(0,Math.floor((now-Date.parse(r.observedAt))/60000));
      const age=minutes<1?'just now':minutes<60?`${minutes} min ago`:`${Math.floor(minutes/60)} h ago`;
      article.append(text('small',`Unverified · seen ${age}`));
      if(owners[r.id]){
        const resolve=text('button','Mark resolved');resolve.type='button';
        resolve.onclick=async()=>{
          resolve.disabled=true;
          try {await api(`/api/reports/${r.id}/resolve`,{token:owners[r.id]});loadGeneration++;delete owners[r.id];try{localStorage.setItem(OWNER_KEY,JSON.stringify(owners));}catch{}reports=reports.filter(x=>x.id!==r.id);draw();toast('Report marked resolved.');}
          catch(error){toast(error.message);resolve.disabled=false;}
        };article.append(resolve);
      }
      list.append(article);
    }
  }
  async function refresh() {
    const current=++loadGeneration;$('#community-report-status').textContent='Loading community reports…';
    try {const data=await api('/api/reports');if(current!==loadGeneration)return;reports=data.reports;draw();$('#community-report-status').textContent='Recent reports from the community · not official traffic information.';}
    catch {if(current!==loadGeneration)return;reports=[];onReports([]);list.replaceChildren();$('#community-report-status').textContent='Community reports are unavailable. Try refreshing when you’re online.';}
  }
  function open(){status.textContent='';dialog.showModal();}
  $('#open-report').onclick=open;
  $('#refresh-community').onclick=refresh;
  $('#view-community').onclick=()=>{$('#community-reports').open=true;$('#community-reports').scrollIntoView({behavior:'smooth',block:'nearest'});refresh();};
  form.onsubmit=async event=>{
    event.preventDefault();if(pending)return;
    let last=0;try{last=Number(localStorage.getItem(COOLDOWN_KEY))||0;}catch{}
    if(Date.now()-last<300000){status.textContent='Please wait five minutes between reports.';return;}
    pending=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent='Sharing report…';
    try {
      const data=await api('/api/reports',{type:$('#report-type').value,placeId:$('#report-place').value,location:$('#report-location').value,note:$('#report-note').value,minutesAgo:Number($('#report-when').value),confirmPublic:$('#report-public').checked,website:$('#report-website').value});
      let saved=true;
      // Keep only a small number of local per-report management tokens.
      owners=Object.fromEntries([...Object.entries(owners).slice(-49),[data.report.id,data.token]]);
      try{localStorage.setItem(OWNER_KEY,JSON.stringify(owners));localStorage.setItem(COOLDOWN_KEY,String(Date.now()));}catch{saved=false;}
      loadGeneration++;reports=[data.report,...reports.filter(r=>r.id!==data.report.id)];draw();
      $('#community-report-status').textContent='Your report is shared publicly and labelled unverified.';
      form.reset();expiryNote();dialog.close();$('#community-reports').open=true;
      toast(saved?'Traffic report shared with the community.':'Report shared. Browser storage is unavailable; your resolve button may not survive a reload.');
    } catch(error){status.textContent=error.name==='TimeoutError'?'The request timed out. Refresh community reports before retrying; it may have arrived.':error.message || 'Could not share. Your text is still here.';}
    finally{pending=false;submit.disabled=false;}
  };
  // Do not let a dismiss/reopen allow two submissions while the first is pending.
  dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
  refresh();
  setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return {open,refresh};
}
