import {
  matchPresetQuery,
  type AOI,
  type DemoResult,
  type Evidence,
  type Marker,
} from "./demo-results";
import {
  detectMode,
  detectMeasurementIntent,
  detectSubject,
  extractCoordinates,
  extractLocationHints,
  subjectLabel,
  titleCase,
  type AnalysisMode,
  type Subject,
} from "./query-intel";

const USER_AGENT = "Vantage/0.1 (+https://vantage-blond-nu.vercel.app)";
const REQUEST_TIMEOUT_MS = 6500;
const CONFIDENCE_FLOOR = 0.58;
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMON_LOCATION_SUFFIXES = [
  "industrial park",
  "logistics park",
  "free zone",
  "freezone",
  "bus terminal",
  "bus station",
  "bus stand",
  "railway station",
  "air force base",
  "power plant",
  "data center",
  "datacenter",
  "airfield",
  "aerodrome",
  "airport",
  "airbase",
  "harbour",
  "harbor",
  "terminal",
  "station",
  "warehouse",
  "factory",
  "quarry",
  "refinery",
  "shipyard",
  "railway",
  "depot",
  "yard",
  "plant",
  "port",
  "site",
];

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  category?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  name?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  osm_type?: string;
  osm_id?: number;
  importance?: number;
  geojson?: SurfaceGeometry;
};

type SurfaceGeometry =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

type ResolvedPlace = {
  name: string;
  displayName: string;
  center: [number, number];
  bbox: [number, number, number, number];
  className: string;
  typeName: string;
  address: Record<string, string>;
  wikipediaTag?: string;
  wikidataId?: string;
  osmType?: string;
  osmId?: number;
  importance?: number;
  sourceUrl?: string;
  geometry?: SurfaceGeometry;
};

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type ContextCategory =
  | "maritime"
  | "logistics"
  | "energy"
  | "industrial"
  | "transport"
  | "aviation"
  | "water"
  | "other";

type ContextFeature = {
  id: string;
  label: string;
  descriptor: string;
  coord: [number, number];
  score: number;
  markerKind: Marker["kind"];
  category: ContextCategory;
  distanceKm: number;
  sourceUrl: string;
};

type WikiBrief = {
  title: string;
  extract: string;
  url?: string;
};

type WikidataClaimValue = {
  id?: string;
};

type WikidataEntity = {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        snaktype?: string;
        datavalue?: {
          value?: WikidataClaimValue;
        };
      };
    }>
  >;
};

type WikidataResponse = {
  entities?: Record<string, WikidataEntity>;
};

type WikidataProfile = {
  id: string;
  label: string;
  description?: string;
  url: string;
  wikipediaTag?: string;
  instanceOf: string[];
  operators: string[];
  owners: string[];
  countries: string[];
  locatedIn: string[];
  industries: string[];
};

type EvidenceRefs = {
  place: string;
  context?: string;
  entity?: string;
  background?: string;
};

type ContextSnapshot = {
  count: number;
  categoryMix: Array<[ContextCategory, number]>;
  topLabels: string[];
  nearest?: ContextFeature;
  descriptor: string;
};

export async function analyzeQuery(query: string): Promise<DemoResult> {
  const preset = matchPresetQuery(query);
  if (preset) return preset;

  const grounded = await buildGroundedAnalysis(query);
  if (grounded) return grounded;

  return buildNoMatchResult(query);
}

async function buildGroundedAnalysis(query: string): Promise<DemoResult | null> {
  const mode = detectMode(query);
  const subject = detectSubject(query);
  const measurementIntent = detectMeasurementIntent(query);
  const place = await resolvePlace(query, subject, measurementIntent === "footprint");
  if (!place) return null;

  if (measurementIntent === "footprint") {
    const footprintResult = buildFootprintResult(query, mode, place);
    if (footprintResult) return footprintResult;
  }

  const [features, wikidata] = await Promise.all([
    fetchNearbyContext(place, subject),
    fetchWikidataProfile(place.wikidataId),
  ]);

  const wiki = await fetchWikipediaBrief(place.wikipediaTag ?? wikidata?.wikipediaTag);
  const topFeatures = features.slice(0, 5);
  const context = summarizeContext(topFeatures);
  const confidence = scoreConfidence(place, topFeatures, wikidata, wiki);

  const hasSubstantiveContext =
    topFeatures.length > 0 ||
    Boolean(wikidata?.instanceOf.length) ||
    Boolean(wikidata?.operators.length) ||
    Boolean(wikidata?.owners.length) ||
    Boolean(wiki);

  if (!hasSubstantiveContext || confidence < CONFIDENCE_FLOOR) {
    return buildWithheldResult(query, mode, subject, place, confidence, topFeatures.length);
  }

  const evidence: Evidence[] = [];
  const addEvidence = (
    item: Omit<Evidence, "id" | "hash"> & {
      hashSeed: string;
    },
  ) => {
    const id = `e${evidence.length + 1}`;
    evidence.push({
      id,
      kind: item.kind,
      claim: item.claim,
      source: item.source,
      sourceUrl: item.sourceUrl,
      hash: hexHash(item.hashSeed),
    });
    return id;
  };

  const placeEvidenceId = addEvidence({
    kind: "entity",
    claim: `${place.name} resolved to a canonical map object with a bounded area of interest.`,
    source: `OpenStreetMap Nominatim · ${place.className}/${place.typeName}`,
    sourceUrl: place.sourceUrl,
    hashSeed: `geo:${query}:${place.displayName}`,
  });

  const contextEvidenceId =
    topFeatures.length > 0
      ? addEvidence({
          kind: "measurement",
          claim: buildContextClaim(context, topFeatures, subject),
          source: `OpenStreetMap Overpass · ${Math.round(radiusForSubject(subject) / 1000)} km infrastructure scan`,
          sourceUrl: buildOsmMapUrl(place.center, Math.min(15, Math.round(chooseZoom(place.bbox) + 1))),
          hashSeed: `context:${query}:${topFeatures.map((feature) => feature.label).join("|")}`,
        })
      : undefined;

  const entityEvidenceId = wikidata
    ? addEvidence({
        kind: "entity",
        claim: buildEntityClaim(wikidata, place),
        source: "Wikidata · public entity graph",
        sourceUrl: wikidata.url,
        hashSeed: `wikidata:${wikidata.id}:${wikidata.label}`,
      })
    : undefined;

  const backgroundEvidenceId = wiki
    ? addEvidence({
        kind: "event",
        claim: `${wiki.title} public reference summary used for non-decisive background context.`,
        source: "Wikipedia · public summary",
        sourceUrl: wiki.url,
        hashSeed: `wiki:${wiki.title}:${wiki.extract}`,
      })
    : undefined;

  const refs: EvidenceRefs = {
    place: placeEvidenceId,
    context: contextEvidenceId,
    entity: entityEvidenceId,
    background: backgroundEvidenceId,
  };

  const narrative = [
    {
      text: buildOperatingPictureLine(place, subject, context, wikidata, wiki),
      refs: compactRefs([refs.place, refs.context, refs.entity, refs.background]),
    },
    {
      text: buildBusinessLine(mode, subject, place, context, wikidata),
      refs: compactRefs([refs.context, refs.entity, refs.place]),
    },
    {
      text: buildConfidenceLine(mode, confidence, topFeatures.length, Boolean(wikidata), Boolean(wiki)),
      refs: compactRefs([refs.place, refs.context, refs.entity]),
    },
    {
      text: buildNextStepLine(mode, subject, topFeatures.length > 0, Boolean(wikidata)),
      refs: compactRefs([refs.place, refs.context, refs.entity, refs.background]),
    },
  ];

  return {
    id: `grounded_${hash(query).toString(16)}`,
    query,
    headline: buildHeadline(mode, subject, place, context, confidence, Boolean(wikidata)),
    narrative,
    evidence,
    aoi: buildAoi(place, topFeatures, refs),
    confidence,
    mode,
    tookMs: 2500 + topFeatures.length * 140 + (wikidata ? 260 : 0) + (wiki ? 200 : 0),
    methodology: buildMethodology(subject, place, Boolean(wikidata), Boolean(wiki)),
    kind: "answer",
  };
}

async function resolvePlace(
  query: string,
  subject: Subject,
  includeGeometry = false,
): Promise<ResolvedPlace | null> {
  const coords = extractCoordinates(query);
  if (coords) {
    const reverse = await fetchNominatimReverse(coords[0], coords[1], includeGeometry);
    if (reverse) return normalizePlace(reverse);
  }

  const candidates: NominatimPlace[] = [];
  const seenQueries = new Set<string>();

  const queries = buildPlaceSearchQueries(query, subject);
  for (const hint of queries) {
    const normalized = hint.trim().toLowerCase();
    if (!normalized || seenQueries.has(normalized)) continue;
    seenQueries.add(normalized);

    const matches = await fetchNominatimSearch(hint, includeGeometry);
    candidates.push(...matches);
  }

  const best = pickBestPlace(candidates, query, subject);
  return best ? normalizePlace(best) : null;
}

function buildPlaceSearchQueries(query: string, subject: Subject): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  const push = (value?: string | null) => {
    const normalized = value?.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(normalized);
  };

  const hints = extractLocationHints(query);
  hints.forEach((hint) => push(hint));
  hints.forEach((hint) => {
    buildFallbackPlaceHints(hint, subject).forEach((variant) => push(variant));
  });
  push(query);

  return queries;
}

function buildFallbackPlaceHints(hint: string, subject: Subject): string[] {
  const suffixes = Array.from(
    new Set([
      ...subjectSuffixes(subject),
      ...COMMON_LOCATION_SUFFIXES,
    ]),
  ).sort((a, b) => b.length - a.length);

  const variants: string[] = [];
  let current = hint.trim();

  for (const suffix of suffixes) {
    const pattern = new RegExp(`\\b${escapeRegex(suffix)}\\b$`, "i");
    if (!pattern.test(current)) continue;

    const stripped = current.replace(pattern, "").trim().replace(/[,-]+$/, "").trim();
    if (stripped && stripped !== current && stripped.split(/\s+/).length >= 1) {
      variants.push(stripped);
      current = stripped;
    }
  }

  return variants;
}

async function fetchNominatimSearch(
  query: string,
  includeGeometry = false,
): Promise<NominatimPlace[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1",
    extratags: "1",
  });
  if (includeGeometry) {
    params.set("polygon_geojson", "1");
  }

  const results = await fetchJson<NominatimPlace[]>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
  );

  return results ?? [];
}

async function fetchNominatimReverse(
  lat: number,
  lon: number,
  includeGeometry = false,
): Promise<NominatimPlace | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "16",
    addressdetails: "1",
    extratags: "1",
  });
  if (includeGeometry) {
    params.set("polygon_geojson", "1");
  }

  return fetchJson<NominatimPlace>(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
  );
}

async function fetchNearbyContext(place: ResolvedPlace, subject: Subject): Promise<ContextFeature[]> {
  const radius = radiusForSubject(subject);
  const [lon, lat] = place.center;
  const query = buildOverpassQuery(radius, lat, lon, subject);

  const response = await fetchJson<{ elements?: OverpassElement[] }>(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: query,
    },
  );

  const features = (response?.elements ?? [])
    .map((element) => mapElementToFeature(element, place.center, subject))
    .filter((feature): feature is ContextFeature => Boolean(feature))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

  const unique = new Map<string, ContextFeature>();
  for (const feature of features) {
    const key = `${feature.label.toLowerCase()}-${feature.category}`;
    if (!unique.has(key)) unique.set(key, feature);
  }

  return Array.from(unique.values()).slice(0, 10);
}

async function fetchWikidataProfile(entityId?: string): Promise<WikidataProfile | null> {
  if (!entityId) return null;

  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    languages: "en",
    props: "labels|descriptions|claims|sitelinks",
    ids: entityId,
  });

  const data = await fetchJson<WikidataResponse>(`${WIKIDATA_API}?${params.toString()}`);
  const entity = data?.entities?.[entityId];
  if (!entity) return null;

  const relatedIds = Array.from(
    new Set([
      ...readClaimItemIds(entity, "P31"),
      ...readClaimItemIds(entity, "P137"),
      ...readClaimItemIds(entity, "P127"),
      ...readClaimItemIds(entity, "P17"),
      ...readClaimItemIds(entity, "P131"),
      ...readClaimItemIds(entity, "P452"),
    ]),
  );

  const labels = await fetchWikidataLabels(relatedIds);
  const wikipediaTitle = entity.sitelinks?.enwiki?.title;

  return {
    id: entityId,
    label: readEntityText(entity.labels) ?? entityId,
    description: readEntityText(entity.descriptions),
    url: `https://www.wikidata.org/wiki/${entityId}`,
    wikipediaTag: wikipediaTitle ? `en:${wikipediaTitle}` : undefined,
    instanceOf: labelIds(readClaimItemIds(entity, "P31"), labels),
    operators: labelIds(readClaimItemIds(entity, "P137"), labels),
    owners: labelIds(readClaimItemIds(entity, "P127"), labels),
    countries: labelIds(readClaimItemIds(entity, "P17"), labels),
    locatedIn: labelIds(readClaimItemIds(entity, "P131"), labels),
    industries: labelIds(readClaimItemIds(entity, "P452"), labels),
  };
}

async function fetchWikidataLabels(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    languages: "en",
    props: "labels",
    ids: ids.join("|"),
  });

  const data = await fetchJson<WikidataResponse>(`${WIKIDATA_API}?${params.toString()}`);
  const labels: Record<string, string> = {};

  Object.entries(data?.entities ?? {}).forEach(([id, entity]) => {
    const label = readEntityText(entity.labels);
    if (label) labels[id] = label;
  });

  return labels;
}

async function fetchWikipediaBrief(tag?: string): Promise<WikiBrief | null> {
  if (!tag) return null;

  const normalizedTag = tag.includes(":") ? tag : `en:${tag}`;
  const [lang, rawTitle] = normalizedTag.split(":");
  if (!lang || !rawTitle) return null;

  const params = new URLSearchParams({
    action: "query",
    prop: "extracts|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    format: "json",
    titles: rawTitle,
  });

  const data = await fetchJson<{
    query?: {
      pages?: Record<
        string,
        { title?: string; extract?: string; fullurl?: string; missing?: string }
      >;
    };
  }>(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`);

  const page = Object.values(data?.query?.pages ?? {}).find((entry) => !entry.missing);
  if (!page?.title || !page.extract) return null;

  return {
    title: page.title,
    extract: page.extract.split(". ").slice(0, 2).join(". ").trim(),
    url: page.fullurl,
  };
}

function pickBestPlace(
  candidates: NominatimPlace[],
  query: string,
  subject: Subject,
): NominatimPlace | null {
  const unique = new Map<string, NominatimPlace>();

  for (const candidate of candidates) {
    const key = `${candidate.osm_type ?? "unknown"}:${candidate.osm_id ?? candidate.display_name}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }

  const ranked = Array.from(unique.values())
    .map((candidate) => ({
      candidate,
      score: scorePlaceCandidate(candidate, query, subject),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 1.2) return null;
  return best.candidate;
}

function scorePlaceCandidate(
  candidate: NominatimPlace,
  query: string,
  subject: Subject,
): number {
  const lowerQuery = query.toLowerCase();
  const name =
    (candidate.name || candidate.display_name.split(",")[0]?.trim() || "").toLowerCase();
  const className = (candidate.class ?? candidate.category ?? "").toLowerCase();
  const typeName = candidate.type?.toLowerCase() ?? candidate.addresstype?.toLowerCase() ?? "";
  const text = `${name} ${typeName} ${candidate.display_name}`.toLowerCase();
  const identityText = `${name} ${typeName} ${className}`.toLowerCase();

  let score = candidate.importance ?? 0;

  if (name && lowerQuery.includes(name)) score += 1.4;
  if (placeMatchesSubject(className, typeName, subject, text)) score += 1.8;
  if (isSpecificSiteCandidate(className, typeName)) score += 0.35;
  if (className === "boundary" || typeName === "administrative" || typeName === "city") score += 0.5;
  if (className === "place" && (typeName === "city" || typeName === "town" || typeName === "village")) score += 0.7;
  if (isBroadCandidate(candidate)) score -= 0.4;
  else score += 0.1;

  if (looksLikeStreetLevelCandidate(identityText, className, typeName)) score -= 2.6;
  if (
    !placeMatchesSubject(className, typeName, subject, text) &&
    looksLikeStreetLevelCandidate(identityText, className, typeName)
  ) {
    score -= 0.6;
  }

  return score;
}

function placeMatchesSubject(
  className: string,
  typeName: string,
  subject: Subject,
  text: string,
): boolean {
  const contains = (terms: string[]) => terms.some((term) => text.includes(term));

  switch (subject) {
    case "port":
    case "vessel":
      return (
        contains(["port", "harbour", "harbor", "terminal", "dock", "quay", "pier"]) ||
        className === "harbour" ||
        className === "waterway" ||
        className === "industrial"
      );
    case "storage":
    case "refinery":
    case "power":
      return (
        contains(["tank", "storage", "refinery", "power", "terminal", "industrial"]) ||
        className === "industrial" ||
        className === "man_made" ||
        className === "power"
      );
    case "airport":
    case "airbase":
    case "aircraft":
      return contains(["airport", "airbase", "airfield", "aerodrome"]) || className === "aeroway";
    default:
      return contains(subjectQueryTerms(subject)) || className === "place" || className === "boundary";
  }
}

function looksLikeStreetLevelCandidate(text: string, className: string, typeName: string): boolean {
  return (
    /street|road|avenue|lane|drive|residential|house|building|footway|service/.test(text) ||
    typeName === "residential" ||
    typeName === "road" ||
    typeName === "house" ||
    className === "highway"
  );
}

function isSpecificSiteCandidate(className: string, typeName: string): boolean {
  return (
    [
      "amenity",
      "building",
      "railway",
      "aeroway",
      "tourism",
      "leisure",
      "office",
      "shop",
      "industrial",
      "man_made",
      "power",
      "waterway",
      "public_transport",
    ].includes(className) ||
    [
      "bus_station",
      "station",
      "terminal",
      "airport",
      "aerodrome",
      "harbour",
      "port",
      "university",
      "hospital",
      "stadium",
      "depot",
      "factory",
      "warehouse",
    ].includes(typeName)
  );
}

function isBroadCandidate(candidate: NominatimPlace): boolean {
  const bbox = candidate.boundingbox?.map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => Number.isNaN(value))) {
    return false;
  }

  const [south, north, west, east] = bbox;
  return Math.max(Math.abs(north - south), Math.abs(east - west)) > 0.28;
}

function subjectQueryTerms(subject: Subject): string[] {
  switch (subject) {
    case "port":
    case "vessel":
      return ["port", "harbour", "harbor", "terminal"];
    case "storage":
      return ["storage", "tank", "terminal"];
    case "refinery":
      return ["refinery", "plant"];
    case "power":
      return ["power", "plant", "substation"];
    case "airport":
    case "airbase":
    case "aircraft":
      return ["airport", "airbase", "airfield"];
    case "facility":
      return [
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
      ];
    default:
      return [subject.replace(/_/g, " ")];
  }
}

function subjectSuffixes(subject: Subject): string[] {
  switch (subject) {
    case "port":
    case "vessel":
      return ["port", "harbour", "harbor", "terminal"];
    case "airport":
    case "airbase":
    case "aircraft":
      return ["airport", "airbase", "airfield", "aerodrome"];
    case "railway":
      return ["railway station", "railway", "station", "yard"];
    case "storage":
      return ["storage", "tank farm", "terminal", "depot"];
    case "refinery":
      return ["refinery", "plant"];
    case "warehouse":
      return ["warehouse", "logistics park", "depot"];
    case "factory":
      return ["factory", "plant"];
    case "shipyard":
      return ["shipyard", "drydock", "dry dock"];
    case "power":
      return ["power plant", "substation", "switchyard"];
    case "datacenter":
      return ["data center", "datacenter", "campus"];
    case "facility":
      return [
        "bus stand",
        "bus station",
        "bus terminal",
        "station",
        "terminal",
        "depot",
        "free zone",
        "freezone",
        "industrial park",
        "logistics park",
        "facility",
        "site",
      ];
    default:
      return [];
  }
}

function normalizePlace(place: NominatimPlace): ResolvedPlace {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const [south, north, west, east] = place.boundingbox
    ? place.boundingbox.map(Number)
    : [lat - 0.02, lat + 0.02, lon - 0.02, lon + 0.02];

  return {
    name: place.name || place.display_name.split(",")[0]?.trim() || "the resolved site",
    displayName: place.display_name,
    center: [lon, lat],
    bbox: [south, north, west, east],
    className: place.class ?? place.category ?? "place",
    typeName: place.type ?? place.addresstype ?? "site",
    address: place.address ?? {},
    wikipediaTag: place.extratags?.wikipedia,
    wikidataId: place.extratags?.wikidata,
    osmType: place.osm_type,
    osmId: place.osm_id,
    importance: place.importance,
    sourceUrl: buildOsmObjectUrl(place.osm_type, place.osm_id, [lon, lat]),
    geometry: normalizeSurfaceGeometry(place.geojson),
  };
}

function normalizeSurfaceGeometry(
  geometry?: NominatimPlace["geojson"],
): SurfaceGeometry | undefined {
  if (!geometry) return undefined;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return geometry;
  }
  return undefined;
}

function buildFootprintResult(
  query: string,
  mode: AnalysisMode,
  place: ResolvedPlace,
): DemoResult | null {
  if (!place.geometry) return null;
  if (isBroadPlace(place) || place.className === "boundary" || place.typeName === "administrative") {
    return null;
  }

  const areaSqm = computeSurfaceAreaSqm(place.geometry);
  if (!Number.isFinite(areaSqm) || areaSqm <= 0) return null;

  const roundedSqm = Math.round(areaSqm / 10) * 10;
  const hectares = areaSqm / 10000;
  const acres = areaSqm / 4046.8564224;
  const placeLabel = titleCase(place.name);
  const admin = compactAddress(place.address);
  const confidence = 0.78;

  const evidence: Evidence[] = [
    {
      id: "e1",
      kind: "measurement",
      claim: `${placeLabel} polygon encloses about ${formatInteger(roundedSqm)} m² of mapped surface area.`,
      source: `OpenStreetMap geometry · ${place.className}/${place.typeName}`,
      sourceUrl: place.sourceUrl,
      hash: hexHash(`footprint:${query}:${place.osmType}:${place.osmId}:${roundedSqm}`),
    },
  ];

  return {
    id: `footprint_${hash(query).toString(16)}`,
    query,
    headline: `${placeLabel} maps to roughly ${formatInteger(roundedSqm)} m² of current footprint.`,
    narrative: [
      {
        text: `${placeLabel} resolves to ${admin}. For this question, the answer comes from the current mapped OpenStreetMap polygon for the resolved ${place.className}/${place.typeName} object, not from generated prose or a guessed envelope.`,
        refs: ["e1"],
      },
      {
        text: `The mapped footprint is about ${formatInteger(roundedSqm)} square metres, which is roughly ${hectares.toFixed(2)} hectares or ${acres.toFixed(2)} acres.`,
        refs: ["e1"],
      },
      {
        text: `Confidence is ${Math.round(confidence * 100)}% because the geometry is specific and directly attached to the named site. The main limitation is scope: this is the currently mapped footprint, so any unmapped canopies, layover space, or recent civil works would not appear until the map geometry is updated.`,
        refs: ["e1"],
      },
      {
        text: "If you need as-built footprint rather than mapped footprint, the next honest step is an imagery-derived perimeter measurement over a dated satellite pass.",
        refs: [],
      },
    ],
    evidence,
    aoi: buildFootprintAoi(place, "e1"),
    confidence,
    mode,
    tookMs: 1650,
    methodology: [
      "Resolved the site with OpenStreetMap Nominatim using the place name from the prompt.",
      "Requested the returned OSM polygon geometry and computed surface area from that geometry rather than from the bounding box.",
      "Reported the result as a mapped footprint, not a satellite-confirmed as-built perimeter.",
      "Best next step for higher confidence: compare the map geometry against a recent satellite image and redraw if the site has changed.",
    ],
    kind: "answer",
  };
}

function buildHeadline(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  context: ContextSnapshot,
  confidence: number,
  hasWikidata: boolean,
): string {
  const site = titleCase(place.name);
  const confidenceLabel = confidence >= 0.75 ? "high-confidence" : "decision-usable";
  const contextLine =
    context.count > 0
      ? `${context.count} nearby operating signals support the read`
      : "place resolution is clear but the surrounding context is still thin";

  if (mode === "verify") {
    return `Proceed to diligence: ${site} resolves as a real ${subjectLabel(subject)} location, and the free-source stack produced a ${confidenceLabel} validation read. ${contextLine}.`;
  }

  if (mode === "monitor") {
    return `Add ${site} to the watchlist: the site is grounded well enough for recurring monitoring, but this single free-source pass should frame the question, not overclaim the trend.`;
  }

  return `Escalate selectively on ${site}: the site resolves cleanly, the surrounding asset base makes the question commercially legible, and the current read is ${confidenceLabel} enough for triage rather than a final memo.${hasWikidata ? "" : " Entity metadata is still limited, so treat this as operating context first."}`;
}

function buildOperatingPictureLine(
  place: ResolvedPlace,
  subject: Subject,
  context: ContextSnapshot,
  wikidata: WikidataProfile | null,
  wiki: WikiBrief | null,
): string {
  const site = titleCase(place.name);
  const admin = compactAddress(place.address);
  const typeLine = `${site} resolves to ${admin}. The mapped object is tagged as ${place.className}/${place.typeName}, which is directionally consistent with a ${subjectLabel(subject)} question.`;
  const contextLine =
    context.count > 0
      ? ` Nearby context is not generic background noise: ${context.descriptor}.`
      : " Nearby map context is sparse, so this read leans more on place identity than on surrounding operating signals.";
  const entityLine = wikidata
    ? ` Public entity metadata describes it as ${buildEntityDescription(wikidata)}.`
    : "";
  const backgroundLine = wiki ? ` Background summaries describe the site or region as ${wiki.extract}.` : "";

  return `${typeLine}${contextLine}${entityLine}${backgroundLine}`;
}

function buildBusinessLine(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  context: ContextSnapshot,
  wikidata: WikidataProfile | null,
): string {
  const site = titleCase(place.name);
  const nearestLine =
    context.nearest && context.count > 0
      ? `${context.nearest.label} sits about ${formatDistance(context.nearest.distanceKm)} from the site`
      : "the free stack did not surface a decisive adjacent asset";
  const entityLine =
    wikidata && (wikidata.operators.length > 0 || wikidata.owners.length > 0)
      ? ` Public graph data also names ${joinNatural([...wikidata.operators, ...wikidata.owners].slice(0, 2))}, which helps separate a real operating site from a vague place reference.`
      : "";

  if (mode === "verify") {
    return `For diligence, the value is simple: this is a concrete operating location, not a registry ghost. ${nearestLine}, which makes the site economically legible before you spend time on counterparties, sanctions, or ownership-chain follow-up.${entityLine}`;
  }

  if (mode === "monitor") {
    return `For monitoring, this clears the first gate. ${site} is specific enough to revisit on a schedule, and ${nearestLine}, which tells you where pressure, throughput, or change would show up first once recurring imagery or traffic feeds are added.${entityLine}`;
  }

  switch (subject) {
    case "port":
    case "vessel":
      return `For a commercial read, this looks like a routing and throughput question rather than a simple existence check. ${nearestLine}, which is where freight pressure or dwell-time risk would likely surface first.${entityLine}`;
    case "storage":
    case "refinery":
    case "power":
      return `For a market read, this looks like an asset where surrounding infrastructure matters almost as much as the site itself. ${nearestLine}, which frames how quickly a change here could turn into inventory, dispatch, or basis consequences.${entityLine}`;
    default:
      return `For triage, ${site} is specific enough to prioritize. ${nearestLine}, which helps decide whether this belongs on a diligence queue, an operating watchlist, or the discard pile.${entityLine}`;
  }
}

function buildConfidenceLine(
  mode: AnalysisMode,
  confidence: number,
  featureCount: number,
  hasWikidata: boolean,
  hasWiki: boolean,
): string {
  const confidencePercent = Math.round(confidence * 100);
  const sourceMix = [
    "place resolution",
    featureCount > 0 ? "open-map operating context" : null,
    hasWikidata ? "entity graph data" : null,
    hasWiki ? "public background text" : null,
  ].filter(Boolean) as string[];

  const limit =
    mode === "monitor"
      ? "What this does not support yet is a hard time-series claim from one pass. Recurring EO, AIS, or ADS-B is still the honest next layer."
      : "What this does not support yet is a hard claim about recent activity, throughput, or ownership completeness without deeper collection.";

  return `Confidence is ${confidencePercent}%, driven by ${joinNatural(sourceMix)}. That is strong enough for decision support at the triage layer, but not strong enough to pretend the free stack replaces scheduled imagery, registry pulls, or human diligence. ${limit}`;
}

function buildNextStepLine(
  mode: AnalysisMode,
  subject: Subject,
  hasContext: boolean,
  hasWikidata: boolean,
): string {
  const collectionLine = hasContext
    ? "Use this brief to choose where the next hour of analyst time should go."
    : "Use this as a location-validation pass before you invest in deeper collection.";
  const operatorLine = hasWikidata
    ? "The public entity graph is good enough to start ownership and operator checks."
    : "Operator-chain work still needs a separate pass because the public entity graph here is thin.";

  if (mode === "verify") {
    return `${collectionLine} ${operatorLine} Next, add sanctions screening, registry confirmation, and a fresher visual pass before you treat the site as cleared.`;
  }

  if (mode === "monitor") {
    return `${collectionLine} Build the watchlist around the map first, then add recurring imagery and movement data. The free read is useful for framing, not for pretending the time series already exists.`;
  }

  if (subject === "construction" || subject === "port" || subject === "storage") {
    return `${collectionLine} The honest next move is a repeatable comparison window, not more prose. This read tells you where to point it.`;
  }

  return `${collectionLine} ${operatorLine} Treat the current output as a go/no-go filter for deeper work, not as the last memo.`;
}

function buildMethodology(
  subject: Subject,
  place: ResolvedPlace,
  hasWikidata: boolean,
  hasWiki: boolean,
): string[] {
  return [
    `Resolved the place with OpenStreetMap Nominatim and used the returned ${place.className}/${place.typeName} object to frame the AOI.`,
    `Scanned nearby public map features with Overpass and ranked them for a ${subjectLabel(subject)} question by proximity and relevance.`,
    hasWikidata
      ? "Pulled public entity metadata from Wikidata to add instance, operator, owner, and country context where available."
      : "No linked Wikidata entity cleared the bar, so the brief stayed inside place and map context rather than stretching for ownership claims.",
    hasWiki
      ? "Used Wikipedia only for background framing, not as primary proof."
      : "No Wikipedia summary was needed or available, so the brief stayed source-tight.",
    "Confidence rises with source diversity and location specificity, and falls when the place is broad, surrounding context is sparse, or the question really needs scheduled EO or movement data.",
  ];
}

function buildWithheldResult(
  query: string,
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  confidence: number,
  featureCount: number,
): DemoResult {
  return {
    id: `withheld_${hash(query).toString(16)}`,
    query,
    headline: `Place match found for ${titleCase(place.name)}, but the evidence floor for a ${subjectLabel(subject)} brief was not met.`,
    narrative: [
      {
        text: `${titleCase(place.name)} resolved cleanly on the map, but the free-source stack did not return enough surrounding context to support a decision brief. The system withheld the call instead of padding the gap with generated certainty.`,
        refs: [],
      },
      {
        text: `Confidence only reached ${Math.round(confidence * 100)}%. The limiting factor was source depth, not prose. ${featureCount > 0 ? `A few nearby signals appeared, but not enough to make the operating picture decision-grade.` : "The surrounding map context stayed too thin to move beyond place validation."}`,
        refs: [],
      },
    ],
    evidence: [],
    confidence: Number(confidence.toFixed(2)),
    mode,
    tookMs: 2100,
    methodology: [
      "Resolved the location with OpenStreetMap Nominatim.",
      "Tried to enrich with open-map context, public entity metadata, and public background sources.",
      "The evidence mix did not clear the confidence floor, so the brief was withheld.",
      "Best next step: narrow the location, add the operator name, or switch to a collection path with recurring EO or registry data.",
    ],
    kind: "insufficient",
  };
}

function buildNoMatchResult(query: string): DemoResult {
  return {
    id: `insufficient_${hash(query).toString(16)}`,
    query,
    headline: "Not enough grounded location context to start a decision brief.",
    narrative: [
      {
        text:
          "The free-source stack could not resolve a reliable place from this prompt. Vantage stopped there rather than inventing coordinates, a site identity, or a market read that the evidence did not support.",
        refs: [],
      },
    ],
    evidence: [],
    confidence: 0,
    mode: detectMode(query),
    tookMs: 1900,
    methodology: [
      "Tried public geocoding first, using both extracted place hints and the full query.",
      "No reliable place match cleared the floor, so the analysis was withheld before any business framing was attempted.",
      "Best next step: add a clearer place name, coordinates, or the operator name.",
    ],
    kind: "insufficient",
  };
}

function buildAoi(place: ResolvedPlace, features: ContextFeature[], refs: EvidenceRefs): AOI {
  const markers: Marker[] = features.slice(0, 5).map((feature, index) => ({
    id: `m${index + 1}`,
    kind: feature.markerKind,
    coord: feature.coord,
    evidenceRef: refs.context,
    label: feature.label,
  }));

  return {
    center: place.center,
    zoom: chooseZoom(place.bbox),
    polygons: [
      {
        label: titleCase(place.name),
        date: "Grounded context",
        coords: buildPlacePolygonCoords(place),
        accent: "current",
        evidenceRef: refs.place,
      },
    ],
    markers,
    evidenceFocus: {
      [refs.place]: { center: place.center, zoom: chooseZoom(place.bbox) + 0.4 },
      ...(refs.context
        ? {
            [refs.context]: {
              center: features[0]?.coord ?? place.center,
              zoom: Math.min(16.8, chooseZoom(place.bbox) + 1.1),
            },
          }
        : {}),
      ...(refs.entity
        ? {
            [refs.entity]: {
              center: place.center,
              zoom: chooseZoom(place.bbox) + 0.2,
            },
          }
        : {}),
      ...(refs.background
        ? {
            [refs.background]: {
              center: place.center,
              zoom: chooseZoom(place.bbox) + 0.2,
            },
          }
        : {}),
    },
  };
}

function buildFootprintAoi(place: ResolvedPlace, evidenceRef: string): AOI {
  return {
    center: place.center,
    zoom: Math.min(16.6, chooseZoom(place.bbox) + 0.6),
    polygons: [
      {
        label: "Mapped footprint",
        date: "Current OSM geometry",
        coords: buildPlacePolygonCoords(place),
        accent: "current",
        evidenceRef,
      },
    ],
    evidenceFocus: {
      [evidenceRef]: {
        center: place.center,
        zoom: Math.min(16.8, chooseZoom(place.bbox) + 0.9),
      },
    },
  };
}

function buildPlacePolygonCoords(place: ResolvedPlace): [number, number][] {
  const ring = largestOuterRing(place.geometry);
  if (ring && ring.length >= 4) return closeRing(ring);

  const [south, north, west, east] = place.bbox;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
    [west, north],
  ];
}

function largestOuterRing(
  geometry?: SurfaceGeometry,
): [number, number][] | null {
  if (!geometry) return null;

  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let bestRing: [number, number][] | null = null;
  let bestArea = 0;

  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring || ring.length < 4) continue;
    const area = ringAreaSqm(ring);
    if (area > bestArea) {
      bestArea = area;
      bestRing = ring;
    }
  }

  return bestRing;
}

function computeSurfaceAreaSqm(geometry: SurfaceGeometry): number {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let total = 0;
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon;
    if (!outer || outer.length < 4) continue;
    total += ringAreaSqm(outer);
    for (const hole of holes) {
      total -= ringAreaSqm(hole);
    }
  }

  return Math.max(0, total);
}

function ringAreaSqm(ring: [number, number][]): number {
  if (ring.length < 4) return 0;

  const EARTH_RADIUS_M = 6378137;
  const lat0 =
    (ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length) * (Math.PI / 180);
  const projected = ring.map(([lon, lat]) => [
    EARTH_RADIUS_M * (lon * Math.PI / 180) * Math.cos(lat0),
    EARTH_RADIUS_M * (lat * Math.PI / 180),
  ] as const);

  let area = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const [x1, y1] = projected[index];
    const [x2, y2] = projected[(index + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area) / 2;
}

function closeRing(ring: [number, number][]): [number, number][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, first];
}

function buildOverpassQuery(radius: number, lat: number, lon: number, subject: Subject): string {
  const around = `(around:${radius},${lat},${lon})`;
  const selectors = [
    `nwr${around}["landuse"="industrial"];`,
    `nwr${around}["industrial"];`,
    `nwr${around}["man_made"];`,
    `nwr${around}["power"];`,
    `nwr${around}["railway"];`,
    `nwr${around}["aeroway"];`,
    `nwr${around}["waterway"];`,
    `nwr${around}["harbour"];`,
    `nwr${around}["building"~"industrial|warehouse|factory|hangar|retail|commercial"];`,
  ];

  if (subject === "port" || subject === "vessel") {
    selectors.push(
      `nwr${around}["man_made"~"pier|crane|breakwater|quay"];`,
      `nwr${around}["water"="harbour"];`,
    );
  }

  if (subject === "storage" || subject === "refinery") {
    selectors.push(
      `nwr${around}["man_made"~"storage_tank|silo"];`,
      `nwr${around}["industrial"~"storage|tank_farm|refinery"];`,
    );
  }

  if (subject === "airport" || subject === "airbase" || subject === "aircraft") {
    selectors.push(
      `nwr${around}["aeroway"];`,
      `nwr${around}["military"="airfield"];`,
    );
  }

  if (subject === "power") {
    selectors.push(
      `nwr${around}["power"~"plant|substation|generator|transformer"];`,
    );
  }

  return `
[out:json][timeout:22];
(
  ${selectors.join("\n  ")}
);
out center tags;
`;
}

function mapElementToFeature(
  element: OverpassElement,
  center: [number, number],
  subject: Subject,
): ContextFeature | null {
  const tags = element.tags ?? {};
  const coord = readElementCoord(element);
  if (!coord) return null;

  const score = scoreFeature(tags, subject);
  if (score <= 0) return null;

  const category = inferCategory(tags, subject);
  const label = tags.name || tags.operator || tags.brand || inferDescriptor(tags);

  return {
    id: String(element.id),
    label,
    descriptor: inferDescriptor(tags),
    coord,
    score,
    markerKind: inferMarkerKind(tags, subject),
    category,
    distanceKm: haversineKm(center, coord),
    sourceUrl: buildOsmMapUrl(coord, 15),
  };
}

function scoreFeature(tags: Record<string, string>, subject: Subject): number {
  const industrial = tags.industrial;
  const manMade = tags.man_made;
  const landuse = tags.landuse;
  const aeroway = tags.aeroway;
  const railway = tags.railway;
  const power = tags.power;
  const waterway = tags.waterway;
  const building = tags.building;

  switch (subject) {
    case "port":
    case "vessel":
      return Number(
        Boolean(
          tags.harbour ||
            waterway === "dock" ||
            manMade === "pier" ||
            manMade === "quay" ||
            manMade === "crane" ||
            industrial === "port" ||
            landuse === "industrial",
        ),
      ) * 12;
    case "storage":
      return Number(
        Boolean(
          manMade === "storage_tank" ||
            manMade === "silo" ||
            industrial === "storage" ||
            industrial === "tank_farm",
        ),
      ) * 12;
    case "refinery":
      return Number(
        Boolean(
          industrial === "refinery" ||
            manMade === "storage_tank" ||
            landuse === "industrial",
        ),
      ) * 12;
    case "airport":
    case "airbase":
    case "aircraft":
      return Number(Boolean(aeroway || tags.military === "airfield" || tags.aerodrome)) * 12;
    case "railway":
      return Number(Boolean(railway)) * 12;
    case "power":
      return Number(Boolean(power || tags.generator)) * 12;
    case "factory":
    case "warehouse":
    case "facility":
      return Number(Boolean(industrial || landuse === "industrial" || building === "warehouse" || building === "industrial")) * 10;
    case "mine":
    case "quarry":
      return Number(Boolean(landuse === "quarry" || industrial === "mine" || tags.natural === "bare_rock")) * 12;
    default:
      return Number(Boolean(industrial || landuse === "industrial" || manMade || power || railway || aeroway)) * 8;
  }
}

function inferCategory(tags: Record<string, string>, subject: Subject): ContextCategory {
  if (
    subject === "port" ||
    subject === "vessel" ||
    tags.harbour ||
    tags.water === "harbour" ||
    tags.man_made === "pier" ||
    tags.man_made === "quay"
  ) {
    return "maritime";
  }
  if (tags.power || tags.generator || tags.industrial === "refinery" || tags.man_made === "storage_tank") {
    return "energy";
  }
  if (tags.aeroway || tags.military === "airfield") {
    return "aviation";
  }
  if (tags.railway) {
    return "transport";
  }
  if (tags.building === "warehouse" || tags.landuse === "commercial") {
    return "logistics";
  }
  if (tags.waterway) {
    return "water";
  }
  if (tags.industrial || tags.landuse === "industrial" || tags.building === "industrial") {
    return "industrial";
  }
  return "other";
}

function inferDescriptor(tags: Record<string, string>): string {
  if (tags.name) return tags.name;
  if (tags.industrial) return `${tags.industrial.replace(/_/g, " ")} asset`;
  if (tags.man_made) return `${tags.man_made.replace(/_/g, " ")} asset`;
  if (tags.landuse) return `${tags.landuse.replace(/_/g, " ")} area`;
  if (tags.power) return `${tags.power.replace(/_/g, " ")} asset`;
  if (tags.railway) return `${tags.railway.replace(/_/g, " ")} asset`;
  if (tags.aeroway) return `${tags.aeroway.replace(/_/g, " ")} asset`;
  if (tags.waterway) return `${tags.waterway.replace(/_/g, " ")} asset`;
  if (tags.building) return `${tags.building.replace(/_/g, " ")} building`;
  return "mapped infrastructure";
}

function inferMarkerKind(tags: Record<string, string>, subject: Subject): Marker["kind"] {
  if (subject === "storage" || tags.man_made === "storage_tank" || tags.man_made === "silo") {
    return "tank";
  }
  if (subject === "port" || subject === "vessel") {
    return "vessel";
  }
  return "beacon";
}

function summarizeContext(features: ContextFeature[]): ContextSnapshot {
  const counts = new Map<ContextCategory, number>();
  features.forEach((feature) => {
    counts.set(feature.category, (counts.get(feature.category) ?? 0) + 1);
  });

  const categoryMix = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const categoryLabels = categoryMix.slice(0, 2).map(([category, count]) => `${count} ${category}`);
  const topLabels = features.slice(0, 3).map((feature) => feature.label);
  const nearest = features.slice().sort((a, b) => a.distanceKm - b.distanceKm)[0];
  const descriptor =
    features.length > 0
      ? `${joinNatural(categoryLabels)} signals sit around the AOI, led by ${joinNatural(topLabels)}`
      : "no nearby operating signals cleared the relevance floor";

  return {
    count: features.length,
    categoryMix,
    topLabels,
    nearest,
    descriptor,
  };
}

function scoreConfidence(
  place: ResolvedPlace,
  features: ContextFeature[],
  wikidata: WikidataProfile | null,
  wiki: WikiBrief | null,
): number {
  let score = 0.46;

  if (!isBroadPlace(place)) score += 0.06;
  if ((place.importance ?? 0) > 0.4) score += 0.04;
  if (features.length >= 2) score += 0.1;
  else if (features.length === 1) score += 0.05;

  const categories = new Set(features.map((feature) => feature.category));
  score += Math.min(0.08, categories.size * 0.02);

  if (wikidata) score += 0.08;
  if (wikidata && (wikidata.operators.length > 0 || wikidata.owners.length > 0)) score += 0.04;
  if (wiki) score += 0.03;

  if (place.className === "boundary" || place.typeName === "administrative") score -= 0.06;
  if (features.length === 0) score -= 0.05;
  if (isBroadPlace(place)) score -= 0.08;

  return Number(Math.max(0.32, Math.min(0.84, score)).toFixed(2));
}

function buildContextClaim(
  context: ContextSnapshot,
  features: ContextFeature[],
  subject: Subject,
): string {
  const lead = context.nearest
    ? `${context.nearest.label} is the nearest high-signal feature at roughly ${formatDistance(context.nearest.distanceKm)}`
    : "no single nearby feature dominated the context";

  return `${features.length} relevant nearby assets were found for a ${subjectLabel(subject)} read. ${lead}.`;
}

function buildEntityClaim(wikidata: WikidataProfile, place: ResolvedPlace): string {
  const subjectLine = wikidata.instanceOf.length > 0 ? joinNatural(wikidata.instanceOf.slice(0, 2)) : place.typeName;
  const operatorLine =
    wikidata.operators.length > 0
      ? ` Operators include ${joinNatural(wikidata.operators.slice(0, 2))}.`
      : "";
  const ownerLine =
    wikidata.owners.length > 0
      ? ` Owners include ${joinNatural(wikidata.owners.slice(0, 2))}.`
      : "";

  return `${wikidata.label} is described in Wikidata as ${subjectLine}.${operatorLine}${ownerLine}`.trim();
}

function buildEntityDescription(wikidata: WikidataProfile): string {
  const parts = [
    wikidata.description,
    wikidata.instanceOf.length > 0 ? `an instance of ${joinNatural(wikidata.instanceOf.slice(0, 2))}` : null,
    wikidata.countries.length > 0 ? `in ${joinNatural(wikidata.countries.slice(0, 2))}` : null,
  ].filter(Boolean) as string[];

  if (parts.length === 0) return "a resolved public entity";
  return parts.join(", ");
}

function compactRefs(ids: Array<string | undefined>): string[] {
  return ids.filter(Boolean) as string[];
}

function readEntityText(block?: Record<string, { value?: string }>): string | undefined {
  return block?.en?.value ?? Object.values(block ?? {})[0]?.value;
}

function readClaimItemIds(entity: WikidataEntity, propertyId: string): string[] {
  const claims = entity.claims?.[propertyId] ?? [];
  return claims
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter((value): value is string => Boolean(value));
}

function labelIds(ids: string[], labels: Record<string, string>): string[] {
  return ids.map((id) => labels[id]).filter(Boolean);
}

function readElementCoord(element: OverpassElement): [number, number] | null {
  if (typeof element.lon === "number" && typeof element.lat === "number") {
    return [element.lon, element.lat];
  }
  if (
    element.center &&
    typeof element.center.lon === "number" &&
    typeof element.center.lat === "number"
  ) {
    return [element.center.lon, element.center.lat];
  }
  return null;
}

function radiusForSubject(subject: Subject): number {
  switch (subject) {
    case "port":
    case "vessel":
      return 7000;
    case "airport":
    case "airbase":
    case "aircraft":
      return 6500;
    case "storage":
    case "refinery":
    case "power":
      return 4500;
    default:
      return 3200;
  }
}

function chooseZoom([south, north, west, east]: [number, number, number, number]): number {
  const latDelta = Math.max(0.01, Math.abs(north - south));
  const lonDelta = Math.max(0.01, Math.abs(east - west));
  const delta = Math.max(latDelta, lonDelta);
  if (delta < 0.025) return 15.4;
  if (delta < 0.06) return 14.2;
  if (delta < 0.14) return 13.1;
  if (delta < 0.3) return 11.9;
  return 10.8;
}

function isBroadPlace(place: ResolvedPlace): boolean {
  const [south, north, west, east] = place.bbox;
  return Math.max(Math.abs(north - south), Math.abs(east - west)) > 0.28;
}

function buildOsmObjectUrl(
  osmType?: string,
  osmId?: number,
  fallbackCenter?: [number, number],
): string | undefined {
  if (osmType && osmId) {
    const path =
      osmType === "node" || osmType === "N"
        ? "node"
        : osmType === "way" || osmType === "W"
          ? "way"
          : osmType === "relation" || osmType === "R"
            ? "relation"
            : null;

    if (path) return `https://www.openstreetmap.org/${path}/${osmId}`;
  }

  return fallbackCenter ? buildOsmMapUrl(fallbackCenter, 13) : undefined;
}

function buildOsmMapUrl([lon, lat]: [number, number], zoom: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

function compactAddress(address: Record<string, string>): string {
  const candidates = [
    address.city,
    address.city_district,
    address.suburb,
    address.county,
    address.state,
    address.country,
  ].filter(Boolean);

  return candidates.length > 0 ? joinNatural(candidates as string[]) : "the resolved area";
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon;

  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error("[grounded-analysis] request failed", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function hash(input: string): number {
  let hashValue = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hashValue ^= input.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16777619);
  }
  return hashValue >>> 0;
}

function hexHash(input: string): string {
  return `0x${hash(input).toString(16)}…${hash(`${input}:tail`).toString(16).slice(0, 4)}`;
}
