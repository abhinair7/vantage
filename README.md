# Vantage — working prototype

An Apple-light, chat-first interface to Earth observation. One input. One
answer. Every claim carries its evidence. When the evidence isn't there, the
answer says so.

This repo is a **runnable prototype of the product**, not a marketing page for
it. You type a question, the pipeline runs in-line through its 10 nodes, and
the answer drops in with a map, inline citations, and an evidence ledger.
Results are pre-baked fixtures — no keys, no external services, no paid APIs.

---

## Run it locally

Requires Node 18.18+ (tested on Node 25). No API keys needed.

```bash
git clone https://github.com/abhinair7/vantage.git
cd vantage
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

> **Important:** open in a normal foreground tab. The MapLibre canvas relies
> on `requestAnimationFrame`, which browsers pause in backgrounded tabs — if
> you keep the tab hidden, the map won't paint.

### Other scripts

```bash
npm run build     # production build
npm start         # serve the production build (after build)
```

---

## What to try

From the idle hero, click a suggestion chip or type one of:

1. **"Has construction at Mundra Port increased over the last 6 months?"**
   → Investigate mode. 8.4 % quay-footprint delta across two Sentinel-2
   passes, SAR corroboration, AIS berth occupancy, ownership chain. Map shows
   October 2024 footprint (dashed) vs. February 2025 footprint (accent blue).

2. **"Has oil storage at Cushing, Oklahoma changed since March?"**
   → Monitor mode. 4.2 M-barrel drawdown via floating-roof shadow analysis.
   SAR fallback on cloudy passes. Confidence 0.79.

3. **"Verify this company's manufacturing facility in Shenzhen exists."**
   → Verify mode. Facility confirmed via two independent Sentinel-2 passes,
   ownership crosswalk (OSM → Overture → OpenCorporates), sanctions-list
   clean. Confidence 0.92.

**Anything else** — e.g. "How many penguins are in Antarctica?" — hits the
fallback: **Insufficient Evidence**. That's not an error state. It's the
product behaving correctly: the Gatekeeper refused to hand the question to
the LLM because the sources aren't there.

---

## How the flow is wired

Three states, in `app/page.tsx`:

```
 idle   ──ask──▶  running  ──done──▶  done   ──reset──▶  idle
```

- **idle** — centered hero (`components/prompt.tsx`, `compact: false`).
- **running** — slim top bar + animated pipeline rail through the 10 nodes
  (`components/runner.tsx`). Each node is labelled by touch class:
  `LLM · ON A LEASH`, `VISION MODEL`, or `DETERMINISTIC`.
- **done** — two-column pane (`components/result.tsx`): MapLibre map with
  AOI polygons on the left, headline + narrative with inline citation chips
  + evidence ledger + methodology on the right.

Pre-baked results live in `app/lib/demo-results.ts`. A cheap keyword matcher
decides which fixture to return; below threshold, the insufficient-evidence
fixture is returned.

The 10-node pipeline model (what each node does, what it's guarded on, what
touches the LLM) lives in `app/lib/pipeline.ts`.

---

## Stack

- **Next.js 16.2.4** (App Router, Turbopack) · **React 19.2.4** · **TypeScript** strict
- **Tailwind v4** with `@theme inline` tokens
- **MapLibre GL JS 5.23** · light positron raster tiles from CartoDB (no key)
- `next/font/google` — Inter (resolves to SF Pro via `-apple-system` on macOS)
  plus JetBrains Mono for numbers / eyebrows

Design tokens are defined in `app/globals.css`. Palette: white (`#FFFFFF`),
paper (`#FBFBFD`), surface (`#F5F5F7`), ink (`#1D1D1F`), Apple blue accent
(`#0071E3`).

---

## Repo layout

```
app/
  globals.css                  tokens + primitives
  layout.tsx                   next/font wiring
  page.tsx                     state machine (idle → running → done)
  components/
    prompt.tsx                 hero + compact top bar
    runner.tsx                 animated 10-node pipeline rail
    map-view.tsx               MapLibre map with AOI polygons
    result.tsx                 headline + narrative + evidence ledger
  lib/
    pipeline.ts                the 10 nodes (verbatim from Technical Report §7)
    demo-results.ts            pre-baked fixtures + fuzzy matcher
    queries.ts                 specimen queries + modes
```

---

## Things worth knowing

- **No live LLM, no live satellite pipeline.** Every answer comes from the
  static fixtures in `app/lib/demo-results.ts`. The point of the prototype is
  the *interaction model* — ask, see the pipeline, receive a cited answer —
  not the backend.
- **Every narrative chunk carries `evidence_refs`.** The rendering code only
  shows text that has at least one ref, mirroring the Technical Report §7.9
  Citation Verifier's rule: strip chunks that fail attribution.
- **Silence is a feature.** If the keyword matcher can't clear threshold the
  answer returned is "Insufficient evidence" with a methodology breakdown —
  never a made-up answer.

---

## License

Prototype / internal — not open source.
