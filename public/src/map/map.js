import { REPORT_AREAS, REPORT_TYPES } from "../api/traffic-schema.js?v=20260929-12";
import { busPopup } from "./bus-popup.js?v=20260929-11";
import { places, modes } from "../api/catalog.js?v=20260929-12";
import { TRAIL_NOTICES, trailNoticeForMapName } from "../routing/trail-notices.js?v=20260929-1";
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
      clearLocation() {},
      locate() {
        onStatus("Location is unavailable without the map.");
        return Promise.reject(new Error("Geolocation unavailable"));
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
      const notice = trailNoticeForMapName(name);
      if (!notice) continue;
      features.push({
        ...feature,
        properties:{ ...feature.properties, closureTitle:notice.title, closureDetail:notice.detail, routing:notice.routing },
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
        note.textContent = p.routing === "block"
          ? "Source: Queenstown Trails notice + QLDC mapped trail geometry. This notice also blocks matching trail segments in QueenstownGo routing."
          : "Source: Queenstown Trails notice + QLDC mapped trail geometry. This notice is shown as a warning only because precise closure geometry is not yet available.";
        div.append(document.createElement("br"), note);
        layer.bindPopup(div);
      },
    });
    trailClosuresLoaded = true;
    onStatus("Queenstown Trail closure notices · " + features.length + " mapped sections");
    return true;
  }

  let busRoutes;
  let busStops;
  let busesLoaded = false;
  let busesLoading;

  let departureRequest;
  function loadDepartures() {
    if (!departureRequest) departureRequest=(async()=>{
      // Versioned URL bypasses previously deployed six-hour API cache entries.
      const response=await fetch("/api/buses?v=2",{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw Error("Bus API returned "+response.status);
      const data=await response.json();
      if (!data.ok || !Array.isArray(data.routes) || !Array.isArray(data.shapes) || !Array.isArray(data.stops)) throw Error("Unexpected bus response");
      return data;
    })().finally(()=>{departureRequest=null;});
    return departureRequest;
  }

  async function ensureBuses() {
    if (busesLoaded) return true;
    if (busesLoading) return busesLoading;
    busesLoading=(async()=>{
      try {
        onStatus("Loading official Orbus routes & stops…");
        const data=await loadDepartures();
        busRoutes=L.layerGroup();
        for (const shape of data.shapes) {
          if (!Array.isArray(shape.coordinates) || shape.coordinates.length<2) continue;
          const line=L.polyline(shape.coordinates.map(([lng,lat])=>[lat,lng]),{
            color:shape.color || "#597847",weight:5,opacity:.82
          });
          const div=document.createElement("div");
          const strong=document.createElement("strong");
          strong.textContent="Route "+shape.route;
          div.append(strong);
          if (shape.name) div.append(document.createElement("br"),document.createTextNode(shape.name));
          const note=document.createElement("small");
          note.textContent="Source: Otago Regional Council GTFS · scheduled route geometry.";
          div.append(document.createElement("br"),note);
          line.bindPopup(div).addTo(busRoutes);
        }
        busStops=L.layerGroup();
        for (const stop of data.stops) {
          const marker=L.circleMarker([stop.lat,stop.lng],{
            radius:4,color:"#315c36",weight:2,fillColor:"#fff",fillOpacity:1
          }).bindPopup(()=>busPopup(stop,{loading:true})).addTo(busStops);
          let refreshTimer;
          let generation=0;
          marker.on("popupopen",()=>{
            const current=++generation;
            marker.setPopupContent(busPopup(stop,{loading:true}));
            const refresh=async()=>{
              try {
                const fresh=await loadDepartures();
                const updated=fresh.stops.find(s=>s.id===stop.id);
                if (!updated) throw Error("Stop no longer in timetable");
                if (generation===current && marker.isPopupOpen()) marker.setPopupContent(busPopup(updated));
              } catch {
                if (generation===current && marker.isPopupOpen()) marker.setPopupContent(busPopup(stop,{error:true}));
              }
            };
            refresh();
            refreshTimer=setInterval(refresh,30000);
          });
          marker.on("popupclose",()=>{generation++;clearInterval(refreshTimer);});
        }
        busesLoaded=true;
        onStatus("Orbus scheduled network · "+new Set(data.routes.map(route=>route.number)).size+" Queenstown routes · "+data.stops.length+" stops");
        return true;
      } catch (error) {
        console.warn("Orbus GTFS unavailable",error);
        onStatus("Orbus routes & stops are temporarily unavailable. Use the official Orbus link for current information.");
        return false;
      } finally { busesLoading=null; }
    })();
    return busesLoading;
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
  let renderGeneration=0;
  return {
    async render(enabled, reports) {
      const currentRender=++renderGeneration;
      markers.clearLayers();
      for (const place of places) {
        const mode = modes.find(
          (m) => enabled.has(m.id) && m.id !== "buses" && place.modes.includes(m.id),
        );
        if (mode)
          marker(
            place,
            mode.color,
            "Approximate landmark only. Check official information for services.",
          );
      }
      if (enabled.has("buses")) {
        const ok=await ensureBuses();
        if (ok) {
          if (busRoutes && !map.hasLayer(busRoutes)) busRoutes.addTo(map);
          if (busStops && !map.hasLayer(busStops)) busStops.addTo(map);
        }
      } else {
        if (busRoutes && map.hasLayer(busRoutes)) map.removeLayer(busRoutes);
        if (busStops && map.hasLayer(busStops)) map.removeLayer(busStops);
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

      if (currentRender!==renderGeneration) return;
      if (enabled.has("community"))
        for (const report of reports) {
          if (report.shared && Date.parse(report.expiresAt)<=Date.now()) continue;
          const area=REPORT_AREAS.find(([id])=>id===report.placeId);
          const place = report.shared && area ? {name:area[1],lng:area[2],lat:area[3]} : places.find((p) => p.id === report.placeId);
          if (place)
            marker(
              place,
              "#8c719e",
              report.shared ? `Unverified community report · approximate area: ${REPORT_TYPES[report.type]?.label || report.type}. ${report.location}. ${report.note}` : `Private draft: ${report.type}. ${report.note}`,
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
    clearLocation() {
      if (location) {
        map.removeLayer(location);
        location = null;
      }
      onStatus("");
    },
    locate() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const error = new Error("Your browser does not support location.");
          error.code = 0;
          onStatus(error.message);
          reject(error);
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
          (geoError) => {
            let message = "Could not get your location. Tap ◎ to retry.";
            if (geoError.code === geoError.PERMISSION_DENIED) {
              message = "Location access was denied. Enable location for QueenstownGo, then tap ◎ to retry.";
            } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
              message = "Your location is temporarily unavailable. Tap ◎ to retry.";
            } else if (geoError.code === geoError.TIMEOUT) {
              message = "Location request timed out. Tap ◎ to try again.";
            }
            onStatus(message);
            const error = new Error(message);
            error.code = geoError.code;
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
      });
    },
  };
}
