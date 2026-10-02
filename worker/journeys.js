import { queenstownGtfsTables, serviceDayStart } from "./gtfs.js";

const ZONE = "Pacific/Auckland";
const partsFormat = new Intl.DateTimeFormat("en-NZ", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localParts(date) {
  return Object.fromEntries(partsFormat.formatToParts(date).map((part) => [part.type, part.value]));
}

function routeNumber(route) {
  return (route?.route_short_name || "").trim();
}

function parseTime(value) {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value || "");
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

function metres(a, b) {
  const r = Math.PI / 180;
  const h =
    Math.sin((b[1] - a[1]) * r / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function queenstownRoutes(tables) {
  const agencies = tables["agency.txt"] || [];
  const routes = tables["routes.txt"] || [];
  const agencyIds = new Set(
    agencies
      .filter((agency) =>
        String(agency.agency_id || "").toUpperCase() === "QTN" ||
        /queenstown/i.test((agency.agency_name || "") + " " + (agency.agency_url || ""))
      )
      .map((agency) => agency.agency_id)
  );
  let selected = routes.filter(
    (route) => agencyIds.has(route.agency_id) && ["1", "2", "3", "4", "5"].includes(routeNumber(route))
  );
  if (!selected.length) {
    selected = routes.filter(
      (route) =>
        ["1", "2", "3", "4", "5"].includes(routeNumber(route)) &&
        /queenstown|arrowtown|sunshine|kelvin|jacks|lake hayes|remarkables|quail/i.test(
          (route.route_long_name || "") + " " + (route.route_desc || "")
        )
    );
  }
  return selected;
}

function calendarResolver(tables) {
  const calendarByService = new Map((tables["calendar.txt"] || []).map((row) => [row.service_id, row]));
  const exceptionsByDate = new Map();
  for (const row of tables["calendar_dates.txt"] || []) {
    if (!exceptionsByDate.has(row.date)) exceptionsByDate.set(row.date, new Map());
    exceptionsByDate.get(row.date).set(row.service_id, row.exception_type);
  }
  return (serviceId, dateText, weekday) => {
    const exception = exceptionsByDate.get(dateText)?.get(serviceId);
    if (exception === "1") return true;
    if (exception === "2") return false;
    const calendar = calendarByService.get(serviceId);
    return !!calendar &&
      dateText >= calendar.start_date &&
      dateText <= calendar.end_date &&
      calendar[weekday] === "1";
  };
}

function candidateStops(stops, point, maxWalkMetres, limit) {
  return stops
    .map((stop) => ({ stop, distance: metres(point, [Number(stop.stop_lon), Number(stop.stop_lat)]) }))
    .filter((item) => Number.isFinite(item.distance) && item.distance <= maxWalkMetres)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function walkingSeconds(distance, speed) {
  return Math.ceil(distance / speed);
}

export function buildBusJourneys(
  tables,
  from,
  to,
  now = new Date(),
  { maxWalkMetres = 1200, walkingSpeedMps = 1.35, candidateLimit = 8, resultLimit = 5 } = {}
) {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2 ||
      !from.every(Number.isFinite) || !to.every(Number.isFinite)) throw Error("Invalid journey points");

  const routes = queenstownRoutes(tables);
  if (!routes.length) return [];
  const routeIds = new Set(routes.map((route) => route.route_id));
  const routeById = new Map(routes.map((route) => [route.route_id, route]));
  const trips = (tables["trips.txt"] || []).filter((trip) => routeIds.has(trip.route_id));
  const tripById = new Map(trips.map((trip) => [trip.trip_id, trip]));
  const tripIds = new Set(trips.map((trip) => trip.trip_id));
  const stopTimes = (tables["stop_times.txt"] || []).filter((row) => tripIds.has(row.trip_id));
  const usedStopIds = new Set(stopTimes.map((row) => row.stop_id));
  const stops = (tables["stops.txt"] || []).filter(
    (stop) => usedStopIds.has(stop.stop_id) &&
      Number.isFinite(Number(stop.stop_lat)) &&
      Number.isFinite(Number(stop.stop_lon))
  );

  const fromStops = candidateStops(stops, from, maxWalkMetres, candidateLimit);
  const toStops = candidateStops(stops, to, maxWalkMetres, candidateLimit);
  if (!fromStops.length || !toStops.length) return [];

  const fromById = new Map(fromStops.map((item) => [item.stop.stop_id, item]));
  const toById = new Map(toStops.map((item) => [item.stop.stop_id, item]));
  const rowsByTrip = new Map();
  for (const row of stopTimes) {
    if (!rowsByTrip.has(row.trip_id)) rowsByTrip.set(row.trip_id, []);
    rowsByTrip.get(row.trip_id).push(row);
  }
  for (const rows of rowsByTrip.values()) {
    rows.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  }

  const serviceRuns = calendarResolver(tables);
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const p = localParts(now);
  const dateUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const nowMs = now.getTime();
  const horizon = nowMs + 7 * 86400000;
  const options = [];

  for (let offset = -1; offset <= 7; offset++) {
    const date = new Date(dateUTC + offset * 86400000);
    const dateText = date.toISOString().slice(0, 10).replaceAll("-", "");
    const weekday = weekdayNames[date.getUTCDay()];
    const start = serviceDayStart(dateText);

    for (const trip of trips) {
      if (!serviceRuns(trip.service_id, dateText, weekday)) continue;
      const rows = rowsByTrip.get(trip.trip_id) || [];
      for (let i = 0; i < rows.length - 1; i++) {
        const board = fromById.get(rows[i].stop_id);
        if (!board || rows[i].pickup_type === "1") continue;
        const departSeconds = parseTime(rows[i].departure_time);
        if (departSeconds === null) continue;
        const departureMs = start + departSeconds * 1000;
        const accessSeconds = walkingSeconds(board.distance, walkingSpeedMps);
        if (departureMs < nowMs + accessSeconds * 1000 || departureMs > horizon) continue;

        for (let j = i + 1; j < rows.length; j++) {
          const alight = toById.get(rows[j].stop_id);
          if (!alight || rows[j].drop_off_type === "1") continue;
          const arrivalSeconds = parseTime(rows[j].arrival_time || rows[j].departure_time);
          if (arrivalSeconds === null || arrivalSeconds < departSeconds) continue;
          const arrivalMs = start + arrivalSeconds * 1000;
          const egressSeconds = walkingSeconds(alight.distance, walkingSpeedMps);
          const finalArrivalMs = arrivalMs + egressSeconds * 1000;
          if (finalArrivalMs > horizon) continue;

          const route = routeById.get(trip.route_id);
          options.push({
            mode: "bus",
            route: routeNumber(route),
            routeName: route?.route_long_name || "",
            tripId: trip.trip_id,
            destination: rows[i].stop_headsign || trip.trip_headsign || route?.route_long_name || "",
            board: {
              stopId: board.stop.stop_id,
              name: board.stop.stop_name,
              walkMetres: Math.round(board.distance),
              walkMinutes: Math.max(1, Math.ceil(accessSeconds / 60)),
              scheduledAt: new Date(departureMs).toISOString(),
            },
            alight: {
              stopId: alight.stop.stop_id,
              name: alight.stop.stop_name,
              walkMetres: Math.round(alight.distance),
              walkMinutes: Math.max(1, Math.ceil(egressSeconds / 60)),
              scheduledAt: new Date(arrivalMs).toISOString(),
            },
            departureAt: new Date(departureMs).toISOString(),
            arrivalAt: new Date(finalArrivalMs).toISOString(),
            transitMinutes: Math.max(1, Math.round((arrivalMs - departureMs) / 60000)),
            totalMinutes: Math.max(1, Math.ceil((finalArrivalMs - nowMs) / 60000)),
          });
          break;
        }
      }
    }
  }

  const bestByTrip = new Map();
  for (const option of options) {
    const key = option.tripId + ":" + option.board.stopId + ":" + option.alight.stopId;
    const previous = bestByTrip.get(key);
    if (!previous || option.arrivalAt < previous.arrivalAt) bestByTrip.set(key, option);
  }
  return [...bestByTrip.values()]
    .sort((a, b) =>
      Date.parse(a.arrivalAt) - Date.parse(b.arrivalAt) ||
      (a.board.walkMetres + a.alight.walkMetres) - (b.board.walkMetres + b.alight.walkMetres)
    )
    .slice(0, resultLimit);
}

export async function queenstownBusJourneys(from, to, now = new Date()) {
  return buildBusJourneys(await queenstownGtfsTables(), from, to, now);
}
