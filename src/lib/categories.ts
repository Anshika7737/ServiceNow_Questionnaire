export const BUILT_IN_CATEGORIES = [
  {
    slug: "CSA",
    label: "CIS - CSA",
    description: "Certified System Administrator",
  },
  {
    slug: "CAD",
    label: "CIS - CAD",
    description: "Certified Application Developer",
  },
  {
    slug: "ITSM",
    label: "CIS - ITSM",
    description: "IT Service Management",
  },
  {
    slug: "CSM",
    label: "CIS - CSM",
    description: "Customer Service Management",
  },
  {
    slug: "DATA_FOUNDATION",
    label: "CIS - Data Foundation",
    description: "Data Foundation Certification",
  },
] as const;

export function slugifyCategoryLabel(label: string): string {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "CUSTOM";
}

/** Short display name for lists (e.g. "CIS - CSA" → "CSA"). */
export function displayTrackName(label: string): string {
  return label.replace(/^CIS\s*-\s*/i, "").trim() || label;
}

/** "A, B, and C" from an array of track names. */
export function formatTrackList(names: string[]): string {
  if (names.length === 0) return "certification tracks";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
