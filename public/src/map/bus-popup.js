export function busPopup(stop, {loading=false, error=false, now=new Date()}={}) {
    const div=document.createElement("div");
    const strong=document.createElement("strong");
    strong.textContent=stop.name || "Orbus stop";
    div.append(strong);
    if (Array.isArray(stop.routes) && stop.routes.length) {
      div.append(document.createElement("br"),document.createTextNode("Routes: "));
      stop.routes.forEach((route,index)=>{
        if (index) div.append(document.createElement("br"));
        const routeLine=document.createElement("span");
        const badge=document.createElement("strong");
        badge.textContent=route.number;
        routeLine.append(badge);
        if (route.name) routeLine.append(document.createTextNode("  "+route.name));
        div.append(routeLine);
      });
    }
    div.append(document.createElement("br"));
    const departures=document.createElement("div");
    const heading=document.createElement("strong");
    heading.textContent="Next scheduled departures";
    departures.append(document.createElement("br"),heading);
    const upcoming=(stop.departures || []).filter(d=>Date.parse(d.scheduledAt)>=now.getTime()).slice(0,5);
    if (loading || error) {
      departures.append(document.createTextNode(loading ? "Loading scheduled departures…" : "Departures unavailable. Try reopening this stop."));
    } else if (upcoming.length) {
      for (const departure of upcoming) {
        const line=document.createElement("div");
        const time=document.createElement("strong");
        const date=new Date(departure.scheduledAt);
        const sameDay=new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland"}).format(date)===new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland"}).format(now);
        time.textContent=new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland",hour:"2-digit",minute:"2-digit",hourCycle:"h23",...(sameDay ? {} : {weekday:"short",day:"numeric",month:"short"})}).format(date);
        line.append(time,document.createTextNode(" · "+departure.route+(departure.destination ? " → "+departure.destination : "")));
        if (["2","3"].includes(departure.pickupType)) line.append(document.createTextNode(" · arrange pickup with operator"));
        departures.append(line);
      }
    } else {
      departures.append(document.createElement("div"),document.createTextNode("No scheduled departures in the next 7 days."));
    }
    div.append(departures,document.createElement("br"));
    const note=document.createElement("small");
    note.textContent="Queenstown time · ORC timetable, not live arrivals.";
    div.append(note);
    return div;
  }

