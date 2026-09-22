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
