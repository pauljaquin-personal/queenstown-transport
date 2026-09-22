// Orientation landmarks only: no route geometry or live status is inferred.
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
    subtitle: "Orbus information",
    status: "OFFICIAL LINKS",
    title: "Make room for the bus",
    description:
      "Find Queenstown bus routes, timetables and alerts from Orbus. Map dots are local landmarks, not bus stops. Live vehicles and arrivals are not connected.",
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
    status: "OFFICIAL LINKS",
    title: "A different pace",
    description:
      "Find trail information and current notices from Queenstown Trails. A verified cycling network is not loaded yet; map landmarks are not route or safety advice.",
    links: [["Queenstown Trails", "https://www.queenstowntrails.co.nz/"]],
  },
  {
    id: "community",
    name: "Community",
    icon: "◇",
    color: "#8c719e",
    tint: "#f0eaf5",
    subtitle: "Your private drafts",
    status: "ON THIS DEVICE",
    title: "Local knowledge starts here",
    description:
      "Keep a private note about a transport issue. Public reports and moderation will follow in a later version. Drafts are not sent to a council or emergency service.",
    links: [],
  },
];
