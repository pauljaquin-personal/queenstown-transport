# Queenstown Transport · v0.1

Mobile-first Queenstown transport guide and installable PWA. Interactive map, scheduled Orbus departures, Whakatipu cycling routes, commute insights and community traffic/trail reports. Bus times are scheduled, not live predictions; community reports are unverified.

## Run and check

`npm run dev` serves http://localhost:4173 (Python 3 required). `npm test` runs storage/validation tests using Node 22+. There is no install or build step. Vendored Leaflet includes its licence. Project MIT licence does not supersede provider data or library licences.

## Deployment

Keep the existing GitHub → Cloudflare integration, blank build command and `npx wrangler deploy`. `wrangler.jsonc` is unchanged and serves `./public`. Review on the feature branch before merging to main. Community reports require the additive D1 migration described in [community reports](docs/community-reports.md) before deployment; existing bindings are reused. Roll back by reverting the app commit on main; close existing PWA windows to allow the replacement service worker to activate.

After merging, verify the root page, manifest, icons, module MIME types, map, service-worker installation and offline reload on the actual HTTPS deployment. Installation UX differs by browser. Offline supports the shell and local drafts, not map tiles or linked sites. Revisit tile provider capacity before public promotion.

See [source audit](docs/data-sources.md) and [architecture](docs/architecture.md).

## Cycling planner

Everyday road-and-trail routing now covers named Whakatipu areas and map-picked points. Choose a quieter-path preference or shorter route, optionally excluding busy roads. Review road exposure, walking sections and dated closure exclusions before riding. See [cycling network](docs/cycling-network.md) for coverage, ODbL data attribution, reproducible updates and limitations. The old Frankton partial-detour maps remain available as reference views.

## Community reports

[Community reports](docs/community-reports.md) covers the report form, expiry, ownership, moderation states, local integration tests and the required database migration. Existing private drafts are never uploaded.
