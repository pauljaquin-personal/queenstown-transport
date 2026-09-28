const R = 6371000;

function metres(a, b) {
  const toRad = Math.PI / 180;
  const p1 = a[1] * toRad, p2 = b[1] * toRad;
  const dp = (b[1] - a[1]) * toRad, dl = (b[0] - a[0]) * toRad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function sampleRoute(route, { spacing = 80, maxSamples = 100 } = {}) {
  const total = Number(route?.metadata?.distanceMetres) || 0;
  if (!Array.isArray(route?.features) || total <= 0) return [];
  const targetSpacing = Math.max(spacing, total / Math.max(2, maxSamples - 1));
  const samples = [];
  let routeDistance = 0;
  let nextTarget = 0;

  const pushSample = (point, distance, props) => {
    const last = samples.at(-1);
    if (last && Math.abs(last.distance - distance) < 0.5) return;
    samples.push({
      point,
      distance,
      kind: props.kind,
      busy: Boolean(props.busy),
      surface: props.surface || "unknown",
    });
  };

  for (const feature of route.features) {
    const coords = feature?.geometry?.coordinates || [];
    const props = feature?.properties || {};
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i];
      const segmentLength = metres(a, b);
      if (!(segmentLength > 0)) continue;
      const segmentStart = routeDistance;
      const segmentEnd = routeDistance + segmentLength;
      while (nextTarget <= segmentEnd + 0.01) {
        if (nextTarget >= segmentStart - 0.01) {
          const t = Math.max(0, Math.min(1, (nextTarget - segmentStart) / segmentLength));
          pushSample(interpolate(a, b, t), nextTarget, props);
        }
        nextTarget += targetSpacing;
      }
      routeDistance = segmentEnd;
    }
  }

  const lastFeature = route.features.at(-1);
  const lastPoint = lastFeature?.geometry?.coordinates?.at(-1);
  if (lastPoint) pushSample(lastPoint, total, lastFeature.properties || {});
  return samples.slice(0, maxSamples);
}

export async function fetchElevations(samples, fetcher = fetch) {
  if (!samples.length) return [];
  const response = await fetcher("/api/elevation", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ locations:samples.map((sample) => sample.point) }),
    signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Elevation unavailable");
  const data = await response.json();
  if (!data?.ok || !Array.isArray(data.elevations) || data.elevations.length !== samples.length) throw Error("Elevation unavailable");
  return samples.map((sample, index) => ({ ...sample, elevation:data.elevations[index] }));
}

export function smoothElevations(points) {
  return points.map((point, i) => {
    const values = points.slice(Math.max(0, i - 1), Math.min(points.length, i + 2))
      .map((p) => p.elevation)
      .filter(Number.isFinite);
    return { ...point, elevation:values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  });
}

export function elevationStats(points) {
  const clean = smoothElevations(points);
  let ascent = 0, descent = 0;
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1].elevation, b = clean[i].elevation;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const delta = b - a;
    if (Math.abs(delta) < 1) continue;
    if (delta > 0) ascent += delta;
    else descent -= delta;
  }
  return { points:clean, ascent:Math.round(ascent), descent:Math.round(descent) };
}
