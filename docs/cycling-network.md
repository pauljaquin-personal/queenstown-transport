# Everyday cycling routing

The planner now computes connected routes across a bounded Whakatipu OpenStreetMap snapshot, instead of limiting every journey to the hand-built Queenstown–Frankton route. Choose one of eleven named area points or pick either endpoint on the map. Calculations and selected coordinates remain in browser memory. No route query, GPS history, account, analytics or commute record is stored or sent to a routing provider.

## Riding choices

- **Prefer paths & quieter roads** weights shared paths and cycle trails ahead of local roads, and strongly penalises major/higher-speed roads. It does not guarantee low traffic or an easy gradient.
- **Shorter route** minimises mapped distance, with a penalty for walking the bike. This can use substantially more road riding.
- **Exclude busy roads** removes trunk, primary and secondary roads (including links), plus roads with a numeric mapped speed above 60 km/h. It may make a journey unavailable; the planner never silently relaxes it.
- Paths/trails, roads, busy roads and walk-bike sections have separate map colours and distance totals. Named route sections, unknown surfaces, rough/unsealed distance, endpoint offsets and data dates are shown.
- The earlier partial Frankton detour and closed normal alignment remain separate reference views. They are not represented as continuous available cycle routes.

The map can show the retained road/path network independently of QLDC's existing trail overlay. QLDC asset geometry is a reference layer, not the topology of this routing graph. The chosen route dims that background layer.

## Source and licence

OSM snapshot timestamp: 2026-09-27T23:07:21Z. Bounds: longitude 168.57–169.04, latitude -45.13–-44.88. The Overpass query is saved in `data/cycling/network.overpass`. The source response is preserved in `osm-source.json.gz` with duplicate relation geometries removed. It contains public map data only. No map tiles were downloaded or bundled.

The extract and derived `public/data/cycle-network.v1.json` are © OpenStreetMap contributors, licensed under [ODbL](https://www.openstreetmap.org/copyright); they are not covered by the repository's MIT code licence. The public UI links to attribution and the downloadable derived database. Named route relations identify mapped Queenstown Trails sections, but are not an official endorsement or a guarantee of complete coverage. QLDC geometry is not combined into the derived database.

Rebuild offline with `node scripts/build-cycle-network.js`. The build is deterministic and tested. Refreshing data requires a deliberate new extract, review of `exclusions.json`, checking known journeys in both directions, and a cache/asset version change. Do not query Overpass per user journey. The application has no dependency on Overpass at runtime.

## Access and topology

Connections use shared OSM node IDs only. Crossing lines, nearby endpoints, rivers and unmapped gaps are never joined geometrically. Start/end points snap to the nearest eligible mapped node within 150 m; access from the selected point is not drawn or counted. Pins across a barrier or on the other side of a river are not a promise of access: users must start at the displayed network endpoint. Presets identify public road points rather than area centroids.

The builder excludes prohibited/private/destination/customer access, construction/proposed ways, motorways, motorroads, steps, driveways, technical MTB and hiking tags, impassable/very rough surfaces, ambiguous conditional access, and unmapped connections. Explicit bicycle permission can override generic access, following OSM tagging. Ordinary public footways are walk-bike links, not riding permissions; explicit bicycle bans remain excluded. Unknown path/track access is excluded. Rough but nontechnical cycleway surfaces remain available and reported.

Bicycle direction rules, one-way roads and roundabouts are respected. Via-node no-turn/only-turn restrictions are enforced with incoming-way state; bicycle exemptions are honoured. Ways participating in unsupported via-way/conditional restrictions are excluded conservatively. Locked/restricted nodes and unknown gates block passage; bollards, cycle barriers and cattle grids may still require care/dismounting. Tagged dismount nodes produce walk-bike sections. The graph does not model every physical barrier, traffic signal phase, gradient, weather condition or unreported closure.

## Reviewed exclusions

Checked 28 September 2026, review due 5 October. Exclusions never expire into automatic reopening. An overdue review adds a visible warning.

- [Queenstown Trails notices](https://queenstowntrails.org.nz/maps-and-trails/all-trails/) and [Frankton Track](https://queenstowntrails.org.nz/maps-and-trails/all-trails/frankton-track/) report 2026 works, and the current page banner reports rain damage, an Arrow River Bridges closure, northern Lake Hayes bridge closure, Lower Shotover flooding and Bush Creek closure.
- [Twin Rivers](https://queenstowntrails.org.nz/maps-and-trails/all-trails/twin-rivers-trail/) has a Shotover Delta detour notice on the index. Index/page notices differ; this planner conservatively retains the exclusion pending direct review.
- [Shotover Gorge](https://queenstowntrails.org.nz/maps-and-trails/all-trails/shotover-gorge/) includes Grade 3/4 sections and is excluded for everyday cycling.

Affected named trails/relations are excluded in full where exact closure geometry has not been verified. This deliberately removes some open portions. `data/cycling/exclusions.json` records relation IDs, name patterns, dates and source URLs. Other roads and shared paths may provide a route, but are not described as the official detour. Links to official notices, route maps and DOC cycling options remain available.

## Verification and deployment

`npm test` covers access policy, directionality, turn restrictions, disconnected graphs, invalid endpoints and payloads, route continuity, named trail inclusion, closure exclusions, reproducible builds, loader retry, commute privacy and optional PWA caching. Browser smoke checks cover both preferences, busy-road exclusion, legacy detour, network overlay, map picking and a 390px mobile viewport.

PWA shell v01-12 uses app/map modules v20260928-2. Graph and routing modules are optional network-first assets with cache fallback only after use; a failed download does not prevent the main map or commute UI from loading. Existing GitHub → Cloudflare deployment is unchanged; no database or binding changes are needed.
