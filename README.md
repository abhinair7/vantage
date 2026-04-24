# Vantage

**Grounded geospatial and public-record briefs for any site, corridor, or region.**

Live at **https://vantage-blond-nu.vercel.app**

Type a question about a place. Vantage resolves the location, calls the real
public data stack, scores the evidence, and returns a cited brief — or refuses
when the signal is too thin. Every claim in the output links to a source.

The point: a general LLM will *generate* an answer. Vantage *fetches* one,
binds every claim to a citation, and says "I don't know" when it should. That's
the moat.

---

## Architecture at a glance

```
         ┌────────────────────────────────────────────────┐
         │                  Prompt (UI)                   │
         │       hero · follow-up · Deepen action         │
         └───────────────────────┬────────────────────────┘
                                 │  { query, force, deepen }
                                 ▼
                    POST /api/analyze  (Next.js route)
                                 │
                                 ▼
         ┌────────────────────────────────────────────────┐
         │          grounded-analysis pipeline            │
         │                                                │
         │  1. Mode detector      (investigate/verify/    │
         │                         monitor + footprint)   │
         │  2. Spatial resolver   (OSM Nominatim, reverse │
         │                         geocode, place match)  │
         │  3. Nearby context     (Overpass, per-subject  │
         │                         radius + tag filters)  │
         │  4. Entity graph       (Wikidata operators,    │
         │                         owners, industries)    │
         │  5. Background         (Wikipedia extracts)    │
         │  6. Fresh reporting    (Google News RSS +      │
         │                         GDELT timeline)        │
         │  7. Gatekeeper         (evidence floor 0.58 +  │
         │                         substantive-context)   │
         │                                                │
         │  — on Deepen, also in parallel —               │
         │                                                │
         │  8.  Regulatory        (SEC EDGAR full-text)   │
         │  9.  Hazard            (USGS · NOAA · FEMA)    │
         │  10. Environment       (Open-Meteo air qual.)  │
         │  11. Permit activity   (Socrata: NYC, SF,      │
         │                         Chicago, Seattle, LA)  │
         │                                                │
         │  12. Narrative + citation verifier             │
         │  13. Headline + brief card builder             │
         │  14. AOI polygon builder (for the map view)    │
         └───────────────────────┬────────────────────────┘
                                 │
                                 ▼
                           DemoResult JSON
                                 │
                                 ▼
         ┌────────────────────────────────────────────────┐
         │                   Result (UI)                  │
         │   MapLibre AOI · narrative with inline refs    │
         │   · evidence ledger · method & limits          │
         │   · follow-up input · Deepen button · thread   │
         └────────────────────────────────────────────────┘
```

Each Deepen pack fires in parallel and appends a narrative chunk **only if the
pack returns something**. No empty sections, no hallucinated filler.

---

## Data sources — all free, no paid keys

| Layer              | Source                    | Scope             |
| ------------------ | ------------------------- | ----------------- |
| Geocoding          | OpenStreetMap Nominatim   | Global            |
| Features / POIs    | Overpass API              | Global            |
| Entity graph       | Wikidata                  | Global            |
| Background         | Wikipedia                 | Global            |
| Fresh reporting    | Google News RSS · GDELT   | Global            |
| Regulatory filings | SEC EDGAR full-text       | Global companies  |
| Earthquakes        | USGS Earthquake Hazards   | Global            |
| Weather alerts     | NOAA / NWS                | US                |
| Disaster decs.     | OpenFEMA                  | US (state)        |
| Air quality        | Open-Meteo Air Quality    | Global            |
| Permit activity    | Socrata open-data portals | NYC, SF, Chicago, Seattle, LA |

Every fetcher has a 6.5 s timeout, no retries, and falls through silently if
the source is down. The Gatekeeper decides whether the remaining evidence is
enough to serve a brief.

> SEC EDGAR requires an email-format `User-Agent`. The default is a
> placeholder; set `SEC_EDGAR_UA="Your Name your@email.com"` before deploying
> at any real traffic volume.

---

## Why it's defensible vs. a general LLM

1. **No hallucinated geography.** Coordinates, operators, filings, hazards
   come from live calls, not training weights.
2. **Refuses when the signal is thin.** The Gatekeeper's 0.58 floor produces a
   withheld brief instead of plausible-sounding prose. An optional
   *"show analysis anyway"* override exists, and the result is visibly stamped
   as a best-effort read capped below the floor.
3. **Every claim is auditable.** Evidence IDs, click-through source links,
   SHA-like hashes, a methodology bullet list.
4. **Fresh by construction.** Google News, GDELT, NOAA active alerts,
   Open-Meteo air quality. No training-cutoff blind spot.
5. **Place-native and reproducible.** Results anchor to an AOI; follow-ups
   re-enter the same pipeline with the anchor pinned.

---

## Run it locally

Requires Node 18.18+. No keys, no billing, no `.env` file.

```bash
git clone https://github.com/abhinair7/vantage.git
cd vantage
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the built app
```

---

## Try these queries

- `Mundra Port construction activity` → investigate brief with news lead.
- `Cushing, Oklahoma oil storage` → monitor brief.
- `Tesla Gigafactory Nevada` → click **Deepen** to pull SEC filings + state
  hazard context.
- `Give me a read on Hell's Kitchen, New York` → click **Deepen** to pull NYC
  DOB permits and NOAA alerts.
- Anything vague (`"how many penguins in Antarctica"`) → the Gatekeeper
  withholds and tells you why.

---

## Repo layout

```
app/
  globals.css                tokens, hero + result styles
  layout.tsx                 fonts + <html>
  page.tsx                   idle / loading / done state machine
  api/analyze/route.ts       POST → analyzeQuery({ force, deepen })
  components/
    hero-globe.tsx           Three.js Earth with PBR material
    prompt.tsx               hero + compact ask bar
    map-view.tsx             MapLibre AOI renderer
    result.tsx               brief layout + follow-up + Deepen
    smooth-scroll.tsx        small helper
  lib/
    grounded-analysis.ts     pipeline: fetchers + narrative + gatekeeper
    demo-results.ts          shared types + curated presets
    query-intel.ts           mode / subject / measurement detection
public/
  textures/                  earth day/normal/specular/clouds maps
```

Production build is ~170 KB first-load JS. Earth textures are served as static
assets from `public/`.

---

## Design notes

- **Single source-of-truth type.** `DemoResult` is the contract between the
  pipeline, the API, and the UI — presets and live runs produce the same
  shape so the UI never branches on data origin.
- **Gatekeeper with override.** The evidence floor is a real guardrail, but
  the override is a visible, opt-in escape hatch with a capped confidence —
  you can't accidentally trust an override result as decision-grade.
- **Anchored follow-ups.** Each brief carries an `anchor` (label + lat/lon).
  Follow-ups compose `"{question} near {anchor}"` and re-enter the full
  pipeline — no free-chat drift, same citation discipline every turn.
- **Parallel everything under Deepen.** EDGAR, USGS, NOAA, FEMA, Open-Meteo,
  and permit portals are fired concurrently via `Promise.allSettled` and
  bounded by a shared request timeout — a single failing source never strips
  the others from the brief.
- **Satellite-operator aesthetic.** Mono telemetry metadata (`CONF`, `T+`,
  `REFS`), hairline dividers, tick-marked section labels, coordinate readout.
  The goal is a console, not a slide deck.

---

## License

Prototype — not open source.
