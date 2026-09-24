const $ = (selector) => document.querySelector(selector);
const SVG_NS = "http://www.w3.org/2000/svg";

const LABELS = {
  zones: {
    queenstown: "Queenstown",
    fernhill: "Fernhill",
    frankton: "Frankton",
    "hanleys-farm": "Hanley’s Farm",
    "jacks-point": "Jack’s Point",
    "kelvin-heights": "Kelvin Heights",
    "arthurs-point": "Arthurs Point",
    "shotover-country": "Shotover Country",
    "lake-hayes-estate": "Lake Hayes Estate",
    arrowtown: "Arrowtown",
  },
  modes: { car: "Car", bus: "Bus", bike: "Bike", walk: "Walk", ferry: "Ferry" },
  timeBands: {
    "weekday-am": "Weekday morning peak",
    "weekday-day": "Weekday daytime",
    "weekday-pm": "Weekday afternoon/evening peak",
    weekend: "Mostly weekends",
    varies: "Varies",
  },
  changeReasons: {
    "safer-cycle-route": "Safer cycle route",
    "more-frequent-bus": "More frequent bus",
    "faster-bus": "Faster bus journey",
    "lower-cost": "Lower cost",
    "secure-bike-parking": "Secure bike parking",
    "better-walking": "Better walking connection",
    nothing: "Prefer current mode",
    other: "Something else",
  },
};

let insightData;

function emptyMessage(text) {
  const p = document.createElement("p");
  p.className = "insights-empty";
  p.textContent = text;
  return p;
}

function parseModes(value) {
  try {
    const modes = JSON.parse(value);
    return Array.isArray(modes) ? modes : [];
  } catch {
    return [];
  }
}

function filteredCells() {
  const mode = $("#filter-mode").value;
  const time = $("#filter-time").value;
  const origin = $("#filter-origin").value;
  return (insightData?.cells || []).filter((cell) => {
    const modes = parseModes(cell.modes);
    return (!mode || modes.includes(mode)) &&
      (!time || cell.timeBand === time) &&
      (!origin || cell.origin === origin);
  });
}

function aggregate(cells, keyFn) {
  const totals = new Map();
  for (const cell of cells) {
    const count = Number(cell.count) || 0;
    for (const key of keyFn(cell)) {
      if (!key) continue;
      totals.set(key, (totals.get(key) || 0) + count);
    }
  }
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function routeRows(cells) {
  return aggregate(cells, (cell) => [cell.origin + "|" + cell.destination])
    .map((row) => {
      const [origin, destination] = row.key.split("|");
      return { origin, destination, count: row.count };
    });
}

function renderBars(container, rows, labelMap, keyName = "key") {
  container.replaceChildren();
  if (!rows.length) {
    container.append(emptyMessage("No privacy-safe aggregate groups match these filters yet."));
    return;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "insight-bar-row";
    const top = document.createElement("div");
    top.className = "insight-bar-label";
    const label = document.createElement("span");
    label.textContent = labelMap[row[keyName]] || row[keyName];
    const count = document.createElement("strong");
    count.textContent = String(row.count);
    top.append(label, count);
    const track = document.createElement("div");
    track.className = "insight-bar-track";
    const fill = document.createElement("div");
    fill.className = "insight-bar-fill";
    fill.style.width = Math.max(8, (row.count / max) * 100) + "%";
    track.append(fill);
    item.append(top, track);
    container.append(item);
  }
}

function renderReasons(rows) {
  const container = $("#reasons-content");
  container.replaceChildren();
  if (!rows.length) {
    container.append(emptyMessage("No change-mode response has reached the privacy threshold for these filters."));
    return;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "ranked-reason";
    const rank = document.createElement("span");
    rank.className = "reason-rank";
    rank.textContent = String(index + 1);
    const body = document.createElement("div");
    const label = document.createElement("div");
    label.className = "insight-bar-label";
    const name = document.createElement("span");
    name.textContent = LABELS.changeReasons[row.key] || row.key;
    const count = document.createElement("strong");
    count.textContent = String(row.count);
    label.append(name, count);
    const track = document.createElement("div");
    track.className = "insight-bar-track";
    const fill = document.createElement("div");
    fill.className = "insight-bar-fill";
    fill.style.width = Math.max(8, (row.count / max) * 100) + "%";
    track.append(fill);
    body.append(label, track);
    item.append(rank, body);
    container.append(item);
  });
}

function renderRoutes(routes) {
  const container = $("#routes-content");
  container.replaceChildren();
  if (!routes.length) {
    container.append(emptyMessage("No origin → destination flow matches these filters at the privacy threshold."));
    return;
  }
  const table = document.createElement("table");
  table.className = "insights-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Commute</th><th>Responses</th></tr>";
  const tbody = document.createElement("tbody");
  for (const route of routes) {
    const tr = document.createElement("tr");
    const journey = document.createElement("td");
    journey.textContent = `${LABELS.zones[route.origin] || route.origin} → ${LABELS.zones[route.destination] || route.destination}`;
    const count = document.createElement("td");
    count.textContent = String(route.count);
    tr.append(journey, count);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  container.append(table);
}

function svgText(x, y, text, anchor) {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("text-anchor", anchor);
  node.setAttribute("class", "flow-label");
  node.textContent = text;
  return node;
}

function renderFlow(routes) {
  const container = $("#flow-visual");
  container.replaceChildren();
  const top = routes.slice(0, 10);
  if (!top.length) {
    container.append(emptyMessage("No aggregate flow has reached the threshold for these filters."));
    return;
  }
  const rowHeight = 54;
  const height = Math.max(150, top.length * rowHeight + 24);
  const max = Math.max(...top.map((row) => row.count), 1);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 800 ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Schematic aggregate commute flows; line thickness represents response count.");
  svg.classList.add("flow-svg");

  top.forEach((route, index) => {
    const y = 35 + index * rowHeight;
    const width = 3 + (route.count / max) * 17;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M 220 ${y} C 330 ${y - 12}, 470 ${y + 12}, 580 ${y}`);
    path.setAttribute("class", "flow-line");
    path.setAttribute("stroke-width", width.toFixed(1));
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${LABELS.zones[route.origin] || route.origin} to ${LABELS.zones[route.destination] || route.destination}: ${route.count} responses`;
    path.append(title);
    svg.append(
      path,
      svgText(205, y + 5, LABELS.zones[route.origin] || route.origin, "end"),
      svgText(595, y + 5, LABELS.zones[route.destination] || route.destination, "start"),
      svgText(400, y - 9, String(route.count), "middle"),
    );
  });
  container.append(svg);
}

function renderAll() {
  if (!insightData) return;
  const cells = filteredCells();
  const routes = routeRows(cells);
  const modes = aggregate(cells, (cell) => parseModes(cell.modes)).map((row) => ({ mode: row.key, count: row.count }));
  const times = aggregate(cells, (cell) => [cell.timeBand]);
  const reasons = aggregate(cells, (cell) => [cell.changeReason]).filter((row) => row.key);

  renderFlow(routes);
  renderRoutes(routes);
  renderBars($("#modes-content"), modes, LABELS.modes, "mode");
  renderBars($("#times-content"), times, LABELS.timeBands);
  renderReasons(reasons);

  const visible = cells.reduce((sum, cell) => sum + (Number(cell.count) || 0), 0);
  $("#export-csv").disabled = cells.length === 0;
  $("#export-csv").title = cells.length ? `Export ${cells.length} privacy-safe aggregate rows (${visible} responses represented)` : "No privacy-safe rows match these filters.";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function exportCsv() {
  const cells = filteredCells();
  if (!cells.length) return;
  const rows = [["origin","destination","modes","time_band","change_reason","responses"]];
  for (const cell of cells) {
    rows.push([
      LABELS.zones[cell.origin] || cell.origin,
      LABELS.zones[cell.destination] || cell.destination,
      parseModes(cell.modes).map((mode) => LABELS.modes[mode] || mode).join(" + "),
      LABELS.timeBands[cell.timeBand] || cell.timeBand,
      LABELS.changeReasons[cell.changeReason] || cell.changeReason || "",
      Number(cell.count) || 0,
    ]);
  }
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "queenstown-commute-insights.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function populateOrigins() {
  const select = $("#filter-origin");
  for (const [value, label] of Object.entries(LABELS.zones)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

async function loadInsights() {
  try {
    const response = await fetch("/api/commutes/summary", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load commute insights.");
    insightData = data;
    $("#total-submissions").textContent = String(data.totalSubmissions || 0);
    $("#minimum-group").textContent = String(data.minimumGroupSize || 5);
    renderAll();
  } catch (error) {
    console.warn("Commute insights unavailable", error);
    $("#total-submissions").textContent = "—";
    for (const selector of ["#flow-visual", "#routes-content", "#modes-content", "#times-content", "#reasons-content"]) {
      $(selector).replaceChildren(emptyMessage("Commute insights are temporarily unavailable."));
    }
  }
}

populateOrigins();
for (const selector of ["#filter-mode", "#filter-time", "#filter-origin"]) {
  $(selector).addEventListener("change", renderAll);
}
$("#clear-filters").addEventListener("click", () => {
  $("#filter-mode").value = "";
  $("#filter-time").value = "";
  $("#filter-origin").value = "";
  renderAll();
});
$("#export-csv").addEventListener("click", exportCsv);
loadInsights();
