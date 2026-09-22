# Queenstown ↔ Frankton normal route

The app now also offers a [partial 2026 detour view](frankton-detour.md). This document describes the preserved normal alignment. Current shell cache: v01-7; entrypoint version: 20260923-4.

Verified 23 September 2026. This is the **normal Frankton Track alignment**, not an open route recommendation or a mapped 2026 diversion. All eleven selected QLDC segments currently have OPSTAT `02` (Closed). The app preserves these flags, draws them red/dashed, and links current detour advice. Do not remove that warning without refreshed evidence.

## Sources and meaning

- [QLDC layer 57](https://gis.qldc.govt.nz/server/rest/services/OpenSpaces/Parks_VIEWER/MapServer/57?f=pjson) is `Tracks_and_Trails` (polyline). Schema/domain evidence is retained in `data/queenstown-frankton/schema.json`.
- Verified domains: CYCLE `01` = Yes, `02` = No; ASSTAT `02` = In Use (not proof of opening); OPSTAT `01` = Open, `02` = Closed; CYCLEGRADE `01` = Grade 1/Easiest, `02` = Grade 2/Easy; SURFACE `09` = Metalled. Values are strings with leading zeros.
- The actual name is **Frankton Track & Kelvin Peninsula Trail**, not simply “Frankton Track”. A name match alone also selects the opposite shore/Kelvin Peninsula. The explicit corridor IDs in the build script prevent that error.
- Query used: layer `/query`, `where=UPPER(TRAILNME) LIKE '%FRANKTON%'`, `outFields=*`, `returnGeometry=true`, `outSR=4326`, `f=geojson`. Returned 63 features; selected source geometry and necessary attributes are retained in `qldc.geojson`.
- Source sequence west to east: QLDC 248, 64045, 247, 64341, 63942, 136, 486, 245, 246, 135; then marina connectors; then QLDC 3. Stored source coordinates are unrounded.
- [OpenStreetMap map API](https://www.openstreetmap.org/api/0.6/map?bbox=168.660,-45.037,168.729,-45.016) supplied a one-time extract. Only five necessary connector ways are retained with tags, version and timestamp: Park Street 190016859, 791466105, 30472626 (residential, shared cycle lanes); marina 1376046834 and 926100099 (designated cycleways). No highway riding or unverified footpath detour is invented. Attribution: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- [Queenstown Trails current notice](https://www.queenstowntrails.org.nz/maps-and-trails/all-trails/frankton-track/) describes a 2026 diversion beside Frankton Road. This implementation does not claim surveyed diversion geometry or live opening status.

## Extent and geometry

The approximate old settlement pins were not route endpoints. The mapped endpoints are explicitly **Queenstown Gardens — Park Street** (168.6641803, -45.0339218) and **Frankton Beach** (168.7236968987632, -45.01705779616665). This is not a route to Frankton bus hub or the airport. Endpoint circles have labelled popups.

16 source segments total approximately 5.91 km. Source joins have survey offsets up to 10.12 m, bounded by a strict 12 m build/runtime check. They remain separate LineStrings; no long straight connector is fabricated. QLDC feature 3 is trimmed at the projected marina rejoin to avoid doubling back over an overlapping prefix. Distance sums actual segment geometry, excluding small survey offsets. The route reverses segment order and vertex order for Frankton → Queenstown.

## Isolation and PWA

The application creates its map before any routing import. Only pressing Show route dynamically imports the independent module, then fetches the versioned local JSON with a ten-second timeout. Module/data failures update only route status. Changes to selections invalidate in-flight requests and clear the old line. Other destinations remain selectable but do not draw routes. There is no runtime Overpass dependency.

Cache v01-6 precaches the exact versioned app and map module URLs. Routing module and versioned JSON are optional, cached only after successful use: a missing route asset cannot fail shell installation. No tiles or external GIS/API results are cached. No forced skipWaiting is introduced; close existing app tabs/windows to allow the new worker to activate. An uncached route is unavailable offline; a previously used route remains a dated snapshot, not live conditions.

## Refresh and validation

Run `node scripts/build-frankton-route.js` after deliberately replacing reviewed snapshots. The build verifies domains, exact names, cycling/in-use codes, OSM connector tags and maximum gaps. Do not blindly refresh by name or change selected IDs without checking geometry and access. The layer response has no copyright statement; no new licence is inferred for council data. The small council snapshot implements the expressly requested QLDC integration and identifies its source; redistribution terms should be established before a broader data product.

Run `npm test` and syntax-check modified JavaScript before committing. Tests cover reverse traversal, unsupported pairs, malformed/disconnected data, source joins, reproducible generation, fetch failures and exact PWA entrypoint versions. Browser regression checks additionally exercise both directions, selector changes, missing modules, failed data requests and map survival. No generalized routing graph or backend is introduced.

Browser check reproduction: serve `public` on port 4173, provide Playwright through `NODE_PATH` (or a local installation), and run `node tests/browser-check.cjs` with Google Chrome installed. External GIS and tiles are deliberately blocked so the assertions verify map and route isolation without depending on third-party availability.
