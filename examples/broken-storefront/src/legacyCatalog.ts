export function legacyCatalogLookup(id: string): string {
  const records: Record<string, string> = {
    "old-1": "Archived lamp",
    "old-2": "Archived chair"
  };
  return records[id] || "Unknown item";
}
