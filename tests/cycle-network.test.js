import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { classifyWay, blockedNode, metres } from '../public/src/routing/cycle-policy.js';
import { prepareNetwork, findRoute, snapPoint, networkOverlay, loadNetwork } from '../public/src/routing/network.js';
import { CYCLE_PLACES } from '../public/src/api/catalog.js';
import { blockingTrailNoticeForWay } from '../public/src/routing/trail-notices.js';
const road = (extra={}) => ({highway:'residential',...extra});
test('eligibility rejects prohibited/private/technical/conditional routes and prefers bicycle-specific access',()=>{
 for(const tags of [road({access:'private'}),road({bicycle:'no'}),road({vehicle:'no'}),road({'bicycle:conditional':'yes @ (Mo-Fr)'}),road({motorroad:'yes'}),{highway:'construction'},{highway:'steps'},{highway:'motorway'},{highway:'path'},{highway:'cycleway','mtb:scale':'2'},{highway:'cycleway',smoothness:'horrible'}]) assert.equal(classifyWay(tags),null,JSON.stringify(tags));
 assert.ok(classifyWay(road({access:'private',bicycle:'yes'})));
 assert.equal(classifyWay({highway:'footway'}).kind,'walk-bike');
 assert.equal(classifyWay({highway:'footway',bicycle:'designated'}).kind,'path');
 assert.equal(classifyWay({highway:'footway',foot:'no'}),null);
 assert.equal(classifyWay(road({oneway:'yes'})).backward,false);
 assert.equal(classifyWay(road({oneway:'yes','oneway:bicycle':'no'})).backward,true);
 assert.equal(classifyWay(road({oneway:'-1'})).forward,false);
 assert.equal(classifyWay(road({junction:'roundabout'})).backward,false);
 assert.equal(blockedNode({barrier:'gate',locked:'yes'}),true);
 assert.equal(blockedNode({barrier:'gate',locked:'yes',bicycle:'yes'}),true);
 assert.equal(blockedNode({barrier:'bollard'}),false);
 assert.equal(blockedNode({barrier:'gate',bicycle:'yes'}),false);
});
function fixture() {
 const nodes=[[1,168.7,-45],[2,168.701,-45],[3,168.702,-45],[4,168.701,-44.999]];
 const ways=[{id:10,name:'Busy',kind:'road',busy:true,surface:'asphalt',forward:true,backward:true,networks:[]},{id:11,name:'Path',kind:'path',busy:false,surface:'asphalt',forward:true,backward:true,networks:[]}];
 const edges=[[0,1,0],[1,2,0],[0,3,1],[3,2,1]].map(([a,b,w])=>[a,b,w,metres(nodes[a].slice(1),nodes[b].slice(1)),0]);
 return {version:1,nodes,ways,edges,restrictions:[],notices:[],osmTimestamp:'2026-09-27T00:00:00Z'};
}
test('quiet preference takes paths; direct uses shorter road; avoid-busy removes roads',()=>{
 const data=fixture(),n=prepareNetwork(data),a=data.nodes[0].slice(1),b=data.nodes[2].slice(1);
 assert.ok(findRoute(n,a,b).features.every(f=>f.properties.kind==='path'));
 assert.ok(findRoute(n,a,b,{profile:'direct'}).metadata.totals.busy>0);
 assert.equal(findRoute(n,a,b,{profile:'direct',avoidBusy:true}).metadata.totals.busy,0);
});
test('one-way, no-turn and only-turn restrictions change reachability',()=>{
 const data=fixture();data.edges=data.edges.slice(0,2);data.ways[0].backward=false;
 let n=prepareNetwork(data);assert.throws(()=>findRoute(n,data.nodes[2].slice(1),data.nodes[0].slice(1)),/No connected/);
 data.ways[0].backward=true;data.edges[1][2]=1;
 data.restrictions=[{from:10,to:11,via:1,type:'no_right_turn'}];n=prepareNetwork(data);
 assert.throws(()=>findRoute(n,data.nodes[0].slice(1),data.nodes[2].slice(1)),/No connected/);
 data.restrictions=[{from:10,to:99,via:1,type:'only_right_turn'}];n=prepareNetwork(data);
 assert.throws(()=>findRoute(n,data.nodes[0].slice(1),data.nodes[2].slice(1)),/No connected/);
});
test('does not join nearby disconnected networks and validates corrupt geometry',()=>{
 const data=fixture();data.edges=[data.edges[0],data.edges[3]];
 assert.throws(()=>findRoute(prepareNetwork(data),data.nodes[0].slice(1),data.nodes[2].slice(1)),/No connected/);
 assert.throws(()=>snapPoint(prepareNetwork(fixture()),[0,0]),/coverage/);
 assert.throws(()=>snapPoint(prepareNetwork(fixture()),[168.8,-45]),/150 m/);
 const broken=fixture();broken.edges[0][3]=9999;assert.throws(()=>prepareNetwork(broken),/distance/);
 assert.throws(()=>prepareNetwork({version:1}),/Invalid/);
});
test('snapshot excludes reviewed closures; real routes remain contiguous and reversible',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/cycle-network.v1.json',import.meta.url)));
 const n=prepareNetwork(data),p=Object.fromEntries(CYCLE_PLACES.map(([id,name,x,y])=>[id,[x,y]]));
 const exclusions=JSON.parse(readFileSync(new URL('../data/cycling/exclusions.json',import.meta.url)));
 assert.ok(!data.ways.some(w=>exclusions.blockedNamePatterns.some(pattern=>new RegExp(pattern,'i').test(w.name))));
 for(const [a,b] of [['queenstown','frankton'],['arthurs-point','arrowtown'],['shotover-country','lake-hayes-estate'],['hanleys-farm','frankton']])for(const [from,to] of [[a,b],[b,a]]){
  const r=findRoute(n,p[from],p[to]);assert.ok(r.features.length);assert.ok(r.metadata.distanceMetres>0);
  assert.ok(r.features.every(f=>!blockingTrailNoticeForWay(f.properties)));
  for(let i=1;i<r.features.length;i++) assert.deepEqual(r.features[i-1].geometry.coordinates.at(-1),r.features[i].geometry.coordinates[0]);
 }
 const r=findRoute(n,p['arthurs-point'],p.arrowtown,{avoidBusy:true});assert.equal(r.metadata.totals.busy,0);assert.ok(r.features.some(f=>f.properties.networks.includes('Wharehuanui Trail')));
 const overlay=networkOverlay(n);assert.ok(overlay.features.length<data.edges.length);
});
test('snapshot build is reproducible without network access',()=>{
 const path=new URL('../public/data/cycle-network.v1.json',import.meta.url),before=readFileSync(path);
 execFileSync(process.execPath,['scripts/build-cycle-network.js'],{cwd:new URL('..',import.meta.url)});
 assert.deepEqual(readFileSync(path),before);
});
test('network loader rejects failed and malformed responses and permits retry',async()=>{
 await assert.rejects(loadNetwork(async()=>({ok:false})),/downloaded/);
 await assert.rejects(loadNetwork(async()=>({ok:true,json:async()=>({})})),/Invalid/);
 const data=fixture();assert.ok(await loadNetwork(async()=>({ok:true,json:async()=>data})));
});
