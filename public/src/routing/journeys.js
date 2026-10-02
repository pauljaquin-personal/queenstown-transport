import { loadNetwork, findRoute } from "./network.js?v=20260929-3";

export const JOURNEY_MODES = ["cycle", "bus", "all"];

export function normaliseJourneyMode(value) {
  const mode = String(value || "all").toLowerCase();
  if (!JOURNEY_MODES.includes(mode)) throw Error("Unknown journey mode");
  return mode;
}

export function cycleJourneyFromRoute(route, {
  cyclingSpeedKph = 16,
  now = new Date(),
} = {}) {
  if (!route?.metadata || !Array.isArray(route.features)) throw Error("Invalid cycle route");
  const distanceMetres = Number(route.metadata.distanceMetres) || 0;
  const movingMinutes = Math.max(1, Math.ceil(distanceMetres / (cyclingSpeedKph * 1000 / 60)));
  const departureAt = now.toISOString();
  const arrivalAt = new Date(now.getTime() + movingMinutes * 60000).toISOString();
  return {
    mode: "cycle",
    transfers: 0,
    departureAt,
    arrivalAt,
    totalMinutes: movingMinutes,
    distanceMetres,
    profile: route.metadata.profile || "quiet",
    avoidBusy: !!route.metadata.avoidBusy,
    totals: route.metadata.totals,
    snaps: route.metadata.snaps,
    route,
  };
}

async function cycleJourneys(from, to, {
  profile = "quiet",
  avoidBusy = false,
  cyclingSpeedKph = 16,
  now = new Date(),
  loadNetworkFn = loadNetwork,
  findRouteFn = findRoute,
} = {}) {
  const network = await loadNetworkFn();
  const route = findRouteFn(network, from, to, { profile, avoidBusy });
  return [cycleJourneyFromRoute(route, { cyclingSpeedKph, now })];
}

async function busJourneys(from, to, {
  fetcher = fetch,
} = {}) {
  const params = new URLSearchParams({
    from: from.join(","),
    to: to.join(","),
  });
  const response = await fetcher("/api/journeys?" + params.toString(), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("Bus journey planning unavailable");
  const data = await response.json();
  if (!data?.ok || !Array.isArray(data.journeys)) throw Error("Invalid bus journey response");
  return data.journeys;
}

export async function planJourneys(from, to, {
  mode = "all",
  ...options
} = {}) {
  mode = normaliseJourneyMode(mode);
  if (mode === "cycle") {
    return { mode, cycle: await cycleJourneys(from, to, options), bus: [], journeys: [] };
  }
  if (mode === "bus") {
    return { mode, cycle: [], bus: await busJourneys(from, to, options), journeys: [] };
  }

  const [cycleResult, busResult] = await Promise.allSettled([
    cycleJourneys(from, to, options),
    busJourneys(from, to, options),
  ]);
  const cycle = cycleResult.status === "fulfilled" ? cycleResult.value : [];
  const bus = busResult.status === "fulfilled" ? busResult.value : [];
  const journeys = [...cycle, ...bus].sort((a, b) =>
    Number(a.totalMinutes || Infinity) - Number(b.totalMinutes || Infinity)
  );
  if (!journeys.length) throw Error("No journey options available");
  return {
    mode,
    cycle,
    bus,
    journeys,
    unavailable: {
      cycle: cycleResult.status === "rejected",
      bus: busResult.status === "rejected",
    },
  };
}
