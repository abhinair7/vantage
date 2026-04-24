import {
  matchPresetQuery,
  type AOI,
  type DemoResult,
  type Evidence,
  type Marker,
  type NarrativeChunk,
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
  type MeasurementIntent,
  type Subject,
} from "./query-intel";

const USER_AGENT = "Vantage/0.1 (+https://vantage-blond-nu.vercel.app)";
const REQUEST_TIMEOUT_MS = 6500;
const CONFIDENCE_FLOOR = 0.58;
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const RECENT_NEWS_WINDOW_HOURS = 168;
const BARE_LOOKUP_DISQUALIFIERS =
  /\b(?:worth|monitor|monitoring|track|tracking|verify|verification|confirm|check|checking|status|signal|signals|trend|trends|risk|disruption|throughput|traffic|activity|volume|utilization|utilisation|construction|growth|footprint|area|size|acreage|extent|sqm|sq\.?\s?m|m2|m²|square|hectare|hectares|ha|acre|acres|owner|owners|operator|operators|company|evidence|brief|decision|useful|important|real|exists|exist|legit|legitimate|safe|unsafe|now|today|since|over|under|during|last|past|next|total|current|latest|increased|decreased|change|changed|what|where|when|why|how|who)\b/i;
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
const SPECIFIC_FACILITY_TERMS = [
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
  "campus",
  "hospital",
  "university",
  "mall",
  "stadium",
];
const SITE_FOCUSED_QUERY_TERMS = [
  "airport",
  "airbase",
  "airfield",
  "aerodrome",
  "bus stand",
  "bus station",
  "bus terminal",
  "campus",
  "data center",
  "datacenter",
  "depot",
  "factory",
  "free zone",
  "freezone",
  "hospital",
  "industrial park",
  "logistics park",
  "mall",
  "power plant",
  "refinery",
  "shipyard",
  "stadium",
  "station",
  "terminal",
  "university",
  "warehouse",
];
const AREA_FOCUSED_QUERY_TERMS = [
  "free zone",
  "freezone",
  "industrial park",
  "logistics park",
  "campus",
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
  geometryType?: string;
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

type NewsArticle = {
  title: string;
  url: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  publishedTs: number;
  ageHours: number;
  relevance: number;
  placeMatched: boolean;
  topicMatched: boolean;
  queryScope: "place" | "admin" | "fallback" | "gdelt";
};

type NewsSnapshot = {
  articles: NewsArticle[];
  descriptor: string;
  dominantTheme: string;
  sourceNames: string[];
  freshestHours: number | null;
};

type EdgarFiling = {
  company: string;
  form: string;
  filedAt: string;
  url: string;
  cik: string;
};

type HazardHit = {
  kind: "earthquake" | "alert" | "disaster";
  summary: string;
  whenIso?: string;
  url?: string;
};

type AirqHit = {
  location: string;
  parameter: string;
  value: number;
  unit: string;
  when: string;
};

type PermitHit = {
  city: string;
  summary: string;
  when?: string;
  url?: string;
};

type EvidenceRefs = {
  place: string;
  context?: string;
  entity?: string;
  background?: string;
  news?: string[];
  filings?: string[];
  hazards?: string[];
  airq?: string[];
  permits?: string[];
};

type ContextSnapshot = {
  count: number;
  categoryMix: Array<[ContextCategory, number]>;
  topLabels: string[];
  nearest?: ContextFeature;
  descriptor: string;
};

export type AnalyzeOptions = {
  /**
   * Skip the Gatekeeper's confidence-floor / source-diversity short-circuit.
   * Set when the customer clicked "show analysis anyway" — a best-effort
   * narrative is produced instead of a withheld brief, and the result is
   * stamped with a visible disclaimer.
   */
  force?: boolean;
  /**
   * Run the broader-synthesis path: additionally query SEC EDGAR for
   * regulatory filings around the resolved place or its operator and fold
   * those hits into the evidence ledger and narrative.
   */
  deepen?: boolean;
};

export async function analyzeQuery(
  query: string,
  opts: AnalyzeOptions = {},
): Promise<DemoResult> {
  const preset = matchPresetQuery(query);
  if (preset) return preset;

  const grounded = await buildGroundedAnalysis(query, opts.force === true, opts.deepen === true);
  if (grounded) return grounded;

  return buildNoMatchResult(query);
}

async function buildGroundedAnalysis(
  query: string,
  force: boolean,
  deepen: boolean = false,
): Promise<DemoResult | null> {
  const mode = detectMode(query);
  const subject = detectSubject(query);
  const measurementIntent = detectMeasurementIntent(query);
  const place = await resolvePlace(query, subject, measurementIntent === "footprint");
  if (!place) return null;
  const barePlaceLookup = isBarePlaceLookupQuery(query, mode, measurementIntent);

  if (measurementIntent === "footprint") {
    const footprintResult = buildFootprintResult(query, mode, place);
    if (footprintResult) return footprintResult;
  }

  const [features, wikidata, news] = await Promise.all([
    fetchNearbyContext(place, subject),
    fetchWikidataProfile(place.wikidataId),
    fetchRegionalNews(query, place, subject),
  ]);

  const [filings, hazards, airq, permits] = deepen
    ? await Promise.all([
        fetchEdgarFilings(place, wikidata),
        fetchHazardSignals(place),
        fetchAirQuality(place),
        fetchPermitActivity(place),
      ])
    : [[] as EdgarFiling[], [] as HazardHit[], [] as AirqHit[], [] as PermitHit[]];

  const wiki = await fetchWikipediaBrief(place.wikipediaTag ?? wikidata?.wikipediaTag);
  const topFeatures = features.slice(0, 5);
  const context = summarizeContext(topFeatures);
  const confidence = scoreConfidence(place, topFeatures, wikidata, wiki, news);

  const hasSubstantiveContext =
    topFeatures.length > 0 ||
    Boolean(news?.articles.length) ||
    Boolean(wikidata?.instanceOf.length) ||
    Boolean(wikidata?.operators.length) ||
    Boolean(wikidata?.owners.length) ||
    Boolean(wiki);

  const belowFloor = !hasSubstantiveContext || confidence < CONFIDENCE_FLOOR;
  if (belowFloor && !force) {
    return buildWithheldResult(
      query,
      mode,
      subject,
      place,
      confidence,
      topFeatures.length,
      measurementIntent,
      news,
    );
  }
  const overrideApplied = belowFloor && force;

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

  const newsEvidenceIds =
    news?.articles.slice(0, 2).map((article, index) =>
      addEvidence({
        kind: "event",
        claim: `Recent local reporting flagged: ${article.title}`,
        source: `Google News / GDELT · ${article.source} · ${formatPublishedDate(article.publishedAt)}`,
        sourceUrl: article.url,
        hashSeed: `news:${query}:${article.url}:${index}`,
      }),
    ) ?? [];

  const filingEvidenceIds = filings.slice(0, 3).map((filing, index) =>
    addEvidence({
      kind: "event",
      claim: `SEC ${filing.form} on file for ${filing.company} — ${filing.filedAt}.`,
      source: `SEC EDGAR · Form ${filing.form} · filed ${filing.filedAt}`,
      sourceUrl: filing.url,
      hashSeed: `edgar:${query}:${filing.cik}:${filing.form}:${filing.filedAt}:${index}`,
    }),
  );

  const hazardEvidenceIds = hazards.slice(0, 4).map((h, index) => {
    const sourceLabel =
      h.kind === "earthquake"
        ? `USGS · M2.5+ within 200 km${h.whenIso ? ` · ${formatPublishedDate(h.whenIso)}` : ""}`
        : h.kind === "alert"
          ? `NOAA NWS · active alert${h.whenIso ? ` · ${formatPublishedDate(h.whenIso)}` : ""}`
          : `FEMA · disaster declaration${h.whenIso ? ` · ${formatPublishedDate(h.whenIso)}` : ""}`;
    return addEvidence({
      kind: "event",
      claim: h.summary,
      source: sourceLabel,
      sourceUrl: h.url,
      hashSeed: `hazard:${query}:${h.kind}:${index}:${h.summary}`,
    });
  });

  const airqEvidenceIds = airq.slice(0, 3).map((a, index) =>
    addEvidence({
      kind: "measurement",
      claim: `${a.parameter} reading ${a.value} ${a.unit} at ${a.location}.`,
      source: `OpenAQ · latest within 25 km · ${formatPublishedDate(a.when)}`,
      hashSeed: `airq:${query}:${a.location}:${a.parameter}:${index}`,
    }),
  );

  const permitEvidenceIds = permits.slice(0, 4).map((p, index) =>
    addEvidence({
      kind: "event",
      claim: p.summary,
      source: `${p.city} open-data portal${p.when ? ` · ${formatPublishedDate(p.when)}` : ""}`,
      sourceUrl: p.url,
      hashSeed: `permit:${query}:${p.city}:${index}:${p.summary}`,
    }),
  );

  const refs: EvidenceRefs = {
    place: placeEvidenceId,
    context: contextEvidenceId,
    entity: entityEvidenceId,
    background: backgroundEvidenceId,
    news: newsEvidenceIds,
    filings: filingEvidenceIds,
    hazards: hazardEvidenceIds,
    airq: airqEvidenceIds,
    permits: permitEvidenceIds,
  };

  // When recent local reporting exists, news leads the brief — everything
  // else becomes supporting context. That matches how a human analyst would
  // actually read the same evidence pack.
  const narrative: NarrativeChunk[] = news
    ? [
        {
          text: buildNewsLeadLine(place, subject, news),
          refs: compactRefs([...(refs.news ?? []), refs.place, refs.context]),
        },
        {
          text: buildOperatingPictureLine(place, subject, context, wikidata, wiki, news),
          refs: compactRefs([refs.place, refs.context, refs.entity, refs.background]),
        },
        {
          text: buildBusinessLine(mode, subject, place, context, wikidata, news, barePlaceLookup),
          refs: compactRefs([refs.context, refs.entity, refs.place, ...(refs.news ?? [])]),
        },
        {
          text: buildNextStepLine(mode, subject, topFeatures.length > 0, Boolean(wikidata), Boolean(news)),
          refs: compactRefs([refs.place, refs.context, refs.entity, refs.background, ...(refs.news ?? [])]),
        },
      ]
    : [
        {
          text: buildOperatingPictureLine(place, subject, context, wikidata, wiki, news),
          refs: compactRefs([refs.place, refs.context, refs.entity, refs.background]),
        },
        {
          text: buildBusinessLine(mode, subject, place, context, wikidata, news, barePlaceLookup),
          refs: compactRefs([refs.context, refs.entity, refs.place]),
        },
        {
          text: buildConfidenceLine(mode, confidence, topFeatures.length, Boolean(wikidata), Boolean(wiki), news),
          refs: compactRefs([refs.place, refs.context, refs.entity]),
        },
        {
          text: buildNextStepLine(mode, subject, topFeatures.length > 0, Boolean(wikidata), Boolean(news)),
          refs: compactRefs([refs.place, refs.context, refs.entity, refs.background]),
        },
      ];

  if (filings.length > 0) {
    const filingNames = Array.from(new Set(filings.slice(0, 3).map((f) => f.company)));
    const filingForms = Array.from(new Set(filings.slice(0, 3).map((f) => f.form)));
    narrative.push({
      title: "Regulatory timeline",
      text: `SEC EDGAR returns ${filings.length} matching filing${filings.length === 1 ? "" : "s"} (${filingForms.join(", ")}) tied to ${joinNatural(filingNames)}. These are the on-record public disclosures around the anchor, not press coverage — treat them as an audit trail, not a live operational read.`,
      refs: compactRefs([...(refs.filings ?? []), refs.entity, refs.place]),
    });
  }

  if (hazards.length > 0) {
    const heads = hazards.slice(0, 3).map((h) => h.summary);
    narrative.push({
      title: "Hazard and alert context",
      text: `${joinNatural(heads)}. Pulled from USGS (global seismic), NOAA (active US weather alerts), and FEMA (US disaster declarations). This is the free-source natural-hazard read for the anchor, not a full catastrophe model.`,
      refs: compactRefs([...(refs.hazards ?? []), refs.place]),
    });
  }

  if (airq.length > 0) {
    const lines = airq.slice(0, 3).map((a) => `${a.parameter} ${a.value} ${a.unit} (${a.location})`);
    narrative.push({
      title: "Air quality snapshot",
      text: `${joinNatural(lines)}. Latest OpenAQ readings within 25 km of the anchor. Treat as point-in-time sensor output — meaningful for near-term operational planning, not a long-run air-quality model.`,
      refs: compactRefs([...(refs.airq ?? []), refs.place]),
    });
  }

  if (permits.length > 0) {
    const cities = Array.from(new Set(permits.map((p) => p.city)));
    const samples = permits.slice(0, 3).map((p) => p.summary);
    narrative.push({
      title: "Permit activity",
      text: `${permits.length} recent permit record${permits.length === 1 ? "" : "s"} from ${joinNatural(cities)} — ${joinNatural(samples)}. Sourced from the city's open-data portal (Socrata). Useful as a construction-intensity and build-cycle signal around the anchor.`,
      refs: compactRefs([...(refs.permits ?? []), refs.place]),
    });
  }

  const baseMethodology = buildMethodology(
    subject,
    place,
    Boolean(wikidata),
    Boolean(wiki),
    Boolean(news),
  );
  const deepenBullets: string[] = [];
  if (filings.length > 0) {
    deepenBullets.push(
      `Consulted SEC EDGAR full-text search for regulatory filings around the anchor; ${filings.length} filing${filings.length === 1 ? "" : "s"} folded into the evidence ledger.`,
    );
  }
  if (hazards.length > 0) {
    deepenBullets.push(
      `Consulted USGS earthquakes, NOAA active alerts, and FEMA disaster declarations for natural-hazard context; ${hazards.length} hazard item${hazards.length === 1 ? "" : "s"} recorded.`,
    );
  }
  if (airq.length > 0) {
    deepenBullets.push(
      `Consulted OpenAQ for the latest air-quality sensor readings within 25 km of the anchor; ${airq.length} station reading${airq.length === 1 ? "" : "s"} recorded.`,
    );
  }
  if (permits.length > 0) {
    deepenBullets.push(
      `Consulted city open-data portals for recent permit activity; ${permits.length} permit record${permits.length === 1 ? "" : "s"} recorded.`,
    );
  }
  const withDeepenMethodology =
    deepenBullets.length > 0 ? [...baseMethodology, ...deepenBullets] : baseMethodology;
  const methodology = overrideApplied
    ? [
        "Evidence-floor override applied at the customer's request — the Gatekeeper would normally have withheld this brief.",
        ...withDeepenMethodology,
        `Auto-computed confidence landed at ${Math.round(confidence * 100)}%, below the 58% floor Vantage uses for decision-grade output.`,
      ]
    : withDeepenMethodology;
  const reportedConfidence = overrideApplied
    ? Number(Math.min(confidence, CONFIDENCE_FLOOR - 0.01).toFixed(2))
    : confidence;

  return {
    id: `grounded_${hash(query).toString(16)}${overrideApplied ? "_override" : ""}`,
    query,
    headline: buildHeadline(mode, subject, place, context, confidence, Boolean(wikidata), news, barePlaceLookup),
    narrative,
    evidence,
    aoi: buildAoi(place, topFeatures, refs),
    confidence: reportedConfidence,
    mode,
    tookMs:
      2500 +
      topFeatures.length * 140 +
      (wikidata ? 260 : 0) +
      (wiki ? 200 : 0) +
      (news ? 280 : 0),
    methodology,
    kind: "answer",
    notice: overrideApplied
      ? "Best-effort read — the Gatekeeper would have withheld this brief because the evidence floor was not cleared. Do not use as decision-grade without a second pass."
      : undefined,
    overrideApplied: overrideApplied || undefined,
    anchor: { label: place.name, center: place.center },
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

  if (queryHasAreaFocus(query.toLowerCase())) {
    const expansions = buildAddressExpansionQueries(candidates, query);
    for (const hint of expansions) {
      const normalized = hint.trim().toLowerCase();
      if (!normalized || seenQueries.has(normalized)) continue;
      seenQueries.add(normalized);

      const matches = await fetchNominatimSearch(hint, includeGeometry);
      candidates.push(...matches);
    }
  }

  if (candidates.length === 0) {
    const fuzzyQueries = buildSoftenedPlaceQueries(queries);
    for (const hint of fuzzyQueries) {
      const normalized = hint.trim().toLowerCase();
      if (!normalized || seenQueries.has(normalized)) continue;
      seenQueries.add(normalized);

      const matches = await fetchNominatimSearch(hint, includeGeometry);
      candidates.push(...matches);
    }
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

function buildAddressExpansionQueries(
  candidates: NominatimPlace[],
  query: string,
): string[] {
  const lowerQuery = query.toLowerCase();
  const expansions = new Set<string>();

  for (const candidate of candidates) {
    for (const value of Object.values(candidate.address ?? {})) {
      const normalized = value.trim();
      if (
        normalized &&
        candidateNameMatchesQueryAreaFocus(
          lowerQuery,
          normalized.toLowerCase(),
          normalized,
        )
      ) {
        expansions.add(normalized);
      }
    }
  }

  return Array.from(expansions).sort((a, b) => b.length - a.length);
}

function buildSoftenedPlaceQueries(queries: string[]): string[] {
  const variants = new Set<string>();

  for (const query of queries) {
    const softened = softenPlaceSpelling(query);
    if (softened && softened.toLowerCase() !== query.trim().toLowerCase()) {
      variants.add(softened);
    }
  }

  return Array.from(variants);
}

function softenPlaceSpelling(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const softened = trimmed.replace(/([bdgkpt])h/gi, "$1");
  return softened !== trimmed ? softened : null;
}

async function fetchNominatimSearch(
  query: string,
  includeGeometry = false,
): Promise<NominatimPlace[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "8",
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

async function fetchRegionalNews(
  query: string,
  place: ResolvedPlace,
  subject: Subject,
): Promise<NewsSnapshot | null> {
  const topicTerms = buildNewsTopicTerms(query, subject, place);
  const queries = buildNewsSearchQueries(place, topicTerms);
  const googleBatches = await Promise.all(
    queries.map((candidate) => fetchGoogleNewsArticles(candidate.query, candidate.scope)),
  );
  const collected = googleBatches.flat();

  if (collected.length < 3) {
    const gdeltQuery = buildGdeltSearchQuery(place, topicTerms);
    if (gdeltQuery) {
      const gdeltArticles = await fetchGdeltArticles(gdeltQuery);
      collected.push(...gdeltArticles);
    }
  }

  const ranked = rankNewsArticles(collected, place, topicTerms, subject).slice(0, 4);
  if (ranked.length === 0) return null;

  const freshestHours = ranked[0]?.ageHours ?? null;
  const dominantTheme = inferNewsTheme(ranked, subject);
  const descriptor = buildNewsDescriptor(place, ranked, dominantTheme);

  return {
    articles: ranked,
    descriptor,
    dominantTheme,
    sourceNames: Array.from(new Set(ranked.map((article) => article.source))).slice(0, 3),
    freshestHours,
  };
}

function buildNewsTopicTerms(
  query: string,
  subject: Subject,
  place: ResolvedPlace,
): string[] {
  const lower = query.toLowerCase();
  const prioritized =
    subject === "traffic"
      ? ["traffic", "congestion", "closure", "transit", "crash"]
      : subject === "power"
        ? ["power", "outage", "grid"]
        : subject === "port" || subject === "vessel"
          ? ["port", "shipping", "cargo"]
          : subject === "construction"
            ? ["construction", "expansion", "project"]
            : [];

  if (prioritized.length > 0) {
    return Array.from(
      new Set(prioritized.filter((term) => lower.includes(term) || prioritized[0] === term)),
    ).slice(0, 5);
  }

  const placeTokens = buildPlaceTokenSet(place);
  return Array.from(
    new Set(
      lower
        .split(/[^a-z0-9]+/)
        .filter(
          (token) =>
            token.length >= 4 &&
            !placeTokens.has(token) &&
            !BARE_LOOKUP_DISQUALIFIERS.test(token),
        ),
    ),
  ).slice(0, 3);
}

function buildNewsSearchQueries(
  place: ResolvedPlace,
  topicTerms: string[],
): Array<{ query: string; scope: NewsArticle["queryScope"] }> {
  const queries: Array<{ query: string; scope: NewsArticle["queryScope"] }> = [];
  const seen = new Set<string>();
  const topicalVariants = topicTerms.length > 0 ? topicTerms.slice(0, 3) : [""];
  const adminCandidates = Array.from(
    new Set(
      [
        place.address.city,
        place.address.town,
        place.address.village,
        place.address.municipality,
        place.address.city_district,
        place.address.county,
        place.address.state,
        place.address.suburb,
      ]
        .filter(Boolean)
        .map((value) => value?.trim() ?? "")
        .filter((value) => value && value.toLowerCase() !== place.name.toLowerCase()),
    ),
  );

  const push = (raw: string, scope: NewsArticle["queryScope"]) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ query: cleaned, scope });
  };

  topicalVariants.forEach((topic) => {
    push(`"${place.name}"${topic ? ` ${topic}` : ""}`, "place");
  });
  adminCandidates.slice(0, 2).forEach((candidate) => {
    topicalVariants.slice(0, 2).forEach((topic) => {
      push(`"${candidate}"${topic ? ` ${topic}` : ""}`, "admin");
    });
  });
  push(`"${place.name}"`, "fallback");

  return queries;
}

async function fetchGoogleNewsArticles(
  query: string,
  scope: NewsArticle["queryScope"],
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  const xml = await fetchText(`${GOOGLE_NEWS_RSS}?${params.toString()}`);
  if (!xml) return [];

  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
    .slice(0, 8)
    .map((match) => parseGoogleNewsItem(match[1], scope))
    .filter((article): article is NewsArticle => Boolean(article));
}

function parseGoogleNewsItem(
  xml: string,
  scope: NewsArticle["queryScope"],
): NewsArticle | null {
  const title = readXmlTag(xml, "title");
  const url = readXmlTag(xml, "link");
  const publishedRaw = readXmlTag(xml, "pubDate");
  const sourceMatch = xml.match(/<source(?:\s+url="([^"]+)")?>([\s\S]*?)<\/source>/i);
  const source = decodeXmlEntities(sourceMatch?.[2] ?? "Google News");
  const sourceUrl = sourceMatch?.[1] ? decodeXmlEntities(sourceMatch[1]) : undefined;
  const publishedAt = normalizeDateString(publishedRaw);
  if (!title || !url || !publishedAt) return null;

  return {
    title: cleanNewsTitle(title),
    url,
    source,
    sourceUrl,
    publishedAt,
    publishedTs: new Date(publishedAt).getTime(),
    ageHours: ageHoursFrom(publishedAt),
    relevance: 0,
    placeMatched: false,
    topicMatched: false,
    queryScope: scope,
  };
}

async function fetchGdeltArticles(query: string): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: "6",
    sort: "DateDesc",
  });

  const response = await fetchJson<{
    articles?: Array<{
      url?: string;
      title?: string;
      seendate?: string;
      domain?: string;
    }>;
  }>(`${GDELT_DOC_API}?${params.toString()}`);

  return (response?.articles ?? []).flatMap((article) => {
      const publishedAt = normalizeDateString(article.seendate);
      if (!article.title || !article.url || !publishedAt) return [];

      return [{
        title: cleanNewsTitle(article.title),
        url: article.url,
        source: article.domain ?? "GDELT",
        sourceUrl: article.domain ? `https://${article.domain}` : undefined,
        publishedAt,
        publishedTs: new Date(publishedAt).getTime(),
        ageHours: ageHoursFrom(publishedAt),
        relevance: 0,
        placeMatched: false,
        topicMatched: false,
        queryScope: "gdelt" as const,
      }];
    });
}

async function fetchEdgarFilings(
  place: ResolvedPlace,
  wikidata: WikidataProfile | null,
): Promise<EdgarFiling[]> {
  // Prefer named operators/owners when the place is a known asset; fall back
  // to the place name so the search still runs for generic sites.
  const candidates: string[] = [];
  if (wikidata?.operators?.length) candidates.push(...wikidata.operators.slice(0, 2));
  if (wikidata?.owners?.length) candidates.push(...wikidata.owners.slice(0, 2));
  if (candidates.length === 0) candidates.push(place.name);

  const seen = new Set<string>();
  const filings: EdgarFiling[] = [];

  for (const candidate of candidates) {
    if (filings.length >= 4) break;
    const term = candidate.trim();
    if (!term || term.length < 3) continue;

    const params = new URLSearchParams({
      q: `"${term}"`,
      forms: "10-K,10-Q,8-K,20-F,6-K",
    });
    const response = await fetchJson<{
      hits?: {
        hits?: Array<{
          _id?: string;
          _source?: {
            display_names?: string[];
            file_date?: string;
            form?: string;
            adsh?: string;
            ciks?: string[];
          };
        }>;
      };
    }>(`https://efts.sec.gov/LATEST/search-index?${params.toString()}&hits=5`);

    const hits = response?.hits?.hits ?? [];
    for (const hit of hits) {
      if (filings.length >= 4) break;
      const src = hit._source;
      if (!src?.adsh || !src.ciks?.[0] || !src.form || !src.file_date) continue;
      const key = src.adsh;
      if (seen.has(key)) continue;
      seen.add(key);

      const cikInt = String(Number(src.ciks[0])); // strip leading zeros
      const adshNoDashes = src.adsh.replace(/-/g, "");
      const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}&type=${encodeURIComponent(src.form)}&dateb=&owner=include&count=10`;
      filings.push({
        company: src.display_names?.[0]?.replace(/\s*\(CIK\s+\d+\)\s*$/i, "").trim() ?? term,
        form: src.form,
        filedAt: src.file_date,
        url,
        cik: cikInt,
      });
    }
  }

  return filings;
}

async function fetchHazardSignals(place: ResolvedPlace): Promise<HazardHit[]> {
  const [lon, lat] = place.center;
  const countryCode = (place.address.country_code || "").toLowerCase();
  const isUs = countryCode === "us";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const tasks: Array<Promise<HazardHit[]>> = [];

  // USGS Earthquakes — global
  tasks.push((async () => {
    const params = new URLSearchParams({
      format: "geojson",
      starttime: thirtyDaysAgo,
      latitude: String(lat),
      longitude: String(lon),
      maxradiuskm: "200",
      minmagnitude: "2.5",
      orderby: "time",
      limit: "4",
    });
    const r = await fetchJson<{
      features?: Array<{
        properties?: { mag?: number; place?: string; time?: number; url?: string };
      }>;
    }>(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`);
    return (r?.features ?? []).flatMap((f) => {
      const p = f.properties;
      if (!p || p.mag == null || !p.time) return [];
      return [{
        kind: "earthquake" as const,
        summary: `M${p.mag.toFixed(1)} earthquake${p.place ? ` — ${p.place}` : ""}`,
        whenIso: new Date(p.time).toISOString(),
        url: p.url,
      }];
    });
  })());

  if (isUs) {
    // NOAA active alerts at point
    tasks.push((async () => {
      const r = await fetchJson<{
        features?: Array<{
          id?: string;
          properties?: {
            event?: string;
            severity?: string;
            sent?: string;
            areaDesc?: string;
          };
        }>;
      }>(`https://api.weather.gov/alerts/active?point=${lat},${lon}`);
      return (r?.features ?? []).slice(0, 3).flatMap((f) => {
        const p = f.properties;
        if (!p || !p.event) return [];
        const area = p.areaDesc ? p.areaDesc.split(";")[0].trim() : "";
        return [{
          kind: "alert" as const,
          summary: `${p.severity ? `${p.severity} ` : ""}${p.event}${area ? ` — ${area}` : ""}`,
          whenIso: p.sent,
          url: f.id,
        }];
      });
    })());

    // OpenFEMA recent disaster declarations (by state)
    const stateCode = usStateCode(place.address);
    if (stateCode) {
      tasks.push((async () => {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const params = new URLSearchParams({
          $filter: `state eq '${stateCode}' and declarationDate gt '${ninetyDaysAgo}T00:00:00.000z'`,
          $orderby: "declarationDate desc",
          $top: "3",
          $select: "declarationTitle,incidentType,declarationDate,designatedArea,disasterNumber",
        });
        const r = await fetchJson<{
          DisasterDeclarationsSummaries?: Array<{
            declarationTitle?: string;
            incidentType?: string;
            declarationDate?: string;
            designatedArea?: string;
            disasterNumber?: number;
          }>;
        }>(`https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${params.toString()}`);
        return (r?.DisasterDeclarationsSummaries ?? []).flatMap((d) => {
          if (!d.declarationTitle) return [];
          return [{
            kind: "disaster" as const,
            summary: `${d.incidentType ?? "Declared disaster"} — ${d.declarationTitle}${d.designatedArea ? ` (${d.designatedArea})` : ""}`,
            whenIso: d.declarationDate,
            url: d.disasterNumber
              ? `https://www.fema.gov/disaster/${d.disasterNumber}`
              : undefined,
          }];
        });
      })());
    }
  }

  const settled = await Promise.all(tasks);
  return settled.flat().slice(0, 5);
}

async function fetchAirQuality(place: ResolvedPlace): Promise<AirqHit[]> {
  const [lon, lat] = place.center;
  const r = await fetchJson<{
    results?: Array<{
      location?: string;
      city?: string;
      measurements?: Array<{
        parameter?: string;
        value?: number;
        unit?: string;
        lastUpdated?: string;
      }>;
    }>;
  }>(`https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=25000&limit=3`);
  return (r?.results ?? []).flatMap((loc) => {
    const measurement = (loc.measurements ?? []).find(
      (m) => m.parameter && m.value != null && m.unit && m.lastUpdated,
    );
    if (!measurement) return [];
    return [{
      location: loc.location || loc.city || "Nearby station",
      parameter: (measurement.parameter || "").toUpperCase(),
      value: measurement.value!,
      unit: measurement.unit!,
      when: measurement.lastUpdated!,
    }];
  });
}

async function fetchPermitActivity(place: ResolvedPlace): Promise<PermitHit[]> {
  const addr = place.address;
  const city = (addr.city || addr.town || addr.municipality || addr.borough || "").toLowerCase();
  const state = (addr.state || "").toLowerCase();

  type PermitSource = {
    matches: boolean;
    endpoint: string;
    portalUrl: string;
    cityLabel: string;
    mapper: (row: Record<string, unknown>) => PermitHit | null;
  };

  const asString = (v: unknown) => (typeof v === "string" ? v : undefined);

  const sources: PermitSource[] = [
    {
      matches:
        state.includes("new york") &&
        /new york|manhattan|brooklyn|queens|bronx|staten/i.test(city),
      cityLabel: "New York (DOB Now)",
      endpoint:
        "https://data.cityofnewyork.us/resource/rbx6-tga4.json?$limit=3&$order=approved_date DESC",
      portalUrl: "https://www.nyc.gov/site/buildings/dob/dob-now.page",
      mapper: (r) => {
        const when = asString(r.approved_date);
        const work = asString(r.work_type) || "Building work";
        const house = asString(r.house__) || asString(r.house_no) || "";
        const street = asString(r.street_name) || "";
        const loc = `${house} ${street}`.trim();
        return {
          city: "New York (DOB Now)",
          summary: `${work}${loc ? ` at ${loc}` : ""}`.trim(),
          when,
          url: "https://www.nyc.gov/site/buildings/dob/dob-now.page",
        };
      },
    },
    {
      matches: state.includes("california") && /san francisco/i.test(city),
      cityLabel: "San Francisco (DBI)",
      endpoint:
        "https://data.sfgov.org/resource/i98e-djp9.json?$limit=3&$order=filed_date DESC",
      portalUrl: "https://dbi-eservices.sfgov.org/PermitPortal",
      mapper: (r) => {
        const when = asString(r.filed_date);
        const type = asString(r.permit_type_definition) || asString(r.permit_type) || "Permit";
        const desc = asString(r.description);
        return {
          city: "San Francisco (DBI)",
          summary: `${type}${desc ? ` — ${desc.slice(0, 140)}` : ""}`,
          when,
          url: "https://dbi-eservices.sfgov.org/PermitPortal",
        };
      },
    },
    {
      matches: state.includes("illinois") && /chicago/i.test(city),
      cityLabel: "Chicago (Building Permits)",
      endpoint:
        "https://data.cityofchicago.org/resource/ydr8-5enu.json?$limit=3&$order=issue_date DESC",
      portalUrl: "https://webapps1.chicago.gov/buildingrecords/",
      mapper: (r) => {
        const when = asString(r.issue_date);
        const type = asString(r.permit_type) || "Permit";
        const desc = asString(r.work_description);
        return {
          city: "Chicago (Building Permits)",
          summary: `${type}${desc ? ` — ${desc.slice(0, 140)}` : ""}`,
          when,
          url: "https://webapps1.chicago.gov/buildingrecords/",
        };
      },
    },
    {
      matches: state.includes("washington") && /seattle/i.test(city),
      cityLabel: "Seattle (SDCI)",
      endpoint:
        "https://data.seattle.gov/resource/76t5-zqzr.json?$limit=3&$order=applieddate DESC",
      portalUrl: "https://cosaccela.seattle.gov/portal/",
      mapper: (r) => {
        const when = asString(r.applieddate);
        const type = asString(r.permittype) || "Permit";
        const desc = asString(r.description);
        return {
          city: "Seattle (SDCI)",
          summary: `${type}${desc ? ` — ${desc.slice(0, 140)}` : ""}`,
          when,
          url: "https://cosaccela.seattle.gov/portal/",
        };
      },
    },
    {
      matches: state.includes("california") && /los angeles/i.test(city),
      cityLabel: "Los Angeles (LADBS)",
      endpoint:
        "https://data.lacity.org/resource/yv23-pmwf.json?$limit=3&$order=issue_date DESC",
      portalUrl: "https://www.ladbs.org/services/online-services/permit-report",
      mapper: (r) => {
        const when = asString(r.issue_date);
        const type = asString(r.permit_type) || "Permit";
        const desc = asString(r.work_description) || asString(r.use_desc);
        return {
          city: "Los Angeles (LADBS)",
          summary: `${type}${desc ? ` — ${desc.slice(0, 140)}` : ""}`,
          when,
          url: "https://www.ladbs.org/services/online-services/permit-report",
        };
      },
    },
  ];

  const active = sources.filter((s) => s.matches);
  if (active.length === 0) return [];

  const results = await Promise.all(
    active.map((s) =>
      fetchJson<Array<Record<string, unknown>>>(s.endpoint).then(
        (rows) => ({ source: s, rows: rows ?? [] }),
      ),
    ),
  );

  return results.flatMap(({ source, rows }) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => source.mapper(r))
      .filter((hit): hit is PermitHit => hit !== null);
  });
}

function usStateCode(address: Record<string, string>): string | null {
  const iso = address["ISO3166-2-lvl4"];
  if (iso && iso.toUpperCase().startsWith("US-")) return iso.slice(3).toUpperCase();
  const name = (address.state || "").toLowerCase();
  if (!name) return null;
  return US_STATE_CODES[name] || null;
}

const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI",
  idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME",
  maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function buildGdeltSearchQuery(place: ResolvedPlace, topicTerms: string[]): string | null {
  const cityLike =
    place.address.city ||
    place.address.town ||
    place.address.village ||
    place.address.municipality ||
    place.address.city_district ||
    place.address.county ||
    place.address.suburb;

  const location = cityLike && cityLike.toLowerCase() !== place.name.toLowerCase() ? cityLike : place.name;
  if (!location) return null;

  const topic = topicTerms[0];
  return topic ? `"${location}" AND ${topic}` : `"${location}"`;
}

function rankNewsArticles(
  articles: NewsArticle[],
  place: ResolvedPlace,
  topicTerms: string[],
  subject: Subject,
): NewsArticle[] {
  const placeTokens = buildPlaceTokenSet(place);
  const adminTokens = buildAdminTokenSet(place.address);
  const requiresTopic = topicTerms.length > 0;

  const deduped = new Map<string, NewsArticle>();
  for (const article of articles) {
    const key = article.url.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, article);
  }

  return Array.from(deduped.values())
    .map((article) => {
      const titleHaystack = article.title.toLowerCase();
      const titleTokens = significantTokens(titleHaystack);
      const placeMatched = intersects(placeTokens, titleTokens);
      const adminMatched = intersects(adminTokens, titleTokens);
      const topicMatched = topicTerms.some((term) => titleHaystack.includes(term.toLowerCase()));

      let relevance = 0;
      if (article.queryScope === "place") relevance += 0.55;
      else if (article.queryScope === "admin") relevance += 0.35;
      else if (article.queryScope === "gdelt") relevance += 0.22;
      else relevance += 0.18;

      if (placeMatched) relevance += 0.58;
      else if (adminMatched) relevance += 0.28;

      if (topicMatched) relevance += 0.78;
      else if (requiresTopic) relevance -= 0.62;

      if (subject === "traffic") {
        if (/\bclosure|advisory|lane|congestion|transit|mbta|road\b/.test(titleHaystack)) {
          relevance += 0.24;
        }
        if (/\btraffic stop|suspect|shooting|killed|arrested\b/.test(titleHaystack)) {
          relevance -= 0.38;
        }
      }

      if (article.ageHours <= 24) relevance += 0.42;
      else if (article.ageHours <= 72) relevance += 0.28;
      else if (article.ageHours <= RECENT_NEWS_WINDOW_HOURS) relevance += 0.14;
      else if (article.ageHours > 24 * 45) relevance -= 0.45;
      if (article.ageHours > 24 * 365) relevance -= 0.9;

      if (/\.(gov|edu)\b/i.test(article.sourceUrl ?? "")) relevance += 0.12;

      return {
        ...article,
        relevance: Number(relevance.toFixed(2)),
        placeMatched,
        topicMatched,
      };
    })
    .filter((article) => article.relevance >= 0.82)
    .sort((a, b) => b.relevance - a.relevance || a.ageHours - b.ageHours)
    .slice(0, 4);
}

function buildNewsDescriptor(
  place: ResolvedPlace,
  articles: NewsArticle[],
  dominantTheme: string,
): string {
  const lead = articles[0];
  const scope =
    place.address.city ||
    place.address.town ||
    place.address.village ||
    place.address.suburb ||
    titleCase(place.name);
  if (!lead) {
    return `recent local reporting around ${scope} stayed too thin to characterize`;
  }

  const recency =
    lead.ageHours <= 24
      ? "within the last day"
      : lead.ageHours <= 72
        ? "within the last three days"
        : "within the last week";

  return `${articles.length} recent local articles ${recency} point to ${dominantTheme}, led by ${lead.title}.`;
}

function inferNewsTheme(articles: NewsArticle[], subject: Subject): string {
  const combined = articles.map((article) => article.title.toLowerCase()).join(" ");

  if (subject === "traffic") {
    if (/\bflood|storm|weather\b/.test(combined)) return "weather-linked road disruption";
    if (/\bcrash|collision|tractor-trailer|fatal\b/.test(combined)) return "incident-driven traffic disruption";
    if (/\bmarathon|advisory|closure|lane\b/.test(combined)) return "access advisories and road closures";
    if (/\btransit|mbta|rail\b/.test(combined)) return "transit-led mobility pressure";
    return "current mobility and access constraints";
  }

  if (/\bfire|explosion|evacuation\b/.test(combined)) return "public safety disruption";
  if (/\bpower|outage|blackout\b/.test(combined)) return "energy and utility disruption";
  if (/\bconstruction|project|expansion\b/.test(combined)) return "active build-out and infrastructure work";
  return "current local operating conditions";
}

function buildPlaceTokenSet(place: ResolvedPlace): Set<string> {
  const tokens = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    significantTokens(value).forEach((token) => tokens.add(token));
  };

  add(place.name);
  add(place.displayName.split(",")[0]);
  Object.values(place.address).forEach(add);
  return tokens;
}

function buildAdminTokenSet(address: Record<string, string>): Set<string> {
  const tokens = new Set<string>();
  [
    address.suburb,
    address.city,
    address.city_district,
    address.county,
    address.state,
    address.country,
  ]
    .filter(Boolean)
    .forEach((value) => {
      significantTokens(value ?? "").forEach((token) => tokens.add(token));
    });

  return tokens;
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function readXmlTag(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  return decodeXmlEntities(match?.[1] ?? "");
}

function cleanNewsTitle(value: string): string {
  return decodeXmlEntities(value)
    .replace(/\s+-\s+Google News$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeDateString(value?: string): string | null {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const compact = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!compact) return null;

  const [, year, month, day, hour, minute, second] = compact;
  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
  ).toISOString();
}

function ageHoursFrom(dateString: string): number {
  return Math.max(0, (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60));
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

  const scored = Array.from(unique.values())
    .map((candidate) => ({
      candidate,
      score: scorePlaceCandidate(candidate, query, subject),
    }));

  const lowerQuery = query.toLowerCase();
  const strongSpecific = queryHasSiteFocus(lowerQuery)
    ? scored.filter(({ candidate }) => isStrongSpecificCandidate(candidate, query, subject))
    : [];
  const nonSubfeatureSpecific = strongSpecific.filter(
    ({ candidate }) => !looksLikeSubfeatureCandidate(candidate, lowerQuery),
  );
  const pool =
    nonSubfeatureSpecific.length > 0
      ? nonSubfeatureSpecific
      : strongSpecific.length > 0
        ? strongSpecific
        : scored;

  const ranked = pool.sort((a, b) => b.score - a.score);

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
  const stationGlyphMatch = lowerQuery.includes("station") && /駅/.test(candidate.display_name);
  const explicitSiteMatch = candidateMatchesQuerySiteFocus(
    lowerQuery,
    text,
    candidate.display_name,
  );
  const areaNameMatch = candidateNameMatchesQueryAreaFocus(
    lowerQuery,
    name,
    candidate.display_name,
  );
  const siteFocusedQuery = queryHasSiteFocus(lowerQuery);
  const areaFocusedQuery = queryHasAreaFocus(lowerQuery);
  const queryTokens = Array.from(significantTokens(lowerQuery));
  const candidateTokens = significantTokens(text);
  const tokenOverlap = queryTokens.filter((token) => candidateTokens.has(token)).length;

  let score = candidate.importance ?? 0;

  if (name && lowerQuery.includes(name)) {
    const wordCount = name.split(/\s+/).filter(Boolean).length;
    score += 0.55 + Math.min(1.05, wordCount * 0.3);
  }
  if (tokenOverlap > 0 && queryTokens.length > 0) {
    const coverage = tokenOverlap / queryTokens.length;
    score += Math.min(0.62, tokenOverlap * 0.18 + coverage * 0.34);
  }
  if (placeMatchesSubject(className, typeName, subject, text)) score += 1.8;
  if (isSpecificSiteCandidate(className, typeName)) score += 0.35;
  if (subject === "traffic" && isSpecificSiteCandidate(className, typeName)) score += 0.28;
  if (explicitSiteMatch) score += stationGlyphMatch ? 3.1 : 1.15;
  if (areaFocusedQuery && areaNameMatch) score += 1.2;
  if (className === "boundary" || typeName === "administrative" || typeName === "city") score += 0.5;
  if (className === "place" && (typeName === "city" || typeName === "town" || typeName === "village")) score += 0.7;
  const broadCandidate = isBroadCandidate(candidate);
  if (broadCandidate) score -= 0.4;
  else score += 0.1;
  if (siteFocusedQuery && broadCandidate) score -= 1.35;
  if (subject === "facility" && broadCandidate && queryContainsSpecificFacilityTerm(lowerQuery)) {
    score -= 1.1;
  }
  if (siteFocusedQuery && looksLikeSubfeatureCandidate(candidate, lowerQuery)) {
    score -= 1.05;
  }
  if (areaFocusedQuery && !areaNameMatch) {
    score -= 1.35;
  }

  if (!explicitSiteMatch && looksLikeStreetLevelCandidate(identityText, className, typeName)) score -= 2.6;
  if (
    !explicitSiteMatch &&
    !placeMatchesSubject(className, typeName, subject, text) &&
    looksLikeStreetLevelCandidate(identityText, className, typeName)
  ) {
    score -= 0.6;
  }

  return score;
}

function significantTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(
        (token) =>
          token.length >= 3 &&
          !BARE_LOOKUP_DISQUALIFIERS.test(token) &&
          !["the", "and", "for", "with", "from", "near", "into"].includes(token),
      ),
  );
}

function queryHasSiteFocus(query: string): boolean {
  return SITE_FOCUSED_QUERY_TERMS.some((term) => query.includes(term));
}

function queryHasAreaFocus(query: string): boolean {
  return AREA_FOCUSED_QUERY_TERMS.some((term) => query.includes(term));
}

function isStrongSpecificCandidate(
  candidate: NominatimPlace,
  query: string,
  subject: Subject,
): boolean {
  const lowerQuery = query.toLowerCase();
  const name =
    (candidate.name || candidate.display_name.split(",")[0]?.trim() || "").toLowerCase();
  const className = (candidate.class ?? candidate.category ?? "").toLowerCase();
  const typeName = candidate.type?.toLowerCase() ?? candidate.addresstype?.toLowerCase() ?? "";
  const text = `${name} ${typeName} ${candidate.display_name}`.toLowerCase();

  if (isBroadCandidate(candidate)) return false;
  if (candidateMatchesQuerySiteFocus(lowerQuery, text, candidate.display_name)) return true;
  if (isSpecificSiteCandidate(className, typeName)) return true;
  if (placeMatchesSubject(className, typeName, subject, text)) return true;

  return (
    queryContainsSpecificFacilityTerm(lowerQuery) &&
    /airport|airbase|airfield|aerodrome|terminal|depot|free zone|freezone|industrial park|logistics park|campus|hospital|university|stadium|mall|warehouse|factory|shipyard|refinery|power plant|data center|datacenter/.test(
      text,
    )
  );
}

function looksLikeSubfeatureCandidate(candidate: NominatimPlace, query: string): boolean {
  const name = candidate.name ?? "";
  const text = `${name} ${candidate.display_name}`;

  if (!/[;()]/.test(name) && !/\b(exit|entrance|gate|platform|concourse)\b/i.test(text) && !/出入口/.test(text)) {
    return false;
  }

  return !/[;()]/.test(query) && !/\b(exit|entrance|gate|platform|concourse)\b/i.test(query) && !/出入口/.test(query);
}

function candidateMatchesQuerySiteFocus(
  query: string,
  text: string,
  displayName: string,
): boolean {
  if (query.includes("station") && /駅/.test(displayName)) return true;

  return SITE_FOCUSED_QUERY_TERMS.some(
    (term) => query.includes(term) && text.includes(term),
  );
}

function candidateNameMatchesQueryAreaFocus(
  query: string,
  name: string,
  displayName: string,
): boolean {
  const displayHead = displayName.split(",")[0]?.trim().toLowerCase() ?? displayName.toLowerCase();

  return AREA_FOCUSED_QUERY_TERMS.some(
    (term) => query.includes(term) && (name.includes(term) || displayHead.includes(term)),
  );
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
    case "traffic":
      return (
        contains([
          "university",
          "campus",
          "station",
          "terminal",
          "airport",
          "hospital",
          "downtown",
          "junction",
          "interchange",
        ]) ||
        isSpecificSiteCandidate(className, typeName) ||
        className === "place" ||
        className === "boundary"
      );
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

function queryContainsSpecificFacilityTerm(query: string): boolean {
  return SPECIFIC_FACILITY_TERMS.some((term) => query.includes(term));
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
    case "traffic":
      return ["traffic", "transit", "junction", "interchange", "campus", "station"];
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
    case "traffic":
      return ["campus", "station", "terminal", "downtown", "university"];
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
    geometryType: place.geojson?.type,
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
  if (!place.geometry) {
    if (place.geometryType && place.geometryType !== "Point" && place.geometryType !== "MultiPoint") {
      return buildGeometryUnavailableResult(query, mode, place);
    }
    return null;
  }
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
    anchor: { label: place.name, center: place.center },
  };
}

function buildGeometryUnavailableResult(
  query: string,
  mode: AnalysisMode,
  place: ResolvedPlace,
): DemoResult {
  const placeLabel = titleCase(place.name);

  return {
    id: `footprint_unavailable_${hash(query).toString(16)}`,
    query,
    headline: `${placeLabel} resolved, but the current public map record does not include an areal footprint.`,
    narrative: [
      {
        text: `${placeLabel} matched as a specific mapped place, but the available OpenStreetMap geometry is ${place.geometryType?.toLowerCase() ?? "non-areal"} rather than a polygon. That means Vantage can anchor the location, but it cannot honestly compute a surface-area footprint from this public record alone.`,
        refs: ["e1"],
      },
      {
        text: "This is still useful because the location itself is no longer ambiguous. The limitation is geometric, not geocoding-related.",
        refs: ["e1"],
      },
      {
        text: "Best next step: use a recent satellite image or another polygon-bearing source to trace the station, terminal, or campus boundary before quoting area.",
        refs: [],
      },
    ],
    evidence: [
      {
        id: "e1",
        kind: "entity",
        claim: `${placeLabel} resolved to a specific map object, but that object is stored as ${place.geometryType?.toLowerCase() ?? "non-areal"} geometry rather than a polygon.`,
        source: `OpenStreetMap geometry · ${place.className}/${place.typeName}`,
        sourceUrl: place.sourceUrl,
        hash: hexHash(`footprint-unavailable:${query}:${place.osmType}:${place.osmId}:${place.geometryType}`),
      },
    ],
    aoi: {
      center: place.center,
      zoom: Math.min(16.4, chooseZoom(place.bbox) + 0.8),
      polygons: [
        {
          label: placeLabel,
          date: "Resolved location",
          coords: buildPlacePolygonCoords(place),
          accent: "current",
          evidenceRef: "e1",
        },
      ],
      evidenceFocus: {
        e1: {
          center: place.center,
          zoom: Math.min(16.8, chooseZoom(place.bbox) + 1),
        },
      },
    },
    confidence: 0.69,
    mode,
    tookMs: 1500,
    methodology: [
      "Resolved the place with OpenStreetMap Nominatim.",
      "The returned map object is non-areal geometry, so no square-metre footprint was computed.",
      "This is an honest geometry limitation, not a failure to identify the location.",
      "Best next step: use imagery or another polygon-bearing source to draw the footprint.",
    ],
    kind: "insufficient",
    anchor: { label: place.name, center: place.center },
  };
}

function buildHeadline(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  context: ContextSnapshot,
  confidence: number,
  hasWikidata: boolean,
  news: NewsSnapshot | null,
  barePlaceLookup: boolean,
): string {
  const site = titleCase(place.name);
  const confidenceLabel = confidence >= 0.75 ? "high-confidence" : "decision-usable";
  const contextLine =
    context.count > 0
      ? `${context.count} nearby operating signals support the read`
      : news
        ? "recent local reporting adds live context even though the mapped surround is thin"
        : "place resolution is clear but the surrounding context is still thin";

  if (barePlaceLookup && news) {
    return `Current watchline for ${site}: ${news.dominantTheme} is showing up in recent local reporting, which makes the location usable as a monitoring frame rather than just a geocode.`;
  }

  if (subject === "traffic" && news) {
    return `Operational access around ${site} deserves attention: recent local reporting points to ${news.dominantTheme}, and the location now resolves cleanly enough for a live mobility brief.`;
  }

  if (mode === "verify") {
    return `Proceed to diligence: ${site} resolves as a real ${subjectLabel(subject)} location, and the free-source stack produced a ${confidenceLabel} validation read. ${contextLine}.`;
  }

  if (mode === "monitor") {
    return `Add ${site} to the watchlist: the site is grounded well enough for recurring monitoring, but this single free-source pass should frame the question, not overclaim the trend.`;
  }

  return `Escalate selectively on ${site}: the site resolves cleanly, the surrounding asset base makes the question commercially legible, and the current read is ${confidenceLabel} enough for triage rather than a final memo.${hasWikidata ? "" : " Entity metadata is still limited, so treat this as operating context first."}`;
}

function buildNewsLeadLine(
  place: ResolvedPlace,
  subject: Subject,
  news: NewsSnapshot,
): string {
  const site = titleCase(place.name);
  const top = news.articles[0];
  const freshness =
    news.freshestHours == null
      ? "recent"
      : news.freshestHours < 1
        ? "just in"
        : news.freshestHours < 24
          ? `${Math.max(1, Math.round(news.freshestHours))}h ago`
          : `${Math.round(news.freshestHours / 24)}d ago`;
  const sourcesLine =
    news.sourceNames.length > 0
      ? `${joinNatural(news.sourceNames)} are the sources carrying it`
      : "multiple independent outlets are carrying it";
  const subjectHint = subjectLabel(subject);
  const headline = top?.title
    ? `"${top.title.replace(/\s+/g, " ").trim()}"`
    : news.descriptor;

  return `The live read on ${site} right now is ${news.dominantTheme}. The freshest local item, ${freshness}, reads ${headline}, and ${sourcesLine}. This is the part of the brief that actually moves a ${subjectHint} decision today — map data and entity graphs round it out, they don't replace it.`;
}

function buildOperatingPictureLine(
  place: ResolvedPlace,
  subject: Subject,
  context: ContextSnapshot,
  wikidata: WikidataProfile | null,
  wiki: WikiBrief | null,
  news: NewsSnapshot | null,
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
  const newsLine = news ? ` Recent local reporting adds live context: ${news.descriptor}` : "";

  return `${typeLine}${contextLine}${entityLine}${backgroundLine}${newsLine ? ` ${newsLine}` : ""}`;
}

function buildBusinessLine(
  mode: AnalysisMode,
  subject: Subject,
  place: ResolvedPlace,
  context: ContextSnapshot,
  wikidata: WikidataProfile | null,
  news: NewsSnapshot | null,
  barePlaceLookup: boolean,
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
  const newsLine = news
    ? ` Recent local coverage points to ${news.dominantTheme}, which is the live signal that makes the brief useful right now.`
    : "";

  if (mode === "verify") {
    return `For diligence, the value is simple: this is a concrete operating location, not a registry ghost. ${nearestLine}, which makes the site economically legible before you spend time on counterparties, sanctions, or ownership-chain follow-up.${entityLine}${newsLine}`;
  }

  if (mode === "monitor") {
    return `For monitoring, this clears the first gate. ${site} is specific enough to revisit on a schedule, and ${nearestLine}, which tells you where pressure, throughput, or change would show up first once recurring imagery or traffic feeds are added.${entityLine}${newsLine}`;
  }

  if (barePlaceLookup && news) {
    return `For triage, the useful move is not to ask for another generic description of ${site}. The live value is that recent reporting already frames ${news.dominantTheme}, so this location can go straight onto a watchlist or into field-planning decisions.${entityLine}`;
  }

  if (subject === "traffic") {
    return `For operations, this is an access-and-timing question rather than a static site lookup. ${news ? `Recent reporting points to ${news.dominantTheme}, which means arrival windows, route planning, and commute assumptions deserve immediate attention.` : `${nearestLine}, which helps show where access pressure would be felt first.`}${entityLine}`;
  }

  switch (subject) {
    case "port":
    case "vessel":
      return `For a commercial read, this looks like a routing and throughput question rather than a simple existence check. ${nearestLine}, which is where freight pressure or dwell-time risk would likely surface first.${entityLine}${newsLine}`;
    case "storage":
    case "refinery":
    case "power":
      return `For a market read, this looks like an asset where surrounding infrastructure matters almost as much as the site itself. ${nearestLine}, which frames how quickly a change here could turn into inventory, dispatch, or basis consequences.${entityLine}${newsLine}`;
    default:
      return `For triage, ${site} is specific enough to prioritize. ${nearestLine}, which helps decide whether this belongs on a diligence queue, an operating watchlist, or the discard pile.${entityLine}${newsLine}`;
  }
}

function buildConfidenceLine(
  mode: AnalysisMode,
  confidence: number,
  featureCount: number,
  hasWikidata: boolean,
  hasWiki: boolean,
  news: NewsSnapshot | null,
): string {
  const confidencePercent = Math.round(confidence * 100);
  const sourceMix = [
    "place resolution",
    featureCount > 0 ? "open-map operating context" : null,
    news ? "recent regional news" : null,
    hasWikidata ? "entity graph data" : null,
    hasWiki ? "public background text" : null,
  ].filter(Boolean) as string[];

  const limit =
    mode === "monitor"
      ? "What this does not support yet is a hard time-series claim from one pass. Recurring EO, AIS, or ADS-B is still the honest next layer."
      : news
        ? "What this still does not support is a direct satellite-observed object count or a continuous sensor time series. The live signal here is public reporting layered on top of place resolution."
        : "What this does not support yet is a hard claim about recent activity, throughput, or ownership completeness without deeper collection.";

  return `Confidence is ${confidencePercent}%, driven by ${joinNatural(sourceMix)}. That is strong enough for decision support at the triage layer, but not strong enough to pretend the free stack replaces scheduled imagery, registry pulls, or human diligence. ${limit}`;
}

function buildNextStepLine(
  mode: AnalysisMode,
  subject: Subject,
  hasContext: boolean,
  hasWikidata: boolean,
  hasNews: boolean,
): string {
  const collectionLine = hasContext
    ? "Use this brief to choose where the next hour of analyst time should go."
    : hasNews
      ? "Use this as a live location brief rather than a dead-end lookup."
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

  if (subject === "traffic") {
    return `${collectionLine} Next, add a live traffic or transit feed plus recurring imagery before you make hard calls on throughput, accessibility, or disruption duration.`;
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
  hasNews: boolean,
): string[] {
  return [
    `Resolved the place with OpenStreetMap Nominatim and used the returned ${place.className}/${place.typeName} object to frame the AOI.`,
    `Scanned nearby public map features with Overpass and ranked them for a ${subjectLabel(subject)} question by proximity and relevance.`,
    hasNews
      ? "Pulled recent regional reporting from Google News RSS and GDELT to add live local context when the place could be tied to current public coverage."
      : "No current regional news signal cleared the relevance floor, so the brief leaned on place, map, and entity context only.",
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
  measurementIntent: MeasurementIntent | null,
  news: NewsSnapshot | null,
): DemoResult {
  const placeLabel = titleCase(place.name);
  const barePlaceLookup = isBarePlaceLookupQuery(query, mode, measurementIntent);
  const placeEvidenceId = "e1";
  const refs: EvidenceRefs = { place: placeEvidenceId };
  const evidence: Evidence[] = [
    {
      id: placeEvidenceId,
      kind: "entity",
      claim: `${placeLabel} resolved to a canonical map object with a bounded area of interest.`,
      source: `OpenStreetMap Nominatim · ${place.className}/${place.typeName}`,
      sourceUrl: place.sourceUrl,
      hash: hexHash(`withheld-geo:${query}:${place.displayName}`),
    },
  ];
  const admin = compactAddress(place.address);

  return {
    id: `withheld_${hash(query).toString(16)}`,
    query,
    headline: barePlaceLookup
      ? news
        ? `${placeLabel} resolves cleanly, and recent local reporting was found, but the exact decision brief is still too loose to make a confident call.`
        : `${placeLabel} resolves to a mapped ${place.typeName.replace(/_/g, " ")} in ${admin}, but the prompt does not yet specify what to assess there.`
      : `Place match found for ${placeLabel}, but the evidence floor for a ${subjectLabel(subject)} brief was not met.`,
    narrative: [
      {
        text: barePlaceLookup
          ? news
            ? `${placeLabel} resolves cleanly on the map as ${place.className}/${place.typeName} in ${admin}, and there is current local reporting in the area. The brief still stopped short because the prompt is too open-ended to choose one decision frame without overreaching.`
            : `${placeLabel} resolves cleanly on the map as ${place.className}/${place.typeName} in ${admin}. The public stack can validate the place and anchor it on the map, but this prompt does not yet ask a concrete operational, strategic, or measurement question about it.`
          : `${placeLabel} resolved cleanly on the map, but the free-source stack did not return enough surrounding context to support a decision brief. The system withheld the call instead of padding the gap with generated certainty.`,
        refs: [placeEvidenceId],
      },
      {
        text: barePlaceLookup
          ? news
            ? `Best next step: anchor the place to an operating frame such as traffic, power, construction, safety, or footprint. Right now the system can see live local context, but it still needs the decision lens.`
            : `Best next step: ask about a specific site, road, facility, footprint, operator, or trend inside ${placeLabel}. That gives Vantage something decision-grade to test instead of only geocoding the locality.`
          : `Confidence only reached ${Math.round(confidence * 100)}%. The limiting factor was source depth, not prose. ${featureCount > 0 ? `A few nearby signals appeared, but not enough to make the operating picture decision-grade.` : news ? "Some current local reporting was available, but it did not tie tightly enough to the exact site or decision frame." : "The surrounding map context stayed too thin to move beyond place validation."}`,
        refs: barePlaceLookup ? [placeEvidenceId] : [],
      },
    ],
    evidence,
    aoi: buildAoi(place, [], refs),
    confidence: Number(confidence.toFixed(2)),
    mode,
    tookMs: 2100,
    methodology: [
      "Resolved the location with OpenStreetMap Nominatim.",
      "Tried to enrich with open-map context, recent regional news, public entity metadata, and public background sources.",
      "The evidence mix did not clear the confidence floor, so the brief was withheld.",
      "Best next step: narrow the location, add the operator name, or switch to a collection path with recurring EO or registry data.",
    ],
    kind: "insufficient",
    anchor: { label: place.name, center: place.center },
  };
}

function isBarePlaceLookupQuery(
  query: string,
  mode: AnalysisMode,
  measurementIntent: MeasurementIntent | null,
): boolean {
  const trimmed = query.trim();
  if (!trimmed || mode !== "investigate" || measurementIntent) return false;
  if (extractCoordinates(trimmed)) return false;
  if (BARE_LOOKUP_DISQUALIFIERS.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 6;
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
      ...(refs.news
        ? Object.fromEntries(
            refs.news.map((id) => [
              id,
              {
                center: place.center,
                zoom: chooseZoom(place.bbox) + 0.3,
              },
            ]),
          )
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

  if (subject === "traffic") {
    selectors.push(
      `way${around}["highway"~"motorway|trunk|primary|secondary"];`,
      `nwr${around}["highway"="motorway_junction"];`,
      `nwr${around}["highway"="traffic_signals"];`,
      `nwr${around}["public_transport"];`,
      `nwr${around}["amenity"~"bus_station|parking"];`,
      `nwr${around}["railway"~"station|halt|tram_stop"];`,
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
    case "traffic":
      return Number(
        Boolean(
          tags.highway === "motorway_junction" ||
            tags.highway === "traffic_signals" ||
            highwayRank(tags.highway) > 0 ||
            railway === "station" ||
            railway === "tram_stop" ||
            tags.public_transport ||
            tags.amenity === "bus_station" ||
            tags.amenity === "parking",
        ),
      ) * 11;
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
  if (highwayRank(tags.highway) > 0 || tags.highway === "traffic_signals" || tags.public_transport) {
    return "transport";
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
  if (tags.highway) return `${tags.highway.replace(/_/g, " ")} corridor`;
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

function highwayRank(highway?: string): number {
  switch (highway) {
    case "motorway":
      return 4;
    case "trunk":
      return 3;
    case "primary":
      return 2;
    case "secondary":
      return 1;
    default:
      return 0;
  }
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
  news: NewsSnapshot | null,
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
  if (news) score += 0.07;
  if (news && news.articles.length >= 2) score += 0.04;
  if (news?.freshestHours !== null && news?.freshestHours !== undefined) {
    if (news.freshestHours <= 24) score += 0.05;
    else if (news.freshestHours <= 72) score += 0.03;
  }

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
    case "traffic":
      return 2600;
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

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;
    return await response.text();
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
