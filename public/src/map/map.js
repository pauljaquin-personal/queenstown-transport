import { places, modes } from "../api/catalog.js";
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
    render(enabled, reports) {
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
