import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrafficReport,trafficReports} from '../worker/traffic-reports.js';
const report={type:'congestion',placeId:'frankton',location:'Frankton Road',note:'Queues towards town',minutesAgo:15,confirmPublic:true};
const request=(body=report,path='/api/reports',extra={})=>new Request('https://qt.test'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://qt.test',...extra},body:JSON.stringify(body)});
const now=new Date('2026-09-29T03:00:00Z');
function database({rows=[],changes=1,fail=false}={}) {
 const calls=[];
 return {calls,prepare(sql){return {bind(...values){calls.push({sql,values});return {async all(){if(fail)throw Error('offline');return {results:rows};},async run(){if(fail)throw Error('offline');return {meta:{changes}};}};}};}};
}
test('validates categories, location, limits, age and explicit public consent',()=>{
 assert.equal(validateTrafficReport(report).value.type,'congestion');
 for(const patch of [{type:'__proto__'},{placeId:'anywhere'},{note:' '},{note:'x'.repeat(501)},{location:'a'},{location:'x'.repeat(121)},{minutesAgo:999},{confirmPublic:false},{website:'spam'}])assert.ok(validateTrafficReport({...report,...patch}).error,JSON.stringify(patch));
 assert.ok(validateTrafficReport(null).error);
 assert.equal(validateTrafficReport({...report,type:'trail',location:'  Twin Rivers Trail  '}).value.location,'Twin Rivers Trail');
});
test('public list selects only active reports and never includes management hashes',async()=>{
 const db=database({rows:[{id:'1',type:'trail'}]});const response=await trafficReports(new Request('https://qt.test/api/reports'),{COMMUTES:db},now);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual((await response.json()).reports,[{id:'1',type:'trail'}]);
 assert.match(db.calls[0].sql,/resolved_at IS NULL AND expires_at > \?/);assert.doesNotMatch(db.calls[0].sql,/owner_hash/);assert.match(db.calls[0].sql,/LIMIT 100/);
});
test('submissions expire from observation time and return a private resolve token',async()=>{
 for(const [type,hours] of [['congestion',2],['trail',72]]){
  const db=database();const response=await trafficReports(request({...report,type}),{COMMUTES:db},now);const data=await response.json();
  assert.equal(response.status,201);assert.equal(data.report.observedAt,'2026-09-29T02:45:00.000Z');
  assert.equal(Date.parse(data.report.expiresAt)-Date.parse(data.report.observedAt),hours*3600000);
  assert.equal(data.token.length,72);assert.equal(data.report.token,undefined);
  const insert=db.calls[0];assert.match(insert.sql,/COUNT\(\*\)/);assert.match(insert.sql,/NOT EXISTS/);assert.ok(!insert.values.includes(data.token));assert.equal(insert.values[8].length,64);
 }
});
test('rejects duplicate/burst inserts and handles storage failures honestly',async()=>{
 assert.equal((await trafficReports(request(),{COMMUTES:database({changes:0})},now)).status,429);
 assert.equal((await trafficReports(request(),{COMMUTES:database({fail:true})},now)).status,503);
 assert.equal((await trafficReports(request(),{},now)).status,503);
});
test('only the owner token can resolve, and resolution does not delete other reports',async()=>{
 const id='01234567-89ab-cdef-0123-456789abcdef',path=`/api/reports/${id}/resolve`,token=id+id;
 let db=database();assert.equal((await trafficReports(request({token},path),{COMMUTES:db},now)).status,200);
 assert.match(db.calls[0].sql,/WHERE id = \? AND owner_hash = \?/);assert.equal(db.calls[0].values[1],id);
 assert.equal((await trafficReports(request({token:'bad'},path),{COMMUTES:db},now)).status,403);
 db=database({changes:0});assert.equal((await trafficReports(request({token},path),{COMMUTES:db},now)).status,404);
});
test('rejects cross-origin and oversized requests even without content-length',async()=>{
 const env={COMMUTES:database()};
 assert.equal((await trafficReports(request(report,'/api/reports',{origin:'https://elsewhere.test'}),env,now)).status,403);
 assert.equal((await trafficReports(request(report,'/api/reports',{'content-type':'text/plain'}),env,now)).status,415);
 assert.equal((await trafficReports(request({...report,note:'a'.repeat(5000)}),env,now)).status,413);
 assert.equal((await trafficReports(new Request('https://qt.test/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:'{' }),env,now)).status,400);
});
