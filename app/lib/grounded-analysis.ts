import { matchPresetQuery, type AOI, type DemoResult, type Evidence, type Marker } from "./demo-results";
import {
  detectMode,
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

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  class?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
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
};

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type ContextFeature = {
  id: string;
  label: string;
  descriptor: string;
  coord: [number, number];
  score: number;
  markerKind: Marker["kind"];
};

type WikiBrief = {
  title: string;
  extract: string;
  url?: string;
};

export async function analyzeQuery(query: string): Promise<DemoResult> {
  const preset = matchPresetQuery(query);
  if (preset) return preset;

  const grounded = await buildGroundedAnalysis(query);
  if (grounded) return grounded;

  return {
    id: `insufficient_${hash(query).toString(16)}`,
    query,
    headline: "Not enough grounded context to make a business-grade call yet.",
    narrative: [
      {
        text:
          "The free-source stack could not resolve a reliable place or operating context from this prompt. I would rather stop here than invent a map, an operator, or a trend that the evidence does not support.",
        refs: [],
      },
    ],
    evidence: [],
    confidence: 0,
    mode: detectMode(query),
    tookMs: 2100,
    methodology: [
      "Tried public geocoding and open-map context first.",
      "No grounded place match cleared the confidence floor, so the analysis was withheld.",
      "Best next step: add a clearer place name, coordinates, or the operator name.",
    ],
    kind: "insufficient",
  };
}

async function buildGroundedAnalysis(query: string): Promise<DemoResult | null> {
  const mode = detectMode(query);
  const subject = detectSubject(query);
  const place = await resolvePlace(query);
  if (!place) return null;

  const [features, wiki] = await Promise.all([
    fetchNearbyContext(place, subject),
    fetchWikipediaBrief(place.wikipediaTag),
  ]);

  const topFeatures = features.slice(0, 4);
  const featureCount = features.length;
  const confidence = Number(
    Math.min(0.78, 0.54 + topFeatures.length * 0.04 + (wiki ? 0.06 : 0.02)).toFixed(2),
  );

  const evidence: Evidence[] = [];
  evidence.push({
    id: "e1",
    kind: "entity",
    claim: `${place.name} resolved to a canonical map object.`,
    source: `OpenStreetMap Nominatim · ${place.className}/${place.typeName}`,
    hash: hexHash(`geo:${query}:${place.displayName}`),
  });

  if (topFeatures.length > 0) {
    evidence.push({
      id: "e2",
      kind: "measurement",
      claim: `${topFeatures.length} relevant nearby assets found around the AOI.`,
      source: "OpenStreetMap Overpass · nearby infrastructure scan",
      hash: hexHash(`osm:${query}:${topFeatures.map((feature) => feature.label).join("|")}`),
    });
  }

  if (wiki) {
    evidence.push({
      id: "e3",
      kind: "event",
      claim: `${wiki.title} public description used for context.`,
      source: "Wikipedia · public background summary",
      hash: hexHash(`wiki:${wiki.title}:${wiki.extract}`),
    });
  }

  const refsForContext = evidence.filter((item) => item.id !== "e3").map((item) => item.id);
  const refsForMarket = evidence.slice(-2).map((item) => item.id);
  const refsForAction = evidence.map((item) => item.id);

  const summaryLine = buildSiteContextLine(place, subject, topFeatures);
  const wikiLine = wiki
    ? ` Public reference material describes the site or region as ${wiki.extract.replace(/\s+/g, " ").trim()}.`
    : "";

  const narrative = [
    {
      text: `${summaryLine}.${wikiLine}`,
      refs: refsForContext,
    },
    {
      text: buildBusinessLine(mode, subject, place, topFeatures, featureCount),
      refs: refsForMarket,
    },
    {
      text: buildActionLine(mode, subject, topFeatures.length > 0),
      refs: refsForAction,
    },
  ];

  return {
    id: `grounded_${hash(query).toString(16)}`,
    query,
    headline: buildHeadline(mode, subject, place, featureCount, Boolean(wiki)),
    narrative,
    evidence,
    aoi: buildAoi(place, topFeatures),
    confidence,
    mode,
    tookMs: 2600 + topFeatures.length * 180 + (wiki ? 220 : 0),
    methodology: [
      "Geocoded the place with OpenStreetMap Nominatim and drew the AOI from its returned bounding box.",
      "Scanned nearby open-map infrastructure with the Overpass API to ground the commercial context around the site.",
      wiki
        ? "Added public background context from Wikipedia when the place carried a linked article."
        : "No linked Wikipedia context was available, so the brief stayed inside map-grounded evidence only.",
      "This free path is good for location validation and strategic triage, not for claiming precise throughput or recent change without recurring EO or AIS data.",
    ],
    kind: "answer",
  };
}

async function resolvePlace(query: string): Promise<ResolvedPlace | null> {
  const coords = extractCoordinates(query);
  if (coords) {
    const reverse = await fetchNominatimReverse(coords[0], coords[1]);
    if (reverse) return normalizePlace(reverse);
  }

  const hints = extractLocationHints(query);
  for (const hint of hints) {
    const place = await fetchNominatimSearch(hint);
    if (place) return normalizePlace(place);
  }

  const fullQueryPlace = await fetchNominatimSearch(query);
  return fullQueryPlace ? normalizePlace(fullQueryPlace) : null;
}

async function fetchNominatimSearch(query: string): Promise<NominatimPlace | null> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    extratags: "1",
  });
  const results = await fetchJson<NominatimPlace[]>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
  );
  return results?.[0] ?? null;
}

async function fetchNominatimReverse(lat: number, lon: number): Promise<NominatimPlace | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "16",
    addressdetails: "1",
    extratags: "1",
  });
  return fetchJson<NominatimPlace>(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
  );
}

async function fetchNearbyContext(place: ResolvedPlace, subject: Subject): Promise<ContextFeature[]> {
  const radius = radiusForSubject(subject);
  const [lon, lat] = place.center;
  const query = `
[out:json][timeout:20];
(
  nwr(around:${radius},${lat},${lon})["landuse"="industrial"];
  nwr(around:${radius},${lat},${lon})["industrial"];
  nwr(around:${radius},${lat},${lon})["man_made"];
  nwr(around:${radius},${lat},${lon})["power"];
  nwr(around:${radius},${lat},${lon})["railway"];
  nwr(around:${radius},${lat},${lon})["aeroway"];
  nwr(around:${radius},${lat},${lon})["waterway"];
  nwr(around:${radius},${lat},${lon})["harbour"];
);
out center tags 32;
`;

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
    .map((element) => mapElementToFeature(element, subject))
    .filter((feature): feature is ContextFeature => Boolean(feature))
    .sort((a, b) => b.score - a.score);

  const unique = new Map<string, ContextFeature>();
  for (const feature of features) {
    const key = `${feature.label.toLowerCase()}-${feature.markerKind}`;
    if (!unique.has(key)) unique.set(key, feature);
  }

  return Array.from(unique.values()).slice(0, 8);
}

async function fetchWikipediaBrief(tag?: string): Promise<WikiBrief | null> {
  if (!tag || !tag.includes(":")) return null;

  const [lang, rawTitle] = tag.split(":");
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

function normalizePlace(place: NominatimPlace): ResolvedPlace {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const [south, north, west, east] = place.boundingbox
    ? place.boundingbox.map(Number)
    : [lat - 0.02, lat + 0.02, lon - 0.02, lon + 0.02];

  return {
    name: place.display_name.split(",")[0]?.trim() || "the resolved site",
    displayName: place.display_name,
    center: [lon, lat],
    bbox: [south, north, west, east],
    className: place.class ?? "place",
    typeName: place.type ?? "site",
    address: place.address ?? {},
    wikipediaTag: place.extratags?.wikipedia,
    wikidataId: place.extratags?.wikidata,
  };
}

function buildHeadline(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  featureCount: number,
  hasWiki: boolean,
): string {
  const site = titleCase(place.name);
  const context = featureCount > 0 ? `${featureCount} supporting signals found nearby` : "location resolved cleanly";

  if (mode === "verify") {
    return `${site} resolves as a real ${subjectLabel(subject)} target. ${context}; this is worth deeper diligence, not dismissal.`;
  }

  if (mode === "monitor") {
    return `${site} is a valid monitoring target. ${context}, but the free stack supports context before it supports a hard trend call.`;
  }

  return `${site} is commercially relevant enough to investigate. ${context}${hasWiki ? " and public background context lines up." : "."}`;
}

function buildSiteContextLine(place: ResolvedPlace, subject: Subject, features: ContextFeature[]): string {
  const site = titleCase(place.name);
  const admin = compactAddress(place.address);
  const featureSummary =
    features.length > 0
      ? `Open-map infrastructure around the AOI includes ${joinNatural(features.slice(0, 3).map((feature) => feature.descriptor))}`
      : "The surrounding open-map footprint is sparse, so the brief leans mainly on place resolution rather than nearby asset context";

  return `${site} resolves to ${admin}. The map object is tagged as ${place.className}/${place.typeName}, which is directionally consistent with a ${subjectLabel(subject)} question. ${featureSummary}`;
}

function buildBusinessLine(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  features: ContextFeature[],
  featureCount: number,
): string {
  const site = titleCase(place.name);
  const supporting = featureCount > 0 ? joinNatural(features.slice(0, 2).map((feature) => feature.label)) : "the surrounding asset base";

  if (mode === "verify") {
    return `From a diligence lens, this is enough to confirm that ${site} is a concrete operating location, not just a registry artifact. ${supporting} make the site economically legible, which is exactly the threshold you want before spending time on ownership, sanctions, or supplier follow-on work.`;
  }

  if (mode === "monitor") {
    return `From a monitoring lens, ${site} now clears the first gate: it is specific, map-grounded, and surrounded by signals that matter to the business question. ${supporting} tell you where congestion, throughput, or expansion pressure would likely surface first once you add recurring imagery or traffic feeds.`;
  }

  switch (subject) {
    case "port":
    case "vessel":
      return `From a commercial lens, the surrounding maritime footprint suggests a question tied to capacity, dwell, or routing rather than simple site existence. ${supporting} are the choke points to watch because that is where operational pressure turns into freight-rate or delivery-risk consequences.`;
    case "storage":
    case "refinery":
    case "power":
      return `From a market lens, this looks like an asset where infrastructure context matters almost as much as the site itself. ${supporting} frame how quickly a change here could translate into inventory, dispatch, or basis implications for downstream decisions.`;
    default:
      return `From a business lens, ${site} is specific enough to prioritize. ${supporting} make the site strategically legible, which helps decide whether this is a real diligence target, a watchlist candidate, or something to drop before spending more analyst time.`;
  }
}

function buildActionLine(mode: AnalysisMode, subject: Subject, hasContext: boolean): string {
  const contextClause = hasContext
    ? "Use this brief to decide whether the site deserves recurring EO, registry pulls, or partner outreach."
    : "Use this brief as a location-validation pass before committing any deeper work.";

  if (mode === "verify") {
    return `${contextClause} The free stack is strong enough to validate location and operating context, but it is not strong enough to certify ownership chain completeness or recent on-the-ground activity without additional registry and imagery passes.`;
  }

  if (mode === "monitor") {
    return `${contextClause} What it should not do is pretend to quantify a time-series change from one free lookup. For a defensible monitor, the next layer is scheduled imagery, AIS or ADS-B where relevant, and a fixed comparison window.`;
  }

  if (subject === "construction" || subject === "port" || subject === "storage") {
    return `${contextClause} For change-sensitive questions like this one, the next honest step is time-series imagery rather than narrative polish. The map now tells you where to point that deeper collection.`;
  }

  return `${contextClause} The current free path is deliberately conservative: enough to support triage, not enough to support a hard numerical claim about throughput, output, or recent change.`;
}

function buildAoi(place: ResolvedPlace, features: ContextFeature[]): AOI {
  const [south, north, west, east] = place.bbox;
  const coords: [number, number][] = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
    [west, north],
  ];

  const markers: Marker[] = features.slice(0, 5).map((feature, index) => ({
    id: `m${index + 1}`,
    kind: feature.markerKind,
    coord: feature.coord,
    evidenceRef: "e2",
    label: feature.label,
  }));

  return {
    center: place.center,
    zoom: chooseZoom(place.bbox),
    polygons: [
      {
        label: titleCase(place.name),
        date: "Grounded context",
        coords,
        accent: "current",
        evidenceRef: "e1",
      },
    ],
    markers,
    evidenceFocus: {
      e1: { center: place.center, zoom: chooseZoom(place.bbox) + 0.4 },
      e2: {
        center: features[0]?.coord ?? place.center,
        zoom: Math.min(16.8, chooseZoom(place.bbox) + 1.1),
      },
      e3: { center: place.center, zoom: chooseZoom(place.bbox) + 0.2 },
    },
  };
}

function mapElementToFeature(element: OverpassElement, subject: Subject): ContextFeature | null {
  const tags = element.tags ?? {};
  const coord = readElementCoord(element);
  if (!coord) return null;

  const score = scoreFeature(tags, subject);
  if (score <= 0) return null;

  const label = tags.name || tags.operator || tags.brand || inferDescriptor(tags);
  return {
    id: String(element.id),
    label,
    descriptor: inferDescriptor(tags),
    coord,
    score,
    markerKind: inferMarkerKind(tags, subject),
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

  switch (subject) {
    case "port":
    case "vessel":
      return Number(
        Boolean(tags.harbour || waterway === "dock" || manMade === "pier" || industrial === "port" || landuse === "industrial"),
      ) * 10;
    case "storage":
      return Number(Boolean(manMade === "storage_tank" || manMade === "silo" || industrial === "storage" || industrial === "tank_farm")) * 10;
    case "refinery":
      return Number(Boolean(industrial === "refinery" || manMade === "storage_tank" || landuse === "industrial")) * 10;
    case "airport":
    case "airbase":
    case "aircraft":
      return Number(Boolean(aeroway || tags.military === "airfield" || tags.aerodrome)) * 10;
    case "railway":
      return Number(Boolean(railway)) * 10;
    case "power":
      return Number(Boolean(power || tags.generator)) * 10;
    case "mine":
    case "quarry":
      return Number(Boolean(landuse === "quarry" || industrial === "mine" || tags.natural === "bare_rock")) * 10;
    default:
      return Number(Boolean(industrial || landuse === "industrial" || manMade || power || railway || aeroway)) * 8;
  }
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

function readElementCoord(element: OverpassElement): [number, number] | null {
  if (typeof element.lon === "number" && typeof element.lat === "number") {
    return [element.lon, element.lat];
  }
  if (element.center && typeof element.center.lon === "number" && typeof element.center.lat === "number") {
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
      return 6000;
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

function compactAddress(address: Record<string, string>): string {
  const candidates = [
    address.city,
    address.county,
    address.state,
    address.country,
  ].filter(Boolean);

  return candidates.length > 0 ? joinNatural(candidates as string[]) : "the resolved area";
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
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
