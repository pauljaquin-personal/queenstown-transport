# 2026 Frankton detour — partial mapping

Checked 23 September 2026. This update adds a **partial detour overview**, not a complete navigation route. The default view is the detour; the earlier normal alignment remains selectable. Both directions work, with the same route-loading isolation.

## Authority and scope

- [QLDC project update](https://www.qldc.govt.nz/your-council/council-projects/frankton-track-wastewater-upgrades) identifies the Frankton Road pedestrian/cyclist diversion. It describes temporary access arrangements for the narrow Middleton–Perkins section and local changes around the marina/beach. The approximate November review date is a prompt to recheck, never an automatic reopening.
- [Council detour diagram](https://www.qldc.govt.nz/media/pdyplnem/qldc_frankton-track-wastewater-works_800px-x-800px_detour_nov25.png) was visually inspected. Its orange roadside corridor supports the main alignment; it is not survey geometry for temporary platforms or every junction.
- [Queenstown Trails notice](https://www.queenstowntrails.org.nz/maps-and-trails/all-trails/frankton-track/) independently identifies the roadside footpath diversion. The local path snapshot supplies geometry, not live access status.
- OSM geometry comes from the same 23 September extract used for the normal route: [map API](https://www.openstreetmap.org/api/0.6/map?bbox=168.660,-45.037,168.729,-45.016). `data/queenstown-frankton/osm-detour.json` retains the selected source way versions, timestamps, tags, original nodes/coordinates, and selected contiguous node sequences. Attribution: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

## Two unresolved connections

1. At `[168.7090179, -45.0204742]` the mapped shared path meets the narrow works section toward `[168.7132945, -45.0189385]`. OSM way 1484179810 would connect these points using the normal Frankton Track. That geometry overlaps council closure data and does not establish the exact temporary route. **It is excluded.** Separate circles mark both boundaries and no line bridges the gap.
2. The east fragment ends on the roadside shared path at `[168.7235563, -45.0161791]`, near Frankton Beach. It does not reach the earlier beach endpoint. Available path topology and current works information did not establish that final connection. The endpoint label explicitly says beach access is unmapped; there is no straight-line snap through the worksite or campground.

A complete detour needs a current, sufficiently detailed official temporary-access plan or reliable field-confirmed geometry for these connections. Merely removing QLDC closure flags, routing over the highway centreline or joining nearby coordinates is not sufficient. No message has been sent to the council.

## Mapped sections

The route starts at the established Park Street endpoint, connects via mapped roadside paths to Frankton Road, and follows the Te Kirikiri Frankton Link. East of the works gap it resumes on that link and finishes near the beach. All 31 fragments preserve contiguous OSM geometry. Orange shows mapped route sections; purple dashed footpath/crossing segments instruct users to walk their bikes where cycling permission is not recorded. The interface also tells users to obey temporary signs and dismount instructions throughout.

The reported 5.04 km sums mapped sections **only**, not the missing works connection or beach access. No continuous route line, whole-trip distance, ETA or claim that the route is open is made. This partial result is deliberately distinguishable from the normal lakeside alignment and its closed sections.

## Build, cache and tests

- Run `node scripts/build-frankton-detour.js` for deterministic offline generation. It rejects unsuitable ways, non-contiguous source nodes, and unexpected gaps.
- Runtime validation accepts only the one explicitly recorded works gap for this snapshot; other disconnections fail. Reversing the route also reverses gap boundaries and endpoint descriptions.
- Routing assets remain optional local fetches, dynamically loaded after map startup. Selection changes invalidate pending results, including switches between detour and normal views.
- Cache v01-7 and entrypoint version `20260923-4` replace the prior shell without forced activation. Both route snapshots cache only after use. An offline copy remains a dated overview.
- All 14 Node tests passed, along with JavaScript syntax checks. Chrome regressions cover both route views/directions, no geometry drawn through the gap, unsupported destinations, failed downloads, invalid data, missing route modules and stale responses. External GIS/tiles are blocked in these tests to check isolation. This is not a field inspection.
