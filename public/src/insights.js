const $ = (selector) => document.querySelector(selector);

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
  modes: {
    car: "Car",
    bus: "Bus",
    bike: "Bike",
    walk: "Walk",
    ferry: "Ferry",
  },
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

function emptyMessage(text) {
  const p = document.createElement("p");
  p.className = "insights-empty";
  p.textContent = text;
  return p;
}

function renderBars(container, rows, labelMap, keyName) {
  container.replaceChildren();
  if (!rows.length) {
    container.append(emptyMessage("Not enough submissions in any category yet."));
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

function renderRoutes(routes) {
  const container = $("#routes-content");
  container.replaceChildren();
  if (!routes.length) {
    container.append(emptyMessage("No origin → destination pair has reached the privacy threshold yet."));
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

async function loadInsights() {
  try {
    const response = await fetch("/api/commutes/summary", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load commute insights.");

    $("#total-submissions").textContent = String(data.totalSubmissions || 0);
    $("#minimum-group").textContent = String(data.minimumGroupSize || 5);
    renderRoutes(data.routes || []);
    renderBars($("#modes-content"), data.modes || [], LABELS.modes, "mode");
    renderBars($("#times-content"), data.timeBands || [], LABELS.timeBands, "key");
    renderBars($("#reasons-content"), data.changeReasons || [], LABELS.changeReasons, "key");
  } catch (error) {
    console.warn("Commute insights unavailable", error);
    $("#total-submissions").textContent = "—";
    for (const selector of ["#routes-content", "#modes-content", "#times-content", "#reasons-content"]) {
      const container = $(selector);
      container.replaceChildren(emptyMessage("Commute insights are temporarily unavailable."));
    }
  }
}

loadInsights();
