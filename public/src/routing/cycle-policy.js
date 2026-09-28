// Conservative everyday-cycle eligibility. Shared with the reproducible data builder.
const ALLOW = new Set(['yes', 'designated', 'permissive', 'official']);
const DENY = new Set(['no', 'private', 'customers', 'destination', 'delivery', 'agricultural', 'forestry', 'use_sidepath']);
const ROADS = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);
export const BOUNDS = [168.57, -45.13, 169.04, -44.88];
export function withinBounds(p) {
  return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= BOUNDS[0] && p[0] <= BOUNDS[2] && p[1] >= BOUNDS[1] && p[1] <= BOUNDS[3];
}
export function classifyWay(tags = {}) {
  const h = tags.highway;
  if (!ROADS.has(h) && !['cycleway', 'path', 'track', 'footway', 'pedestrian'].includes(h)) return null;
  if (Object.keys(tags).some(k => /^(access|vehicle|bicycle|oneway|foot).*:conditional$/.test(k))) return null;
  if (tags.construction || tags.proposed || tags['disused:highway'] || tags['abandoned:highway'] || tags.motorroad === 'yes' || tags.area === 'yes' || tags.ford === 'yes') return null;
  if (DENY.has(tags.bicycle)) return null;
  if (!ALLOW.has(tags.bicycle) && tags.bicycle !== 'dismount' && (DENY.has(tags.access) || DENY.has(tags.vehicle))) return null;
  if (tags.bicycle === 'dismount' && (DENY.has(tags.foot) || (DENY.has(tags.access) && !ALLOW.has(tags.foot)))) return null;
  if (tags['mtb:scale'] && tags['mtb:scale'] !== '0') return null;
  if (tags.sac_scale && tags.sac_scale !== 'hiking') return null;
  if (['very_bad', 'horrible', 'very_horrible', 'impassable'].includes(tags.smoothness)) return null;
  if (['sand', 'mud', 'rock', 'rocks', 'pebblestone'].includes(tags.surface) || ['grade3', 'grade4', 'grade5'].includes(tags.tracktype)) return null;
  // Unmarked walking paths and informal tracks are not assumed cycle-legal.
  if (['path', 'track'].includes(h) && !ALLOW.has(tags.bicycle) && tags.bicycle !== 'dismount') return null;
  if (tags.service === 'driveway' || tags.service === 'parking_aisle') return null;
  const walking = tags.bicycle === 'dismount' || (['footway', 'pedestrian'].includes(h) && !ALLOW.has(tags.bicycle));
  if (walking && (DENY.has(tags.foot) || (DENY.has(tags.access) && !ALLOW.has(tags.foot)))) return null;
  const road = ROADS.has(h);
  const busy = road && (/^(trunk|primary|secondary)/.test(h) || Number.parseFloat(tags.maxspeed) > 60);
  const surface = tags.surface || 'unknown';
  const rough = tags.smoothness === 'bad' || !['asphalt', 'paved', 'concrete', 'concrete:plates', 'paving_stones'].includes(surface);
  const one = walking ? (tags['oneway:foot'] || 'no') : (tags['oneway:bicycle'] ?? tags.oneway ?? (tags.junction === 'roundabout' ? 'yes' : 'no'));
  // Unknown direction values are excluded rather than interpreted as bidirectional.
  if (!['yes', '1', 'true', '-1', 'no', '0', 'false'].includes(one)) return null;
  if (DENY.has(tags['bicycle:forward']) && DENY.has(tags['bicycle:backward'])) return null;
  return { kind: walking ? 'walk-bike' : road ? 'road' : 'path', busy, surface, rough,
    forward: !['-1'].includes(one) && !DENY.has(tags['bicycle:forward']),
    backward: !['yes', '1', 'true'].includes(one) && !DENY.has(tags['bicycle:backward']) };
}
export function blockedNode(tags = {}) {
  if (tags.ford || tags.highway === 'steps' || Object.keys(tags).some(k => k.endsWith(':conditional'))) return true;
  if (DENY.has(tags.bicycle) || tags.locked === 'yes') return true;
  if (ALLOW.has(tags.bicycle) || tags.bicycle === 'dismount') return false;
  if (DENY.has(tags.access) || DENY.has(tags.vehicle) || tags.locked === 'yes') return true;
  return !!tags.barrier && !['bollard', 'cycle_barrier', 'cattle_grid', 'kerb', 'height_restrictor', 'entrance'].includes(tags.barrier);
}
export function metres(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
