const FEED_URL = "https://www.orc.govt.nz/transit/google_transit.zip";
const td = new TextDecoder();

function u16(v,o){ return v.getUint16(o,true); }
function u32(v,o){ return v.getUint32(o,true); }

function centralEntries(buffer) {
  const v = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (u32(v,i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw Error("Invalid GTFS ZIP");
  const count = u16(v,eocd+10);
  let p = u32(v,eocd+16);
  const entries = new Map();
  for (let i=0;i<count;i++) {
    if (u32(v,p)!==0x02014b50) throw Error("Invalid ZIP directory");
    const method=u16(v,p+10), compressed=u32(v,p+20), size=u32(v,p+24);
    const nameLen=u16(v,p+28), extraLen=u16(v,p+30), commentLen=u16(v,p+32);
    const offset=u32(v,p+42);
    const name=td.decode(new Uint8Array(buffer,p+46,nameLen));
    entries.set(name,{method,compressed,size,offset});
    p += 46+nameLen+extraLen+commentLen;
  }
  return entries;
}

async function unzipText(buffer, entries, name) {
  const e=entries.get(name);
  if (!e) throw Error("GTFS missing "+name);
  const v=new DataView(buffer);
  if (u32(v,e.offset)!==0x04034b50) throw Error("Invalid ZIP entry");
  const nameLen=u16(v,e.offset+26), extraLen=u16(v,e.offset+28);
  const start=e.offset+30+nameLen+extraLen;
  const bytes=new Uint8Array(buffer,start,e.compressed);
  if (e.method===0) return td.decode(bytes);
  if (e.method!==8) throw Error("Unsupported ZIP compression");
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

function csv(text) {
  const rows=[]; let row=[], field="", quoted=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (quoted) {
      if (c==='"' && text[i+1]==='"') { field+='"'; i++; }
      else if (c==='"') quoted=false;
      else field+=c;
    } else if (c==='"') quoted=true;
    else if (c===',') { row.push(field); field=""; }
    else if (c==='\n') { row.push(field.replace(/\r$/,"")); rows.push(row); row=[]; field=""; }
    else field+=c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/,"")); rows.push(row); }
  const headers=rows.shift() || [];
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? ""])));
}

function routeNumber(route) {
  return (route.route_short_name || "").trim();
}

export async function queenstownGtfs() {
  const upstream=await fetch(FEED_URL,{headers:{"user-agent":"QueenstownGo/0.1 (+https://queenstowngo.nz)"}});
  if (!upstream.ok) throw Error("ORC GTFS returned "+upstream.status);
  const buffer=await upstream.arrayBuffer();
  const entries=centralEntries(buffer);
  const names=["agency.txt","routes.txt","trips.txt","stops.txt","stop_times.txt","shapes.txt","feed_info.txt","calendar.txt","calendar_dates.txt"];
  const texts=Object.fromEntries(await Promise.all(names.map(async n=>[n,await unzipText(buffer,entries,n)])));
  const agencies=csv(texts["agency.txt"]);
  const routes=csv(texts["routes.txt"]);
  const qtnAgencyIds=new Set(agencies.filter(a=>String(a.agency_id||"").toUpperCase()==="QTN" || /queenstown/i.test((a.agency_name||"")+" "+(a.agency_url||""))).map(a=>a.agency_id));
  let qRoutes=routes.filter(r=>qtnAgencyIds.has(r.agency_id) && ["1","2","3","4","5"].includes(routeNumber(r)));
  if (!qRoutes.length) qRoutes=routes.filter(r=>["1","2","3","4","5"].includes(routeNumber(r)) && /queenstown|arrowtown|sunshine|kelvin|jacks|lake hayes|remarkables|quail/i.test((r.route_long_name||"")+" "+(r.route_desc||"")));
  const routeIds=new Set(qRoutes.map(r=>r.route_id));
  const trips=csv(texts["trips.txt"]).filter(t=>routeIds.has(t.route_id));
  const tripIds=new Set(trips.map(t=>t.trip_id));
  const shapeIds=new Set(trips.map(t=>t.shape_id).filter(Boolean));
  const stopTimes=csv(texts["stop_times.txt"]).filter(s=>tripIds.has(s.trip_id));
  const stopIds=new Set(stopTimes.map(s=>s.stop_id));
  const tripRoute=new Map(trips.map(t=>[t.trip_id,t.route_id]));
  const routeById=new Map(qRoutes.map(r=>[r.route_id,r]));
  const tripById=new Map(trips.map(t=>[t.trip_id,t]));
  const calendars=csv(texts["calendar.txt"]);
  const calendarDates=csv(texts["calendar_dates.txt"]);
  const calendarByService=new Map(calendars.map(row=>[row.service_id,row]));
  const exceptionsByDate=new Map();
  for (const row of calendarDates) {
    if (!exceptionsByDate.has(row.date)) exceptionsByDate.set(row.date,new Map());
    exceptionsByDate.get(row.date).set(row.service_id,row.exception_type);
  }
  function serviceRuns(serviceId,dateText,weekday) {
    const exception=exceptionsByDate.get(dateText)?.get(serviceId);
    if (exception==="1") return true;
    if (exception==="2") return false;
    const cal=calendarByService.get(serviceId);
    if (!cal) return false;
    return dateText>=cal.start_date && dateText<=cal.end_date && cal[weekday]==="1";
  }
  const weekdayNames=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const nowParts=new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(new Date());
  const part=type=>nowParts.find(p=>p.type===type)?.value || "";
  const today=part("year")+part("month")+part("day");
  const weekday=({Sun:"sunday",Mon:"monday",Tue:"tuesday",Wed:"wednesday",Thu:"thursday",Fri:"friday",Sat:"saturday"})[part("weekday")];
  const nowSeconds=Number(part("hour"))*3600+Number(part("minute"))*60+Number(part("second"));
  const departureByStop=new Map();
  for (const s of stopTimes) {
    if (!s.departure_time || s.pickup_type==="1") continue;
    const trip=tripById.get(s.trip_id);
    if (!trip || !serviceRuns(trip.service_id,today,weekday)) continue;
    const [h,m,sec]=s.departure_time.split(":").map(Number);
    const departureSeconds=h*3600+m*60+sec;
    if (departureSeconds < nowSeconds) continue;
    const route=routeById.get(trip.route_id);
    if (!route) continue;
    if (!departureByStop.has(s.stop_id)) departureByStop.set(s.stop_id,[]);
    departureByStop.get(s.stop_id).push({
      time:s.departure_time,seconds:departureSeconds,route:routeNumber(route),
      destination:s.stop_headsign || trip.trip_headsign || route.route_long_name || ""
    });
  }
  for (const departures of departureByStop.values()) departures.sort((a,b)=>a.seconds-b.seconds);
  const stopRouteIds=new Map();
  for (const s of stopTimes) {
    const routeId=tripRoute.get(s.trip_id);
    if (!routeId) continue;
    if (!stopRouteIds.has(s.stop_id)) stopRouteIds.set(s.stop_id,new Set());
    stopRouteIds.get(s.stop_id).add(routeId);
  }
  const stops=csv(texts["stops.txt"]).filter(s=>stopIds.has(s.stop_id)).map(s=>({
    id:s.stop_id,name:s.stop_name,lat:Number(s.stop_lat),lng:Number(s.stop_lon),
    routes:[...(stopRouteIds.get(s.stop_id)||[])].map(id=>routeById.get(id)).filter(Boolean)
      .map(r=>({id:r.route_id,number:routeNumber(r),name:r.route_long_name||"",color:r.route_color ? "#"+r.route_color.replace(/^#/,"") : null}))
      .sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true})),
    departures:(departureByStop.get(s.stop_id)||[]).slice(0,5).map(({seconds,...departure})=>departure)
  })).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng));
  const shapePoints=new Map();
  for (const s of csv(texts["shapes.txt"])) {
    if (!shapeIds.has(s.shape_id)) continue;
    if (!shapePoints.has(s.shape_id)) shapePoints.set(s.shape_id,[]);
    shapePoints.get(s.shape_id).push([Number(s.shape_pt_sequence),Number(s.shape_pt_lon),Number(s.shape_pt_lat)]);
  }
  for (const points of shapePoints.values()) points.sort((a,b)=>a[0]-b[0]);
  const shapes=[];
  const seen=new Set();
  for (const trip of trips) {
    if (!trip.shape_id || seen.has(trip.shape_id)) continue;
    seen.add(trip.shape_id);
    const route=qRoutes.find(r=>r.route_id===trip.route_id);
    const coords=(shapePoints.get(trip.shape_id)||[]).map(p=>[p[1],p[2]]).filter(p=>p.every(Number.isFinite));
    if (coords.length>1) shapes.push({
      id:trip.shape_id,routeId:trip.route_id,route:routeNumber(route),name:route?.route_long_name||trip.trip_headsign||"",
      color:route?.route_color ? "#"+route.route_color.replace(/^#/,"") : null,coordinates:coords
    });
  }
  const feed=csv(texts["feed_info.txt"])[0] || {};
  return {
    source:"Otago Regional Council GTFS",license:"CC BY 4.0",feedVersion:feed.feed_version||null,
    feedStart:feed.feed_start_date||null,feedEnd:feed.feed_end_date||null,
    routes:qRoutes.map(r=>({id:r.route_id,number:routeNumber(r),name:r.route_long_name||"",color:r.route_color ? "#"+r.route_color.replace(/^#/,"") : null})),
    stops,shapes
  };
}
