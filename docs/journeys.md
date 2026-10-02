# Multimodal journey planning

QueenstownGo now has a backend journey-planning seam that can be connected to the redesigned mobile UI later.

## First supported journey

The first planner returns scheduled:

**walk → Orbus → walk**

journeys between two Whakatipu coordinates.

It uses the same official Otago Regional Council static GTFS feed as the bus map. The planner:

- considers Queenstown routes 1–5;
- respects GTFS service calendars and date exceptions;
- keeps Pacific/Auckland service-day handling, including 24+ hour GTFS times;
- considers nearby origin and destination stops rather than requiring a stop to be selected manually;
- will not join disconnected trips or reverse the order of stops on a trip;
- includes access/egress walking distance and scheduled boarding/alighting times;
- currently searches up to 1.2 km of walking at each end and returns up to five earliest options.

This remains **scheduled** information. It does not yet use realtime vehicle positions, predicted arrivals, disruption-aware rerouting, cycling-to-bus, ferry legs, or transfers between bus services.

## API

`GET /api/journeys?from=<lng>,<lat>&to=<lng>,<lat>`

The response contains a `journeys` array. Each journey includes the bus route, boarding and alighting stops, walking distances, scheduled times, transit time and total elapsed time from the request time.

## Next steps

1. Verify representative Queenstown, Frankton, Arrowtown, Shotover Country and Kelvin Heights journeys against the published Orbus timetable.
2. Add one-transfer bus journeys.
3. Bring the existing cycle route engine into the same journey-result model.
4. Add realtime information when a reliable public source is available.
5. Connect the planner to the post-Swimspots QueenstownGo mobile UI rather than adding another temporary interface now.
