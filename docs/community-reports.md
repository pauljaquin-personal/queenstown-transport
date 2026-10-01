# Community traffic reports

The Community section and Community layer offer **Report a traffic problem**. Categories are traffic congestion, road obstruction/damage, cycle trail issues, walking/accessibility issues and other traffic problems. Reports include a named area, a road/trail or landmark description, short details, and an observation time (now, 15 minutes or one hour ago). An explicit checkbox explains that the text and location will be public.

Recent reports are visible to everyone, labelled **unverified**, refreshed each minute, and available as approximate-area markers through the Community layer. They are not verified closures, do not alter cycle routing, and are not sent to a council or emergency service. Old private drafts remain on their original device and are never uploaded automatically.

## Expiry and ownership

Congestion expires two hours after observation; obstructions/other issues after 12 hours; accessibility reports after 24 hours; trail issues after 72 hours. The API filters expired/resolved rows. The browser that submitted a report can mark it resolved using a per-report random token held in local storage; only a SHA-256 digest is stored server-side. Listing reports never includes tokens or hashes. Clearing browser storage loses the ability to resolve a report, but automatic expiry still applies.

The app stores no account, IP address, contact details or cross-report device identity in the report table. Infrastructure access logs are outside this application schema. The local five-minute cooldown is a convenience, not a strong anti-abuse guarantee. An atomic database insert also rejects identical reports within 15 minutes and caps global submissions at 20 per minute. Text lengths, enumerated values, origin and payload size are checked server-side; public text is rendered with text nodes. Moderation states are `unverified` and `hidden`; only unverified, unresolved, unexpired reports are public. There is no staffed moderation queue in this increment. Operators can set `moderation_state = 'hidden'` or delete abusive reports through their authenticated D1 access. Per-report bearer tokens enforce owner access for resolution; no public endpoint permits editing or deleting another report. Expired rows older than seven days are removed on the next successful submission; this is opportunistic cleanup, not a scheduled retention guarantee.

## Deployment

Apply `migrations/0002_traffic_reports.sql` to the existing `COMMUTES` D1 binding **before** deploying the app. This is additive: the commute table and bus/cycling code are unchanged. On an existing database without migration history, `0001_commutes.sql` uses `IF NOT EXISTS` and does not erase commute data.

```sh
npx wrangler d1 migrations apply COMMUTES --local
npx wrangler dev --port 4174
# In another terminal, Node 22+:
node tests/traffic-reports-integration.js
npm test
```

Production migration (requires deployment approval):

```sh
npx wrangler d1 migrations apply COMMUTES --remote
```

Then merge the feature PR through the existing GitHub → Cloudflare deployment. Verify `GET /api/reports` returns an empty/real list, cache `v01-37`, and the form opens. Do not publish synthetic reports on the production feed. Rollback can revert the app commit and leave the additive table in place.

Endpoints: `GET /api/reports`, `POST /api/reports`, `POST /api/reports/:id/resolve`. POST bodies are JSON; resolve accepts only the submitting browser's token. API responses are never cached. Community loading failures do not prevent bus maps, cycling or commute features from working.
