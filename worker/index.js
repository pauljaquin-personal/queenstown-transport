import { validateCommute } from "./commutes.js";

const json = (data, status=200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/commutes" && request.method === "POST") {
      if (!env.COMMUTES) return json({ ok:false, error:"storage_not_configured" }, 503);
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 4096) return json({ ok:false, error:"Submission too large." }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ ok:false, error:"Invalid JSON." }, 400); }
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
      if (!env.COMMUTES) return json({ ok:false, error:"storage_not_configured", groups:[] }, 503);
      const result = await env.COMMUTES.prepare(
        "SELECT origin_zone AS origin, destination_zone AS destination, modes, time_band AS timeBand, COUNT(*) AS count FROM commutes GROUP BY origin_zone,destination_zone,modes,time_band HAVING COUNT(*) >= 5 ORDER BY count DESC LIMIT 200"
      ).all();
      return json({ ok:true, minimumGroupSize:5, groups:result.results || [] });
    }
    if (url.pathname.startsWith("/api/")) return json({ ok:false, error:"Not found." }, 404);
    return env.ASSETS.fetch(request);
  },
};
