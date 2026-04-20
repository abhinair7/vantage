/**
 * Example queries. All lifted verbatim from Strategic Report §3.
 * Used as placeholder cycling in the hero input and the closing CTA.
 */

export const EXAMPLE_QUERIES: string[] = [
  "Has construction at Mundra Port increased over the last 6 months?",
  "Has oil storage at Cushing, Oklahoma changed since March?",
  "Verify this company's manufacturing facility in Shenzhen exists.",
  "Track ship arrivals at Mundra Port for the last 30 days.",
  "Evidence of deforestation at these coordinates, 2020 to today?",
];

/**
 * Modes — Strategic Report §3, Technical Report §3. Pricing and positioning
 * verbatim from the reports. No new marketing copy.
 */
export type Mode = {
  id: "investigate" | "verify" | "monitor";
  label: string;
  customer: string;
  pricing: string;
  features: string[];
  specimenQuery: string;
  specimenOutput: string;
};

export const MODES: Mode[] = [
  {
    id: "investigate",
    label: "Investigate",
    customer: "Journalists · OSINT researchers · NGOs",
    pricing: "Free / $29 mo",
    features: [
      "Public shareable links",
      "Social preview cards",
      "Case-study library",
    ],
    specimenQuery:
      "Russian armor movements at Crimean rail sidings, last 48 hours.",
    specimenOutput:
      "14 freight cars relocated eastward between 03:12 and 07:41 UTC. Two independent Sentinel-2 passes + one SAR confirmation. Shareable URL generated.",
  },
  {
    id: "verify",
    label: "Verify",
    customer: "Due diligence · Compliance · ESG",
    pricing: "$99 – $299 mo",
    features: [
      "PDF export with audit trail",
      "Methodology disclosure block",
      "Verified per-claim citations",
    ],
    specimenQuery:
      "Does Shenzhen Luohu Industrial Co. operate the facility at 22.55°N 114.11°E?",
    specimenOutput:
      "Facility exists. Ownership chain traced through 2 Wikidata hops → OpenCorporates entity Q4829913. Last activity 2026-04-12. Full audit trail exportable as PDF appendix.",
  },
  {
    id: "monitor",
    label: "Monitor",
    customer: "Hedge funds · Family offices · Commodities",
    pricing: "$499+ mo, API",
    features: [
      "Recurring monitoring + alerts",
      "Historical backtesting",
      "Webhook delivery + programmatic API",
    ],
    specimenQuery:
      "Alert me if vessel count at Port of Shahid Rajaee exceeds 30 per week.",
    specimenOutput:
      "Monitor active. Next scheduled run 2026-04-20 06:00 UTC. Historical mean 23 vessels/week (σ 4.1). Webhook POST configured.",
  },
];
