import { places, modes } from "./api/catalog.js";
import { readReports, saveReport, deleteReport } from "./api/reports.js";
import { createMap } from "./map/map.js?v=20260923-3";
const $ = (s) => document.querySelector(s);
const enabled = new Set(["buses", "ferries", "cycling"]);
let selected = "buses";
let deferredInstall;
const ROUTE_PLACES = [
  ["queenstown", "Queenstown", 168.6626, -45.0328],
  ["fernhill", "Fernhill", 168.6387, -45.0380],
  ["frankton", "Frankton", 168.7447, -45.0182],
  ["hanleys-farm", "Hanley’s Farm", 168.7348, -45.0838],
  ["jacks-point", "Jack’s Point", 168.7385, -45.0895],
  ["kelvin-heights", "Kelvin Heights", 168.7035, -45.0500],
  ["arthurs-point", "Arthurs Point", 168.6845, -44.9820],
  ["shotover-country", "Shotover Country", 168.7900, -44.9970],
  ["lake-hayes-estate", "Lake Hayes Estate", 168.8140, -44.9990],
  ["arrowtown", "Arrowtown", 168.8350, -44.9380],
];

const map = createMap((text) => ($("#map-status").textContent = text));
for (const [id, name] of ROUTE_PLACES) {
  for (const selector of ["#route-from", "#route-to"]) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    $(selector).append(option);
  }
}
$("#route-from").value = "queenstown";
$("#route-to").value = "frankton";
function toast(text) {
  $("#toast").textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").textContent = ""), 5500);
}
for (const place of places)
  for (const selector of ["#place", "#report-place"]) {
    const option = document.createElement("option");
    option.value = place.id;
    option.textContent = place.name;
    $(selector).append(option);
  }
for (const mode of modes) {
  const row = document.createElement("div");
  row.className = "layer-row";
  row.dataset.mode = mode.id;
  row.style.setProperty("--color", mode.color);
  row.style.setProperty("--tint", mode.tint);
  const button = document.createElement("button");
  button.className = "layer-select";
  button.innerHTML = `<span class="mode-icon" aria-hidden="true">${mode.icon}</span><span>${mode.name}<small>${mode.subtitle}</small></span>`;
  button.onclick = () => {
    selected = mode.id;
    render();
  };
  const label = document.createElement("label");
  label.className = "toggle";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = enabled.has(mode.id);
  toggle.setAttribute(
    "aria-label",
    `Show ${mode.name.toLowerCase()} landmarks on map`,
  );
  toggle.onchange = () => {
    toggle.checked ? enabled.add(mode.id) : enabled.delete(mode.id);
    selected = mode.id;
    render();
  };
  label.append(toggle);
  row.append(button, label);
  $("#layers").append(row);
}
function render() {
  map.render(enabled, readReports());
  for (const row of document.querySelectorAll(".layer-row")) {
    const active = row.dataset.mode === selected;
    row.classList.toggle("active", active);
    row.querySelector("button").setAttribute("aria-pressed", String(active));
  }
  const mode = modes.find((m) => m.id === selected);
  const container = $("#details");
  container.replaceChildren();
  const card = document.createElement("div");
  card.className = "detail-card";
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = mode.status;
  const title = document.createElement("h3");
  title.textContent = mode.title;
  const description = document.createElement("p");
  description.textContent = mode.description;
  card.append(title, tag, description);
  for (const [text, url] of mode.links) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${text} ↗`;
    card.append(link, document.createElement("br"));
  }
  if (selected === "community") {
    const add = document.createElement("button");
    add.className = "primary";
    add.textContent = "＋ Keep a private draft";
    add.onclick = () => $("#report-dialog").showModal();
    card.append(add);
    const reports = readReports();
    if (!reports.length) {
      const empty = document.createElement("p");
      empty.textContent = "No private drafts saved on this device.";
      card.append(empty);
    }
    for (const report of reports) {
      const article = document.createElement("article");
      article.className = "draft";
      const heading = document.createElement("strong");
      heading.textContent = `${report.type} · ${places.find((p) => p.id === report.placeId)?.name || "Unknown place"}`;
      const note = document.createElement("p");
      note.textContent = report.note;
      const remove = document.createElement("button");
      remove.textContent = "Delete draft";
      remove.onclick = () => {
        try {
          deleteReport(report.id);
          render();
          toast("Draft deleted.");
        } catch {
          toast("Browser storage is unavailable.");
        }
      };
      article.append(heading, note, remove);
      card.append(article);
    }
  }
  container.append(card);
}
let routeRequest = 0;
function clearRoute() {
  routeRequest++;
  map.showCycleRoute(null);
  $("#route-status").textContent = "Choose Show route to display the selected journey.";
}
$("#route-from").onchange = clearRoute;
$("#route-to").onchange = clearRoute;
$("#test-cycle-route").onclick = async () => {
  const request = ++routeRequest;
  const from = $("#route-from").value;
  const to = $("#route-to").value;
  map.showCycleRoute(null);
  if (from === to) {
    $("#route-status").textContent = "Choose two different places.";
    return;
  }
  if (!((from === "queenstown" && to === "frankton") || (from === "frankton" && to === "queenstown"))) {
    $("#route-status").textContent = "Only Queenstown ↔ Frankton is mapped so far.";
    return;
  }
  $("#route-status").textContent = "Loading verified route geometry…";
  try {
    const { loadRoute } = await import("./routing/frankton.js?v=20260923-3");
    const route = await loadRoute(from, to);
    if (request !== routeRequest) return;
    map.showCycleRoute(route);
    $("#route-status").textContent = `${route.metadata.start} → ${route.metadata.end} · ${(route.metadata.distanceMetres / 1000).toFixed(1)} km. ${route.metadata.notice} Red dashed sections: closed. Blue: OSM connections. Geometry checked ${route.metadata.verifiedAt}.`;
  } catch (error) {
    if (request !== routeRequest) return;
    console.warn("Cycle route unavailable", error);
    map.showCycleRoute(null);
    $("#route-status").textContent = "Cycle route unavailable. The map and From/To controls still work. Try again.";
  }
};
$("#place").onchange = (event) => {
  const place = places.find((p) => p.id === event.target.value);
  if (place) map.focus(place);
};
$("#reset").onclick = () => {
  map.reset();
  $("#place").value = "";
};
$("#locate").onclick = () => map.locate();
$("#about").onclick = () => $("#about-dialog").showModal();
for (const close of document.querySelectorAll("[data-close]"))
  close.onclick = () => close.closest("dialog").close();
$("#report-form").onsubmit = (event) => {
  event.preventDefault();
  try {
    saveReport({
      placeId: $("#report-place").value,
      type: $("#report-type").value,
      note: $("#report-note").value,
    });
    $("#report-note").value = "";
    $("#draft-status").textContent = "";
    $("#report-dialog").close();
    render();
    toast("Draft saved on this device. It has not been submitted.");
  } catch (error) {
    $("#draft-status").textContent =
      error.message.includes("characters") ||
      error.message.includes("50 drafts")
        ? error.message
        : "Unable to save: browser storage is unavailable or full.";
  }
};
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
});
$("#install").onclick = async () => {
  if (deferredInstall) {
    await deferredInstall.prompt();
    deferredInstall = null;
  } else $("#about-dialog").showModal();
};
window.addEventListener("offline", () => {
  $("#map-status").textContent =
    "Offline · map tiles and official links need internet";
  toast("Offline. Your saved drafts are still available.");
});
window.addEventListener("online", () => toast("Back online."));
render();
if (!navigator.onLine)
  $("#map-status").textContent =
    "Offline · map tiles and official links need internet";
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() =>
      toast("Offline mode could not be enabled. The app still works online."),
    );
