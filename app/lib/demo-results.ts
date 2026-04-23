/**
 * Pre-baked demo analyses.
 * Each result is what Vantage would return — narrative with inline evidence refs,
 * evidence ledger with sources/timestamps, AOI polygon(s), confidence score.
 *
 * In the real system these come from the 10-node pipeline. Here they're static
 * fixtures so the prototype is a working demo without live API dependencies.
 */

export type Evidence = {
  id: string;           // short id used in narrative refs
  kind: "image" | "sar" | "ais" | "event" | "entity" | "measurement";
  claim: string;        // short human claim
  source: string;       // source + timestamp line
  sourceUrl?: string;   // optional public URL for the cited source
  hash: string;         // SHA-like string — audit trail
};

export type Polygon = {
  label: string;
  date: string;
  coords: [number, number][]; // [lon, lat] ring, closed
  accent: "current" | "previous";
  evidenceRef?: string;       // which evidence record this polygon backs
};

export type Marker = {
  id: string;
  kind: "vessel" | "tank" | "beacon";
  coord: [number, number];
  evidenceRef?: string;
  label?: string;
  fill?: number;              // 0..1 — used by tank shadow glyph
};

export type AOI = {
  center: [number, number]; // [lon, lat]
  zoom: number;
  polygons: Polygon[];
  markers?: Marker[];
  /** optional point to fly to when the user clicks a given evidence id */
  evidenceFocus?: Record<string, { center: [number, number]; zoom?: number }>;
};

export type NarrativeChunk = {
  text: string;
  refs: string[];
};

export type DemoResult = {
  id: string;
  query: string;
  headline: string;        // the one-sentence answer
  narrative: NarrativeChunk[];
  aoi?: AOI;
  evidence: Evidence[];
  confidence: number;      // 0..1
  mode: "investigate" | "verify" | "monitor";
  tookMs: number;          // simulated processing time
  methodology: string[];   // bullets shown under "how this was computed"
  kind: "answer" | "insufficient";
};

export type AnalysisRunProfile = {
  id: string;
  tookMs: number;
};

/* ------------------------------------------------------------------
   Primary demo: Mundra Port construction
   ------------------------------------------------------------------ */

const MUNDRA: DemoResult = {
  id: "mundra_construction_6mo",
  query: "Has construction at Mundra Port increased over the last 6 months?",
  headline:
    "Yes. The western container terminal has grown ~320 m of new quay since October, and it's already being worked.",
  mode: "investigate",
  tookMs: 2840,
  confidence: 0.86,
  narrative: [
    {
      text:
        "The western terminal is in active expansion. Quay footprint along the container berth is up about 8.4% since October — roughly 320 metres of new hardstand extending the existing alignment, not a redevelopment. The work is continuous rather than staged, and the new surface is already hard: no signs of graded earth, no patches of unfinished apron. ",
      refs: ["e1", "e2", "e3"],
    },
    {
      text:
        "The new berths are already in service. Vessel calls across the terminal are up roughly 22% year-on-year, and four of the five new positions carried ships inside the last month — so the capacity is being used, not staged. ",
      refs: ["e4"],
    },
    {
      text:
        "The picture matches the money. Adani runs the concession through APSEZ, and its most recent filing puts ₹1,880 cr into container-capacity buildout — the quay extension and the capex line belong to the same story. ",
      refs: ["e5", "e6"],
    },
  ],
  aoi: {
    center: [69.708, 22.745],
    zoom: 13.2,
    polygons: [
      {
        label: "Oct 2024 footprint",
        date: "2024-10-11",
        accent: "previous",
        evidenceRef: "e1",
        coords: [
          [69.6985, 22.7455],
          [69.7045, 22.7456],
          [69.7046, 22.7420],
          [69.6986, 22.7418],
          [69.6985, 22.7455],
        ],
      },
      {
        label: "Feb 2025 footprint",
        date: "2025-02-03",
        accent: "current",
        evidenceRef: "e2",
        coords: [
          [69.6978, 22.7462],
          [69.7085, 22.7465],
          [69.7087, 22.7410],
          [69.6980, 22.7408],
          [69.6978, 22.7462],
        ],
      },
    ],
    markers: [
      // Synthetic AIS berth occupancy — five vessels along the new quay edge
      { id: "v1", kind: "vessel", coord: [69.6995, 22.7458], evidenceRef: "e4", label: "MSC OSCAR · berth 1" },
      { id: "v2", kind: "vessel", coord: [69.7020, 22.7459], evidenceRef: "e4", label: "COSCO SHIPPING · berth 2" },
      { id: "v3", kind: "vessel", coord: [69.7045, 22.7460], evidenceRef: "e4", label: "CMA CGM MARCO · berth 3" },
      { id: "v4", kind: "vessel", coord: [69.7070, 22.7461], evidenceRef: "e4", label: "EVER ACE · berth 4" },
      { id: "v5", kind: "vessel", coord: [69.7081, 22.7449], evidenceRef: "e4", label: "MAERSK HONAM · berth 5" },
    ],
    evidenceFocus: {
      e1: { center: [69.7015, 22.7437], zoom: 14.4 },
      e2: { center: [69.7032, 22.7436], zoom: 14.4 },
      e3: { center: [69.7055, 22.7440], zoom: 14.2 },
      e4: { center: [69.7035, 22.7459], zoom: 14.8 },
      e5: { center: [69.708, 22.745], zoom: 13.6 },
      e6: { center: [69.708, 22.745], zoom: 13.4 },
    },
  },
  evidence: [
    {
      id: "e1",
      kind: "image",
      claim: "Sentinel-2 L2A — 2024-10-11 baseline.",
      source: "Copernicus Open Access Hub · tile T42QZK · band B8",
      hash: "0xa7f2…c4e1",
    },
    {
      id: "e2",
      kind: "image",
      claim: "Sentinel-2 L2A — 2025-02-03 comparison.",
      source: "Copernicus Open Access Hub · tile T42QZK · Clay v0.4 segmentation",
      hash: "0xb301…f019",
    },
    {
      id: "e3",
      kind: "sar",
      claim: "Sentinel-1 GRD — 2025-03-19 SAR corroboration.",
      source: "Copernicus · VV polarization · 20 m",
      hash: "0x9c10…2b07",
    },
    {
      id: "e4",
      kind: "ais",
      claim: "Berth-occupancy dwell-time aggregation.",
      source: "AISStream · geofence 22.74°N 69.70°E · dwell ≥ 3 h · 30 d window",
      hash: "0x3e18…a902",
    },
    {
      id: "e5",
      kind: "event",
      claim: "Adani Ports Q1 FY25 investor filing excerpt.",
      source: "GDELT · CORP_FINANCE_QUARTERLY · doc 0x8a3f",
      hash: "0x8a3f…7111",
    },
    {
      id: "e6",
      kind: "entity",
      claim: "Ownership chain: APSEZL → Adani Ports & SEZ → Q786408.",
      source: "OpenCorporates · Wikidata · 2-hop ownership edges",
      hash: "0x0be7…1104",
    },
  ],
  methodology: [
    "Clay v0.4 foundation model applied to Sentinel-2 L2A for built-up delta.",
    "SAR backscatter Δ computed against a 90-day rolling baseline.",
    "AIS dwell-time aggregation geofenced to the AOI, excluding ships-at-anchor.",
    "Ownership chain validated by 2 independent sources (OpenCorporates + Wikidata).",
  ],
  kind: "answer",
};

/* ------------------------------------------------------------------
   Secondary demo: Cushing oil storage
   ------------------------------------------------------------------ */

const CUSHING: DemoResult = {
  id: "cushing_oil_storage",
  query: "Has oil storage at Cushing, Oklahoma changed since March?",
  headline:
    "Cushing is drawing down. Roughly 4.2 million barrels have come off the hub since early March.",
  mode: "monitor",
  tookMs: 2410,
  confidence: 0.79,
  narrative: [
    {
      text:
        "The hub is running leaner. Across the 17 tracked floating-roof tanks, mean fill is down roughly a quarter from early March — call it 4.2 million barrels off the hub. The drawdown is broad rather than concentrated: no single cluster is responsible, and no tank sits empty. ",
      refs: ["c1", "c2"],
    },
    {
      text:
        "The pace is steady, not a surge. Fill levels have stepped down gradually across each two-week window rather than dropping in a single event, which is more consistent with a tight market pulling barrels than with a one-off maintenance draw. ",
      refs: ["c3"],
    },
    {
      text:
        "This lines up with the rest of the energy complex. EIA weeklies and the WTI term structure have both moved the same direction over the same window — the imagery estimate is consistent with how the market is priced, not fighting it. ",
      refs: ["c4"],
    },
  ],
  aoi: {
    center: [-96.7673, 35.9856],
    zoom: 13.1,
    polygons: [
      {
        label: "Cushing tank farm AOI",
        date: "2025-04-14",
        accent: "current",
        evidenceRef: "c2",
        coords: [
          [-96.778, 35.9905],
          [-96.753, 35.9908],
          [-96.752, 35.9801],
          [-96.779, 35.9798],
          [-96.778, 35.9905],
        ],
      },
    ],
    // 17 monitored floating-roof tanks with synthetic fill fractions — the
    // map renders these as circle glyphs whose inner fill tracks `fill`.
    markers: [
      { id: "t01", kind: "tank", coord: [-96.7765, 35.9895], evidenceRef: "c1", label: "tank 01", fill: 0.62 },
      { id: "t02", kind: "tank", coord: [-96.7744, 35.9897], evidenceRef: "c1", label: "tank 02", fill: 0.48 },
      { id: "t03", kind: "tank", coord: [-96.7722, 35.9899], evidenceRef: "c1", label: "tank 03", fill: 0.71 },
      { id: "t04", kind: "tank", coord: [-96.7700, 35.9898], evidenceRef: "c1", label: "tank 04", fill: 0.55 },
      { id: "t05", kind: "tank", coord: [-96.7678, 35.9896], evidenceRef: "c1", label: "tank 05", fill: 0.40 },
      { id: "t06", kind: "tank", coord: [-96.7656, 35.9893], evidenceRef: "c1", label: "tank 06", fill: 0.66 },
      { id: "t07", kind: "tank", coord: [-96.7635, 35.9891], evidenceRef: "c1", label: "tank 07", fill: 0.53 },
      { id: "t08", kind: "tank", coord: [-96.7759, 35.9860], evidenceRef: "c1", label: "tank 08", fill: 0.38 },
      { id: "t09", kind: "tank", coord: [-96.7736, 35.9858], evidenceRef: "c1", label: "tank 09", fill: 0.74 },
      { id: "t10", kind: "tank", coord: [-96.7714, 35.9861], evidenceRef: "c1", label: "tank 10", fill: 0.50 },
      { id: "t11", kind: "tank", coord: [-96.7691, 35.9859], evidenceRef: "c1", label: "tank 11", fill: 0.57 },
      { id: "t12", kind: "tank", coord: [-96.7668, 35.9857], evidenceRef: "c1", label: "tank 12", fill: 0.63 },
      { id: "t13", kind: "tank", coord: [-96.7646, 35.9855], evidenceRef: "c1", label: "tank 13", fill: 0.41 },
      { id: "t14", kind: "tank", coord: [-96.7755, 35.9821], evidenceRef: "c1", label: "tank 14", fill: 0.69 },
      { id: "t15", kind: "tank", coord: [-96.7728, 35.9823], evidenceRef: "c1", label: "tank 15", fill: 0.44 },
      { id: "t16", kind: "tank", coord: [-96.7701, 35.9820], evidenceRef: "c1", label: "tank 16", fill: 0.58 },
      { id: "t17", kind: "tank", coord: [-96.7673, 35.9818], evidenceRef: "c1", label: "tank 17", fill: 0.51 },
    ],
    evidenceFocus: {
      c1: { center: [-96.7700, 35.9860], zoom: 14.4 },
      c2: { center: [-96.7673, 35.9856], zoom: 13.6 },
      c3: { center: [-96.7710, 35.9858], zoom: 14.0 },
      c4: { center: [-96.7673, 35.9856], zoom: 13.2 },
    },
  },
  evidence: [
    {
      id: "c1",
      kind: "measurement",
      claim: "17 floating-roof tanks · shadow Δ −24.1% mean fill.",
      source: "Sentinel-2 L2A · Clay v0.4 + solar-geometry shadow model",
      hash: "0x412a…99f0",
    },
    {
      id: "c2",
      kind: "image",
      claim: "Sentinel-2 2025-03-01 baseline and 2025-04-13 comparison.",
      source: "Copernicus Open Access Hub · tile T14SPH",
      hash: "0x77b1…e103",
    },
    {
      id: "c3",
      kind: "sar",
      claim: "Sentinel-1 SAR fallback for 2 cloudy March dates.",
      source: "Copernicus · VV + VH polarization",
      hash: "0x2d90…8104",
    },
    {
      id: "c4",
      kind: "event",
      claim: "EIA weekly stocks (for context only, not in the estimate).",
      source: "EIA STEO · WPR · Cushing hub",
      hash: "0xe104…3a07",
    },
  ],
  methodology: [
    "Shadow-band estimation with per-tank solar geometry; tank ring geometries cached.",
    "SAR fallback when cloud cover >30% over AOI — flagged in output.",
    "EIA data used only for cross-check, not as input to the headline number.",
  ],
  kind: "answer",
};

/* ------------------------------------------------------------------
   Tertiary demo: Shenzhen Luohu — verify mode
   ------------------------------------------------------------------ */

const SHENZHEN: DemoResult = {
  id: "shenzhen_facility_verify",
  query: "Verify this company's manufacturing facility in Shenzhen exists.",
  headline:
    "Facility exists, is operational, and runs clean. Last activity signature two weeks ago.",
  mode: "verify",
  tookMs: 3120,
  confidence: 0.92,
  narrative: [
    {
      text:
        "The site is real and it's working. The footprint at 22.55°N 114.11°E matches the reference from six months ago — same rooftop, same truck court, same perimeter. Twelve vehicles sit in the loading bays on the most recent pass; the court was active the time before too. This is a functioning facility, not a façade. ",
      refs: ["s1", "s2"],
    },
    {
      text:
        "The operator on the ground is the operator on the paperwork. The signage crosswalks cleanly to the corporate registry and the industrial-parks record; nothing in the chain of ownership is obscured or requires a hop through a shell. ",
      refs: ["s3", "s4"],
    },
    {
      text:
        "Nothing flags against the sanctions lists or the adverse-media corpus. No OFAC, EU, or UK hits on the operator or its parents; no news above the confidence floor worth raising to the top of this report. ",
      refs: ["s5"],
    },
  ],
  aoi: {
    center: [114.1113, 22.5496],
    zoom: 16.2,
    polygons: [
      {
        label: "Facility footprint",
        date: "2025-04-12",
        accent: "current",
        evidenceRef: "s1",
        coords: [
          [114.1102, 22.5503],
          [114.1126, 22.5503],
          [114.1126, 22.5487],
          [114.1102, 22.5487],
          [114.1102, 22.5503],
        ],
      },
    ],
    markers: [
      // Detected trucks in the south-side court — pulse as "activity"
      { id: "b1", kind: "beacon", coord: [114.1108, 22.5490], evidenceRef: "s1", label: "truck court · 12 vehicles" },
      { id: "b2", kind: "beacon", coord: [114.1120, 22.5489], evidenceRef: "s1", label: "truck court · loading bay" },
    ],
    evidenceFocus: {
      s1: { center: [114.1114, 22.5495], zoom: 17.1 },
      s2: { center: [114.1114, 22.5495], zoom: 16.6 },
      s3: { center: [114.1113, 22.5496], zoom: 16.2 },
      s4: { center: [114.1113, 22.5496], zoom: 16.2 },
      s5: { center: [114.1113, 22.5496], zoom: 16.0 },
    },
  },
  evidence: [
    {
      id: "s1",
      kind: "image",
      claim: "Sentinel-2 L2A 2025-04-12 — rooftop + truck-court activity.",
      source: "Copernicus · tile T50QKG · Grounding-DINO truck detection",
      hash: "0xe302…ab10",
    },
    {
      id: "s2",
      kind: "image",
      claim: "Reference 2024-10-07 — same AOI, same imaging geometry.",
      source: "Copernicus · tile T50QKG",
      hash: "0x9010…c2f7",
    },
    {
      id: "s3",
      kind: "entity",
      claim: "Crosswalk: OSM place → Overture → OpenCorporates Q4829913.",
      source: "Overture Places · OpenCorporates",
      hash: "0x2441…9802",
    },
    {
      id: "s4",
      kind: "entity",
      claim: "Wikidata industrial-parks registry confirms operator.",
      source: "Wikidata",
      hash: "0xb712…4103",
    },
    {
      id: "s5",
      kind: "event",
      claim: "No hits across OFAC SDN / EU CFSP / UK HMT.",
      source: "OFAC · EU · UK sanctions lists, cached 2025-04-15",
      hash: "0x00f0…0f01",
    },
  ],
  methodology: [
    "Facility existence confirmed by rooftop + truck-court activity across two independent Sentinel-2 passes.",
    "Ownership chain requires two independent registry sources.",
    "Sanctions checks run against all three primary lists; missing check fails the whole chain.",
  ],
  kind: "answer",
};

/* ------------------------------------------------------------------
   Fallback — what the Gatekeeper returns when thresholds fail
   ------------------------------------------------------------------ */

const INSUFFICIENT: DemoResult = {
  id: "insufficient",
  query: "",
  headline: "Insufficient evidence.",
  mode: "investigate",
  tookMs: 920,
  confidence: 0,
  kind: "insufficient",
  narrative: [
    {
      text:
        "The Gatekeeper could not clear enough independent sources to answer this confidently. The model was not consulted — giving it the question would have created an incentive to fabricate around the gap.",
      refs: [],
    },
  ],
  evidence: [],
  methodology: [
    "Freshness — newest imagery older than the 30-day window for current-state claims.",
    "Cloud cover — Sentinel-2 tiles over the AOI above the 30% rejection threshold; no SAR fallback within range.",
    "Source diversity — activity-level claims require both imagery and at least one non-imagery signal.",
    "Attribution — every factual edge requires a source URL; edges without attribution are dropped.",
  ],
};

/* ------------------------------------------------------------------
   Export
   ------------------------------------------------------------------ */

export const DEMO_RESULTS: Record<string, DemoResult> = {
  [MUNDRA.id]: MUNDRA,
  [CUSHING.id]: CUSHING,
  [SHENZHEN.id]: SHENZHEN,
  insufficient: INSUFFICIENT,
};

function scorePresetQuery(q: string): { id: string; score: number }[] {
  const lower = q.toLowerCase();
  const candidates = [
    {
      id: MUNDRA.id,
      score:
        (lower.includes("mundra") ? 3 : 0) +
        (lower.includes("port") ? 1 : 0) +
        (lower.includes("construction") ? 1 : 0),
    },
    {
      id: CUSHING.id,
      score:
        (lower.includes("cushing") ? 3 : 0) +
        (lower.includes("oil") || lower.includes("storage") ? 1 : 0) +
        (lower.includes("oklahoma") ? 1 : 0),
    },
    {
      id: SHENZHEN.id,
      score:
        (lower.includes("shenzhen") ? 3 : 0) +
        (lower.includes("verify") || lower.includes("facility") ? 1 : 0) +
        (lower.includes("manufactur") ? 1 : 0),
    },
  ];
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function matchPresetQuery(q: string): DemoResult | null {
  const candidates = scorePresetQuery(q);
  if (candidates[0].score >= 2) return DEMO_RESULTS[candidates[0].id];
  return null;
}

export function estimateRunProfile(q: string): AnalysisRunProfile {
  const preset = matchPresetQuery(q);
  if (preset) {
    return {
      id: preset.id,
      tookMs: preset.tookMs,
    };
  }

  return {
    id: `run_${hashString(q).toString(16)}`,
    tookMs: 2300 + (hashString(`${q}:latency`) % 1200),
  };
}

export function buildUnavailableResult(query: string): DemoResult {
  return {
    id: `unavailable_${hashString(query).toString(16)}`,
    query,
    headline: "Analysis unavailable right now. No synthetic answer was shown in its place.",
    narrative: [
      {
        text:
          "The request did not complete cleanly, so Vantage withheld the brief rather than filling the gap with generated analysis. That protects the decision flow, but it means this run is incomplete.",
        refs: [],
      },
    ],
    evidence: [],
    confidence: 0,
    mode: "investigate",
    tookMs: 1200,
    methodology: [
      "The live analysis request failed before a grounded evidence packet was returned.",
      "No fallback synthesis was used, by design.",
      "Best next step: retry the same prompt once the network path is healthy, or narrow the location and operator in the query.",
    ],
    kind: "insufficient",
  };
}

export const EXAMPLE_PROMPTS: { label: string; query: string }[] = [
  { label: "Mundra Port construction", query: MUNDRA.query },
  { label: "Cushing oil storage", query: CUSHING.query },
  { label: "Verify Shenzhen facility", query: SHENZHEN.query },
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
