export type Subject =
  | "port"
  | "refinery"
  | "storage"
  | "airport"
  | "airbase"
  | "factory"
  | "warehouse"
  | "mine"
  | "quarry"
  | "railway"
  | "pipeline"
  | "shipyard"
  | "power"
  | "datacenter"
  | "farm"
  | "construction"
  | "vessel"
  | "aircraft"
  | "military"
  | "facility";

export type AnalysisMode = "investigate" | "verify" | "monitor";

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  port: ["port", "harbor", "harbour", "terminal", "quay", "dock", "berth"],
  refinery: ["refinery", "refineries", "petrochemical"],
  storage: ["storage", "tank farm", "silo", "oil hub", "stockpile", "inventory"],
  airport: ["airport", "runway", "tarmac", "apron"],
  airbase: ["airbase", "air field", "airfield", "air force base"],
  factory: ["factory", "plant", "manufacturing", "mill"],
  warehouse: ["warehouse", "distribution centre", "distribution center", "fulfillment", "logistics park"],
  mine: ["mine", "open pit", "smelter"],
  quarry: ["quarry", "cement works"],
  railway: ["railway", "railyard", "rail yard", "siding", "yard"],
  pipeline: ["pipeline", "right-of-way", "compressor station", "pumping station"],
  shipyard: ["shipyard", "drydock", "dry dock"],
  power: ["power plant", "substation", "switchyard", "generation"],
  datacenter: ["data center", "datacenter", "server farm"],
  farm: ["farm", "crop", "acreage", "planting", "harvest", "field"],
  construction: ["construction", "build-out", "buildout", "expansion", "project"],
  vessel: ["vessel", "ship", "tanker", "container ship", "bulker"],
  aircraft: ["aircraft", "airplane", "jet", "fighter", "bomber", "helicopter"],
  military: ["military", "troop", "garrison", "barracks", "base"],
  facility: ["facility", "site", "compound", "installation"],
};

const LOCATION_PATTERN =
  /\b(?:at|in|near|around|outside|inside|from|of)\s+([^?.!,;]+?)(?=\b(?:since|over|during|for|within|last|past|today|tomorrow|yesterday|this|that|these|those|exists|exist|is|are|has|have|with|without|using|show|shows|change|changed|increased|decreased|verify|monitor|track)\b|[?.!,;]|$)/gi;
const TITLE_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
const QUOTE_PATTERN = /["“]([^"”]{2,80})["”]/g;
const GENERIC_HINTS = new Set([
  "has",
  "have",
  "verify",
  "track",
  "monitor",
  "show",
  "shows",
  "change",
  "changed",
  "increased",
  "decreased",
  "construction",
  "facility",
  "company",
]);

export function detectSubject(q: string): Subject {
  const lower = q.toLowerCase();
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS) as [
    Subject,
    string[],
  ][]) {
    if (keywords.some((keyword) => lower.includes(keyword))) return subject;
  }
  return "facility";
}

export function detectMode(q: string): AnalysisMode {
  const lower = q.toLowerCase();
  if (/\b(verify|confirm|authenticate|legitimate|exist|exists)\b/i.test(lower)) {
    return "verify";
  }
  if (/\b(monitor|track|over time|trend|since|last \d|past \d|weekly|daily|change|changed|increased|decreased)\b/i.test(lower)) {
    return "monitor";
  }
  return "investigate";
}

export function extractCoordinates(q: string): [number, number] | null {
  const match = q.match(
    /(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

export function extractLocationHints(q: string): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const hint = normalizeHint(value);
    if (!hint || seen.has(hint.toLowerCase())) return;
    seen.add(hint.toLowerCase());
    hints.push(hint);
  };

  for (const match of q.matchAll(QUOTE_PATTERN)) {
    push(match[1]);
  }

  for (const match of q.matchAll(LOCATION_PATTERN)) {
    push(match[1]);
  }

  for (const match of q.matchAll(TITLE_PATTERN)) {
    push(match[1]);
  }

  return hints;
}

export function inferEntityHint(q: string): string | null {
  const quoted = Array.from(q.matchAll(QUOTE_PATTERN))[0]?.[1];
  if (quoted) return normalizeHint(quoted);

  const companyMatch = q.match(
    /\b(?:company|operator|owner|firm|manufacturer)\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/,
  );
  if (companyMatch) return normalizeHint(companyMatch[1]);
  return null;
}

export function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function subjectLabel(subject: Subject): string {
  switch (subject) {
    case "airbase":
      return "air base";
    case "datacenter":
      return "data center";
    default:
      return subject;
  }
}

function normalizeHint(value: string): string {
  const normalized = value
    .replace(/\b(?:the|a|an|this|that|these|those)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");

  if (!normalized) return "";
  if (GENERIC_HINTS.has(normalized.toLowerCase())) return "";
  return normalized;
}
