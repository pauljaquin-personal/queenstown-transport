import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { classifyWay, blockedNode, withinBounds, metres, BOUNDS } from '../public/src/routing/cycle-policy.js';
const source = JSON.parse(gunzipSync(readFileSync(new URL('../data/cycling/osm-source.json.gz', import.meta.url))));
const exclusions = JSON.parse(readFileSync(new URL('../data/cycling/exclusions.json', import.meta.url)));
if (source.remark || !source.osm3s?.timestamp_osm_base || !Array.isArray(source.elements)) throw Error('Incomplete OSM extract');
const blocked = new Set(), networks = new Map(), nodeTags = new Map(), restrictions = [];
const namePatterns = exclusions.blockedNamePatterns.map(p => new RegExp(p, 'i'));
for (const e of source.elements) {
  if (e.type === 'node') nodeTags.set(e.id, e.tags || {});
  if (e.type !== 'relation') continue;
  if (e.tags?.route === 'bicycle') for (const m of e.members.filter(m => m.type === 'way')) {
    if (exclusions.blockedRelations.includes(e.id)) blocked.add(m.ref);
    if (e.tags.name && !['Wanaka Queenstown Tour Aotearoa', 'Southern Way 1000'].includes(e.tags.name)) {
      const list = networks.get(m.ref) || []; list.push(e.tags.name); networks.set(m.ref, list);
    }
  }
  if (e.tags?.type === 'restriction') {
    if ((e.tags.except || '').split(';').includes('bicycle') && !e.tags['restriction:bicycle']) continue;
    const type = e.tags['restriction:bicycle'] || e.tags.restriction;
    if (!type && !e.tags['restriction:conditional'] && !e.tags['restriction:bicycle:conditional']) continue;
    const from = e.members.find(m => m.role === 'from'), to = e.members.find(m => m.role === 'to'), via = e.members.filter(m => m.role === 'via');
    if (from?.type === 'way' && to?.type === 'way' && via.length === 1 && via[0].type === 'node' && /^(no_|only_)/.test(type || '') && !Object.keys(e.tags).some(k => k.includes('conditional'))) {
      restrictions.push({ from: from.ref, to: to.ref, via: via[0].ref, type });
    } else {
      // Complex/conditional restrictions fail closed, rather than silently allowing a turn.
      for (const m of e.members.filter(m => m.type === 'way')) blocked.add(m.ref);
    }
  }
}
const nodes = [], index = new Map(), ways = [], edges = [];
function node(id, point) {
  if (!index.has(id)) { index.set(id, nodes.length); nodes.push([id, point[0], point[1]]); }
  return index.get(id);
}
let excluded = 0;
for (const e of source.elements.filter(e => e.type === 'way').sort((a,b) => a.id-b.id)) {
  const policy = classifyWay(e.tags);
  if (!policy || blocked.has(e.id) || namePatterns.some(p => p.test(e.tags?.name || ''))) { excluded++; continue; }
  if (!Array.isArray(e.nodes) || e.nodes.length !== e.geometry?.length) throw Error('Missing geometry');
  const way = ways.length;
  ways.push({ id: e.id, name: e.tags.name || networks.get(e.id)?.[0] || (policy.kind === 'road' ? 'Unnamed road' : 'Unnamed cycle connection'), ...policy, networks: networks.get(e.id) || [] });
  for (let i = 1; i < e.nodes.length; i++) {
    const a = [e.geometry[i-1].lon, e.geometry[i-1].lat], b = [e.geometry[i].lon, e.geometry[i].lat];
    if (!withinBounds(a) || !withinBounds(b) || blockedNode(nodeTags.get(e.nodes[i-1])) || blockedNode(nodeTags.get(e.nodes[i]))) continue;
    const length = metres(a,b);
    if (length < .01) continue;
    const walk = [e.nodes[i-1], e.nodes[i]].some(id => nodeTags.get(id)?.bicycle === 'dismount');
    edges.push([node(e.nodes[i-1], a), node(e.nodes[i], b), way, Math.round(length * 100) / 100, walk ? 1 : 0]);
  }
}
const data = { version: 1, bounds: BOUNDS, osmTimestamp: source.osm3s.timestamp_osm_base, ...exclusions, nodes, ways, edges, restrictions: restrictions.filter(r => index.has(r.via)).map(r => ({...r, via: index.get(r.via)})) };
// Keep the graph as a single optional static asset; no endpoint coordinates leave the browser.
writeFileSync(new URL('../public/data/cycle-network.v1.json', import.meta.url), JSON.stringify(data));
console.log(`${nodes.length} nodes, ${edges.length} links, ${ways.length} ways; ${excluded} ways excluded.`);
