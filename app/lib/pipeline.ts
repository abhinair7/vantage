/**
 * The 10-node pipeline, drawn verbatim from Technical Report §7.
 * LLM-touch nodes: 0 (Parser), F (Narrator). All others deterministic.
 */

export type NodeTouch = "LLM" | "DETRM" | "ML";

export type PipelineNode = {
  id: string;          // "0", "A", "B", ...
  slug: string;        // url-safe
  name: string;
  touch: NodeTouch;
  input: string;
  processing: string;
  output: string;
  guards: string;
  sectionRef: string;  // e.g. "Technical Report §7.2"
};

export const PIPELINE: PipelineNode[] = [
  {
    id: "0",
    slug: "parser",
    name: "Query Parser",
    touch: "LLM",
    input: "Raw string. Example: Has construction at Mundra Port increased over the last 6 months?",
    processing:
      "Claude Sonnet call with structured-output mode enforcing the QueryIntent schema. Temperature 0.1 to minimize variance. System prompt explicitly prohibits the model from inventing coordinates or dates.",
    output: "Validated QueryIntent object. Schema enforced by Pydantic.",
    guards:
      "Reject if coordinates outside Earth bounds, date range in the future, or intent type unclassifiable. Fail loud.",
    sectionRef: "Technical Report §7.2",
  },
  {
    id: "A",
    slug: "spatial-resolver",
    name: "Spatial Resolver",
    touch: "DETRM",
    input: "QueryIntent with raw place reference.",
    processing:
      "Full-text + fuzzy search against places table (pg_trgm, tsvector). Rank by exact match > entity class > spatial disambiguation > popularity. Fallback to live geocoding via Mapbox or Nominatim.",
    output: "ResolvedPlace with canonical geometry, Wikidata/OSM/Overture IDs.",
    guards: "Cache hot resolutions in Redis, 24h TTL.",
    sectionRef: "Technical Report §7.3",
  },
  {
    id: "B",
    slug: "extraction",
    name: "Extraction",
    touch: "DETRM",
    input: "ResolvedPlace + time window.",
    processing:
      "Parallel fetch: Sentinel-2 L2A optical · Sentinel-1 SAR · AISStream vessels · OpenSky ADS-B · GDELT events · OpenCorporates · OFAC/EU/UK sanctions · NASA FIRMS · Sentinel-5P air quality · UN Comtrade.",
    output: "Signal[] — typed list of raw, un-interpreted data points with source, timestamp, confidence, payload.",
    guards: "Each Signal carries source_content_hash (SHA-256) for audit.",
    sectionRef: "Technical Report §7.4",
  },
  {
    id: "C",
    slug: "cv-measurement",
    name: "CV Measurement",
    touch: "ML",
    input: "Signal[] imagery subset.",
    processing:
      "Specialized vision models — never the LLM. Clay foundation embeddings · Prithvi-100M segmentation · Segment Anything 2 · Grounding DINO / YOLO-World open-vocabulary detection · NDVI/NDWI/NDBI spectral indices · xView2 damage classifier.",
    output: "Measurement[] with type, value, unit, model+version, uncertainty bounds.",
    guards: "Every measurement records numerical uncertainty_lower / uncertainty_upper.",
    sectionRef: "Technical Report §7.5",
  },
  {
    id: "D",
    slug: "cross-reference",
    name: "Cross-Reference",
    touch: "DETRM",
    input: "Signal[] + Measurement[].",
    processing:
      "Spatial join over place geometry. Temporal join over window; stale signals demoted. Entity-graph traversal up to 3 hops via Wikidata owned-by / operator / parent edges. AIS vessel → port-call matching by geofence + dwell time.",
    output: "LinkGraph — nodes are entities, edges are verified relationships with source attribution.",
    guards: "Edges without source_url are dropped before exit.",
    sectionRef: "Technical Report §7.6",
  },
  {
    id: "E",
    slug: "gatekeeper",
    name: "Gatekeeper",
    touch: "DETRM",
    input: "Signal[] + Measurement[] + LinkGraph.",
    processing:
      "Deterministic firewall between raw data and the LLM. Confidence floor 0.7. Freshness: drop imagery >30d for current-state; warn >90d for change. Cloud cover: reject Sentinel-2 tiles >30% over AOI; prefer SAR fallback. Conflict detection across independent sources.",
    output: "Evidence[] — pre-verified packets. If below threshold, short-circuit to INSUFFICIENT EVIDENCE.",
    guards:
      "Source diversity: activity-level claims require imagery AND non-imagery corroboration. Attribution completeness required. Silence is a feature.",
    sectionRef: "Technical Report §7.7",
  },
  {
    id: "F",
    slug: "narration",
    name: "Narration",
    touch: "LLM",
    input: "Evidence[] + QueryIntent only. Never raw signals.",
    processing:
      "Claude call, temperature 0.3. System prompt requires every factual claim to cite an evidence_id. Narrative glue permitted only as connective tissue. Structured output mode: NarrativeChunk[] with text + evidence_refs.",
    output: "AnalysisDraft — structured narrative with per-chunk evidence references.",
    guards:
      "No web tool. No code execution. No external data access during this call. LLM is on a leash.",
    sectionRef: "Technical Report §7.8",
  },
  {
    id: "G",
    slug: "citation-verifier",
    name: "Citation Verifier",
    touch: "DETRM",
    input: "AnalysisDraft + Evidence[].",
    processing:
      "For each chunk: confirm every evidence_ref points to an evidence_id that exists. For each factual assertion: require at least one citation. NLI entailment check (local DeBERTa-MNLI — no LLM call). Chunks that fail any check are stripped.",
    output: "VerifiedNarrative — only chunks that passed all checks.",
    guards: "Stripped content logged for the hallucination-rate metric.",
    sectionRef: "Technical Report §7.9",
  },
  {
    id: "H",
    slug: "formatter",
    name: "Formatter",
    touch: "DETRM",
    input: "VerifiedNarrative + Evidence[] + ImageRef[].",
    processing:
      "Generate stable cite-URLs per evidence_id. Pair imagery renders with narrative chunks. Compute overall confidence score (aggregated, citation-count-weighted). Apply mode-specific post-processing.",
    output: "Formatted response packet: narrative + imagery + citations + confidence summary + trace.",
    guards: "Verify mode prepends a methodology block. Investigate prepends a shareable social preview.",
    sectionRef: "Technical Report §7.10",
  },
  {
    id: "I",
    slug: "persistence",
    name: "Persistence",
    touch: "DETRM",
    input: "Formatted response packet.",
    processing:
      "Insert into analyses table with JSONB output. Upsert evidence records into evidence_index. Generate embedding of query + narrative into pgvector. Push imagery renders to S3/R2. Emit Kafka event for active Monitor subscribers.",
    output: "Durable, shareable, cacheable analysis. Stream to user.",
    guards: "audit_log writes are append-only with immutable semantics.",
    sectionRef: "Technical Report §7.11",
  },
];

export const LLM_NODE_IDS = new Set(["0", "F"]);

/* ------------------------------------------------------------------
   Customer-facing pipeline.

   We run 10 nodes internally. A customer does not care whether the
   data is written to Postgres, whether we run NLI entailment on a
   local DeBERTa, or whether the formatter prepends a social preview.
   They care about the moments that feel like thinking.

   These are those moments — six steps, each a real engineering phase,
   labelled in product English.
   ------------------------------------------------------------------ */

export type CustomerStep = {
  id: string;
  label: string;
  sublabel: string;
  touch: NodeTouch;
};

export const CUSTOMER_PIPELINE: CustomerStep[] = [
  {
    id: "parse",
    label: "Understanding your question",
    sublabel: "Parsing intent, place, and time window",
    touch: "LLM",
  },
  {
    id: "locate",
    label: "Locating the area",
    sublabel: "Resolving to canonical geometry",
    touch: "DETRM",
  },
  {
    id: "pull",
    label: "Pulling imagery & signals",
    sublabel: "Sentinel-2, SAR, AIS, entity graph",
    touch: "DETRM",
  },
  {
    id: "measure",
    label: "Analyzing imagery",
    sublabel: "Vision models, never the LLM",
    touch: "ML",
  },
  {
    id: "verify",
    label: "Verifying evidence",
    sublabel: "Source checks, cross-reference, confidence floor",
    touch: "DETRM",
  },
  {
    id: "compose",
    label: "Composing the answer",
    sublabel: "Narrator on a leash — every claim cited",
    touch: "LLM",
  },
];
