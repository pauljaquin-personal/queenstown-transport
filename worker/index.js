import { validateCommute } from "./commutes.js";
import { MIN_GROUP_SIZE, summariseModeRows, suppressSmallGroups } from "./summary.js";

const json = (data, status=200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/elevation" && request.method === "POST") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 20000) return json({ ok:false, error:"Request too large." }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ ok:false, error:"Invalid JSON." }, 400); }
      const locations = Array.isArray(body?.locations) ? body.locations : [];
      if (!locations.length || locations.length > 120) return json({ ok:false, error:"Provide 1–120 locations." }, 400);
      const cleaned = [];
      for (const point of locations) {
        if (!Array.isArray(point) || point.length !== 2) return json({ ok:false, error:"Invalid location." }, 400);
        const [lng, lat] = point.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -48 || lat > -34 || lng < 166 || lng > 179.9) {
          return json({ ok:false, error:"Location outside supported NZ bounds." }, 400);
        }
        cleaned.push([lng, lat]);
      }
      const payload = {
        locations: cleaned.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|"),
        interpolation: "bilinear",
      };
      try {
        const upstream = await fetch("https://api.opentopodata.org/v1/nzdem8m", {
          method:"POST",
          headers:{ "content-type":"application/json" },
          body:JSON.stringify(payload),
          signal:AbortSignal.timeout(12000),
        });
        if (!upstream.ok) return json({ ok:false, error:"Elevation service unavailable." }, 502);
        const data = await upstream.json();
        if (data?.status !== "OK" || !Array.isArray(data.results)) return json({ ok:false, error:"Elevation lookup failed." }, 502);
        return json({
          ok:true,
          dataset:"nzdem8m",
          elevations:data.results.map((item) => Number.isFinite(item?.elevation) ? item.elevation : null),
        });
      } catch {
        return json({ ok:false, error:"Elevation service unavailable." }, 502);
      }
    }
    if (url.pathname === "/api/commutes" && request.method === "POST") {
      if (!env.COMMUTES) return json({ ok:false, error:"storage_not_configured" }, 503);
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 4096) return json({ ok:false, error:"Submission too large." }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ ok:false, error:"Invalid JSON." }, 400); }
      if (body && typeof body.website === "string" && body.website.trim()) return json({ ok:true }, 201);
      const checked = validateCommute(body);
      if (!checked.ok) return json({ ok:false, error:checked.error }, 400);
      const c = checked.value;
      const createdMonth = new Date().toISOString().slice(0,7);
      await env.COMMUTES.prepare(
        "INSERT INTO commutes (origin_zone,destination_zone,modes,time_band,change_reason,created_month) VALUES (?,?,?,?,?,?)"
      ).bind(c.origin,c.destination,JSON.stringify(c.modes),c.timeBand,c.changeReason,createdMonth).run();
      return json({ ok:true }, 201);
    }
    if (url.pathname === "/api/commutes/summary" && request.method === "GET") {
      if (!env.COMMUTES) return json({ ok:false, error:"storage_not_configured" }, 503);
      const [totalResult, routeResult, modeResult, timeResult, reasonResult] = await Promise.all([
        env.COMMUTES.prepare("SELECT COUNT(*) AS count FROM commutes").first(),
        env.COMMUTES.prepare(
          "SELECT origin_zone AS origin, destination_zone AS destination, COUNT(*) AS count FROM commutes GROUP BY origin_zone,destination_zone HAVING COUNT(*) >= ? ORDER BY count DESC LIMIT 200"
        ).bind(MIN_GROUP_SIZE).all(),
        env.COMMUTES.prepare(
          "SELECT modes, COUNT(*) AS count FROM commutes GROUP BY modes"
        ).all(),
        env.COMMUTES.prepare(
          "SELECT time_band AS key, COUNT(*) AS count FROM commutes GROUP BY time_band"
        ).all(),
        env.COMMUTES.prepare(
          "SELECT change_reason AS key, COUNT(*) AS count FROM commutes WHERE change_reason IS NOT NULL AND change_reason != '' GROUP BY change_reason"
        ).all(),
      ]);
      return json({
        ok:true,
        minimumGroupSize:MIN_GROUP_SIZE,
        totalSubmissions:Number(totalResult?.count) || 0,
        routes:(routeResult.results || []).map((row) => ({
          origin:row.origin,
          destination:row.destination,
          count:Number(row.count) || 0,
        })),
        modes:summariseModeRows(modeResult.results || []),
        timeBands:suppressSmallGroups(timeResult.results || []),
        changeReasons:suppressSmallGroups(reasonResult.results || []),
        cells:(await env.COMMUTES.prepare(
          "SELECT origin_zone AS origin, destination_zone AS destination, modes, time_band AS timeBand, COALESCE(change_reason, '') AS changeReason, COUNT(*) AS count FROM commutes GROUP BY origin_zone,destination_zone,modes,time_band,COALESCE(change_reason, '') HAVING COUNT(*) >= ? ORDER BY count DESC LIMIT 1000"
        ).bind(MIN_GROUP_SIZE).all()).results || [],
      });
    }
    if (url.pathname.startsWith("/api/")) return json({ ok:false, error:"Not found." }, 404);
    return env.ASSETS.fetch(request);
  },
};
