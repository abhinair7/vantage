export type Subject =
  | "port"
  | "refinery"
  | "storage"
  | "traffic"
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
export type MeasurementIntent = "footprint";

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  port: ["port", "harbor", "harbour", "terminal", "quay", "dock", "berth"],
  refinery: ["refinery", "refineries", "petrochemical"],
  storage: ["storage", "tank farm", "silo", "oil hub", "stockpile", "inventory"],
  traffic: [
    "traffic",
    "congestion",
    "gridlock",
    "commute",
    "closure",
    "lane closure",
    "traffic advisory",
    "road",
    "roads",
    "highway",
    "highways",
    "transit",
    "transportation",
    "crash",
    "collision",
  ],
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
  facility: [
    "facility",
    "site",
    "compound",
    "installation",
    "bus stand",
    "bus station",
    "bus terminal",
    "station",
    "terminal",
    "depot",
  ],
};

const LOCATION_PATTERN =
  /\b(?:at|in|near|around|outside|inside|from|of)\s+([^?.!,;]+?)(?=\b(?:since|over|during|for|within|last|past|today|tomorrow|yesterday|this|that|these|those|exists|exist|is|are|has|have|with|without|using|show|shows|change|changed|increased|decreased|verify|monitor|track)\b|[?.!,;]|$)/gi;
const TITLE_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
const QUOTE_PATTERN = /["“]([^"”]{2,80})["”]/g;
const FOOTPRINT_PATTERN =
  /\b(?:footprint|area|size|acreage|extent|sqm|sq\.?\s?m|m2|m²|square meters?|square metres?|hectare|hectares|ha|acre|acres)\b/i;
const LEADING_AREA_HINT_PATTERN =
  /^\s*([a-z0-9][a-z0-9&'",./() -]{2,120}?)(?=\s+\b(?:total|current|latest|now|today|footprint|area|size|acreage|extent|sqm|sq\.?\s?m|m2|m²|square|hectare|hectares|ha|acre|acres)\b)/i;
const LEADING_QUERY_STOPWORDS = new Set([
  "worth",
  "monitor",
  "monitoring",
  "track",
  "tracking",
  "verify",
  "verification",
  "confirm",
  "check",
  "checking",
  "status",
  "signal",
  "signals",
  "trend",
  "trends",
  "risk",
  "disruption",
  "throughput",
  "traffic",
  "activity",
  "volume",
  "utilization",
  "utilisation",
  "construction",
  "growth",
  "footprint",
  "area",
  "size",
  "acreage",
  "extent",
  "sqm",
  "m2",
  "m²",
  "square",
  "meter",
  "meters",
  "metre",
  "metres",
  "hectare",
  "hectares",
  "ha",
  "acre",
  "acres",
  "total",
  "current",
  "currently",
  "latest",
  "now",
  "today",
  "yesterday",
  "tomorrow",
  "since",
  "during",
  "within",
  "over",
  "under",
  "past",
  "last",
  "next",
  "operator",
  "owner",
  "owners",
  "company",
  "evidence",
  "brief",
  "decision",
  "call",
  "useful",
  "important",
  "real",
  "exists",
  "exist",
  "legit",
  "legitimate",
  "safe",
  "unsafe",
  "for",
]);
const LEADING_QUERY_SKIP_AT_START = new Set([
  "the",
  "a",
  "an",
]);
const GENERIC_HINTS = new Set([
  "is",
  "are",
  "was",
  "were",
  "does",
  "do",
  "did",
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

export function detectMeasurementIntent(q: string): MeasurementIntent | null {
  return FOOTPRINT_PATTERN.test(q) ? "footprint" : null;
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

  const leadingHint = extractLeadingLocationHint(q);
  if (leadingHint) push(leadingHint);

  if (
    detectMeasurementIntent(q) === "footprint" &&
    !/^\s*(?:is|are|was|were|does|do|did|has|have|can|could|should|would|will|what|which|where|when|why|how)\b/i.test(q)
  ) {
    const leading = q.match(LEADING_AREA_HINT_PATTERN)?.[1];
    if (leading) push(leading);
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
    case "traffic":
      return "traffic";
    default:
      return subject;
  }
}

function normalizeHint(value: string): string {
  const normalized = value
    .replace(/^(?:is|are|was|were|does|do|did|has|have|can|could|should|would|will)\b/gi, " ")
    .replace(/(^|\s)(?:the|a|an|this|that|these|those)(?=\s|$)/gi, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");

  if (!normalized) return "";
  if (GENERIC_HINTS.has(normalized.toLowerCase())) return "";
  return normalized;
}

function extractLeadingLocationHint(query: string): string | null {
  const cleaned = query
    .replace(/[?]+/g, " ")
    .replace(/[“”"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  const stripped = cleaned
    .replace(
      /^(?:what(?:'s| is)?|where(?:'s| is)?|when(?:'s| is)?|which|who|why|how|is|are|was|were|does|do|did|has|have|can|could|should|would|will|tell me|show me|find|check|verify|assess|monitor|track)\b/gi,
      " ",
    )
    .trim();

  if (!stripped) return null;

  const kept: string[] = [];
  for (const token of stripped.split(/\s+/)) {
    const bare = token
      .toLowerCase()
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

    if (!bare) continue;
    if (kept.length === 0 && LEADING_QUERY_SKIP_AT_START.has(bare)) continue;
    if (kept.length > 0 && LEADING_QUERY_STOPWORDS.has(bare)) break;

    kept.push(token.replace(/^[,;:]+|[,;:]+$/g, ""));
    if (kept.length >= 8) break;
  }

  const hint = kept.join(" ").trim();
  return hint.length >= 3 ? hint : null;
}
