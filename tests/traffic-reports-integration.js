// Run against a local wrangler dev server after applying local D1 migrations.
import assert from 'node:assert/strict';
const base=process.env.REPORT_TEST_URL || 'http://127.0.0.1:4174';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Test reports must never be posted to production');
const api=async(path,body)=>{
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json',origin:base}:{},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
};
const created=[];
try {
 for(const type of ['congestion','trail']) {
  const body={type,placeId:type==='trail'?'gibbston':'frankton',location:`Local test ${crypto.randomUUID()}`,note:'Synthetic integration test, not a real traffic incident.',minutesAgo:15,confirmPublic:true};
  const result=await api('/api/reports',body);assert.equal(result.status,201,JSON.stringify(result.data));created.push(result.data);
  assert.equal((await api('/api/reports',body)).status,429,'duplicate must not be inserted');
  const list=await api('/api/reports');const item=list.data.reports.find(r=>r.id===result.data.report.id);assert.ok(item);
  assert.equal(item.token,undefined);assert.equal(item.owner_hash,undefined);
  assert.equal(Date.parse(item.expiresAt)-Date.parse(item.observedAt),(type==='trail'?72:2)*3600000);
  assert.equal((await api(`/api/reports/${item.id}/resolve`,{token:crypto.randomUUID()+crypto.randomUUID()})).status,404);
  assert.ok((await api('/api/reports')).data.reports.some(r=>r.id===item.id),'wrong token must not resolve');
 }
} finally {
 for(const {report,token} of created) {
  assert.equal((await api(`/api/reports/${report.id}/resolve`,{token})).status,200);
  assert.ok(!(await api('/api/reports')).data.reports.some(r=>r.id===report.id));
 }
}
console.log('Local D1 integration passed: congestion, trail, expiry, duplicate suppression, private tokens and resolution.');
