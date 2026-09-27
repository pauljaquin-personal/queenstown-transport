export function parseModes(value) {
  try {
    const modes = JSON.parse(value);
    return Array.isArray(modes) ? modes : [];
  } catch {
    return [];
  }
}

export function selectCells(rows, { mode = "", time = "", origin = "" } = {}, minimum = 5) {
  const threshold = Math.max(5, Number(minimum) || 5);
  return (Array.isArray(rows) ? rows : []).filter(cell =>
    cell && Number.isSafeInteger(Number(cell.count)) && Number(cell.count) >= threshold &&
    typeof cell.origin === "string" && typeof cell.destination === "string" &&
    (!mode || parseModes(cell.modes).includes(mode)) &&
    (!time || cell.timeBand === time) && (!origin || cell.origin === origin)
  );
}

export function aggregate(cells, keyFn) {
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

export function routeRows(cells) {
  return aggregate(cells, (cell) => [cell.origin + "|" + cell.destination])
    .map((row) => {
      const [origin, destination] = row.key.split("|");
      return { origin, destination, count: row.count };
    });
}

