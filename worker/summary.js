const MIN_GROUP_SIZE = 5;

export function suppressSmallGroups(rows, keyName = "key") {
  return (rows || [])
    .map((row) => ({ [keyName]: row[keyName], count: Number(row.count) || 0 }))
    .filter((row) => row.count >= MIN_GROUP_SIZE)
    .sort((a, b) => b.count - a.count);
}

export function summariseModeRows(rows) {
  const totals = new Map();
  for (const row of rows || []) {
    let modes;
    try { modes = JSON.parse(row.modes); } catch { modes = []; }
    if (!Array.isArray(modes)) continue;
    for (const mode of modes) {
      totals.set(mode, (totals.get(mode) || 0) + (Number(row.count) || 0));
    }
  }
  return [...totals.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .filter((row) => row.count >= MIN_GROUP_SIZE)
    .sort((a, b) => b.count - a.count);
}

export { MIN_GROUP_SIZE };
