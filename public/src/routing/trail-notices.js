export const TRAIL_NOTICES = [
  {
    id:"arrow-river-bridges",
    mapMatch:/Arrow River Bridges/i,
    routeMatch:/Arrow River Bridges/i,
    title:"Arrow River Bridges Trail",
    detail:"Closed between Tobins Bridge and Whitechapel Road.",
    routing:"block",
  },
  {
    id:"lake-hayes",
    mapMatch:/Lake Hayes/i,
    routeMatch:/Lake Hayes/i,
    title:"Waiwhakaata Lake Hayes Trail",
    detail:"Partially open; the bridge at the northern end remains closed.",
    routing:"block",
  },
  {
    id:"bush-creek",
    mapMatch:/Bush Creek/i,
    routeMatch:/Bush Creek/i,
    title:"Bush Creek",
    detail:"Closed.",
    routing:"block",
  },
  {
    id:"frankton-track",
    mapMatch:/Frankton Track/i,
    routeMatch:/Frankton Track/i,
    title:"Frankton Track",
    detail:"2026 detour in place due to major infrastructure upgrades.",
    routing:"block",
  },
  {
    id:"coronet-loop",
    mapMatch:/Coronet Loop/i,
    routeMatch:/Coronet Loop/i,
    title:"Coronet Loop",
    detail:"Closed for winter.",
    routing:"block",
  },
  {
    id:"lower-shotover",
    mapMatch:/Lower Shotover/i,
    routeMatch:null,
    title:"Lower Shotover Conservation Area",
    detail:"Flooded; check current trail notice before travelling.",
    routing:"warn",
  },
];

export function trailNoticeForMapName(name = "") {
  return TRAIL_NOTICES.find(notice => notice.mapMatch?.test(name)) || null;
}

export function blockingTrailNoticeForWay(way) {
  const labels = [way?.name || "", ...(way?.networks || [])];
  return TRAIL_NOTICES.find(notice =>
    notice.routing === "block" &&
    notice.routeMatch &&
    labels.some(label => notice.routeMatch.test(label))
  ) || null;
}
