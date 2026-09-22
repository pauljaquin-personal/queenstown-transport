const KEY = "qt-transport-drafts-v1";
export function readReports(storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof r.placeId === "string" &&
              typeof r.note === "string" &&
              typeof r.type === "string",
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function saveReport(report, storage = localStorage) {
  if (!report.note?.trim() || report.note.length > 500)
    throw new Error("Enter between 1 and 500 characters.");
  const reports = readReports(storage);
  if (reports.length >= 50)
    throw new Error("You have 50 drafts. Delete one before adding another.");
  const item = {
    ...report,
    note: report.note.trim(),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  storage.setItem(KEY, JSON.stringify([item, ...reports]));
  return item;
}
export function deleteReport(id, storage = localStorage) {
  storage.setItem(
    KEY,
    JSON.stringify(readReports(storage).filter((r) => r.id !== id)),
  );
}
