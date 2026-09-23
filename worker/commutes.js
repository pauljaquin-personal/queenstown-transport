export const COMMUTE_ZONES = new Set([
  "queenstown","fernhill","frankton","hanleys-farm","jacks-point",
  "kelvin-heights","arthurs-point","shotover-country","lake-hayes-estate","arrowtown",
]);
export const COMMUTE_MODES = new Set(["car","bus","bike","walk","ferry"]);
export const TIME_BANDS = new Set(["weekday-am","weekday-day","weekday-pm","weekend","varies"]);
export const CHANGE_REASONS = new Set([
  "safer-cycle-route","more-frequent-bus","faster-bus","lower-cost",
  "secure-bike-parking","better-walking","nothing","other",
]);

export function validateCommute(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok:false, error:"Invalid submission." };
  const origin = String(input.origin || "");
  const destination = String(input.destination || "");
  const timeBand = String(input.timeBand || "");
  const modes = Array.isArray(input.modes) ? [...new Set(input.modes.map(String))] : [];
  const changeReason = input.changeReason ? String(input.changeReason) : null;
  if (!COMMUTE_ZONES.has(origin) || !COMMUTE_ZONES.has(destination)) return { ok:false, error:"Choose valid commute areas." };
  if (origin === destination) return { ok:false, error:"Choose two different commute areas." };
  if (!modes.length || modes.length > 5 || modes.some((m) => !COMMUTE_MODES.has(m))) return { ok:false, error:"Choose at least one valid travel mode." };
  if (!TIME_BANDS.has(timeBand)) return { ok:false, error:"Choose a valid time band." };
  if (changeReason && !CHANGE_REASONS.has(changeReason)) return { ok:false, error:"Choose a valid change option." };
  modes.sort();
  return { ok:true, value:{ origin, destination, modes, timeBand, changeReason } };
}
