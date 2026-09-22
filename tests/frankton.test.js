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
