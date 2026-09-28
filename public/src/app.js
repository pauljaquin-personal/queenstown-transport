import { places, modes, CYCLE_PLACES as ROUTE_PLACES } from "./api/catalog.js";
import { readReports, saveReport, deleteReport } from "./api/reports.js";
import { createMap } from "./map/map.js?v=20260928-2";
const $ = (s) => document.querySelector(s);
const enabled = new Set(["buses", "ferries", "cycling"]);
let selected = "buses";
let deferredInstall;


const map = createMap((text) => ($("#map-status").textContent = text));
for (const [id, name] of ROUTE_PLACES) {
  for (const selector of ["#route-from", "#route-to"]) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    $(selector).append(option);
  }
}
const pickStartOption = document.createElement("option");
pickStartOption.value = "pick:start";
pickStartOption.textContent = "Pick on map…";
$("#route-from").append(pickStartOption);

$("#route-from").value = "queenstown";
$("#route-to").value = "frankton";
$("#journey-destination").textContent = $("#route-to").selectedOptions[0]?.textContent || "Frankton";
function toast(text) {
  $("#toast").textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").textContent = ""), 5500);
}
for (const place of places) {
  const searchOption = document.createElement("option");
  searchOption.value = place.id;
  searchOption.textContent = place.name;
  $("#place").append(searchOption);

  const reportOption = document.createElement("option");
  reportOption.value = place.id;
  reportOption.textContent = place.name;
  $("#report-place").append(reportOption);
}
const existingSearchLabels = new Set([...$("#place").options].map((option) => option.textContent));
for (const [id, name] of ROUTE_PLACES) {
  const baseName = name.split(" · ")[0];
  if (existingSearchLabels.has(baseName) || [...$("#place").options].some((option) => option.textContent.startsWith(baseName))) continue;
  const option = document.createElement("option");
  option.value = `route:${id}`;
  option.textContent = baseName;
  $("#place").append(option);
}
const pickFinishOption = document.createElement("option");
pickFinishOption.value = "pick:finish";
pickFinishOption.textContent = "Pick on map…";
$("#place").append(pickFinishOption);
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
    `Show ${mode.name.toLowerCase()} on map`,
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
  $("#cycle-results").replaceChildren();
  $("#route-status").textContent = "Choose Show route to display the selected journey.";
}
let lastRouteFrom = "queenstown";
$("#route-from").onchange = () => {
  if ($("#route-from").value === "pick:start") {
    beginMapPick("start", "#route-from", lastRouteFrom);
    return;
  }
  lastRouteFrom = $("#route-from").value;
  clearRoute();
};
$("#route-to").onchange = () => {
  const selectedText = $("#route-to").selectedOptions[0]?.textContent || "Choose destination";
  $("#journey-destination").textContent = selectedText;
  clearRoute();
};
$("#route-variant").onchange = () => {
  const legacy = !["quiet", "direct"].includes($("#route-variant").value);
  $("#avoid-busy").disabled = legacy;
  clearRoute();
};
$("#avoid-busy").onchange = clearRoute;
const picked = {};
let activePick = null;
function beginMapPick(label, selector, restoreValue = "") {
  clearRoute();
  activePick = { label, selector, restoreValue };
  $("#cancel-pick").hidden = false;
  $("#pick-status").textContent = `Tap the map to choose your ${label}.`;
  map.pickCyclePoint(point => {
    picked[label] = point;
    const select = $(selector);
    let option = select.querySelector('[value="picked-' + label + '"]');
    if (!option) {
      option = document.createElement("option");
      option.value = "picked-" + label;
      select.append(option);
    }
    option.textContent = `Map ${label} (${point[1].toFixed(4)}, ${point[0].toFixed(4)})`;
    select.value = option.value;
    if (label === "start") lastRouteFrom = option.value;
    if (label === "finish") {
      $("#journey-destination").textContent = option.textContent;
      $("#place").value = "";
      $("#route-to").value = option.value;
    }
    $("#cancel-pick").hidden = true;
    $("#pick-status").textContent = "";
    activePick = null;
    clearRoute();
  });
  $("#map").scrollIntoView({ block:"center", behavior:"smooth" });
}
$("#cancel-pick").onclick = () => {
  map.pickCyclePoint(null);
  if (activePick?.selector === "#route-from") $("#route-from").value = activePick.restoreValue || lastRouteFrom;
  if (activePick?.label === "finish") $("#place").value = "";
  activePick = null;
  $("#cancel-pick").hidden = true;
  $("#pick-status").textContent = "";
};
let overlayRequest = 0;
$("#cycle-network-toggle").onchange = async event => {
  const request = ++overlayRequest;
  if (!event.target.checked) { map.showCycleNetwork(null); $("#network-status").textContent = ""; return; }
  $("#network-status").textContent = "Loading available roads and paths…";
  try {
    const { loadNetwork, networkOverlay } = await import("./routing/network.js?v=20260928-2");
    const network = await loadNetwork();
    if (request !== overlayRequest) return;
    map.showCycleNetwork(networkOverlay(network));
    $("#network-status").textContent = "Routing network shown. Excluded or unmapped links are omitted; QLDC background trails may include them.";
  } catch {
    if (request !== overlayRequest) return;
    event.target.checked = false;
    $("#network-status").textContent = "Network overlay unavailable. The map still works; try again.";
  }
};
function renderCycleResult(route) {
  const box = $("#cycle-results"); box.replaceChildren();
  const m = route.metadata, km = value => value < 1000 ? Math.round(value) + " m" : (value / 1000).toFixed(1) + " km";
  const title = document.createElement("h4"); title.textContent = `${km(m.distanceMetres)} · ${m.profile === "quiet" ? "Paths & quieter roads" : "Shorter route"}`;
  const mix = document.createElement("p"); mix.textContent = `${km(m.totals.path)} paths/trails · ${km(m.totals.road)} roads · ${km(m.totals['walk-bike'])} walking bike.`;
  box.append(title, mix);
  if (m.totals.busy > 0) { const warning = document.createElement("p"); warning.className = "cycle-warning"; warning.textContent = `Includes ${km(m.totals.busy)} on busy or higher-speed roads. This is not a continuous protected cycle route. Select “Exclude busy roads” to search without these sections.`; box.append(warning); }
  const surfaces = document.createElement("p"); surfaces.textContent = `${km(m.totals.unpaved)} unsealed or rough surface; ${km(m.totals.unknownSurface)} with surface unknown. Hills and gradients are not assessed.`;
  const ends = document.createElement("p"); ends.textContent = `Start/finish are ${Math.round(m.snaps[0])} m / ${Math.round(m.snaps[1])} m from your selections. No access line from pins is included.`;
  const date = document.createElement("p"); date.textContent = `OSM data: ${m.osmTimestamp.slice(0,10)}. Closures reviewed: ${m.reviewedAt}. Check current trail notices before riding.`;
  if (new Date().toISOString().slice(0,10) > m.reviewAfter) date.textContent += " Closure review is due; this snapshot is not current advice.";
  box.append(surfaces, ends, date);
  const details = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("ol");
  summary.textContent = "Route sections";
  for (const f of route.features) { const item = document.createElement("li"); const p=f.properties; item.textContent = `${p.name} · ${km(p.metres)} · ${p.kind === 'walk-bike' ? 'walk bike' : p.busy ? 'busy road' : p.kind === 'road' ? 'road' : 'path/trail'}${p.networks.length ? ' · ' + p.networks.join(', ') : ''}`; list.append(item); }
  details.append(summary, list); box.append(details);
}
$("#test-cycle-route").onclick = async () => {
  const request = ++routeRequest;
  map.pickCyclePoint(null);
  $("#cancel-pick").hidden = true;
  $("#pick-status").textContent = "";
  const from = $("#route-from").value;
  const to = $("#route-to").value;
  const variant = $("#route-variant").value;
  map.showCycleRoute(null);
  $("#cycle-results").replaceChildren();
  if (from === to) {
    $("#route-status").textContent = "Choose two different places.";
    return;
  }
  if (["quiet", "direct"].includes(variant)) {
    $("#route-status").textContent = "Finding a connected cycle route…";
    try {
      const { loadNetwork, findRoute } = await import("./routing/network.js?v=20260928-2");
      const network = await loadNetwork();
      if (request !== routeRequest) return;
      const point = id => id.startsWith("picked-") ? picked[id.slice(7)] : ROUTE_PLACES.find(p => p[0] === id)?.slice(2);
      const route = findRoute(network, point(from), point(to), { profile: variant, avoidBusy: $("#avoid-busy").checked, start: $("#route-from").selectedOptions[0].textContent, end: $("#route-to").selectedOptions[0].textContent });
      map.showCycleRoute(route);
      renderCycleResult(route);
      $("#route-status").textContent = "Route found. Review its road, trail and walking sections below.";
    } catch (error) {
      if (request !== routeRequest) return;
      map.showCycleRoute(null);
      $("#route-status").textContent = error.message.startsWith("No ") || error.message.startsWith("Choose ") ? error.message : "Cycling network unavailable. The map still works. Try again.";
    }
    return;
  }
  if (!((from === "queenstown" && to === "frankton") || (from === "frankton" && to === "queenstown"))) {
    $("#route-status").textContent = "Only Queenstown ↔ Frankton is mapped so far.";
    return;
  }
  $("#route-status").textContent = "Loading verified route geometry…";
  try {
    const { loadRoute } = await import("./routing/frankton.js?v=20260923-4");
    const route = await loadRoute(from, to, undefined, variant);
    if (request !== routeRequest) return;
    map.showCycleRoute(route);
    const detour = variant === "detour";
    const legend = detour ? "Orange: mapped detour. Purple dashed: walk your bike. Gaps are not connected." : "Red dashed: closed. Blue: connections.";
    const dated = detour && new Date().toISOString().slice(0,10) >= route.metadata.reviewAfter ? " Detour snapshot needs rechecking; the planned works period has ended." : "";
    $("#route-status").textContent = `${route.metadata.start} → ${route.metadata.end} · ${(route.metadata.distanceMetres / 1000).toFixed(1)} km${detour ? " mapped (excludes gaps)" : ""}. ${route.metadata.notice} ${legend} Sources checked ${route.metadata.verifiedAt}.${dated}`;
  } catch (error) {
    if (request !== routeRequest) return;
    console.warn("Cycle route unavailable", error);
    map.showCycleRoute(null);
    $("#route-status").textContent = "Cycle route unavailable. The map and From/To controls still work. Try again.";
  }
};
$("#place").onchange = (event) => {
  const value = event.target.value;
  if (!value) return;
  if (value === "pick:finish") {
    beginMapPick("finish", "#route-to");
    return;
  }

  const destinationMap = {
    town: "queenstown",
    frankton: "frankton",
    arrowtown: "arrowtown",
    kelvin: "kelvin-heights",
    airport: "frankton",
    marina: "frankton",
  };

  let routeDestination = destinationMap[value];
  let displayName = "";
  const place = places.find((p) => p.id === value);

  if (place) {
    map.focus(place);
    displayName = place.name;
  } else if (value.startsWith("route:")) {
    routeDestination = value.slice(6);
    const routePlace = ROUTE_PLACES.find((item) => item[0] === routeDestination);
    if (routePlace) {
      displayName = routePlace[1];
      map.focus({ lat: routePlace[3], lng: routePlace[2] });
    }
  }

  if (routeDestination && $("#route-to").querySelector(`option[value="${routeDestination}"]`)) {
    $("#route-to").value = routeDestination;
    $("#journey-destination").textContent =
      $("#route-to").selectedOptions[0]?.textContent || displayName || "Selected destination";
    clearRoute();
    $("#route-status").textContent =
      `${displayName || $("#journey-destination").textContent} selected as your destination. Choose where you are starting, then route.`;
  }
};
$("#change-destination").onclick = () => {
  $("#place").focus();
  $("#place").scrollIntoView({ block: "center", behavior: "smooth" });
};
$("#locate").onclick = () => map.locate();
$("#open-commute").onclick = async () => {
  try {
    const { openCommuteDialog } = await import("./commute.js?v=20260924-1");
    openCommuteDialog({ dialog: $("#commute-dialog"), toast });
  } catch (error) {
    console.warn("My Commute unavailable", error);
    toast("My Commute is temporarily unavailable. The map still works.");
  }
};
$("#open-report").onclick = () => $("#report-dialog").showModal();
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
