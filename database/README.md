# Future transport database

Plan an isolated `transport` Postgres/PostGIS schema with events, sources, reports, routes, stops, vehicles, corridors and travel_times. This long-term plan is separate from the current D1 integration below. Record source identifiers, timestamps, licence metadata and expiry. Public reports need explicit moderation and row-level access policies before enabling writes. Shared hosting must not grant access to other apps' data.

## Current community reports

The application now reuses the existing Cloudflare D1 `COMMUTES` binding for an isolated `traffic_reports` table. See [community reports](../docs/community-reports.md) for its additive migration, explicit moderation states and per-report ownership controls. The older PostgreSQL plan above is not required for this increment.
