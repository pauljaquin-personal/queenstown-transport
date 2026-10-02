import test from "node:test";
import assert from "node:assert/strict";
import { buildBusJourneys } from "../worker/journeys.js";

const baseCalendar = [{
  service_id:"daily", monday:"1", tuesday:"1", wednesday:"1", thursday:"1",
  friday:"1", saturday:"1", sunday:"1", start_date:"20260101", end_date:"20261231"
}];

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
  "calendar.txt": baseCalendar,
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
  assert.equal(journeys[0].transfers, 0);
  assert.equal(journeys[0].route, "1");
  assert.equal(journeys[0].board.name, "Camp Street");
  assert.equal(journeys[0].alight.name, "Frankton Bus Hub");
  assert.equal(journeys[0].departureAt, "2026-10-02T20:15:00.000Z");
  assert.equal(journeys[0].transitMinutes, 15);
  assert.equal(journeys[0].legs.length, 1);
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

const transferTables = {
  "agency.txt": [{ agency_id:"QTN", agency_name:"Queenstown Orbus", agency_url:"https://example.test" }],
  "routes.txt": [
    { route_id:"r1", agency_id:"QTN", route_short_name:"1", route_long_name:"Queenstown to Frankton" },
    { route_id:"r2", agency_id:"QTN", route_short_name:"2", route_long_name:"Frankton to Arthurs Point" },
  ],
  "trips.txt": [
    { route_id:"r1", service_id:"daily", trip_id:"t1", trip_headsign:"Frankton" },
    { route_id:"r2", service_id:"daily", trip_id:"t2", trip_headsign:"Arthurs Point" },
  ],
  "stops.txt": [
    { stop_id:"a", stop_name:"Camp Street", stop_lat:"-45.0303", stop_lon:"168.6597" },
    { stop_id:"x", stop_name:"Frankton Hub A", stop_lat:"-45.0208", stop_lon:"168.7385" },
    { stop_id:"y", stop_name:"Frankton Hub B", stop_lat:"-45.02075", stop_lon:"168.7387" },
    { stop_id:"d", stop_name:"Arthurs Point", stop_lat:"-44.9820", stop_lon:"168.6845" },
  ],
  "stop_times.txt": [
    { trip_id:"t1", stop_id:"a", stop_sequence:"1", arrival_time:"09:15:00", departure_time:"09:15:00" },
    { trip_id:"t1", stop_id:"x", stop_sequence:"2", arrival_time:"09:30:00", departure_time:"09:30:00" },
    { trip_id:"t2", stop_id:"y", stop_sequence:"1", arrival_time:"09:36:00", departure_time:"09:36:00" },
    { trip_id:"t2", stop_id:"d", stop_sequence:"2", arrival_time:"09:56:00", departure_time:"09:56:00" },
  ],
  "calendar.txt": baseCalendar,
  "calendar_dates.txt": [],
};

test("builds a one-transfer journey including a short interchange walk", () => {
  const journeys = buildBusJourneys(
    transferTables,
    [168.65965, -45.03028],
    [168.6845, -44.9820],
    new Date("2026-10-02T20:00:00.000Z")
  );
  const journey = journeys.find((item) => item.transfers === 1);
  assert.ok(journey);
  assert.equal(journey.route, "1 → 2");
  assert.equal(journey.legs.length, 2);
  assert.equal(journey.legs[0].tripId, "t1");
  assert.equal(journey.legs[1].tripId, "t2");
  assert.equal(journey.transfer.fromName, "Frankton Hub A");
  assert.equal(journey.transfer.toName, "Frankton Hub B");
  assert.ok(journey.transfer.walkMetres > 0);
  assert.equal(journey.alight.name, "Arthurs Point");
});

test("rejects a connection that leaves before the minimum interchange time", () => {
  const tooTight = structuredClone(transferTables);
  tooTight["stop_times.txt"] = tooTight["stop_times.txt"].map((row) =>
    row.trip_id === "t2" && row.stop_id === "y"
      ? { ...row, arrival_time:"09:32:00", departure_time:"09:32:00" }
      : row
  );
  const journeys = buildBusJourneys(
    tooTight,
    [168.65965, -45.03028],
    [168.6845, -44.9820],
    new Date("2026-10-02T20:00:00.000Z")
  );
  assert.equal(journeys.some((item) => item.transfers === 1), false);
});

test("does not transfer onto the same trip occurrence", () => {
  const sameTrip = structuredClone(tables);
  sameTrip["stops.txt"].push(
    { stop_id:"d", stop_name:"Later stop", stop_lat:"-44.9820", stop_lon:"168.6845" }
  );
  sameTrip["stop_times.txt"].push(
    { trip_id:"t1", stop_id:"d", stop_sequence:"4", arrival_time:"09:45:00", departure_time:"09:45:00" }
  );
  const journeys = buildBusJourneys(
    sameTrip,
    [168.65965, -45.03028],
    [168.6845, -44.9820],
    new Date("2026-10-02T20:00:00.000Z")
  );
  assert.equal(journeys.some((item) => item.transfers === 1), false);
  assert.equal(journeys[0].transfers, 0);
});
