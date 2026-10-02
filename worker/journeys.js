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

function lowerBound(events, earliestMs) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (events[mid].departureMs < earliestMs) low = mid + 1;
    else high = mid;
  }
  return low;
}

function leg(routeById, trip, boardRow, alightRow, departureMs, arrivalMs) {
  const route = routeById.get(trip.route_id);
  return {
    mode: "bus",
    route: routeNumber(route),
    routeName: route?.route_long_name || "",
    tripId: trip.trip_id,
    destination: boardRow.stop_headsign || trip.trip_headsign || route?.route_long_name || "",
    boardStopId: boardRow.stop_id,
    alightStopId: alightRow.stop_id,
    departureAt: new Date(departureMs).toISOString(),
    arrivalAt: new Date(arrivalMs).toISOString(),
    transitMinutes: Math.max(1, Math.round((arrivalMs - departureMs) / 60000)),
  };
}

function journeySort(a, b) {
  return Date.parse(a.arrivalAt) - Date.parse(b.arrivalAt) ||
    a.transfers - b.transfers ||
    a.walkMetres - b.walkMetres;
}

export function buildBusJourneys(
  tables,
  from,
  to,
  now = new Date(),
  {
    maxWalkMetres = 1200,
    walkingSpeedMps = 1.35,
    candidateLimit = 8,
    resultLimit = 5,
    maxTransferWalkMetres = 250,
    minTransferMinutes = 3,
  } = {}
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
  const stopById = new Map(stops.map((stop) => [stop.stop_id, stop]));

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

  const transferStops = new Map();
  for (const stop of stops) {
    const point = [Number(stop.stop_lon), Number(stop.stop_lat)];
    transferStops.set(stop.stop_id, stops
      .map((other) => ({
        stop: other,
        distance: metres(point, [Number(other.stop_lon), Number(other.stop_lat)]),
      }))
      .filter((item) => item.distance <= maxTransferWalkMetres)
      .sort((a, b) => a.distance - b.distance));
  }

  const serviceRuns = calendarResolver(tables);
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const p = localParts(now);
  const dateUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const nowMs = now.getTime();
  const horizon = nowMs + 7 * 86400000;
  const occurrences = [];
  const departuresByStop = new Map();

  for (let offset = -1; offset <= 7; offset++) {
    const date = new Date(dateUTC + offset * 86400000);
    const dateText = date.toISOString().slice(0, 10).replaceAll("-", "");
    const weekday = weekdayNames[date.getUTCDay()];
    const start = serviceDayStart(dateText);

    for (const trip of trips) {
      if (!serviceRuns(trip.service_id, dateText, weekday)) continue;
      const sourceRows = rowsByTrip.get(trip.trip_id) || [];
      const rows = sourceRows.map((row) => {
        const arrivalSeconds = parseTime(row.arrival_time || row.departure_time);
        const departureSeconds = parseTime(row.departure_time || row.arrival_time);
        return {
          ...row,
          arrivalMs: arrivalSeconds === null ? null : start + arrivalSeconds * 1000,
          departureMs: departureSeconds === null ? null : start + departureSeconds * 1000,
        };
      });
      const occurrence = { key: trip.trip_id + ":" + dateText, trip, rows };
      occurrences.push(occurrence);
      rows.forEach((row, index) => {
        if (row.departureMs === null || row.departureMs < nowMs || row.departureMs > horizon || row.pickup_type === "1") return;
        if (!departuresByStop.has(row.stop_id)) departuresByStop.set(row.stop_id, []);
        departuresByStop.get(row.stop_id).push({ occurrence, index, departureMs: row.departureMs });
      });
    }
  }
  for (const events of departuresByStop.values()) events.sort((a, b) => a.departureMs - b.departureMs);

  const options = [];
  const minTransferMs = minTransferMinutes * 60000;

  for (const first of occurrences) {
    const rows = first.rows;
    for (let i = 0; i < rows.length - 1; i++) {
      const board = fromById.get(rows[i].stop_id);
      if (!board || rows[i].departureMs === null || rows[i].pickup_type === "1") continue;
      const accessSeconds = walkingSeconds(board.distance, walkingSpeedMps);
      if (rows[i].departureMs < nowMs + accessSeconds * 1000 || rows[i].departureMs > horizon) continue;

      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].arrivalMs === null || rows[j].arrivalMs < rows[i].departureMs || rows[j].drop_off_type === "1") continue;

        const destination = toById.get(rows[j].stop_id);
        if (destination) {
          const egressSeconds = walkingSeconds(destination.distance, walkingSpeedMps);
          const finalArrivalMs = rows[j].arrivalMs + egressSeconds * 1000;
          if (finalArrivalMs <= horizon) {
            const firstLeg = leg(routeById, first.trip, rows[i], rows[j], rows[i].departureMs, rows[j].arrivalMs);
            options.push({
              mode: "bus",
              transfers: 0,
              route: firstLeg.route,
              routeName: firstLeg.routeName,
              tripId: firstLeg.tripId,
              destination: firstLeg.destination,
              legs: [firstLeg],
              board: {
                stopId: board.stop.stop_id,
                name: board.stop.stop_name,
                walkMetres: Math.round(board.distance),
                walkMinutes: Math.max(1, Math.ceil(accessSeconds / 60)),
                scheduledAt: firstLeg.departureAt,
              },
              alight: {
                stopId: destination.stop.stop_id,
                name: destination.stop.stop_name,
                walkMetres: Math.round(destination.distance),
                walkMinutes: Math.max(1, Math.ceil(egressSeconds / 60)),
                scheduledAt: firstLeg.arrivalAt,
              },
              departureAt: firstLeg.departureAt,
              arrivalAt: new Date(finalArrivalMs).toISOString(),
              transitMinutes: firstLeg.transitMinutes,
              transferMinutes: 0,
              walkMetres: Math.round(board.distance + destination.distance),
              totalMinutes: Math.max(1, Math.ceil((finalArrivalMs - nowMs) / 60000)),
            });
          }
        }

        for (const transfer of transferStops.get(rows[j].stop_id) || []) {
          const walkSeconds = walkingSeconds(transfer.distance, walkingSpeedMps);
          const earliestSecond = rows[j].arrivalMs + walkSeconds * 1000 + minTransferMs;
          const events = departuresByStop.get(transfer.stop.stop_id) || [];
          for (let e = lowerBound(events, earliestSecond); e < events.length; e++) {
            const event = events[e];
            if (event.departureMs > rows[j].arrivalMs + 90 * 60000) break;
            if (event.occurrence.key === first.key) continue;
            const secondRows = event.occurrence.rows;
            let completed = false;
            for (let k = event.index + 1; k < secondRows.length; k++) {
              const secondDestination = toById.get(secondRows[k].stop_id);
              if (!secondDestination || secondRows[k].arrivalMs === null || secondRows[k].drop_off_type === "1") continue;
              const egressSeconds = walkingSeconds(secondDestination.distance, walkingSpeedMps);
              const finalArrivalMs = secondRows[k].arrivalMs + egressSeconds * 1000;
              if (finalArrivalMs > horizon) continue;

              const firstLeg = leg(routeById, first.trip, rows[i], rows[j], rows[i].departureMs, rows[j].arrivalMs);
              const secondLeg = leg(
                routeById,
                event.occurrence.trip,
                secondRows[event.index],
                secondRows[k],
                event.departureMs,
                secondRows[k].arrivalMs
              );
              const transferMinutes = Math.max(
                minTransferMinutes,
                Math.round((event.departureMs - rows[j].arrivalMs) / 60000)
              );
              options.push({
                mode: "bus",
                transfers: 1,
                route: firstLeg.route + " → " + secondLeg.route,
                routeName: firstLeg.routeName + " → " + secondLeg.routeName,
                tripId: firstLeg.tripId + "+" + secondLeg.tripId,
                destination: secondLeg.destination,
                legs: [firstLeg, secondLeg],
                board: {
                  stopId: board.stop.stop_id,
                  name: board.stop.stop_name,
                  walkMetres: Math.round(board.distance),
                  walkMinutes: Math.max(1, Math.ceil(accessSeconds / 60)),
                  scheduledAt: firstLeg.departureAt,
                },
                transfer: {
                  fromStopId: rows[j].stop_id,
                  fromName: stopById.get(rows[j].stop_id)?.stop_name || rows[j].stop_id,
                  toStopId: transfer.stop.stop_id,
                  toName: transfer.stop.stop_name,
                  walkMetres: Math.round(transfer.distance),
                  walkMinutes: transfer.distance > 5 ? Math.max(1, Math.ceil(walkSeconds / 60)) : 0,
                  minimumMinutes: minTransferMinutes,
                  scheduledWaitMinutes: transferMinutes,
                },
                alight: {
                  stopId: secondDestination.stop.stop_id,
                  name: secondDestination.stop.stop_name,
                  walkMetres: Math.round(secondDestination.distance),
                  walkMinutes: Math.max(1, Math.ceil(egressSeconds / 60)),
                  scheduledAt: secondLeg.arrivalAt,
                },
                departureAt: firstLeg.departureAt,
                arrivalAt: new Date(finalArrivalMs).toISOString(),
                transitMinutes: firstLeg.transitMinutes + secondLeg.transitMinutes,
                transferMinutes,
                walkMetres: Math.round(board.distance + transfer.distance + secondDestination.distance),
                totalMinutes: Math.max(1, Math.ceil((finalArrivalMs - nowMs) / 60000)),
              });
              completed = true;
              break;
            }
            if (completed) break;
          }
        }
      }
    }
  }

  const bestByPattern = new Map();
  for (const option of options) {
    const legKey = option.legs.map((item) => item.tripId + ":" + item.boardStopId + ":" + item.alightStopId).join("|");
    const previous = bestByPattern.get(legKey);
    if (!previous || journeySort(option, previous) < 0) bestByPattern.set(legKey, option);
  }

  return [...bestByPattern.values()].sort(journeySort).slice(0, resultLimit);
}

export async function queenstownBusJourneys(from, to, now = new Date()) {
  return buildBusJourneys(await queenstownGtfsTables(), from, to, now);
}
