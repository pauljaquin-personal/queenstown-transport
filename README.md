# Queenstown Transport · v0.1

Mobile-first Queenstown transport guide and installable PWA. Interactive map, five mode controls, local-place selection, location on request, official transport links and private browser report drafts. Live traffic, bus/ferry arrivals and cycle route geometry are **not connected**. Map points are approximate landmarks, not verified stops or routes.

## Run and check

`npm run dev` serves http://localhost:4173 (Python 3 required). `npm test` runs storage/validation tests using Node 20+. There is no install or build step. Vendored Leaflet includes its licence. Project MIT licence does not supersede provider data or library licences.

## Deployment

Keep the existing GitHub → Cloudflare integration, blank build command and `npx wrangler deploy`. `wrangler.jsonc` is unchanged and serves `./public`. Review on the feature branch before merging to main. No secrets, database, bindings, redirects or Cloudflare settings were changed. Roll back by reverting the app commit on main; close existing PWA windows to allow the replacement service worker to activate.

After merging, verify the root page, manifest, icons, module MIME types, map, service-worker installation and offline reload on the actual HTTPS deployment. Installation UX differs by browser. Offline supports the shell and local drafts, not map tiles or linked sites. Revisit tile provider capacity before public promotion.

See [source audit](docs/data-sources.md) and [architecture](docs/architecture.md).
