// Loaded only after a route request; no startup dependencies and no remote API.
export function distance(a,b) {
  const rad=Math.PI/180;
  const h=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function routeFor(data,from,to,variant='normal') {
  if (!((from==='queenstown' && to==='frankton') || (from==='frankton' && to==='queenstown'))) throw Error('Unsupported route');
  if (!['normal','detour'].includes(variant)) throw Error('Unsupported route variant');
  const detour = variant === 'detour';
  if(data?.type!=='FeatureCollection' || data.metadata?.version!==(detour?2:1) || data.metadata?.status!==(detour?'partial':'closed') || !Array.isArray(data.features) || data.features.length!==(detour?31:16)) throw Error('Invalid route data');
  if (detour && (data.metadata.variant!=='detour' || data.metadata.gaps?.length!==1 || data.metadata.gaps[0].afterId!==1367426422 || data.metadata.gaps[0].beforeId!==1226627111)) throw Error('Invalid works gap');
  for(const f of data.features) {
    if(f.geometry?.type!=='LineString' || f.geometry.coordinates.length<2 || !['QLDC','OSM'].includes(f.properties?.source) || typeof f.properties.closed!=='boolean') throw Error('Invalid route segment');
    if (detour && (f.properties.source!=='OSM' || f.properties.closed || !['detour','walk-bike'].includes(f.properties.kind) || f.properties.id===1484179810)) throw Error('Unverified detour segment');
    for(const p of f.geometry.coordinates) if(!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite) || p[0]<168.66 || p[0]>168.73 || p[1]<-45.04 || p[1]>-45.01) throw Error('Invalid route coordinate');
  }
  let worksGaps = 0;
  for(let i=1;i<data.features.length;i++) {
    const before=data.features[i-1], after=data.features[i];
    const a=before.geometry.coordinates.at(-1), b=after.geometry.coordinates[0];
    if (distance(a,b) <= (detour?0.01:12)) continue;
    const gap=detour && data.metadata.gaps[0];
    if (!gap || before.properties.id!==gap.afterId || after.properties.id!==gap.beforeId || distance(a,gap.from)>0.01 || distance(b,gap.to)>0.01) throw Error('Disconnected route');
    worksGaps++;
  }
  if(detour && worksGaps!==1) throw Error('Missing works gap');
  const route=structuredClone(data);
  if(from==='frankton') {
    route.features.reverse();
    for(const f of route.features) f.geometry.coordinates.reverse();
    if(detour) for(const gap of route.metadata.gaps) {
      [gap.from,gap.to]=[gap.to,gap.from];
      [gap.afterId,gap.beforeId]=[gap.beforeId,gap.afterId];
    }
    [route.metadata.start,route.metadata.end]=[route.metadata.end,route.metadata.start];
  }
  return route;
}
export async function loadRoute(from,to,fetcher=fetch,variant='normal') {
  if (!['normal','detour'].includes(variant)) throw Error('Unsupported route variant');
  const file=variant==='detour'?'queenstown-frankton-detour.v1.json':'queenstown-frankton.v1.json';
  const response=await fetcher(new URL(`../../data/${file}`,import.meta.url),{signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error('Route data unavailable');
  return routeFor(await response.json(),from,to,variant);
}
