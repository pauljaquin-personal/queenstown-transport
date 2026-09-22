import { places, modes } from "../api/catalog.js";
const QLDC_TRAILS_URL = "https://gis.qldc.govt.nz/server/rest/services/OpenSpaces/Parks_VIEWER/MapServer/57/query?where=CYCLE%3D%2701%27%20AND%20ASSTAT%3D%2702%27&outFields=OBJECTID%2CTRAILNME%2CCYCLEGRADE%2CSURFACE%2CCYCLE%2COPSTAT%2CACTIVETRVL%2CSUBTYPE%2CLENGTHM%2CCONFID&returnGeometry=true&outSR=4326&f=geojson";

export function createMap(onStatus) {
  if (!window.L) {
    onStatus("Map unavailable. Use the transport links below.");
    return {
      render() {},
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
  const trails = L.geoJSON(null, {\n    style: (feature) => ({ color: feature?.properties?.OPSTAT === "02" ? "#9b4d45" : "#2f7d5b", weight: 4, opacity: 0.9, dashArray: feature?.properties?.OPSTAT === "02" ? "8 7" : null }),\n    onEachFeature(feature, layer) {\n      const p = feature.properties || {};\n      const div = document.createElement("div");\n      const strong = document.createElement("strong");\n      strong.textContent = p.TRAILNME || "QLDC cycle trail";\n      div.append(strong);\n      const details = [];\n      if (p.CYCLEGRADE) details.push("Grade: " + p.CYCLEGRADE);\n      if (p.SURFACE) details.push("Surface: " + p.SURFACE);\n      if (p.OPSTAT === "02") details.push("QLDC operating status: closed");\n      else if (p.OPSTAT === "01") details.push("QLDC operating status: open");\n      for (const text of details) div.append(document.createElement("br"), document.createTextNode(text));\n      const note = document.createElement("small");\n      note.textContent = "Source: QLDC Tracks & Trails. Operational asset data; verify conditions before riding.";\n      div.append(document.createElement("br"), note);\n      layer.bindPopup(div);\n    },\n  });\n  let trailsLoaded = false;\n  let trailsLoading;\n  async function ensureTrails() {\n    if (trailsLoaded) return true;\n    if (trailsLoading) return trailsLoading;\n    trailsLoading = (async () => {\n      try {\n        onStatus("Loading official QLDC cycle trails…");\n        const response = await fetch(QLDC_TRAILS_URL, { headers: { Accept: "application/geo+json,application/json" } });\n        if (!response.ok) throw new Error("QLDC returned " + response.status);\n        const data = await response.json();\n        if (data.error || !Array.isArray(data.features)) throw new Error("Unexpected QLDC response");\n        trails.addData(data);\n        trailsLoaded = true;\n        onStatus("QLDC cycle network · " + data.features.length + " trail segments loaded");\n        return true;\n      } catch (error) {\n        console.warn("QLDC trails unavailable", error);\n        onStatus("QLDC cycle trails are temporarily unavailable. Basemap and official links still work.");\n        return false;\n      } finally { trailsLoading = null; }\n    })();\n    return trailsLoading;\n  }\n  let location;
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
      if (enabled.has("cycling")) {\n        const ok = await ensureTrails();\n        if (ok && !map.hasLayer(trails)) trails.addTo(map);\n      } else if (map.hasLayer(trails)) map.removeLayer(trails);\n      if (enabled.has("community"))
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
      if (!navigator.geolocation) {
        onStatus("Your browser does not support location.");
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
        },
        () =>
          onStatus(
            "Location unavailable or permission denied. Choose a place instead.",
          ),
        { timeout: 10000, maximumAge: 60000 },
      );
    },
  };
}
