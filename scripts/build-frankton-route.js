// Offline, reproducible build. No network calls or broad name-based route selection.
import { readFileSync, writeFileSync } from 'node:fs';
import { distance } from '../public/src/routing/frankton.js';
const read = name => JSON.parse(readFileSync(new URL(`../data/queenstown-frankton/${name}`, import.meta.url)));
const schema = read('schema.json');
for (const [field, code, label] of [['CYCLE','01','Yes'],['ASSTAT','02','In Use'],['OPSTAT','02','Closed'],['OPSTAT','01','Open']]) {
  if (!schema.fields.find(f => f.name === field)?.domain?.codedValues.some(v => v.code === code && v.name === label)) throw Error(`Schema mismatch: ${field}`);
}
const qldc = read('qldc.geojson').features;
const osm = read('osm-connectors.json');
const features = [];
function add(source, id, reverse = false) {
  let coordinates, properties;
  if (source === 'QLDC') {
    const f = qldc.find(f => f.properties.OBJECTID === id);
    if (!f || f.properties.TRAILNME !== 'Frankton Track & Kelvin Peninsula Trail' || f.properties.CYCLE !== '01' || f.properties.ASSTAT !== '02' || !['01','02'].includes(f.properties.OPSTAT)) throw Error(`Unexpected QLDC feature ${id}`);
    coordinates = structuredClone(f.geometry.coordinates);
    properties = { source, id, name: f.properties.TRAILNME, closed: f.properties.OPSTAT === '02' };
  } else {
    const w = osm.find(w => w.id === id);
    if (!w || !['residential','cycleway'].includes(w.tags.highway) || ['no','private'].includes(w.tags.access) || w.tags.bicycle === 'no' || w.tags.oneway === 'yes') throw Error(`Unsuitable connector ${id}`);
    coordinates = structuredClone(w.coordinates);
    properties = { source, id, name: w.tags.name, closed: false, highway: w.tags.highway };
  }
  if (reverse) coordinates.reverse();
  features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
}
for (const id of [190016859,791466105,30472626]) add('OSM', id, true);
for (const id of [248,64045,247,64341,63942,136,486,245,246,135]) add('QLDC', id, true);
for (const id of [1376046834,926100099]) add('OSM', id, true);
add('QLDC', 3);
// Marina cycleway rejoins inside feature 3. Trim only the overlapping prefix,
// projecting onto the actual source segment rather than inventing a connector.
const last = features.at(-1).geometry.coordinates;
const junction = features.at(-2).geometry.coordinates.at(-1);
let best = { metres: Infinity };
for (let i=0;i<last.length-1;i++) {
  const a=last[i], b=last[i+1], scale=Math.cos(junction[1]*Math.PI/180);
  const dx=(b[0]-a[0])*scale, dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((junction[0]-a[0])*scale*dx+(junction[1]-a[1])*dy)/(dx*dx+dy*dy)));
  const p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
  const metres=distance(p,junction);
  if(metres<best.metres) best={metres,i,p};
}
features.at(-1).geometry.coordinates=[best.p,...last.slice(best.i+1)];
const joins=[];
for(let i=1;i<features.length;i++) {
  const a=features[i-1].geometry.coordinates.at(-1), b=features[i].geometry.coordinates[0];
  const metres=distance(a,b);
  if(metres>12) throw Error(`Unverified gap: ${metres}m at ${features[i].properties.id}`);
  // Preserve source coordinates; small survey offsets remain separate features.
  joins.push({from:features[i-1].properties.id,to:features[i].properties.id,metres});
}
const metres=features.reduce((total,f)=>total+f.geometry.coordinates.slice(1).reduce((s,p,i)=>s+distance(f.geometry.coordinates[i],p),0),0);
const result={type:'FeatureCollection',metadata:{version:1,verifiedAt:'2026-09-23',status:'closed',start:'Queenstown Gardens — Park Street',end:'Frankton Beach',distanceMetres:metres,joins,notice:'Normal alignment only: QLDC marks sections closed. The 2026 Frankton Road footpath detour is not mapped. Follow signed diversions.',noticeUrl:'https://www.queenstowntrails.org.nz/maps-and-trails/all-trails/frankton-track/'},features};
writeFileSync(new URL('../public/data/queenstown-frankton.v1.json',import.meta.url),JSON.stringify(result));
console.log(`${features.length} segments; ${(metres/1000).toFixed(2)} km; maximum source offset ${Math.max(...joins.map(j=>j.metres)).toFixed(2)} m`);
