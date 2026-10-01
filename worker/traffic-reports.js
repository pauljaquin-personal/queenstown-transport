import { REPORT_TYPES, REPORT_AREAS } from '../public/src/api/traffic-schema.js';
const areas=new Set(REPORT_AREAS.map(([id])=>id));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function validateTrafficReport(input) {
  if (!input || Array.isArray(input) || typeof input!=='object') return {error:'Invalid report.'};
  if (input.website) return {error:'Unable to accept this report.'};
  if (!Object.hasOwn(REPORT_TYPES,input.type) || !areas.has(input.placeId)) return {error:'Choose an issue type and area.'};
  const location=typeof input.location==='string' ? input.location.trim() : '';
  const note=typeof input.note==='string' ? input.note.trim() : '';
  if (location.length<3 || location.length>120) return {error:'Describe the road or trail in 3–120 characters.'};
  if (note.length<5 || note.length>500) return {error:'Describe the problem in 5–500 characters.'};
  if (![0,15,60].includes(input.minutesAgo)) return {error:'Choose when you saw the problem.'};
  if (input.confirmPublic!==true) return {error:'Confirm that your report can be shared publicly.'};
  return {value:{type:input.type,placeId:input.placeId,location,note,minutesAgo:input.minutesAgo}};
}
export async function trafficReports(request,env,now=new Date()) {
  if (!env.COMMUTES) return json({ok:false,error:'Community reports are temporarily unavailable.'},503);
  const url=new URL(request.url),collection=url.pathname==='/api/reports';
  if (request.method==='GET' && collection) {
    try {
      const rows=await env.COMMUTES.prepare(`SELECT id,type,place_id AS placeId,location,note,observed_at AS observedAt,created_at AS createdAt,expires_at AS expiresAt FROM traffic_reports WHERE resolved_at IS NULL AND expires_at > ? AND moderation_state = 'unverified' ORDER BY created_at DESC LIMIT 100`).bind(now.toISOString()).all();
      return json({ok:true,reports:rows.results || [],generatedAt:now.toISOString()});
    } catch {return json({ok:false,error:'Community reports are temporarily unavailable.'},503);}
  }
  if (request.method!=='POST') return json({ok:false,error:'Not found.'},404);
  const origin=request.headers.get('origin');
  if (origin && origin!==url.origin) return json({ok:false,error:'Submit reports from QueenstownGo.'},403);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ok:false,error:'Expected JSON.'},415);
  if (Number(request.headers.get('content-length'))>4096) return json({ok:false,error:'Report is too large.'},413);
  let input;
  try {const text=await request.text();if(new TextEncoder().encode(text).length>4096)return json({ok:false,error:'Report is too large.'},413);input=JSON.parse(text);} catch {return json({ok:false,error:'Invalid JSON.'},400);}
  try {
    const resolved=/^\/api\/reports\/([a-f0-9-]{36})\/resolve$/.exec(url.pathname);
    if (resolved) {
      if (typeof input?.token!=='string' || !/^[a-f0-9-]{72}$/.test(input.token)) return json({ok:false,error:'This browser cannot resolve that report.'},403);
      const result=await env.COMMUTES.prepare('UPDATE traffic_reports SET resolved_at = ? WHERE id = ? AND owner_hash = ? AND resolved_at IS NULL').bind(now.toISOString(),resolved[1],await digest(input.token)).run();
      return result.meta?.changes ? json({ok:true}) : json({ok:false,error:'Report is already resolved or cannot be changed from this browser.'},404);
    }
    if (!collection) return json({ok:false,error:'Not found.'},404);
    const checked=validateTrafficReport(input);if(checked.error)return json({ok:false,error:checked.error},400);
    const r=checked.value,id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
    const observedAt=new Date(now.getTime()-r.minutesAgo*60000).toISOString();
    const expiresAt=new Date(Date.parse(observedAt)+REPORT_TYPES[r.type].hours*3600000).toISOString();
    // A conditional insert makes duplicate suppression and the global burst cap atomic.
    // No IP address, account, or cross-report device identifier is stored.
    const result=await env.COMMUTES.prepare(`INSERT INTO traffic_reports (id,type,place_id,location,note,observed_at,created_at,expires_at,owner_hash)
      SELECT ?,?,?,?,?,?,?,?,? WHERE
      (SELECT COUNT(*) FROM traffic_reports WHERE created_at > ?) < 20 AND NOT EXISTS
      (SELECT 1 FROM traffic_reports WHERE type = ? AND place_id = ? AND location = ? AND note = ? AND created_at > ? AND resolved_at IS NULL)`)
      .bind(id,r.type,r.placeId,r.location,r.note,observedAt,now.toISOString(),expiresAt,await digest(token),new Date(now.getTime()-60000).toISOString(),r.type,r.placeId,r.location,r.note,new Date(now.getTime()-15*60000).toISOString()).run();
    if (!result.meta?.changes) return json({ok:false,error:'A similar report was recently shared, or reports are arriving too quickly. Please check the list and try later.'},429);
    // On subsequent submissions, remove rows that expired over seven days ago.
    await env.COMMUTES.prepare('DELETE FROM traffic_reports WHERE expires_at < ?').bind(new Date(now.getTime()-7*86400000).toISOString()).run().catch(()=>{});
    return json({ok:true,report:{id,type:r.type,placeId:r.placeId,location:r.location,note:r.note,observedAt,createdAt:now.toISOString(),expiresAt},token},201);
  } catch {return json({ok:false,error:'Community reports are temporarily unavailable. Your report has not been confirmed.'},503);}
}
