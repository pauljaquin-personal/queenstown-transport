import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { csv, readGtfs, buildQueenstownGtfs, serviceDayStart } from '../worker/gtfs.js';
import worker from '../worker/index.js';

function fixture() {
  return {
    'agency.txt':[{agency_id:'QTN',agency_timezone:'Pacific/Auckland'}],
    'routes.txt':[{route_id:'q1',agency_id:'QTN',route_short_name:'1',route_long_name:'Both directions'},{route_id:'q2',agency_id:'QTN',route_short_name:'2',route_long_name:'Route two'},{route_id:'d1',agency_id:'ORC',route_short_name:'1'}],
    'trips.txt':[{trip_id:'t',route_id:'q1',service_id:'daily',trip_headsign:'Airport'},{trip_id:'other',route_id:'d1',service_id:'daily'}],
    'stops.txt':[{stop_id:'s',stop_name:'Town',stop_lat:'-45.03',stop_lon:'168.66'},{stop_id:'d',stop_name:'Dunedin',stop_lat:'-45.8',stop_lon:'170.5'}],
    'stop_times.txt':[{trip_id:'t',stop_id:'s',departure_time:'09:00:00'},{trip_id:'other',stop_id:'d',departure_time:'09:00:00'}],
    'calendar.txt':[{service_id:'daily',start_date:'20260101',end_date:'20271231',...Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d=>[d,'1']))}],
    'calendar_dates.txt':[],
  };
}
const run=(tables,date='2026-09-28T19:00:00Z')=>buildQueenstownGtfs(tables,new Date(date)); // Tuesday 08:00 NZDT
const departures=(tables,date)=>run(tables,date).stops[0].departures;

test('CSV supports BOM, CRLF, quoted commas/newlines, escaped quotes and empty fields',()=>{
  assert.deepEqual(csv('\uFEFFid,name,empty\r\n1,"Stop, ""A""\nBay",\r\n'),[{id:'1',name:'Stop, "A"\nBay',empty:''}]);
});
test('Queenstown routes and stop relationships follow trip IDs, not matching route numbers',()=>{
  const f=fixture();f['trips.txt'].push({trip_id:'two',route_id:'q2',service_id:'daily'});
  f['stop_times.txt'].push({trip_id:'two',stop_id:'s',departure_time:'10:00:00'});
  const data=run(f);
  assert.deepEqual(data.stops.map(s=>s.id),['s']);
  assert.deepEqual(data.stops[0].routes.map(r=>r.number),['1','2']);
  assert.equal(data.timeZone,'Pacific/Auckland');
  assert.equal(data.serviceDate,'20260929');
});
test('next five sorted departures include tomorrow, omit past and no-pickup rows, and use headsign precedence',()=>{
  const f=fixture();f['stop_times.txt']=['12:00:00','07:59:59','09:00:00','10:00:00','08:00:00','11:00:00','13:00:00'].map(departure_time=>({trip_id:'t',stop_id:'s',departure_time}));
  f['stop_times.txt'].push({trip_id:'t',stop_id:'s',departure_time:'08:01:00',pickup_type:'1'});
  f['stop_times.txt'][2].stop_headsign='Town centre';
  const ds=departures(f);
  assert.deepEqual(ds.map(d=>d.time),['08:00:00','09:00:00','10:00:00','11:00:00','12:00:00']);
  assert.equal(ds[1].destination,'Town centre');assert.equal(ds[0].destination,'Airport');
  assert.equal(departures(f,'2026-09-29T10:30:00Z')[0].serviceDate,'20260930');
});
test('calendar bounds and weekdays apply; date exceptions override both',()=>{
  const f=fixture(),cal=f['calendar.txt'][0];cal.tuesday='0';
  assert.notEqual(departures(f)[0].serviceDate,'20260929');
  f['calendar_dates.txt']=[{service_id:'daily',date:'20260929',exception_type:'1'}];
  assert.equal(departures(f)[0].serviceDate,'20260929');
  cal.tuesday='1';f['calendar_dates.txt'][0].exception_type='2';
  assert.notEqual(departures(f)[0].serviceDate,'20260929');
  cal.end_date='20260928';assert.equal(departures(f).length,0);
  f['calendar_dates.txt'][0].exception_type='1';assert.equal(departures(f).length,1);
  delete f['calendar.txt'];assert.equal(departures(f).length,1);
});
test('previous service-day 24+ hour departures survive midnight and honour that day’s exceptions',()=>{
  const f=fixture();f['stop_times.txt'][0].departure_time='24:30:00';
  const ds=departures(f,'2026-09-28T11:15:00Z');
  assert.equal(ds[0].serviceDate,'20260928');assert.equal(ds[0].time,'00:30:00');
  assert.equal(ds[0].scheduledAt,'2026-09-28T11:30:00.000Z');
  f['calendar_dates.txt']=[{service_id:'daily',date:'20260928',exception_type:'2'}];
  assert.equal(departures(f,'2026-09-28T11:15:00Z')[0].serviceDate,'20260929');
});
test('NZ standard/daylight offsets and DST transition days use GTFS noon minus twelve hours',()=>{
  assert.equal(new Date(serviceDayStart('20260929')).toISOString(),'2026-09-28T11:00:00.000Z');
  assert.equal(new Date(serviceDayStart('20260601')).toISOString(),'2026-05-31T12:00:00.000Z');
  assert.equal(new Date(serviceDayStart('20260927')).toISOString(),'2026-09-26T11:00:00.000Z');
  assert.equal(new Date(serviceDayStart('20260405')).toISOString(),'2026-04-04T12:00:00.000Z');
  assert.equal(departures(fixture(),'2026-09-26T19:00:00Z')[0].scheduledAt,'2026-09-26T20:00:00.000Z');
});
test('invalid/untimed departures do not invent times; route name is final headsign fallback',()=>{
  const f=fixture();delete f['trips.txt'][0].trip_headsign;
  for(const time of ['', 'bad','12:99:00']) f['stop_times.txt'].push({trip_id:'t',stop_id:'s',departure_time:time});
  assert.equal(departures(f)[0].destination,'Both directions');
  assert.ok(departures(f).every(d=>d.time==='09:00:00'));
});

// Small ZIP fixture exercises the same directory and decompression path as ORC.
export function zip(files,compressed=false) {
  const local=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(files)) {
    const n=Buffer.from(name),raw=Buffer.from(text),body=compressed?deflateRawSync(raw):raw;
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(compressed?8:0,8);h.writeUInt32LE(body.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(compressed?8:0,10);c.writeUInt32LE(body.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
    local.push(h,n,body);central.push(c,n);offset+=h.length+n.length+body.length;
  }
  const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(local.length/3,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  const b=Buffer.concat([...local,dir,end]);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}
const files=()=>Object.fromEntries(Object.entries(fixture()).filter(([k])=>k!=='calendar.txt').map(([name,rows])=>{
  if(name==='calendar_dates.txt')rows=[{service_id:'daily',date:'20260929',exception_type:'1'}];
  const keys=[...new Set(rows.flatMap(Object.keys))];return [name,[keys.join(','),...rows.map(r=>keys.map(k=>r[k]||'').join(','))].join('\n')];
}));
test('ZIP accepts stored and compressed files, optional metadata/shapes and exception-only calendars',async()=>{
  for(const compressed of [false,true]) {
    const data=await readGtfs(zip(files(),compressed));assert.equal(run(data).stops[0].departures.length,1);
  }
  await assert.rejects(readGtfs(new ArrayBuffer(5)),/Invalid GTFS ZIP/);
  const missing=files();delete missing['calendar_dates.txt'];await assert.rejects(readGtfs(zip(missing)),/service calendars/);
});
test('Worker returns no-store bus JSON, ignores obsolete response cache and reuses only static feed',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(zip(files(),true));};
  globalThis.caches={default:{match(){throw Error('obsolete response cache must not be read');}}};
  try {
    globalThis.fetch=async()=>new Response('upstream unavailable',{status:503});
    const failed=await worker.fetch(new Request('https://example.test/api/buses'),{});
    assert.equal(failed.status,502);assert.equal(failed.headers.get('cache-control'),'no-store');
    assert.equal((await failed.json()).ok,false);
    globalThis.fetch=async()=>{calls++;return new Response(zip(files(),true));};
    for(let i=0;i<2;i++) {
      const response=await worker.fetch(new Request('https://example.test/api/buses?v=2'),{});
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const data=await response.json();assert.equal(data.ok,true);assert.equal(data.stops[0].id,'s');assert.ok(data.generatedAt);
    }
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;delete globalThis.caches;}
});

test('shared shapes retain their route association and points sort by sequence',()=>{
 const f=fixture();f['trips.txt'][0].shape_id='shared';
 f['trips.txt'].push({trip_id:'two',route_id:'q2',service_id:'daily',shape_id:'shared'});
 f['shapes.txt']=[{shape_id:'shared',shape_pt_sequence:'2',shape_pt_lon:'168.7',shape_pt_lat:'-45.0'},{shape_id:'shared',shape_pt_sequence:'1',shape_pt_lon:'168.6',shape_pt_lat:'-45.1'}];
 const shapes=run(f).shapes;assert.equal(shapes.length,2);
 assert.deepEqual(shapes.map(s=>s.routeId),['q1','q2']);
 assert.deepEqual(shapes[0].coordinates,[[168.6,-45.1],[168.7,-45]]);
});
