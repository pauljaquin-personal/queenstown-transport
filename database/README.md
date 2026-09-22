# Future transport database

Plan an isolated `transport` Postgres/PostGIS schema with events, sources, reports, routes, stops, vehicles, corridors and travel_times. No migrations or credentials are applied in v0.1. Record source identifiers, timestamps, licence metadata and expiry. Public reports need explicit moderation and row-level access policies before enabling writes. Shared hosting must not grant access to other apps' data.
