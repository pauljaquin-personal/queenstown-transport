import test from "node:test";
import assert from "node:assert/strict";
import { buildBusJourneys } from "../worker/journeys.js";

const tables = {
  "agency.txt": [{ agency_id:"QTN", agency_name:"Queenstown Orbus", agency_url:"https://example.test" }],
  "routes.txt": [{ route_id:"r1", agency_id:"QTN", route_short_name:"1", route_long_name:"Queenstown to Frankton" }],
  "trips.txt": [{ route_id:"r1", service_id:"daily", trip_id:"t1", trip_headsign:"Frankton" }],
  "stops.txt": [
    { stop_id:"a", stop_name:"Camp Street", stop_lat:"-45.0303", stop_lon:"168.6597" },
    { stop_id:"b", stop_name:"Lake Esplanade", stop_lat:"-45.0330", stop_lon:"168.6760" },
    { stop_id:"c", stop_name:"Frankton Bus Hub", stop_lat:"-45.0208", stop_lon:"168.7385" },
  ],
  "stop_times.txt": [
    { trip_id:"t1", stop_id:"a", stop_sequence:"1", arrival_time:"09:15:00", departure_time:"09:15:00" },
    { trip_id:"t1", stop_id:"b", stop_sequence:"2", arrival_time:"09:22:00", departure_time:"09:22:00" },
    { trip_id:"t1", stop_id:"c", stop_sequence:"3", arrival_time:"09:30:00", departure_time:"09:30:00" },
  ],
  "calendar.txt": [{
    service_id:"daily", monday:"1", tuesday:"1", wednesday:"1", thursday:"1",
    friday:"1", saturday:"1", sunday:"1", start_date:"20260101", end_date:"20261231"
  }],
  "calendar_dates.txt": [],
};

test("builds a walk-bus-walk journey from scheduled GTFS", () => {
  const now = new Date("2026-10-02T20:00:00.000Z");
  const journeys = buildBusJourneys(
    tables,
    [168.65965, -45.03028],
    [168.73855, -45.02082],
    now
  );
  assert.equal(journeys.length, 1);
  assert.equal(journeys[0].route, "1");
  assert.equal(journeys[0].board.name, "Camp Street");
  assert.equal(journeys[0].alight.name, "Frankton Bus Hub");
  assert.equal(journeys[0].departureAt, "2026-10-02T20:15:00.000Z");
  assert.equal(journeys[0].transitMinutes, 15);
  assert.ok(journeys[0].totalMinutes >= 30 && journeys[0].totalMinutes <= 32);
});

test("does not invent a reverse journey on a one-way trip", () => {
  const journeys = buildBusJourneys(
    tables,
    [168.73855, -45.02082],
    [168.65965, -45.03028],
    new Date("2026-10-02T20:00:00.000Z")
  );
  assert.deepEqual(journeys, []);
});

test("returns no journey when the nearest stops are beyond the walking limit", () => {
  const journeys = buildBusJourneys(
    tables,
    [168.90, -45.10],
    [168.73855, -45.02082],
    new Date("2026-10-02T20:00:00.000Z")
  );
  assert.deepEqual(journeys, []);
});
