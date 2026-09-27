# My Commute

The first My Commute implementation deliberately stores coarse transport data only:

- origin zone
- destination zone
- one or more travel modes
- broad time band
- optional change-mode reason
- creation month

It does not ask for or store a name, email, account, exact address, GPS route, precise journey time, user agent, or IP address in the commute table.

## API

- `POST /api/commutes` validates and stores a commute.
- `GET /api/commutes/summary` returns aggregated groups only when a group has at least 5 submissions.

Static assets remain asset-first. Only `/api/*` is routed through the Worker.

## D1 setup

Create a D1 database in Cloudflare, for example `queenstown-transport-data`, and bind it to this Worker as `COMMUTES`.

Then apply:

```
migrations/0001_commutes.sql
```

The Worker intentionally returns HTTP 503 with `storage_not_configured` until the `COMMUTES` binding exists. The client reports that state to the user instead of claiming a submission was saved.

Do not add request-derived identifiers to the commute table without reviewing the privacy design first.

## Public demand overview

Origin and destination summaries, represented-response counts and the top-ten connection diagram all derive from the same published 5+ cells as filters and CSV export. No new database query or individual record access is needed. Small cells are excluded before aggregation or filtering; the browser also rejects counts below five, non-integer counts and invalid counts. Consequently an area total can understate submitted demand. Empty results mean no publishable groups, not zero demand. Counts represent submissions, not unique people or daily journeys. Multi-mode totals can overlap.

The diagram groups origins on the left and destinations on the right, with stroke widths scaled by response count. It is schematic, keyboard-focusable, and backed by the full connection table. The overview and area summaries include all matching published cells even when the diagram shows only ten connections.

Insights remain a separate page and optional service-worker assets. API errors do not affect map startup. Cache v01-11 includes the new optional data module and versioned insights entry point.
