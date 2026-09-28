function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slug(value) {
  return String(value || "queenstown-route")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "queenstown-route";
}

function routePoints(route) {
  const points = [];
  for (const feature of route?.features || []) {
    for (const coord of feature?.geometry?.coordinates || []) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      const [lng, lat] = coord.map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const last = points.at(-1);
      if (last && Math.abs(last[0] - lng) < 1e-9 && Math.abs(last[1] - lat) < 1e-9) continue;
      points.push([lng, lat]);
    }
  }
  return points;
}

export function buildGpx(route, elevationPoints = null) {
  const name = `${route?.metadata?.start || "Start"} to ${route?.metadata?.end || "Destination"}`;
  const sourcePoints = Array.isArray(elevationPoints) && elevationPoints.length > 1
    ? elevationPoints
        .filter((p) => Array.isArray(p.point) && p.point.length >= 2)
        .map((p) => ({ lng:Number(p.point[0]), lat:Number(p.point[1]), ele:Number.isFinite(p.elevation) ? p.elevation : null }))
    : routePoints(route).map(([lng, lat]) => ({ lng, lat, ele:null }));

  if (sourcePoints.length < 2) throw Error("Route has no exportable geometry.");

  const trkpts = sourcePoints.map((p) =>
    `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${Number.isFinite(p.ele) ? `<ele>${p.ele.toFixed(1)}</ele>` : ""}</trkpt>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Queenstown Transport"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>${xmlEscape(name)}</name></metadata>
  <trk>
    <name>${xmlEscape(name)}</name>
    <type>Cycling</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>\n`;

  return {
    xml,
    name,
    filename:`${slug(name)}.gpx`,
    hasElevation:sourcePoints.some((p) => Number.isFinite(p.ele)),
  };
}

function downloadFile(file, filename) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareOrDownloadGpx(route, elevationPoints = null) {
  const gpx = buildGpx(route, elevationPoints);
  const file = new File([gpx.xml], gpx.filename, { type:"application/gpx+xml" });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
    try {
      await navigator.share({
        title:gpx.name,
        text:"Cycling route from Queenstown Transport",
        files:[file],
      });
      return { method:"share", hasElevation:gpx.hasElevation };
    } catch (error) {
      if (error?.name === "AbortError") return { method:"cancelled", hasElevation:gpx.hasElevation };
    }
  }

  downloadFile(file, gpx.filename);
  return { method:"download", hasElevation:gpx.hasElevation };
}
