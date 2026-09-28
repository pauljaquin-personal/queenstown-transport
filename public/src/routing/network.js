import { metres, withinBounds } from './cycle-policy.js?v=20260928-2';
export const PROFILES = ['quiet', 'direct'];
export function prepareNetwork(data) {
  if (data?.version !== 1 || !Array.isArray(data.nodes) || !data.nodes.length || data.nodes.length > 150000 || !Array.isArray(data.edges) || data.edges.length > 200000 || !Array.isArray(data.ways) || !Array.isArray(data.restrictions) || !Array.isArray(data.notices) || !/^\d{4}-\d{2}-\d{2}/.test(data.osmTimestamp)) throw Error('Invalid cycling network');
  for (const n of data.nodes) if (!Array.isArray(n) || n.length !== 3 || !Number.isSafeInteger(n[0]) || !withinBounds(n.slice(1))) throw Error('Invalid network point');
  for (const w of data.ways) if (!Number.isSafeInteger(w.id) || !['path', 'road', 'walk-bike'].includes(w.kind) || typeof w.name !== 'string' || typeof w.surface !== 'string' || typeof w.busy !== 'boolean' || typeof w.forward !== 'boolean' || typeof w.backward !== 'boolean' || !Array.isArray(w.networks)) throw Error('Invalid cycle way');
  const adjacent = data.nodes.map(() => []);
  for (const e of data.edges) {
    const [a,b,w,length,walk] = e;
    if (e.length !== 5 || ![a,b,w].every(Number.isSafeInteger) || !data.nodes[a] || !data.nodes[b] || !data.ways[w] || !(length > 0) || !Number.isFinite(length) || ![0,1].includes(walk)) throw Error('Invalid network link');
    if (Math.abs(metres(data.nodes[a].slice(1), data.nodes[b].slice(1)) - length) > 1) throw Error('Invalid network distance');
    if (data.ways[w].forward) adjacent[a].push({ to:b, way:w, length, walk });
    if (data.ways[w].backward) adjacent[b].push({ to:a, way:w, length, walk });
  }
  const turns = new Map();
  for (const r of data.restrictions) {
    if (!data.nodes[r.via] || !Number.isSafeInteger(r.from) || !Number.isSafeInteger(r.to) || !/^(no_|only_)/.test(r.type)) throw Error('Invalid turn restriction');
    const list = turns.get(r.via) || []; list.push(r); turns.set(r.via, list);
  }
  return { data, adjacent, turns };
}
class Heap {
  items = [];
  push(item) { let i = this.items.length; this.items.push(item); while (i) { const p = (i-1)>>1; if(this.items[p].cost <= item.cost) break; this.items[i]=this.items[p]; i=p; } this.items[i]=item; }
  pop() { const root=this.items[0], last=this.items.pop(); if(this.items.length) { let i=0; while(i*2+1<this.items.length) { let c=i*2+1; if(c+1<this.items.length && this.items[c+1].cost<this.items[c].cost)c++; if(this.items[c].cost>=last.cost)break; this.items[i]=this.items[c];i=c; } this.items[i]=last; } return root; }
}
function usable(w, avoidBusy) { return !avoidBusy || !w.busy; }
export function snapPoint(network, point, avoidBusy = false) {
  if (!withinBounds(point)) throw Error('Choose a point inside the Whakatipu coverage area.');
  let best = { distance: Infinity, index: -1 };
  // A pin is snapped only to the nearest eligible mapped node, never across a graph gap.
  network.data.nodes.forEach((n, i) => {
    if (!network.adjacent[i].some(e => usable(network.data.ways[e.way], avoidBusy))) return;
    const d = metres(point, n.slice(1));
    if (d < best.distance) best = { index: i, distance: d };
  });
  if (best.distance > 150) throw Error('No eligible cycle connection within 150 m. Move the point onto a mapped road or shared path.');
  return best;
}
function turnAllowed(network, at, previous, incoming, edge) {
  const from = network.data.ways[incoming]?.id, to = network.data.ways[edge.way].id;
  for (const r of network.turns.get(at) || []) {
    if (r.from !== from) continue;
    const matches = r.to === to && (!r.type.endsWith('u_turn') || edge.to === previous);
    if (r.type.startsWith('no_') && matches) return false;
    if (r.type.startsWith('only_') && !matches) return false;
  }
  return true;
}
function cost(w, edge, profile) {
  if (w.kind === 'walk-bike' || edge.walk) return edge.length * 5;
  if (profile === 'direct') return edge.length;
  return edge.length * (w.busy ? 7 : w.kind === 'road' ? 1.7 : w.rough ? 1.15 : 1);
}
export function findRoute(network, from, to, { profile = 'quiet', avoidBusy = false, start = 'Start', end = 'Destination' } = {}) {
  if (!PROFILES.includes(profile)) throw Error('Unknown cycling preference');
  const a = snapPoint(network, from, avoidBusy), b = snapPoint(network, to, avoidBusy);
  if (a.index === b.index) throw Error('Choose two different points on the cycling network.');
  const first = { node:a.index, previous:-1, incoming:-1, cost:0, key:`${a.index}:-1:-1` };
  const heap = new Heap(); heap.push(first);
  const distances = new Map([[first.key, 0]]), previous = new Map();
  let final;
  while (heap.items.length) {
    const current = heap.pop();
    if (distances.get(current.key) !== current.cost) continue;
    if (current.node === b.index) { final = current; break; }
    for (const edge of network.adjacent[current.node]) {
      const w = network.data.ways[edge.way];
      if (!usable(w, avoidBusy) || !turnAllowed(network, current.node, current.previous, current.incoming, edge)) continue;
      const nextCost = current.cost + cost(w, edge, profile);
      const key = `${edge.to}:${edge.way}:${current.node}`;
      if (nextCost >= (distances.get(key) ?? Infinity)) continue;
      distances.set(key, nextCost);
      previous.set(key, { key:current.key, node:current.node, edge });
      heap.push({ node:edge.to, previous:current.node, incoming:edge.way, cost:nextCost, key });
    }
  }
  if (!final) throw Error(avoidBusy ? 'No connected route with busy roads excluded. Try allowing busy roads, or choose different points. Known closures remain excluded.' : 'No connected route in this snapshot. Closures, access restrictions or missing links may prevent a journey. No gap has been joined.');
  const steps=[]; let key=final.key;
  while (previous.has(key)) { const p=previous.get(key); steps.push(p); key=p.key; } steps.reverse();
  const features=[], totals={path:0,road:0,'walk-bike':0,busy:0,unknownSurface:0,unpaved:0};
  let lastWay=-1;
  for (const step of steps) {
    const edge=step.edge, w=network.data.ways[edge.way], kind=edge.walk ? 'walk-bike' : w.kind;
    totals[kind]+=edge.length; if(w.busy)totals.busy+=edge.length;
    if(w.surface==='unknown')totals.unknownSurface+=edge.length; else if(w.rough)totals.unpaved+=edge.length;
    const p=network.data.nodes[step.node].slice(1), q=network.data.nodes[edge.to].slice(1);
    if (lastWay === edge.way && features.at(-1)?.properties.kind === kind) {
      features.at(-1).geometry.coordinates.push(q); features.at(-1).properties.metres += edge.length;
    } else {
      features.push({ type:'Feature', properties:{ source:'OSM', id:w.id, name:w.name, kind, busy:w.busy, surface:w.surface, closed:false, networks:w.networks, metres:edge.length }, geometry:{type:'LineString',coordinates:[p,q]} });
    }
    lastWay=edge.way;
  }
  return { type:'FeatureCollection', metadata:{ type:'network', start,end,profile,avoidBusy,distanceMetres:totals.path+totals.road+totals['walk-bike'],totals,snaps:[a.distance,b.distance],osmTimestamp:network.data.osmTimestamp,reviewedAt:network.data.reviewedAt,reviewAfter:network.data.reviewAfter,notices:network.data.notices },features };
}
let cached, pending;
export async function loadNetwork(fetcher = fetch) {
  if(cached)return cached;
  if(!pending)pending=(async()=>{
    const response=await fetcher(new URL('../../data/cycle-network.v1.json',import.meta.url),{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Cycling network could not be downloaded. Try again.');
    cached=prepareNetwork(await response.json()); return cached;
  })().finally(()=>{pending=null;});
  return pending;
}
export function networkOverlay(network) {
  const features=[]; let lastWay=-1,lastNode=-1;
  for(const [a,b,i] of network.data.edges) {
    const w=network.data.ways[i];
    if(lastWay===i && lastNode===a) features.at(-1).geometry.coordinates.push(network.data.nodes[b].slice(1));
    else features.push({type:'Feature',properties:w,geometry:{type:'LineString',coordinates:[network.data.nodes[a].slice(1),network.data.nodes[b].slice(1)]}});
    lastWay=i;lastNode=b;
  }
  return {type:'FeatureCollection',features};
}
