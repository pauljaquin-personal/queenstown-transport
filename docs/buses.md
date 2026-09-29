# ORC scheduled buses (Stage 1)

`GET /api/buses?v=2` returns Queenstown routes 1–5, directional GTFS route records, route shapes, stops and up to five upcoming departures at each stop within the next seven days. Each departure includes its absolute `scheduledAt` UTC timestamp, original `serviceDate`, `tripId`, `routeId`, route number, Queenstown-local `time`, pickup type and destination. This is timetable data, not realtime predictions.

Calendar date additions/removals override the weekday calendar and its inclusive date range. Exception-only feeds work without `calendar.txt`. Previous service days are searched for times beyond 24:00. Time conversion follows the GTFS definition of agency-local noon minus twelve hours, including NZ daylight-saving transition days. `stop_headsign` overrides `trip_headsign`, then route name is used as a fallback. Stops that prohibit pickup and blank/invalid departure times are omitted from departures.

Only static feed tables are cached (one hour per Worker isolate, with a one-hour Cloudflare upstream cache request). Departures are recalculated for every API request; responses use `Cache-Control: no-store`. Feed failures produce an uncached 502 rather than old departures. `generatedAt`, `timeZone` and `departuresThrough` describe the result. The service worker does not intercept the bus API. The `v=2` frontend URL avoids browser entries cached by the former six-hour API response implementation.

Opening a stop fetches fresh departures; an open popup refreshes every 30 seconds and clears its timer on close. Times always display in Pacific/Auckland, with dates for other days. Loading, no service within seven days and unavailable states are distinct. Data is inserted with DOM text nodes, not HTML.

## Validation

Use Node 22+ (`DecompressionStream('deflate-raw')` support), then `npm test`. Tests cover ZIP/CSV decoding, optional tables, calendars/exceptions, midnight, DST, route membership, shared shapes, headsigns, pickup restrictions, top-five ordering, Worker errors/cache headers, popup text and shell version consistency. The existing cycling tests remain enabled.

For a feed check, download https://www.orc.govt.nz/transit/google_transit.zip and independently compare raw calendar/trip/stop-time rows with the API at its `generatedAt` timestamp. During this fix, feed version `260408-1230` matched all 115 stops and 560 returned departures. Browser checks covered a five-departure popup and the existing 6.7 km Queenstown–Frankton cycling route.

GTFS reference: https://gtfs.org/documentation/schedule/reference/
