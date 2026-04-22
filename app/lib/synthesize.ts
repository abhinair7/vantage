/**
 * Deterministic analysis synthesizer.
 *
 * For demo purposes — turns an arbitrary query into a plausible
 * geospatial / OSINT-style answer so every prompt lands on a result
 * page instead of the fallback. Output is stable for a given query.
 *
 * This is *synthesized*, not inferred from live data. The product copy
 * still reads like the canned presets so the demo feels cohesive.
 */

import type { DemoResult, Evidence, NarrativeChunk, AOI, Polygon } from "./demo-results";

/* ------------------------------------------------------------------
   Stable pseudo-random, seeded by the query string
   ------------------------------------------------------------------ */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    s = (s ^= s >>> 16) >>> 0;
    return s / 4294967295;
  };
}

/* ------------------------------------------------------------------
   Locations — mapped to [lon, lat] + a sensible default zoom
   ------------------------------------------------------------------ */

type Loc = { name: string; coord: [number, number]; zoom: number };

const LOCATIONS: Loc[] = [
  { name: "shanghai",     coord: [121.4737, 31.2304], zoom: 11.5 },
  { name: "shenzhen",     coord: [114.0579, 22.5431], zoom: 11.8 },
  { name: "singapore",    coord: [103.8198, 1.3521],  zoom: 11.2 },
  { name: "rotterdam",    coord: [4.47917, 51.9244],  zoom: 11.6 },
  { name: "hamburg",      coord: [9.9937, 53.5511],   zoom: 11.4 },
  { name: "dubai",        coord: [55.2708, 25.2048],  zoom: 11.2 },
  { name: "mundra",       coord: [69.7071, 22.7345],  zoom: 12.8 },
  { name: "mumbai",       coord: [72.8777, 19.076],   zoom: 11.2 },
  { name: "chennai",      coord: [80.2707, 13.0827],  zoom: 11.2 },
  { name: "kandla",       coord: [70.2167, 23.0333],  zoom: 12.5 },
  { name: "cushing",      coord: [-96.7673, 35.9856], zoom: 13.0 },
  { name: "houston",      coord: [-95.3698, 29.7604], zoom: 10.8 },
  { name: "los angeles",  coord: [-118.2437, 34.0522], zoom: 10.8 },
  { name: "long beach",   coord: [-118.2137, 33.767], zoom: 11.4 },
  { name: "san francisco",coord: [-122.4194, 37.7749], zoom: 11.0 },
  { name: "new york",     coord: [-74.006, 40.7128],  zoom: 10.8 },
  { name: "london",       coord: [-0.1276, 51.5074],  zoom: 10.8 },
  { name: "paris",        coord: [2.3522, 48.8566],   zoom: 10.8 },
  { name: "berlin",       coord: [13.405, 52.52],     zoom: 10.8 },
  { name: "moscow",       coord: [37.6173, 55.7558],  zoom: 10.4 },
  { name: "st petersburg",coord: [30.3351, 59.9343],  zoom: 10.8 },
  { name: "vladivostok",  coord: [131.8735, 43.1155], zoom: 11.0 },
  { name: "tokyo",        coord: [139.6503, 35.6762], zoom: 10.8 },
  { name: "osaka",        coord: [135.5023, 34.6937], zoom: 11.0 },
  { name: "yokohama",     coord: [139.6380, 35.4437], zoom: 11.4 },
  { name: "busan",        coord: [129.0756, 35.1796], zoom: 11.2 },
  { name: "hong kong",    coord: [114.1694, 22.3193], zoom: 11.2 },
  { name: "taipei",       coord: [121.5654, 25.033],  zoom: 11.0 },
  { name: "kaohsiung",    coord: [120.3014, 22.6273], zoom: 11.4 },
  { name: "bangkok",      coord: [100.5018, 13.7563], zoom: 10.8 },
  { name: "ho chi minh",  coord: [106.6297, 10.8231], zoom: 11.0 },
  { name: "jakarta",      coord: [106.8456, -6.2088], zoom: 10.8 },
  { name: "manila",       coord: [120.9842, 14.5995], zoom: 11.0 },
  { name: "kuala lumpur", coord: [101.6869, 3.139],   zoom: 10.8 },
  { name: "sydney",       coord: [151.2093, -33.8688],zoom: 10.8 },
  { name: "melbourne",    coord: [144.9631, -37.8136],zoom: 10.8 },
  { name: "perth",        coord: [115.8605, -31.9505],zoom: 10.8 },
  { name: "cape town",    coord: [18.4241, -33.9249], zoom: 10.8 },
  { name: "lagos",        coord: [3.3792, 6.5244],    zoom: 11.0 },
  { name: "cairo",        coord: [31.2357, 30.0444],  zoom: 10.8 },
  { name: "istanbul",     coord: [28.9784, 41.0082],  zoom: 10.8 },
  { name: "tehran",       coord: [51.389, 35.6892],   zoom: 10.8 },
  { name: "riyadh",       coord: [46.6753, 24.7136],  zoom: 10.8 },
  { name: "jeddah",       coord: [39.1925, 21.4858],  zoom: 10.8 },
  { name: "karachi",      coord: [67.0099, 24.8607],  zoom: 10.8 },
  { name: "bangalore",    coord: [77.5946, 12.9716],  zoom: 10.8 },
  { name: "hyderabad",    coord: [78.4867, 17.385],   zoom: 10.8 },
  { name: "delhi",        coord: [77.1025, 28.7041],  zoom: 10.4 },
  { name: "kolkata",      coord: [88.3639, 22.5726],  zoom: 10.8 },
  { name: "seoul",        coord: [126.978, 37.5665],  zoom: 10.8 },
  { name: "pyongyang",    coord: [125.7625, 39.0392], zoom: 10.8 },
  { name: "beijing",      coord: [116.4074, 39.9042], zoom: 10.4 },
  { name: "guangzhou",    coord: [113.2644, 23.1291], zoom: 11.0 },
  { name: "ningbo",       coord: [121.55, 29.8683],   zoom: 11.0 },
  { name: "qingdao",      coord: [120.3826, 36.0671], zoom: 11.0 },
  { name: "tianjin",      coord: [117.3616, 39.3434], zoom: 11.0 },
  { name: "kiev",         coord: [30.5234, 50.4501],  zoom: 10.8 },
  { name: "kyiv",         coord: [30.5234, 50.4501],  zoom: 10.8 },
  { name: "odesa",        coord: [30.7233, 46.4825],  zoom: 11.0 },
  { name: "odessa",       coord: [30.7233, 46.4825],  zoom: 11.0 },
  { name: "sevastopol",   coord: [33.5254, 44.6166],  zoom: 11.0 },
  { name: "crimea",       coord: [34.1024, 44.9521],  zoom: 9.0 },
  { name: "gibraltar",    coord: [-5.3536, 36.1408],  zoom: 11.8 },
  { name: "panama",       coord: [-79.5199, 8.9824],  zoom: 10.6 },
  { name: "suez",         coord: [32.5498, 29.9668],  zoom: 10.8 },
  { name: "bosphorus",    coord: [29.0396, 41.0828],  zoom: 11.4 },
  { name: "malacca",      coord: [102.25, 2.5],       zoom: 8.5 },
];

function findLocation(q: string): Loc | null {
  const lower = q.toLowerCase();
  for (const loc of LOCATIONS) {
    if (lower.includes(loc.name)) return loc;
  }
  return null;
}

/* ------------------------------------------------------------------
   Subject extraction — what kind of thing is the user asking about?
   ------------------------------------------------------------------ */

type Subject =
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

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  port:        ["port", "harbor", "harbour", "terminal", "quay", "dock", "berth"],
  refinery:    ["refinery", "refineries", "petrochemical"],
  storage:     ["storage", "tank farm", "silo", "oil hub", "stockpile"],
  airport:     ["airport", "runway", "tarmac", "apron"],
  airbase:     ["airbase", "air base", "airfield"],
  factory:     ["factory", "plant", "manufactur", "assembly", "production line"],
  warehouse:   ["warehouse", "distribution", "fulfillment", "logistics center"],
  mine:        ["mine", "mining"],
  quarry:      ["quarry"],
  railway:     ["railway", "rail yard", "train", "track", "freight yard"],
  pipeline:    ["pipeline", "pipelines"],
  shipyard:    ["shipyard", "drydock", "ship building"],
  power:       ["power plant", "substation", "solar", "wind farm", "reactor", "nuclear"],
  datacenter:  ["data center", "datacenter", "server farm", "colocation"],
  farm:        ["farm", "cropland", "agriculture", "plantation"],
  construction:["construction", "build", "built", "expansion", "development", "new"],
  vessel:      ["vessel", "ship", "tanker", "bulker", "fleet", "naval"],
  aircraft:    ["aircraft", "airplane", "jet", "fighter", "bomber", "helicopter"],
  military:    ["military", "troop", "garrison", "barracks", "base"],
  facility:    ["facility", "site", "compound", "installation"],
};

function detectSubject(q: string): Subject {
  const lower = q.toLowerCase();
  for (const [subj, keys] of Object.entries(SUBJECT_KEYWORDS) as [Subject, string[]][]) {
    for (const k of keys) {
      if (lower.includes(k)) return subj;
    }
  }
  return "facility";
}

/* ------------------------------------------------------------------
   Intent — what does the user want to know?
   ------------------------------------------------------------------ */

type Mode = "investigate" | "verify" | "monitor";

function detectMode(q: string): Mode {
  const lower = q.toLowerCase();
  if (/^\s*verify|confirm|authenticat|legitimate|exist/i.test(lower)) return "verify";
  if (/monitor|track|over time|trend|since|last \d|past \d|weekly|daily|change/i.test(lower)) return "monitor";
  return "investigate";
}

/* ------------------------------------------------------------------
   Templates — generate headline + narrative from subject + mode
   ------------------------------------------------------------------ */

const NARRATIVE_TEMPLATES: Record<Subject, (locName: string, rand: () => number) => {
  headline: string;
  narrative: NarrativeChunk[];
}> = {
  port: (loc, r) => {
    const growth = (6 + r() * 10).toFixed(1);
    const quay = Math.round(180 + r() * 320);
    const callsDelta = Math.round(12 + r() * 16);
    return {
      headline: `Yes. ${loc} is running harder than a year ago — ~${quay} m of new quay in use and vessel calls up ${callsDelta}% YoY.`,
      narrative: [
        { text: `The terminal footprint is growing, not stable. Hard surface along the main berthline is up about ${growth}% against a six-month baseline — roughly ${quay} metres of new quay, extending the existing alignment rather than redeveloping it. No graded earth or patchwork apron: the new surface is already hardened and in regular use. `, refs: ["e1", "e2"] },
        { text: `The berths are carrying traffic. AIS dwell-time across the terminal shows vessel calls up roughly ${callsDelta}% year-on-year, with the new positions occupied on four of the last five passes — capacity is being used, not just built. `, refs: ["e3"] },
        { text: `The imagery read lines up with the operator's own disclosures: recent concession filings reference capex earmarked for container-capacity buildout, consistent with the quay extension we're observing. `, refs: ["e4", "e5"] },
      ],
    };
  },
  refinery: (loc, r) => {
    const throughput = (r() * 18 - 6).toFixed(1);
    const flare = Math.round(r() * 9 + 2);
    return {
      headline: `Throughput at ${loc} has moved ${Number(throughput) >= 0 ? "up" : "down"} ~${Math.abs(Number(throughput))}% in the last 60 days.`,
      narrative: [
        { text: `The refinery is not idle. Thermal signature across the process trains is ${Number(throughput) >= 0 ? "brighter" : "cooler"} against the 90-day baseline, with ${flare} flare events exceeding the normal-operations envelope in the last 30 days. The change is concentrated on the crude unit, not the secondaries. `, refs: ["e1", "e2"] },
        { text: `The product-side tank ring is consistent with the thermal read: shadow-height estimates on the three distillate tanks are within 8% of each other across the last two imagery passes, suggesting balanced offtake rather than a draw-down. `, refs: ["e3"] },
        { text: `No unusual vessel patterns at the associated marine terminal. Crude-ship arrivals are within the rolling-average band; no opportunistic chartering visible in the AIS picture. `, refs: ["e4"] },
      ],
    };
  },
  storage: (loc, r) => {
    const delta = (r() * 28 - 10).toFixed(1);
    const tanks = Math.round(12 + r() * 18);
    const barrels = (Math.abs(Number(delta)) * 0.2).toFixed(1);
    return {
      headline: `${loc} is ${Number(delta) >= 0 ? "building" : "drawing down"}. Roughly ${barrels}M barrels ${Number(delta) >= 0 ? "added to" : "off"} the hub since the last baseline.`,
      narrative: [
        { text: `Across the ${tanks} tracked floating-roof tanks, mean fill has moved about ${Math.abs(Number(delta))}% from the prior window. The move is broad, not concentrated — no single cluster drives it, and no tank sits at either extreme. `, refs: ["e1", "e2"] },
        { text: `The pace is steady rather than event-driven. Fill has stepped ${Number(delta) >= 0 ? "up" : "down"} gradually across each two-week window, consistent with persistent flow rather than a one-off maintenance draw. `, refs: ["e3"] },
        { text: `The imagery-estimate direction is consistent with how the forward curve and recent weekly stocks are moving — nothing in the price structure fights the satellite read. `, refs: ["e4"] },
      ],
    };
  },
  airport: (loc, r) => {
    const movements = Math.round(r() * 24 + 6);
    const aircraft = Math.round(r() * 30 + 40);
    return {
      headline: `${loc} is operating at roughly 85–95% of its last-year envelope — daily movements steady, ${aircraft} aircraft on the ground.`,
      narrative: [
        { text: `Tarmac utilisation is stable. The most recent daytime pass showed ${aircraft} aircraft on stands and taxiways; the 30-day mean sits within one standard deviation of this. No unusual bunching at the cargo apron or at the remote stands. `, refs: ["e1"] },
        { text: `Movements are steady. ADS-B-derived daily departure counts are tracking within ${movements}% of the same week last year. The mix skews narrow-body on the domestic piers, with the expected long-haul wide-bodies on the international apron. `, refs: ["e2", "e3"] },
        { text: `No construction of a scale that would change capacity. Minor works on the taxiway E extension are visible but within the scope of the previously announced programme. `, refs: ["e4"] },
      ],
    };
  },
  airbase: (loc, r) => {
    const aircraft = Math.round(r() * 14 + 6);
    const revetments = Math.round(r() * 6 + 4);
    return {
      headline: `${loc} shows ${aircraft} combat airframes on-base and the dispersal pattern of an active squadron rotation.`,
      narrative: [
        { text: `Airframe count is consistent with a full-strength posture. The latest pass places ${aircraft} fighter-sized aircraft across the main apron and the ${revetments} hardened revetments; none of the shelters are obviously empty. `, refs: ["e1"] },
        { text: `Ground activity is ordinary for a base of this kind — fuel bowser movements, no tenting or dispersed parking, no accelerated taxi traces on the aprons. The pattern suggests a steady-state squadron, not a surge. `, refs: ["e2"] },
        { text: `Support aircraft and rotary-wing are at their expected parking positions. Nothing unusual visible at the munitions storage area. `, refs: ["e3"] },
      ],
    };
  },
  factory: (loc, r) => {
    const output = (r() * 22 - 4).toFixed(1);
    const trucks = Math.round(10 + r() * 22);
    return {
      headline: `${loc} is operating. Activity indicators are ${Number(output) >= 0 ? "up" : "down"} ~${Math.abs(Number(output))}% vs the 90-day baseline.`,
      narrative: [
        { text: `The plant is running. Thermal signature across the main production halls is within 6% of the prior-quarter baseline and the parking lots are at ~82% of their capacity on the last two weekday passes — staffing is consistent with a two-shift pattern. `, refs: ["e1", "e2"] },
        { text: `Logistics flow matches production. Truck-court dwell-time analysis shows ~${trucks} vehicles per daytime window at the inbound and outbound gates, without the queueing you'd see under a bottleneck. `, refs: ["e3"] },
        { text: `No construction or teardown visible. The site boundary is unchanged against the 180-day baseline. Corporate filings for the operator show no announced capex pull-forward. `, refs: ["e4"] },
      ],
    };
  },
  warehouse: (loc, r) => {
    const trucks = Math.round(r() * 40 + 20);
    const fill = Math.round(r() * 20 + 70);
    return {
      headline: `${loc} is running near peak — ~${trucks} trucks per diurnal cycle, ~${fill}% bay utilisation.`,
      narrative: [
        { text: `The distribution centre is busy. Truck-count per daytime pass averages around ${trucks} across the last 14 days — at or slightly above the site's typical high-season rhythm. Loading doors are near-fully active on the weekday samples. `, refs: ["e1", "e2"] },
        { text: `The yard pattern is consistent with normal fulfillment operations — no extended dwell, no trailer stacks in the overflow lot. `, refs: ["e3"] },
        { text: `No new construction, no visible footprint changes against the 180-day baseline. Operator registry remains the named corporate entity. `, refs: ["e4"] },
      ],
    };
  },
  mine: (loc, r) => {
    const tonnes = (r() * 30 + 8).toFixed(1);
    return {
      headline: `${loc} is producing. Pit-face progression implies throughput ~${tonnes}% above the 12-month trend.`,
      narrative: [
        { text: `The pit is working. Change-detection on the active faces shows roughly ${tonnes}% more material moved in the last 90 days than in the comparable 90-day window a year earlier. Haul-road traffic density matches this read. `, refs: ["e1", "e2"] },
        { text: `Tailings and waste-rock piles have grown consistently with the pit delta — no unexplained accumulation and no suspicious run-off patterns around the containment. `, refs: ["e3"] },
        { text: `Shipment-side signals from the nearest rail siding and port stockpile are consistent with the implied throughput. `, refs: ["e4"] },
      ],
    };
  },
  quarry: (loc, r) => {
    const area = (r() * 28 + 6).toFixed(1);
    return {
      headline: `${loc} has expanded its active extraction footprint by ~${area}% in the last six months.`,
      narrative: [
        { text: `Extraction area has grown. The pit edge has advanced on the northeast side by ${area}% since the prior baseline; overburden stripping is visible ahead of the new face. `, refs: ["e1"] },
        { text: `Stockpile inventories are consistent with matching throughput — no unusual accumulation that would imply a demand shortfall. `, refs: ["e2"] },
        { text: `Haul-road traffic density on the outbound arterial is up in line with the face advance. `, refs: ["e3"] },
      ],
    };
  },
  railway: (loc, r) => {
    const cars = Math.round(r() * 120 + 240);
    return {
      headline: `${loc} is moving ~${cars} cars per daytime pass — at the top of its 6-month range.`,
      narrative: [
        { text: `Yard density is up. The most recent weekday passes count ~${cars} rail cars across the classification bowl; the 30-day mean is within a narrow band of this. `, refs: ["e1", "e2"] },
        { text: `Train-length sampling on the outbound mains is stable — so the delta is dwell, not more trains. Consistent with a yard operating close to capacity. `, refs: ["e3"] },
        { text: `No infrastructure change at the yard boundary; operator filings match. `, refs: ["e4"] },
      ],
    };
  },
  pipeline: (loc, r) => {
    const km = (r() * 180 + 40).toFixed(0);
    return {
      headline: `${loc}: ~${km} km of the right-of-way has been reopened for work in the last 60 days.`,
      narrative: [
        { text: `Ground-disturbance signatures along the right-of-way are consistent with active intervention on roughly ${km} km — not a new build, more consistent with integrity work on an existing alignment. `, refs: ["e1"] },
        { text: `No equipment yards have appeared near the pumping stations beyond the standard maintenance posture. Compressor-station thermal patterns are within normal range. `, refs: ["e2", "e3"] },
        { text: `No vessel activity at the associated export terminal outside the baseline envelope. `, refs: ["e4"] },
      ],
    };
  },
  shipyard: (loc, r) => {
    const hulls = Math.round(r() * 4 + 2);
    return {
      headline: `${loc} has ${hulls} hulls on the ways and dock utilisation near the 2-year high.`,
      narrative: [
        { text: `Drydock utilisation is high. The most recent passes show ${hulls} hulls in active-build positions; launch basin is occupied. Block storage yards are full enough to imply a steady pipeline, not a one-off run. `, refs: ["e1", "e2"] },
        { text: `No unusual labor markers — canteen parking, bus-drop density, and crane activity are all within expected workweek bands. `, refs: ["e3"] },
        { text: `Operator registry is unchanged and matches the site signage read. `, refs: ["e4"] },
      ],
    };
  },
  power: (loc, r) => {
    const capacity = Math.round(r() * 40 + 60);
    return {
      headline: `${loc} is dispatching at ~${capacity}% of nameplate — consistent with grid demand through the window.`,
      narrative: [
        { text: `The plant is running near ${capacity}% of nameplate. Cooling-plume temperature against ambient and stack-thermal signatures line up with an output of ~${capacity * 8} GWh for the week. `, refs: ["e1", "e2"] },
        { text: `Fuel yard inventory sits within its normal seasonal corridor — no draw-down suggestive of supply stress. `, refs: ["e3"] },
        { text: `Switchyard activity is routine; no transformer movements visible. `, refs: ["e4"] },
      ],
    };
  },
  datacenter: (loc, r) => {
    const pct = Math.round(r() * 20 + 75);
    return {
      headline: `${loc} is operational at ~${pct}% of visible thermal capacity; campus build-out is running one phase ahead of schedule.`,
      narrative: [
        { text: `The campus is hot. Rooftop thermal signatures across the live data halls are in the upper ${pct}% of the site's envelope. No brownout hours visible on the timeseries. `, refs: ["e1"] },
        { text: `Construction on the next phase is visible on the north parcel — steel up on two of the three planned halls, substation expansion tracking ahead of the public schedule. `, refs: ["e2", "e3"] },
        { text: `Operator identity is consistent with the corporate registry pull; no sanctions exposure in the chain. `, refs: ["e4"] },
      ],
    };
  },
  farm: (loc, r) => {
    const yield_ = (r() * 18 - 4).toFixed(1);
    return {
      headline: `${loc} is tracking ${Number(yield_) >= 0 ? "above" : "below"} the 5-year NDVI baseline by ~${Math.abs(Number(yield_))}%.`,
      narrative: [
        { text: `Canopy vigour is ${Number(yield_) >= 0 ? "strong" : "soft"}. NDVI over the active parcels is ${Math.abs(Number(yield_))}% ${Number(yield_) >= 0 ? "above" : "below"} the 5-year same-week average, with no obvious pest or drought signatures visible in the near-IR. `, refs: ["e1"] },
        { text: `Irrigation activity is consistent with normal cropping. Reservoir levels across the catchment sit in the mid-range for the season. `, refs: ["e2", "e3"] },
        { text: `Local weather through the window was within a tight band of the long-term mean — the read is about the crop, not the forcing. `, refs: ["e4"] },
      ],
    };
  },
  construction: (loc, r) => {
    const area = Math.round(r() * 80000 + 20000);
    const months = Math.round(r() * 8 + 4);
    return {
      headline: `Yes. ${loc} has added ~${(area / 1000).toFixed(1)}k m² of new hard surface in the last ${months} months.`,
      narrative: [
        { text: `The site has grown. New construction covers roughly ${(area / 1000).toFixed(1)} thousand square metres compared with the baseline six months ago — mostly on the western expansion parcel, with sub-grade already hardened on the first phase. `, refs: ["e1", "e2"] },
        { text: `The work is continuous. Crane positions have shifted progressively between passes rather than dwelling in one place, and laydown yards are rotating — this is a managed programme, not a stalled site. `, refs: ["e3"] },
        { text: `Permitted works and published capex from the operator match the footprint change within reasonable margin. `, refs: ["e4"] },
      ],
    };
  },
  vessel: (loc, r) => {
    const count = Math.round(r() * 20 + 10);
    return {
      headline: `${count} vessels of interest observed at ${loc} in the last 14 days; pattern-of-life is within normal bounds.`,
      narrative: [
        { text: `Traffic is in range. AIS shows ${count} vessels above the size filter across the AOI in the last 14 days — the mix of tankers, bulkers, and container traffic matches the prior-year pattern for this window. `, refs: ["e1", "e2"] },
        { text: `No dark-ship AIS-gap patterns that meet the suspicious-behaviour threshold. A small number of brief loss-of-signal events align with known VTS-mandated silence zones. `, refs: ["e3"] },
        { text: `Anchorage utilisation is typical. No unusual dwell outside the designated waiting areas. `, refs: ["e4"] },
      ],
    };
  },
  aircraft: (loc, r) => {
    const count = Math.round(r() * 40 + 20);
    return {
      headline: `${count} aircraft counted at ${loc} on the most recent pass; type mix is consistent with the operator's published fleet.`,
      narrative: [
        { text: `Aircraft count is within the expected band. The day-pass places ${count} airframes on ramp and taxiway. Type-mix, as inferred from length and wingspan signatures, lines up with the operator's declared fleet. `, refs: ["e1", "e2"] },
        { text: `Ground-support footprint (fuel bowsers, GSE positions) is ordinary; no accelerated turnaround signatures or surge-parking on outer ramps. `, refs: ["e3"] },
        { text: `No construction changing capacity. Hangar doors in their expected state. `, refs: ["e4"] },
      ],
    };
  },
  military: (loc, r) => {
    const vehicles = Math.round(r() * 30 + 25);
    return {
      headline: `${loc}: ${vehicles} vehicles in the motor pool today, posture consistent with routine garrison life.`,
      narrative: [
        { text: `Vehicle count is in its usual range. ${vehicles} trucks and armoured vehicles in the motor pool on the last pass; no rail-loading activity visible at the nearest railhead, no tenting on the parade ground. `, refs: ["e1"] },
        { text: `Soldier-of-life indicators — canteen activity, PT grounds, barracks occupancy inferred from vehicle parking — are within the daily norm. `, refs: ["e2", "e3"] },
        { text: `No munitions movements above the normal-operations threshold. Magazine-area access patterns are routine. `, refs: ["e4"] },
      ],
    };
  },
  facility: (loc, r) => {
    const confidence = Math.round(r() * 14 + 82);
    return {
      headline: `${loc} is live and operating normally; ${confidence}% confidence on site identity and operator attribution.`,
      narrative: [
        { text: `The site is real and active. Footprint at the coordinates matches the reference imagery from six months ago, with ordinary daily activity signatures: staff parking, gate traffic, routine yard movements. `, refs: ["e1", "e2"] },
        { text: `The operator on site matches the operator on the paperwork. Registry and industrial-parks records resolve cleanly; the ownership chain does not pass through a shell. `, refs: ["e3", "e4"] },
        { text: `No hits on sanctions lists or the adverse-media corpus above the reporting threshold. `, refs: ["e5"] },
      ],
    };
  },
};

/* ------------------------------------------------------------------
   Evidence generator — built from the same seed so ids & sources feel
   consistent. Count matches the number of refs used in the narrative.
   ------------------------------------------------------------------ */

const EVIDENCE_KINDS: Evidence["kind"][] = ["image", "sar", "ais", "event", "entity", "measurement"];

function makeEvidence(refs: string[], subject: Subject, loc: string, rand: () => number): Evidence[] {
  const imagerySources = [
    "Copernicus Open Access Hub · Sentinel-2 L2A",
    "Copernicus Open Access Hub · Sentinel-1 GRD",
    "Planet Labs · SkySat basemap",
    "Maxar · WV-3 archive",
    "Airbus OneAtlas · Pléiades Neo",
  ];
  const aisSources = [
    "AISStream · 30d window",
    "MarineCable · AIS aggregate",
    "Spire Maritime · historical AIS",
  ];
  const eventSources = [
    "GDELT · CORP_FINANCE_QUARTERLY",
    "ICEYE insights bulletin",
    "Bloomberg terminal · corp actions",
    "Reuters wire · 30d archive",
  ];
  const entitySources = [
    "OpenCorporates · 2-hop chain",
    "Wikidata + OSM crosswalk",
    "OFAC SDN + EU CFSP + UK HMT",
    "Overture Places registry",
  ];

  const hashHex = () => {
    const a = Math.floor(rand() * 0xffff).toString(16).padStart(4, "0");
    const b = Math.floor(rand() * 0xffff).toString(16).padStart(4, "0");
    return `0x${a}…${b}`;
  };
  const dateIso = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  return refs.map((id, i): Evidence => {
    const kind = EVIDENCE_KINDS[i % EVIDENCE_KINDS.length];
    switch (kind) {
      case "image":
        return {
          id,
          kind,
          claim: `Imagery baseline — ${dateIso(180 + i)}; comparison pass ${dateIso(7 + i)}.`,
          source: `${imagerySources[i % imagerySources.length]} · ${subject} AOI`,
          hash: hashHex(),
        };
      case "sar":
        return {
          id,
          kind,
          claim: `SAR backscatter Δ against 90-day rolling baseline.`,
          source: `Sentinel-1 · VV + VH · ${loc} tile`,
          hash: hashHex(),
        };
      case "ais":
        return {
          id,
          kind,
          claim: `AIS dwell-time aggregation, geofenced to the AOI.`,
          source: aisSources[i % aisSources.length],
          hash: hashHex(),
        };
      case "event":
        return {
          id,
          kind,
          claim: `Corporate + news corpus cross-check within the 60-day window.`,
          source: eventSources[i % eventSources.length],
          hash: hashHex(),
        };
      case "entity":
        return {
          id,
          kind,
          claim: `Operator identity and ownership chain resolution.`,
          source: entitySources[i % entitySources.length],
          hash: hashHex(),
        };
      case "measurement":
        return {
          id,
          kind,
          claim: `Feature-level measurement with per-object geometry.`,
          source: `Clay v0.4 embeddings · Grounding-DINO detections`,
          hash: hashHex(),
        };
    }
  });
}

/* ------------------------------------------------------------------
   AOI — build a small rectangular polygon around the inferred center
   ------------------------------------------------------------------ */

function makeAOI(loc: Loc, rand: () => number): AOI {
  const [lon, lat] = loc.coord;
  // ~600 m half-width at equator; tighter as latitude rises. This reads
  // like a "focused AOI" on the map without being cartoonishly small.
  const dLat = 0.006 + rand() * 0.004;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const poly: Polygon = {
    label: "Current AOI",
    date: new Date().toISOString().slice(0, 10),
    accent: "current",
    evidenceRef: "e1",
    coords: [
      [lon - dLon, lat + dLat],
      [lon + dLon, lat + dLat],
      [lon + dLon, lat - dLat],
      [lon - dLon, lat - dLat],
      [lon - dLon, lat + dLat],
    ],
  };
  const prev: Polygon = {
    label: "Prior baseline",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10),
    accent: "previous",
    evidenceRef: "e2",
    coords: [
      [lon - dLon * 0.72, lat + dLat * 0.72],
      [lon + dLon * 0.72, lat + dLat * 0.72],
      [lon + dLon * 0.72, lat - dLat * 0.72],
      [lon - dLon * 0.72, lat - dLat * 0.72],
      [lon - dLon * 0.72, lat + dLat * 0.72],
    ],
  };
  return {
    center: loc.coord,
    zoom: loc.zoom,
    polygons: [prev, poly],
  };
}

/* ------------------------------------------------------------------
   Public entry point
   ------------------------------------------------------------------ */

const IMPLICATION_TEMPLATES: Record<Subject, (loc: string, r: () => number) => string> = {
  port: (loc, r) => `What this means for the operator thesis: the growth is on the container-capable face, not bulk — it extends the operator's pivot toward higher-margin unitised traffic rather than cementing their bulk-commodity legacy mix. With vessel-calls climbing against what looks like a broad slot-utilisation push, the implied unit economics for ${loc} should carry into the next two quarters unless fuel or inland-haulage friction spikes. Keep an eye on the ${Math.round(2 + r() * 3)}-week rail-siding throughput at the feeder junction — that's the first place bottlenecks would show.`,
  refinery: (loc, r) => `The read is consistent with margin-driven dispatch, not a maintenance event. If the differential holds, expect ${loc}'s crude-slate composition to stay biased toward the medium-sour grade visible in the recent tanker arrivals; a swing back to lights would precede a thermal drop of similar magnitude. Refined-product export patterns to the usual destinations remain the clearest forward signal — ${Math.round(6 + r() * 6)}-day lead on fixtures is the typical tell.`,
  storage: (loc, _r) => `The directional read matters more than the magnitude. Sustained hub flow against a flat forward curve is consistent with either (a) a physical bid from a specific offtaker or (b) a rollover into lower-cost tankage; differentiating the two requires the next two weekly passes. If fill keeps moving in the same direction, this becomes a positioning signal rather than a seasonal one — ${loc} is large enough to move the basis, not just reflect it.`,
  airport: (loc, r) => `Capacity utilisation at this level implies the route network is healthy but not stretched. No sign of fleet redeployment or wet-lease activity that would suggest stress; the operator's published schedule looks deliverable on current aircraft availability. A ${Math.round(4 + r() * 5)}% surge in cargo-apron dwell over the next fortnight would be the first early signal of an operational slip at ${loc}.`,
  airbase: (loc, _r) => `Consistent with a posture of readiness without escalation. No dispersal, no surge, no tenting — the base looks busy in the ordinary sense. Any change would likely appear first as revetment repopulation and ground-support buildup, both of which are visible indicators that lead activity by several days. ${loc}'s current pattern does not yet cross that threshold.`,
  factory: (loc, r) => `Production looks sustainable at current levels. The ${Math.round(5 + r() * 8)}% truck-court variance across the last fortnight is inside normal operational noise, not a demand pull. Parking occupancy consistent with a two-shift pattern means there's headroom to add a third if order intake warrants — ${loc} is not yet at its operational ceiling.`,
  warehouse: (loc, r) => `The facility is running hot, but not at risk of tip-over. Trailer pool utilisation at current levels still leaves ${Math.round(10 + r() * 15)}% nominal headroom. Worth watching: overflow lot occupancy — a sustained move into that buffer is the clearest leading indicator of bay-side congestion at ${loc}.`,
  mine: (loc, _r) => `Implied production is above consensus trend for the operator. The pit-face advance rate, combined with the waste-rock-to-ore ratio visible in the tailings progression, is consistent with the higher end of the operator's guidance band. Shipment-side confirmation from the nearest loadout is the cleanest forward signal for ${loc}.`,
  quarry: (loc, _r) => `Consistent with a durable, not opportunistic, demand profile. Stockpile levels are not building, meaning extraction is matched by offtake rather than accumulating for forward sale. ${loc}'s footprint expansion looks capex-backed rather than speculative.`,
  railway: (loc, _r) => `Yard is near its practical ceiling. Further car count increases without an infrastructure change would require either longer trains (stable, per sampling) or faster classification turnaround. The most likely operational response at ${loc} would be a shift in the distribution of through-traffic to adjacent yards.`,
  pipeline: (loc, _r) => `The pattern reads as integrity and maintenance work, not a throughput shift. No pumping-station thermal anomaly, no compressor expansion, no new metering skids. ${loc}'s right-of-way activity likely means temporary throughput variability but no durable change in export capacity.`,
  shipyard: (loc, _r) => `Utilisation at this level implies a healthy forward orderbook; the block-storage depth is the clearest proxy for committed work beyond the current hulls. ${loc}'s pace is consistent with the operator's public 2-year delivery profile, not a pull-forward.`,
  power: (loc, r) => `Dispatch consistent with grid-demand call, not a strained asset. No signs of forced derate or transformer stress at the switchyard. ${loc}'s current pattern suggests ~${Math.round(4 + r() * 5)} weeks of runway on current fuel inventory without intervention.`,
  datacenter: (loc, _r) => `Thermal envelope consistent with declared PUE; the expansion substation is the binding constraint on next-phase live-date, not the buildings. ${loc} will likely light up the next hall on schedule if utility capacity clears.`,
  farm: (loc, _r) => `Growth-season outlook is tracking above baseline with no signatures of stress. Absent a late-season weather shift, ${loc}'s harvest window should land inside the operator's guided range; watch reservoir drawdown as the first early indicator of a hot, dry finish.`,
  construction: (loc, r) => `The programme is executing. ${Math.round(2 + r() * 4)}-month forward progression would put the first phase into commissioning on schedule. ${loc}'s capex footprint is running slightly ahead of the public build plan, which is the ordinary direction of drift for a well-managed project.`,
  vessel: (loc, _r) => `Traffic is typical for the window and the AOI. Nothing at ${loc} suggests sanctioned-trade displacement, ship-to-ship opacity, or transit-timing games. The pattern is consistent with commercial flow at prevailing rate dynamics.`,
  aircraft: (loc, _r) => `Fleet presence matches operator posture with no unusual staging. ${loc}'s footprint is orderly enough that any appearance of surge-parking or non-standard type mixes would be immediately visible against the baseline.`,
  military: (loc, _r) => `Garrison-life indicators are within their routine envelope; nothing at ${loc} points to rotational turnover, alert-cycle change, or pre-deployment preparation. Any escalation would likely show first as vehicle-park density changes at the motor pool, which currently sits in the ordinary range.`,
  facility: (loc, r) => `Site attribution and operational status are both clean. ${loc}'s operator chain resolves inside ${Math.round(1 + r() * 2)} hops to a named corporate parent with no sanctions overlap. Nothing in the current corpus contradicts the operator's public disclosures.`,
};

const COUNTER_EVIDENCE: Record<Mode, (r: () => number) => string> = {
  investigate: (r) => `Counter-read we tested: that the visible change reflects measurement drift rather than ground truth. The cross-sensor consistency (optical + SAR + AIS) rules this out above the ${Math.round(90 + r() * 6)}% threshold. We also tested whether the operator attribution could be a lookalike site within ~${Math.round(2 + r() * 4)} km; nothing in that radius matches the footprint signature or the operator registry.`,
  verify: (r) => `We stress-tested the identification against two plausible lookalikes in the broader region — a similar footprint footprint ~${Math.round(3 + r() * 5)} km away and a registry-only match with no on-site signature. Neither carries the full optical + entity-graph agreement that this site does. Confidence is bounded, not absolute; the residual ${Math.round(4 + r() * 8)}% uncertainty sits on operator-chain completeness, not on site identity.`,
  monitor: (r) => `The trend is directional, not noise. We partitioned the ${Math.round(60 + r() * 30)}-day window into non-overlapping sub-windows and confirmed the signal is present in each. A one-off imaging artefact or a single anomalous AIS pass could not reproduce the pattern.`,
};

export function synthesize(q: string): DemoResult {
  const seed = hash(q.trim().toLowerCase() || "vantage");
  const rand = seeded(seed);

  const loc = findLocation(q) ?? {
    name: "the AOI",
    coord: [0, 20] as [number, number],
    zoom: 3.5,
  };
  const subject = detectSubject(q);
  const mode = detectMode(q);

  const template = NARRATIVE_TEMPLATES[subject];
  const locTitle = loc.name === "the AOI" ? "The observed site" : titleCase(loc.name);
  const { headline, narrative } = template(locTitle, rand);

  // Broaden the analysis: every answer gets an implications chunk and a
  // counter-evidence / robustness chunk after the per-subject narrative.
  narrative.push({
    text: IMPLICATION_TEMPLATES[subject](locTitle, rand),
    refs: [],
  });
  narrative.push({
    text: COUNTER_EVIDENCE[mode](rand),
    refs: [],
  });

  const refs = Array.from(new Set(narrative.flatMap((n) => n.refs)));
  const evidence = makeEvidence(refs, subject, locTitle, rand);

  const aoi = loc.name === "the AOI" ? undefined : makeAOI(loc, rand);

  const confidence = +(0.74 + rand() * 0.2).toFixed(2);
  const tookMs = Math.round(1800 + rand() * 2600);

  return {
    id: `synth_${seed.toString(16)}`,
    query: q,
    headline,
    narrative,
    evidence,
    aoi,
    confidence,
    mode,
    tookMs,
    methodology: [],
    kind: "answer",
  };
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
