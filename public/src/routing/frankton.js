// Loaded only after a route request; no startup dependencies and no remote API.
export function distance(a,b) {
  const rad=Math.PI/180;
  const h=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function routeFor(data,from,to) {
  if (!((from==='queenstown' && to==='frankton') || (from==='frankton' && to==='queenstown'))) throw Error('Unsupported route');
  if(data?.type!=='FeatureCollection' || data.metadata?.version!==1 || data.metadata?.status!=='closed' || !Array.isArray(data.features) || data.features.length!==16) throw Error('Invalid route data');
  for(const f of data.features) {
    if(f.geometry?.type!=='LineString' || f.geometry.coordinates.length<2 || !['QLDC','OSM'].includes(f.properties?.source) || typeof f.properties.closed!=='boolean') throw Error('Invalid route segment');
    for(const p of f.geometry.coordinates) if(!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite) || p[0]<168.66 || p[0]>168.73 || p[1]<-45.04 || p[1]>-45.01) throw Error('Invalid route coordinate');
  }
  for(let i=1;i<data.features.length;i++) if(distance(data.features[i-1].geometry.coordinates.at(-1),data.features[i].geometry.coordinates[0])>12) throw Error('Disconnected route');
  const route=structuredClone(data);
  if(from==='frankton') {
    route.features.reverse();
    for(const f of route.features) f.geometry.coordinates.reverse();
    [route.metadata.start,route.metadata.end]=[route.metadata.end,route.metadata.start];
  }
  return route;
}
export async function loadRoute(from,to,fetcher=fetch) {
  const response=await fetcher(new URL('../../data/queenstown-frankton.v1.json',import.meta.url),{signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error('Route data unavailable');
  return routeFor(await response.json(),from,to);
}
