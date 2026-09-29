// Approximate reference places; no live status is inferred.
export const places = [
  {
    id: "town",
    name: "Queenstown centre",
    lat: -45.0312,
    lng: 168.6626,
    modes: ["roads", "buses", "cycling"],
  },
  {
    id: "frankton",
    name: "Frankton",
    lat: -45.0207,
    lng: 168.7385,
    modes: ["roads", "buses", "cycling"],
  },
  {
    id: "airport",
    name: "Queenstown Airport",
    lat: -45.0211,
    lng: 168.7392,
    modes: ["roads", "buses"],
  },
  {
    id: "arrowtown",
    name: "Arrowtown",
    lat: -44.9385,
    lng: 168.8358,
    modes: ["roads", "buses", "cycling"],
  },
  {
    id: "kelvin",
    name: "Kelvin Heights",
    lat: -45.0475,
    lng: 168.728,
    modes: ["buses", "ferries", "cycling"],
  },
  {
    id: "bay",
    name: "Queenstown Bay",
    lat: -45.0343,
    lng: 168.6605,
    modes: ["ferries"],
  },
  {
    id: "marina",
    name: "Frankton Marina area",
    lat: -45.026,
    lng: 168.724,
    modes: ["ferries", "cycling"],
  },
];
export const modes = [
  {
    id: "roads",
    name: "Roads",
    icon: "↗",
    color: "#a96b39",
    tint: "#f6eee3",
    subtitle: "Traffic & incidents",
    status: "NOT CONNECTED",
    title: "Check before you drive",
    description:
      "Live congestion, incidents and travel times are not available here yet. Check NZTA for state highways and QLDC for local-road information.",
    links: [
      ["NZTA Journey Planner", "https://www.journeys.nzta.govt.nz/"],
      [
        "QLDC transport & parking",
        "https://www.qldc.govt.nz/services/transport-and-parking",
      ],
    ],
  },
  {
    id: "buses",
    name: "Buses",
    icon: "▣",
    color: "#597847",
    tint: "#edf2e6",
    subtitle: "Routes & stops",
    status: "ORC GTFS",
    title: "Queenstown Orbus network",
    description:
      "Official ORC GTFS routes and stops are shown on the map. This is scheduled network data, not live vehicle tracking or predicted arrivals. Check Orbus for current alerts and service changes.",
    links: [
      [
        "Orbus timetables & alerts",
        "https://www.orc.govt.nz/orbus/queenstown-bus-ferry-timetables",
      ],
    ],
  },
  {
    id: "ferries",
    name: "Ferries",
    icon: "≈",
    color: "#3e7a92",
    tint: "#e8f2f4",
    subtitle: "Across the lake",
    status: "OFFICIAL LINKS",
    title: "Take the lake way",
    description:
      "Explore the ferry option with the operator’s current timetable. Map dots show general areas, not boarding locations. Confirm your wharf and service before travelling.",
    links: [
      ["Queenstown Ferries", "https://queenstownferries.co.nz/"],
      [
        "Orbus bus & ferry information",
        "https://www.orc.govt.nz/orbus/queenstown-bus-ferry-timetables",
      ],
    ],
  },
  {
    id: "cycling",
    name: "Cycling",
    icon: "♧",
    color: "#54856d",
    tint: "#e9f3ec",
    subtitle: "Trails & connections",
    status: "QLDC TRAILS",
    title: "Ride the trail network",
    description:
      "Official QLDC cycle-designated Tracks & Trails are shown on the map. This is operational asset data with variable spatial accuracy, not turn-by-turn navigation or safety advice.",
    links: [["Queenstown Trails", "https://www.queenstowntrails.co.nz/"]],
  },
  {
    id: "nzta-closures",
    name: "NZTA closures",
    icon: "⚠",
    color: "#b84a3a",
    tint: "#faece8",
    subtitle: "State highway events",
    status: "LIVE",
    title: "State highway closures & events",
    description:
      "Verified NZTA road events affecting the state-highway network. Includes closures, incidents, roadworks and weather-related warnings where published by NZTA.",
    links: [["NZTA Journey Planner", "https://www.journeys.nzta.govt.nz/"]],
  },
  {
    id: "qldc-closures",
    name: "QLDC closures",
    icon: "⛔",
    color: "#8f5b36",
    tint: "#f7eee6",
    subtitle: "Council closure notices",
    status: "NOTICES",
    title: "QLDC scheduled road closures",
    description:
      "Published Queenstown Lakes District Council road-closure notices. Locations shown here are notice-based and may be approximate; check the official notice before travelling.",
    links: [["QLDC scheduled road closures", "https://www.qldc.govt.nz/your-council/public-notices/scheduled-event-road-closures"]],
  },
  {
    id: "trail-closures",
    name: "Trail closures",
    icon: "🚧",
    color: "#a13636",
    tint: "#faeaea",
    subtitle: "Queenstown Trail notices",
    status: "NOTICES",
    title: "Queenstown Trail closures & restrictions",
    description:
      "Current Queenstown Trails closure and restriction notices highlighted against mapped QLDC trail geometry where a named trail can be matched.",
    links: [["Queenstown Trails current notices", "https://queenstowntrails.org.nz/maps-and-trails/all-trails/"]],
  },
  {
    id: "community",
    name: "Community",
    icon: "◇",
    color: "#8c719e",
    tint: "#f0eaf5",
    subtitle: "Traffic & trail reports",
    status: "COMMUNITY REPORTS",
    title: "Community traffic & trail reports",
    description:
      "Share congestion, road obstructions and cycle-trail issues. Reports are unverified and expire automatically. Map markers show approximate areas; read the road or trail description for the location.",
    links: [],
  },
];

// Named public-road points in the OSM snapshot, not household addresses or area centroids.
export const CYCLE_PLACES = [
  ['queenstown', 'Queenstown · Camp Street', 168.6596795, -45.0303056],
  ['fernhill', 'Fernhill · Fernhill Road', 168.6387, -45.0380],
  ['frankton', 'Frankton · Gray Street', 168.7305316, -45.016644],
  ['hanleys-farm', 'Hanley’s Farm · Howden Drive', 168.7453591, -45.0675115],
  ['jacks-point', 'Jack’s Point · Maori Jack Road', 168.7506536, -45.0739085],
  ['kelvin-heights', 'Kelvin Heights · Peninsula Road', 168.7268573, -45.0294196],
  ['arthurs-point', 'Arthurs Point · village', 168.6845, -44.9820],
  ['shotover-country', 'Shotover Country · Stalker Road', 168.7732850, -45.0004865],
  ['lake-hayes-estate', 'Lake Hayes Estate · Nerin Square', 168.7894999, -45.0014183],
  ['arrowtown', 'Arrowtown · Ramshaw Lane', 168.8331036, -44.9382617],
  ['gibbston', 'Gibbston · river trail access', 168.9701185, -45.0285032],
];
