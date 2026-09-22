import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {routeFor,loadRoute,distance} from '../public/src/routing/frankton.js';
const url=new URL('../public/data/queenstown-frankton.v1.json',import.meta.url);
const data=JSON.parse(readFileSync(url));
test('route reverses every segment without mutating source',()=>{
 const reverse=routeFor(data,'frankton','queenstown');
 assert.deepEqual(reverse.features[0].geometry.coordinates[0],data.features.at(-1).geometry.coordinates.at(-1));
 assert.deepEqual(reverse.features.at(-1).geometry.coordinates.at(-1),data.features[0].geometry.coordinates[0]);
 assert.equal(data.features[0].properties.id,190016859);
 assert.equal(reverse.metadata.start,data.metadata.end);
 assert.ok(data.metadata.distanceMetres>5800 && data.metadata.distanceMetres<6100);
 assert.equal(data.features.filter(f=>f.properties.source==='QLDC').length,11);
 assert.ok(data.features.filter(f=>f.properties.source==='QLDC').every(f=>f.properties.closed));
});
test('unsupported pairs and corrupt or disconnected geometry fail closed',()=>{
 for(const [from,to] of [['queenstown','queenstown'],['queenstown','arrowtown'],['frankton','hanleys-farm']]) assert.throws(()=>routeFor(data,from,to));
 assert.throws(()=>routeFor({features:[]},'queenstown','frankton'));
 const bad=structuredClone(data);bad.features[1].geometry.coordinates[0]=[168.70,-45.02];
 assert.throws(()=>routeFor(bad,'queenstown','frankton'),/Disconnected/);
 bad.features[0].geometry.coordinates[0]=[NaN,-45.03];
 assert.throws(()=>routeFor(bad,'queenstown','frankton'),/coordinate/);
});
test('source joins are survey offsets, not invented long straight lines',()=>{
 for(let i=1;i<data.features.length;i++) assert.ok(distance(data.features[i-1].geometry.coordinates.at(-1),data.features[i].geometry.coordinates[0])<=12);
 assert.ok(data.features.reduce((n,f)=>n+f.geometry.coordinates.length,0)>200);
});
test('offline generation is reproducible and verifies the source schema',()=>{
 const before=readFileSync(url,'utf8');execFileSync(process.execPath,['scripts/build-frankton-route.js']);assert.equal(readFileSync(url,'utf8'),before);
});
test('loader handles HTTP, network and invalid payload failures; successful retry works',async()=>{
 await assert.rejects(loadRoute('queenstown','frankton',async()=>({ok:false})),/unavailable/);
 await assert.rejects(loadRoute('queenstown','frankton',async()=>{throw Error('offline')}),/offline/);
 await assert.rejects(loadRoute('queenstown','frankton',async()=>({ok:true,json:async()=>({})})),/Invalid/);
 const route=await loadRoute('queenstown','frankton',async(url,options)=>{
  assert.equal(url.pathname.endsWith('/data/queenstown-frankton.v1.json'),true);
  assert.ok(options.signal);return {ok:true,json:async()=>data};
 });assert.equal(route.features.length,16);
});
const detourUrl=new URL('../public/data/queenstown-frankton-detour.v1.json',import.meta.url);
const detour=JSON.parse(readFileSync(detourUrl));
test('detour preserves the works gap and reverses fragments and gap endpoints',()=>{
 const forward=routeFor(detour,'queenstown','frankton','detour');
 const reverse=routeFor(detour,'frankton','queenstown','detour');
 assert.equal(forward.metadata.status,'partial');
 assert.equal(forward.features.length,31);
 assert.ok(forward.metadata.distanceMetres>5000 && forward.metadata.distanceMetres<5100);
 assert.deepEqual(reverse.metadata.gaps[0].from,forward.metadata.gaps[0].to);
 assert.equal(reverse.metadata.gaps[0].beforeId,forward.metadata.gaps[0].afterId);
 assert.deepEqual(reverse.features[0].geometry.coordinates[0],forward.features.at(-1).geometry.coordinates.at(-1));
 assert.ok(forward.features.every(f=>!f.properties.closed && f.properties.id!==1484179810));
 assert.ok(forward.features.some(f=>f.properties.kind==='walk-bike'));
 assert.match(forward.metadata.end,/access unmapped/);
});
test('detour refuses invented gaps, closed track substitutes and wrong variants',()=>{
 const bad=structuredClone(detour);bad.metadata.gaps=[];
 assert.throws(()=>routeFor(bad,'queenstown','frankton','detour'),/gap/);
 const disconnected=structuredClone(detour);disconnected.features[1].geometry.coordinates[0]=[168.70,-45.02];
 assert.throws(()=>routeFor(disconnected,'queenstown','frankton','detour'),/Disconnected/);
 const closed=structuredClone(detour);closed.features[0].properties.closed=true;
 assert.throws(()=>routeFor(closed,'queenstown','frankton','detour'),/Unverified/);
 assert.throws(()=>routeFor(detour,'queenstown','frankton','normal'),/Invalid/);
 assert.throws(()=>routeFor(detour,'queenstown','frankton','unknown'),/Unsupported/);
});
test('detour rebuild is reproducible and loader selects only the local detour snapshot',async()=>{
 const before=readFileSync(detourUrl,'utf8');
 execFileSync(process.execPath,['scripts/build-frankton-detour.js']);assert.equal(readFileSync(detourUrl,'utf8'),before);
 const loaded=await loadRoute('queenstown','frankton',async url=>{
  assert.ok(url.pathname.endsWith('/queenstown-frankton-detour.v1.json'));
  return {ok:true,json:async()=>detour};
 },'detour');assert.equal(loaded.metadata.status,'partial');
});
