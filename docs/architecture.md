# Architecture

The existing Cloudflare Worker and assets deployment remains: `wrangler.jsonc` serves `./public`; no build command or runtime dependency is required. Browser ES modules are authored inside `public/src` so they are served directly. Do not add a second top-level `src` that needs an undocumented build step.

- `public/src/app.js`: interface and orchestration.
- `public/src/map/map.js`: Leaflet map adapter and isolated transport-layer loading.
- `public/src/api/catalog.js`: guide metadata and approximate landmarks.
- `public/src/api/reports.js`: legacy private draft storage; shared reports use `community.js` and `worker/traffic-reports.js`.
- `public/vendor`: pinned Leaflet 1.9.4 and its BSD-2-Clause licence.
- `public/sw.js`: same-origin shell only; neither map tiles nor future API calls are intercepted. New versions wait until old clients close. Bump shell cache version when releasing changes.
- `worker/`: production API boundary for buses, commute data and community reports.
- `database/`: long-term transport schema plan; current D1 migrations are in `migrations/`.

Future data path: official source → scheduled Worker adapter → isolated transport schema in PostgreSQL/PostGIS → versioned API → PWA (and later native clients). A Worker owns secrets, source validation, caching, rate limits and source-specific transformations. Never embed provider secrets in browser assets. Share infrastructure with Swimspots only through explicit interfaces; keep deployments and permissions isolated.

Suggested GET /api/v1/layers/:mode contract:

```json
{"schemaVersion":1,"status":"unavailable","source":{"id":"nzta","url":"https://www.nzta.govt.nz/","attribution":"pending verification"},"retrievedAt":null,"sourceUpdatedAt":null,"staleAfterSeconds":null,"features":{"type":"FeatureCollection","features":[]},"message":"Not connected"}
```

Statuses: fresh, stale, unavailable; distinguish successful empty data from failed fetching. GeoJSON uses WGS84 longitude/latitude. TransportEvent properties: id, sourceId, type, severity, description, startsAt, endsAt, affectedModes, confidence, sourceUpdatedAt. Vehicle and timetable records remain separate; a scheduled departure is not a live prediction. All source text must be rendered as text, never trusted HTML.

Community reports use a D1 table with per-report owner-token authentication for resolution, conditional-insert rate limiting, validation, explicit public consent, unverified/hidden moderation states and expiry. Operator moderation/deletion uses authenticated D1 access; there is no public moderation console. See [community reports](community-reports.md) for the complete contract. Keep community claims distinguishable from official events. No silent automatic submission of private drafts when a backend is introduced.

## Cycling routing foundation

The cycling map now treats two datasets as separate network inputs: QLDC Tracks & Trails supplies council cycle-trail geometry and attributes; OpenStreetMap supplies bicycle-permitted road/path geometry for connection analysis. The browser overlay is diagnostic only and is not yet a routing engine.

Production routing must move network acquisition and graph construction to a backend/preprocessing job. It should snap QLDC trail endpoints to OSM nodes only within a controlled tolerance, preserve provenance on every edge, detect disconnected components, and never invent a connector across water/private land merely because two lines are visually close. Route cost can later use QLDC cycle grade/surface plus OSM highway/surface/access tags. Dynamic closures and community reports remain a separate edge-availability/cost overlay so static geometry is not mistaken for current rideability.
