import { places, modes } from "../api/catalog.js";
export const QLDC_TRAILS_URL = "https://gis.qldc.govt.nz/server/rest/services/OpenSpaces/Parks_VIEWER/MapServer/57/query?where=CYCLE%3D%2701%27%20AND%20ASSTAT%3D%2702%27&outFields=OBJECTID%2CTRAILNME%2CCYCLEGRADE%2CSURFACE%2CCYCLE%2COPSTAT%2CACTIVETRVL%2CSUBTYPE%2CLENGTHM%2CCONFID&returnGeometry=true&outSR=4326&f=geojson";
const NZTA_CLOSURES_URL = "https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/NZTA_Highway_Information/FeatureServer/1/query?where=impact%3D%27Road%20Closed%27&geometry=168.57%2C-45.13%2C169.04%2C-44.88&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson";
const QLDC_NOTICE_DEFS = [
  {
    road:/^Templeton Way$/i,
    title:"Queenstown Library 150th Celebration",
    detail:"Templeton Way: Queenstown Squash Club to Boundary Street carpark · 8:00am–5:30pm, 28 Nov 2026.",
  },
  {
    road:/^Coronet Peak Road$/i,
    title:"Coronet Peak Hill Climb",
    detail:"Upper Coronet Peak Road from Skippers Road · 8:00am–6:00pm, 28 Nov 2026.",
  },
];
const TRAIL_NOTICE_DEFS = [
  { match:/Arrow River Bridges/i, title:"Arrow River Bridges Trail", detail:"Closed between Tobins Bridge and Whitechapel Road." },
  { match:/Lake Hayes/i, title:"Waiwhakaata Lake Hayes Trail", detail:"Partially open; the bridge at the northern end remains closed." },
  { match:/Bush Creek/i, title:"Bush Creek", detail:"Closed." },
  { match:/Frankton Track/i, title:"Frankton Track", detail:"2026 detour in place due to major infrastructure upgrades." },
  { match:/Coronet Loop/i, title:"Coronet Loop", detail:"Closed for winter." },
  { match:/Lower Shotover/i, title:"Lower Shotover Conservation Area", detail:"Flooded; check current trail notice before travelling." },
];

export function createMap(onStatus) {
  if (!window.L) {
    onStatus("Map unavailable. Use the transport links below.");
    return {
      render() {},
      showCycleRoute() {},
      showCycleNetwork() {},
      pickCyclePoint() { onStatus("Map picking is unavailable. Choose a named area instead."); },
      focus() {},
      reset() {},
      locate() {
        onStatus("Location is unavailable without the map.");
      },
    };
  }
  const map = L.map("map", { zoomControl: false }).setView(
    [-45.019, 168.714],
    12,
  );
  L.control.zoom({ position: "topright" }).addTo(map);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  tiles.on("tileerror", () =>
    onStatus(
      "Map tiles unavailable. Official links and drafts remain available.",
    ),
  );
  tiles.on("tileload", () =>
    onStatus("Orientation landmarks · not live transport data"),
  );
  const markers = L.layerGroup().addTo(map);
  const trails = L.geoJSON(null, {
    style: (feature) => ({ color: feature?.properties?.OPSTAT === "02" ? "#9b4d45" : "#2f7d5b", weight: 4, opacity: 0.9, dashArray: feature?.properties?.OPSTAT === "02" ? "8 7" : null }),
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      const div = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = p.TRAILNME || "QLDC cycle trail";
      div.append(strong);
      const details = [];
      if (p.CYCLEGRADE) details.push("Grade: " + p.CYCLEGRADE);
      if (p.SURFACE) details.push("Surface: " + p.SURFACE);
      if (p.OPSTAT === "02") details.push("QLDC operating status: closed");
      else if (p.OPSTAT === "01") details.push("QLDC operating status: open");
      for (const text of details) div.append(document.createElement("br"), document.createTextNode(text));
      const note = document.createElement("small");
      note.textContent = "Source: QLDC Tracks & Trails. Operational asset data; verify conditions before riding.";
      div.append(document.createElement("br"), note);
      layer.bindPopup(div);
    },
  });
  let trailsLoaded = false;
  let trailsLoading;
  let trailData;
  async function ensureTrails() {
    if (trailsLoaded) return true;
    if (trailsLoading) return trailsLoading;
    trailsLoading = (async () => {
      try {
        onStatus("Loading official QLDC cycle trails…");
        const response = await fetch(QLDC_TRAILS_URL, { headers: { Accept: "application/geo+json,application/json" } });
        if (!response.ok) throw new Error("QLDC returned " + response.status);
        const data = await response.json();
        if (data.error || !Array.isArray(data.features)) throw new Error("Unexpected QLDC response");
        trails.addData(data);
        trailData = data;
        trailsLoaded = true;
        onStatus("QLDC cycle network · " + data.features.length + " trail segments loaded");
        return true;
      } catch (error) {
        console.warn("QLDC trails unavailable", error);
        onStatus("QLDC cycle trails are temporarily unavailable. Basemap and official links still work.");
        return false;
      } finally { trailsLoading = null; }
    })();
    return trailsLoading;
  }
  let nztaClosures;
  let qldcClosures;
  let trailClosures;
  let nztaLoaded = false;
  let qldcLoaded = false;
  let trailClosuresLoaded = false;

  function appendLine(div, label, value) {
    if (value === null || value === undefined || value === "") return;
    div.append(document.createElement("br"), document.createTextNode(label + value));
  }

  async function ensureNztaClosures() {
    if (nztaLoaded) return true;
    try {
      onStatus("Loading live NZTA road closures…");
      const response = await fetch(NZTA_CLOSURES_URL, { headers:{ Accept:"application/geo+json,application/json" } });
      if (!response.ok) throw Error("NZTA returned " + response.status);
      const data = await response.json();
      if (!Array.isArray(data.features)) throw Error("Unexpected NZTA response");
      nztaClosures = L.geoJSON(data, {
        style:{ color:"#c1272d", weight:7, opacity:.9, dashArray:"10 7" },
        onEachFeature(feature, layer) {
          const p = feature.properties || {};
          const div = document.createElement("div");
          const strong = document.createElement("strong");
          strong.textContent = p.locationArea || p.eventDescription || "NZTA road closure";
          div.append(strong);
          appendLine(div, "", p.eventDescription && p.eventDescription !== strong.textContent ? p.eventDescription : "");
          appendLine(div, "Impact: ", p.impact);
          appendLine(div, "Restrictions: ", p.restrictions);
          appendLine(div, "Alternative: ", p.alternativeRoute);
          const note = document.createElement("small");
          note.textContent = "Source: NZTA Highway Information · live verified road event.";
          div.append(document.createElement("br"), note);
          layer.bindPopup(div);
        },
      });
      nztaLoaded = true;
      onStatus("NZTA live road closures · " + data.features.length + " in Whakatipu coverage");
      return true;
    } catch (error) {
      console.warn("NZTA closures unavailable", error);
      onStatus("NZTA closures are temporarily unavailable.");
      return false;
    }
  }

  async function ensureQldcClosures() {
    if (qldcLoaded) return true;
    try {
      onStatus("Loading QLDC road-closure notices…");
      const response = await fetch("/data/cycle-network.v1.json");
      if (!response.ok) throw Error("Routing snapshot unavailable");
      const data = await response.json();
      qldcClosures = L.layerGroup();

      for (const notice of QLDC_NOTICE_DEFS) {
        const wayIndexes = new Set();
        data.ways.forEach((way, index) => { if (notice.road.test(way.name || "")) wayIndexes.add(index); });
        const points = [];
        for (const [a,b,w] of data.edges) {
          if (!wayIndexes.has(w)) continue;
          points.push(data.nodes[a].slice(1), data.nodes[b].slice(1));
        }
        if (!points.length) continue;
        const middle = points[Math.floor(points.length / 2)];
        const div = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = notice.title;
        div.append(strong, document.createElement("br"), document.createTextNode(notice.detail));
        const note = document.createElement("small");
        note.textContent = "Source: QLDC scheduled-event road-closure notice · marker is approximate road location.";
        div.append(document.createElement("br"), note);
        L.circleMarker([middle[1], middle[0]], {
          radius:8, color:"#8f5b36", weight:3, fillColor:"#fff", fillOpacity:1,
        }).bindPopup(div).addTo(qldcClosures);
      }
      qldcLoaded = true;
      onStatus("QLDC scheduled road-closure notices loaded");
      return true;
    } catch (error) {
      console.warn("QLDC closure notices unavailable", error);
      onStatus("QLDC closure notices are temporarily unavailable.");
      return false;
    }
  }

  async function ensureTrailClosures() {
    if (trailClosuresLoaded) return true;
    const ok = await ensureTrails();
    if (!ok || !trailData) return false;
    const features = [];
    for (const feature of trailData.features) {
      const name = feature?.properties?.TRAILNME || "";
      const notice = TRAIL_NOTICE_DEFS.find(item => item.match.test(name));
      if (!notice) continue;
      features.push({
        ...feature,
        properties:{ ...feature.properties, closureTitle:notice.title, closureDetail:notice.detail },
      });
    }
    trailClosures = L.geoJSON({ type:"FeatureCollection", features }, {
      style:{ color:"#b83232", weight:7, opacity:.9, dashArray:"9 7" },
      onEachFeature(feature, layer) {
        const p = feature.properties || {};
        const div = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = p.closureTitle || p.TRAILNME || "Trail notice";
        div.append(strong, document.createElement("br"), document.createTextNode(p.closureDetail || "Check current Queenstown Trail notice."));
        const note = document.createElement("small");
        note.textContent = "Source: Queenstown Trails notice + QLDC mapped trail geometry. Whole named trail may be highlighted where the notice affects only part.";
        div.append(document.createElement("br"), note);
        layer.bindPopup(div);
      },
    });
    trailClosuresLoaded = true;
    onStatus("Queenstown Trail closure notices · " + features.length + " mapped sections");
    return true;
  }

  let cycleRoute;
  let cycleNetwork;
  let pickCallback;
  map.on("click", event => {
    if (!pickCallback) return;
    const callback = pickCallback; pickCallback = null;
    map.getContainer().classList.remove("picking-cycle-point");
    callback([event.latlng.lng, event.latlng.lat]);
  });
  let location;
  function popup(title, detail) {
    const div = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    div.append(
      strong,
      document.createElement("br"),
      document.createTextNode(detail),
    );
    return div;
  }
  function marker(place, color, text) {
    L.marker([place.lat, place.lng], {
      title: place.name,
      icon: L.divIcon({
        className: "",
        html: `<div class="place-marker" style="--color:${color};width:18px;height:18px"></div>`,
        iconSize: [18, 18],
      }),
    })
      .bindPopup(popup(place.name, text))
      .addTo(markers);
  }
  return {
    async render(enabled, reports) {
      markers.clearLayers();
      for (const place of places) {
        const mode = modes.find(
          (m) => enabled.has(m.id) && place.modes.includes(m.id),
        );
        if (mode)
          marker(
            place,
            mode.color,
            "Approximate landmark only. Check official information for services.",
          );
      }
      if (enabled.has("cycling")) {
        const ok = await ensureTrails();
        if (ok && !map.hasLayer(trails)) trails.addTo(map);
      } else if (map.hasLayer(trails)) map.removeLayer(trails);

      if (enabled.has("nzta-closures")) {
        const ok = await ensureNztaClosures();
        if (ok && nztaClosures && !map.hasLayer(nztaClosures)) nztaClosures.addTo(map);
      } else if (nztaClosures && map.hasLayer(nztaClosures)) map.removeLayer(nztaClosures);

      if (enabled.has("qldc-closures")) {
        const ok = await ensureQldcClosures();
        if (ok && qldcClosures && !map.hasLayer(qldcClosures)) qldcClosures.addTo(map);
      } else if (qldcClosures && map.hasLayer(qldcClosures)) map.removeLayer(qldcClosures);

      if (enabled.has("trail-closures")) {
        const ok = await ensureTrailClosures();
        if (ok && trailClosures && !map.hasLayer(trailClosures)) trailClosures.addTo(map);
      } else if (trailClosures && map.hasLayer(trailClosures)) map.removeLayer(trailClosures);

      if (enabled.has("community"))
        for (const report of reports) {
          const place = places.find((p) => p.id === report.placeId);
          if (place)
            marker(
              place,
              "#8c719e",
              `Private draft: ${report.type}. ${report.note}`,
            );
        }
    },
    pickCyclePoint(callback) {
      pickCallback = callback;
      map.getContainer().classList.toggle("picking-cycle-point", !!callback);
    },
    showCycleNetwork(geojson) {
      if (cycleNetwork) { map.removeLayer(cycleNetwork); cycleNetwork = null; }
      if (!geojson) return;
      cycleNetwork = L.geoJSON(geojson, {
        renderer: L.canvas(),
        style: feature => ({ color: feature.properties.kind === "walk-bike" ? "#7b4190" : feature.properties.busy ? "#bd5900" : feature.properties.kind === "road" ? "#236bb0" : "#2f7d5b", weight: 3, opacity: 0.6 }),
        onEachFeature(feature, layer) { layer.bindPopup(popup(feature.properties.name, "OSM routing snapshot · check access and conditions")); },
      }).addTo(map);
      if (cycleRoute) cycleRoute.bringToFront();
    },
    showCycleRoute(geojson) {
      trails.setStyle({ opacity: geojson ? 0.25 : 0.9 });
      if (!cycleRoute && !geojson) return;
      if (!cycleRoute) cycleRoute = L.geoJSON(null, {
        style: feature => ({
          color: feature.properties.closed ? "#b83232" : feature.properties.kind === "walk-bike" ? "#7b4190" : feature.properties.kind === "detour" || feature.properties.busy ? "#bd5900" : feature.properties.kind === "path" ? "#2f7d5b" : "#236bb0",
          weight: 7, opacity: 0.95,
          dashArray: feature.properties.closed || feature.properties.kind === "walk-bike" ? "10 8" : null,
        }),
        onEachFeature(feature, layer) {
          layer.bindPopup(popup(feature.properties.name, `${feature.properties.source} · ${feature.properties.closed ? "Closed — normal alignment only" : feature.properties.kind === "walk-bike" ? "Walk your bike on this footpath / crossing" : feature.properties.kind === "detour" ? "Mapped path — follow temporary signs and dismount where instructed" : feature.properties.busy ? "Busy road — riding in traffic" : feature.properties.kind === "path" ? "Cycle path / trail — may be shared or unsealed" : "Road connection — riding in traffic"}`));
        },
      });
      cycleRoute.clearLayers();
      if (!geojson) {
        if (map.hasLayer(cycleRoute)) map.removeLayer(cycleRoute);
        return;
      }
      cycleRoute.addData(geojson);
      const endpoints = [
        [geojson.features[0].geometry.coordinates[0], geojson.metadata.start],
        [geojson.features.at(-1).geometry.coordinates.at(-1), geojson.metadata.end],
      ];
      for (const [point, name] of endpoints) {
        L.circleMarker([point[1], point[0]], { radius: 7, color: "#173f36", fillColor: "#fff", fillOpacity: 1 })
          .bindPopup(popup(name, "Mapped route endpoint"))
          .addTo(cycleRoute);
      }
      for (const gap of geojson.metadata.gaps || []) {
        for (const point of [gap.from, gap.to]) {
          L.circleMarker([point[1], point[0]], { radius: 9, color: "#bd5900", fillColor: "#fff", fillOpacity: 1, weight: 4 })
            .bindPopup(popup("Unmapped works section", gap.label))
            .addTo(cycleRoute);
        }
      }
      if (!map.hasLayer(cycleRoute)) cycleRoute.addTo(map);
      const bounds = cycleRoute.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32] });
    },
    focus(place) {
      map.setView([place.lat, place.lng], 15);
      L.popup()
        .setLatLng([place.lat, place.lng])
        .setContent(popup(place.name, "Approximate orientation landmark"))
        .openOn(map);
    },
    reset() {
      map.setView([-45.019, 168.714], 12);
    },
    locate() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          onStatus("Your browser does not support location.");
          reject(new Error("Geolocation unsupported"));
          return;
        }
        onStatus("Finding your location…");
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            if (location) map.removeLayer(location);
            location = L.circleMarker([coords.latitude, coords.longitude], {
              radius: 8,
              color: "#fff",
              fillColor: "#2c6fc0",
              fillOpacity: 1,
            })
              .bindPopup("Your location (not saved)")
              .addTo(map);
            map.setView([coords.latitude, coords.longitude], 14);
            onStatus("Your location is approximate and is not saved.");
            resolve([coords.longitude, coords.latitude]);
          },
          () => {
            onStatus("Location unavailable or permission denied. Choose a place instead.");
            reject(new Error("Location unavailable"));
          },
          { timeout: 10000, maximumAge: 60000 },
        );
      });
    },
  };
}
