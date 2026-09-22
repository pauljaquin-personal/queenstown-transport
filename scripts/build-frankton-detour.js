// Offline build of only the supported sections. Never bridge a works gap.
import { readFileSync, writeFileSync } from 'node:fs';
import { distance } from '../public/src/routing/frankton.js';
const ways=JSON.parse(readFileSync(new URL('../data/queenstown-frankton/osm-detour.json',import.meta.url)));
const features=ways.map(w=>{
  if (!['residential','cycleway','footway'].includes(w.tags.highway) || ['private','no'].includes(w.tags.access) || w.tags.foot==='no' || w.tags.oneway==='yes' || w.tags.name==='Frankton Track') throw Error(`Unapproved detour way ${w.id}`);
  const indices=w.selectedNodes.map(n=>w.nodes.indexOf(n));
  const step=indices[1]-indices[0];
  if(Math.abs(step)!==1 || indices.some((v,i)=>v<0 || (i>0 && v-indices[i-1]!==step))) throw Error(`Non-contiguous source geometry ${w.id}`);
  const coordinates=indices.map(i=>w.coordinates[i]);
  const walkBike=w.tags.highway==='footway' && !['yes','designated'].includes(w.tags.bicycle);
  return {type:'Feature',properties:{source:'OSM',id:w.id,name:w.tags.name || 'Roadside footpath / crossing',closed:false,kind:walkBike?'walk-bike':'detour',highway:w.tags.highway},geometry:{type:'LineString',coordinates}};
});
const gaps=[];
for(let i=1;i<features.length;i++) {
  const before=features[i-1],after=features[i];
  const a=before.geometry.coordinates.at(-1),b=after.geometry.coordinates[0];
  if(distance(a,b)<=0.01)continue;
  if(before.properties.id!==1367426422 || after.properties.id!==1226627111) throw Error('Unexpected detour gap');
  gaps.push({afterId:before.properties.id,beforeId:after.properties.id,from:a,to:b,label:'Perkins Road works: temporary path geometry unverified. Follow current signs; no connection is drawn.'});
}
if(gaps.length!==1)throw Error('Expected one explicitly unmapped works section');
const distanceMetres=features.reduce((s,f)=>s+f.geometry.coordinates.slice(1).reduce((n,p,i)=>n+distance(f.geometry.coordinates[i],p),0),0);
const data={type:'FeatureCollection',metadata:{version:2,variant:'detour',status:'partial',verifiedAt:'2026-09-23',reviewAfter:'2026-11-06',start:'Queenstown Gardens — Park Street',end:'Frankton roadside path — beach access unmapped',distanceMetres,gaps,notice:'Partial 2026 detour map: the Perkins Road works section and final connection to Frankton Beach are not mapped. Follow temporary signs and dismount where instructed. This is not a continuous navigation route.',noticeUrl:'https://www.qldc.govt.nz/your-council/council-projects/frankton-track-wastewater-upgrades'},features};
writeFileSync(new URL('../public/data/queenstown-frankton-detour.v1.json',import.meta.url),JSON.stringify(data));
console.log(`${features.length} source sections; ${(distanceMetres/1000).toFixed(2)} km mapped, excluding gaps`);
