"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DemoResult, NarrativeChunk } from "../lib/demo-results";
import { detectMeasurementIntent, detectSubject, subjectLabel } from "../lib/query-intel";
import { MapView, type MapHandle } from "./map-view";

const EASE = [0.22, 0.61, 0.36, 1] as const;
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

type Props = {
  result: DemoResult;
  onReset: () => void;
  /**
   * Re-run the same query under the evidence-floor override.
   * Called when the customer clicks "show analysis anyway" on an
   * insufficient brief that still resolved a place.
   */
  onForceRun?: () => void;
};

type BriefCard = {
  label: string;
  title: string;
  body: string;
};

type NarrativeSection = NarrativeChunk & {
  title: string;
};

export function Result({ result, onReset, onForceRun }: Props) {
  const isInsufficient = result.kind === "insufficient";
  // Offer the override only when the place resolved cleanly (aoi exists)
  // and the Gatekeeper short-circuited before the full narrative ran.
  const canForceRun =
    isInsufficient && Boolean(result.aoi) && !result.overrideApplied && typeof onForceRun === "function";
  const mapRef = useRef<MapHandle | null>(null);
  const sourcesRef = useRef<HTMLDetailsElement | null>(null);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);

  const briefCards = useMemo(() => deriveBriefCards(result), [result]);
  const sections = useMemo(() => deriveSections(result), [result]);
  const sourceSummary = useMemo(() => deriveSourceSummary(result), [result]);
  const topline = useMemo(() => deriveTopline(result), [result]);

  const openSources = useCallback(() => {
    if (sourcesRef.current && !sourcesRef.current.open) {
      sourcesRef.current.open = true;
    }
  }, []);

  const scrollToLedgerRow = useCallback(
    (id: string) => {
      openSources();
      window.setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("is-flashed");
        void (el as HTMLElement).offsetWidth;
        el.classList.add("is-flashed");
      }, 60);
    },
    [openSources],
  );

  const focusEvidence = useCallback(
    (id: string) => {
      mapRef.current?.flyToEvidence(id);
      scrollToLedgerRow(id);
    },
    [scrollToLedgerRow],
  );

  return (
    <section
      className="page-wide result-shell"
      style={{
        paddingTop: "0.2rem",
        paddingBottom: "4rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
        maxWidth: 1040,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <motion.button
          type="button"
          onClick={onReset}
          className="result-back"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          aria-label="Back to search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Back</span>
        </motion.button>

        {canForceRun && (
          <motion.button
            type="button"
            onClick={onForceRun}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            title="Run the pipeline past the Gatekeeper's evidence floor and show a best-effort brief."
            style={{
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--warn, #b45309)",
              padding: "0.5rem 0.85rem",
              borderRadius: 999,
              font: "inherit",
              fontSize: 12,
              letterSpacing: "0.02em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span aria-hidden>⚠︎</span>
            <span>Show analysis anyway</span>
          </motion.button>
        )}
      </div>

      {result.notice && (
        <motion.div
          {...reveal(0.02)}
          role="note"
          className="card-tight"
          style={{
            borderColor: "var(--warn, #b45309)",
            background: "rgba(180, 83, 9, 0.06)",
            color: "var(--fg-1)",
            fontSize: 13,
            lineHeight: 1.45,
            display: "flex",
            gap: "0.6rem",
            alignItems: "flex-start",
          }}
        >
          <span aria-hidden style={{ color: "var(--warn, #b45309)", fontSize: 16, lineHeight: 1 }}>
            ⚠︎
          </span>
          <span>{result.notice}</span>
        </motion.div>
      )}

      <motion.div {...reveal(0.04)} className="card-tight result-decision-band">
        <div className="result-decision-copy">
          <div className="result-status-row">
            <span
              className="eyebrow"
              style={{
                color: isInsufficient ? "var(--bad)" : "var(--good)",
              }}
            >
              {isInsufficient ? "BRIEF WITHHELD" : `DECISION BRIEF · ${result.mode.toUpperCase()}`}
            </span>
            <span className="mono result-meta-pill">{(result.tookMs / 1000).toFixed(2)}s</span>
            {!isInsufficient && (
              <span className="mono result-meta-pill">
                {Math.round(result.confidence * 100)}% confidence
              </span>
            )}
          </div>

          <h2 className="display-md result-decision-headline">{result.headline}</h2>
          <p className="result-decision-topline">{topline}</p>
        </div>

        <div className="result-brief-grid">
          {briefCards.map((card) => (
            <article key={card.label} className="card-tight result-brief-card">
              <span className="eyebrow">{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </motion.div>

      {result.aoi && (
        <motion.div
          className="card card-lifted result-map"
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: EASE }}
          style={{
            position: "relative",
            padding: 0,
            overflow: "hidden",
            aspectRatio: "16 / 9",
            maxHeight: 420,
            width: "100%",
          }}
        >
          <MapView
            ref={mapRef}
            aoi={result.aoi}
            onFeatureClick={(id) => {
              focusEvidence(id);
              setHoveredRef(id);
              window.setTimeout(() => {
                setHoveredRef((value) => (value === id ? null : value));
              }, 1400);
            }}
          />
        </motion.div>
      )}

      <div className="result-analysis-grid">
        {sections.map((section, index) => (
          <motion.article
            key={`${section.title}-${index}`}
            {...reveal(0.14 + index * 0.06)}
            className="card-tight result-analysis-card"
            onMouseEnter={() => setHoveredRef(section.refs[0] ?? null)}
            onMouseLeave={() => setHoveredRef(null)}
          >
            <div className="result-analysis-head">
              <span className="eyebrow">{section.title}</span>
            </div>
            <p className="result-analysis-body">
              {renderChunk(section, hoveredRef, focusEvidence, setHoveredRef)}
            </p>
          </motion.article>
        ))}
      </div>

      {result.evidence.length > 0 && (
        <motion.details
          {...reveal(0.34)}
          ref={sourcesRef}
          className="card-tight result-accordion"
        >
          <summary className="result-accordion-summary result-accordion-summary--stacked">
            <div>
              <span>Sourced evidence pack</span>
              <p className="result-accordion-note">
                Compact by default. Expand for the full ledger and source links.
              </p>
            </div>

            <div className="result-accordion-pills">
              <span className="mono result-summary-pill">{result.evidence.length} refs</span>
              {sourceSummary.map((item) => (
                <span key={item} className="mono result-summary-pill">
                  {item}
                </span>
              ))}
            </div>
          </summary>

          <div className="result-source-list">
            {result.evidence.map((e) => {
              const isFocused = hoveredRef === e.id;
              return (
                <div
                  key={e.id}
                  className={`result-source-row${isFocused ? " is-focused" : ""}`}
                >
                  <button
                    type="button"
                    id={e.id}
                    className="result-source-main"
                    onClick={() => focusEvidence(e.id)}
                    onMouseEnter={() => setHoveredRef(e.id)}
                    onMouseLeave={() => setHoveredRef(null)}
                    title={`${e.claim} — ${e.source}`}
                  >
                    <span className="evidence-ref">{e.id}</span>
                    <div className="result-source-copy">
                      <div>{e.claim}</div>
                      <div className="mono">
                        {e.kind.toUpperCase()} · {e.source}
                      </div>
                    </div>
                    <span className="mono result-source-short">{shortSource(e.source)}</span>
                  </button>

                  {e.sourceUrl && (
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="result-source-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </motion.details>
      )}

      {result.methodology.length > 0 && (
        <motion.details
          {...reveal(0.4)}
          className="card-tight result-accordion"
        >
          <summary className="result-accordion-summary">
            <span>Method and limits</span>
            <span className="mono">{result.methodology.length}</span>
          </summary>
          <ul className="result-method-list">
            {result.methodology.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </motion.details>
      )}
    </section>
  );
}

function renderChunk(
  chunk: NarrativeChunk,
  hoveredRef: string | null,
  focusEvidence: (id: string) => void,
  setHoveredRef: (id: string | null) => void,
) {
  return (
    <>
      {chunk.text}
      {chunk.refs.length > 0 && (
        <>
          {" "}
          {chunk.refs.map((ref, index) => (
            <Fragment key={ref}>
              <button
                type="button"
                className={`evidence-ref ${hoveredRef === ref ? "is-hovered" : ""}`}
                onClick={() => focusEvidence(ref)}
                onMouseEnter={() => setHoveredRef(ref)}
                onMouseLeave={() => setHoveredRef(null)}
                aria-label={`Focus evidence ${ref}`}
                style={{ border: 0, font: "inherit" }}
              >
                {ref}
              </button>
              {index < chunk.refs.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}

function deriveSections(result: DemoResult): NarrativeSection[] {
  const measurementIntent = detectMeasurementIntent(result.query);
  const labelsByMode: Record<DemoResult["mode"], string[]> = {
    investigate: [
      "Operating picture",
      "Commercial read-through",
      "Confidence and limits",
      "Recommended next step",
    ],
    verify: [
      "Site validation",
      "Risk relevance",
      "Confidence and limits",
      "Recommended next step",
    ],
    monitor: [
      "Operating picture",
      "Signal read-through",
      "Confidence and limits",
      "Recommended next step",
    ],
  };

  const withheldLabels = [
    "Why the brief was withheld",
    "What limited the read",
    "What to change next",
  ];

  const measurementLabels = [
    "Resolved site",
    "Footprint read",
    "Confidence and limits",
    "Recommended next step",
  ];

  return result.narrative.map((chunk, index) => ({
    ...chunk,
    title:
      result.kind === "insufficient"
        ? withheldLabels[index] ?? "Why the brief stopped here"
        : measurementIntent === "footprint"
          ? measurementLabels[index] ?? `Supporting point ${index + 1}`
        : labelsByMode[result.mode][index] ?? `Supporting point ${index + 1}`,
  }));
}

function deriveBriefCards(result: DemoResult): BriefCard[] {
  const subject = detectSubject(result.query);
  const subjectText = subjectLabel(subject);
  const measurementIntent = detectMeasurementIntent(result.query);

  if (result.kind === "insufficient") {
    return [
      {
        label: "Decision",
        title: "Hold the call",
        body: "Do not treat this as decision-grade yet. The grounded signal did not clear the bar.",
      },
      {
        label: "Why",
        title: "Evidence floor missed",
        body: "The system found either too little location context or too little source diversity to support a credible brief.",
      },
      {
        label: "Next move",
        title: "Add specificity",
        body: "Include the operator, coordinates, or a cleaner place reference before you run this again.",
      },
    ];
  }

  if (measurementIntent === "footprint") {
    return [
      {
        label: "Recommendation",
        title: "Use as mapped baseline",
        body: `Treat this as a current mapped-area read. ${Math.round(result.confidence * 100)}% confidence is enough for sizing and scoping, not for pretending this is a fresh as-built survey.`,
      },
      {
        label: "Why it matters",
        title: "Site sizing reference",
        body: `The useful output here is direct: a grounded footprint number for the resolved ${subjectText}, so planning, diligence, and fieldwork start from the same spatial reference.`,
      },
      {
        label: "Decision posture",
        title: "Do not overstate recency",
        body: "Use this for current mapped footprint. If the real question is live occupancy, recent expansion, or built-up change, switch to an imagery pass next.",
      },
    ];
  }

  const decisionTitle =
    result.mode === "verify"
      ? "Proceed to diligence"
      : result.mode === "monitor"
        ? "Add to watchlist"
        : "Escalate selectively";

  const useTitle =
    result.mode === "verify"
      ? "Diligence kickoff"
      : result.mode === "monitor"
        ? "Monitoring frame"
        : "Triage brief";

  const impactTitle =
    subject === "port" || subject === "vessel"
      ? "Supply-chain exposure"
      : subject === "traffic"
        ? "Mobility / access risk"
      : subject === "storage" || subject === "refinery" || subject === "power"
        ? "Market-moving asset"
        : "Strategic site relevance";

  return [
    {
      label: "Recommendation",
      title: decisionTitle,
      body: `Use this as a ${useTitle.toLowerCase()}, not as the final memo. ${Math.round(result.confidence * 100)}% confidence is enough to move the next decision, not skip it.`,
    },
    {
      label: "Why it matters",
      title: impactTitle,
      body: `The business question is really about a ${subjectText} signal and whether it matters enough to move risk, spend, timing, or follow-on work.`,
    },
    {
      label: "Decision posture",
      title: result.mode === "monitor" ? "Stay honest on trend claims" : "Keep one foot on the brake",
      body: nextMoveCopy(result.mode, subject),
    },
  ];
}

function deriveTopline(result: DemoResult): string {
  const measurementIntent = detectMeasurementIntent(result.query);

  if (result.kind === "insufficient") {
    return "The system stopped at the evidence floor rather than filling the gap with generic AI prose.";
  }

  if (measurementIntent === "footprint") {
    return "Best used as a direct mapped-footprint read, with the limit that map geometry can lag real-world construction or site edits.";
  }

  if (result.mode === "verify") {
    return "Best used to validate that the site is real, relevant, and worth deeper diligence.";
  }

  if (result.mode === "monitor") {
    return "Best used to frame a watchlist and decide what recurring collection should be aimed here next.";
  }

  return "Best used as a strategic or operational triage brief to decide whether this deserves more analyst time.";
}

function deriveSourceSummary(result: DemoResult): string[] {
  const unique = Array.from(new Set(result.evidence.map((item) => shortSource(item.source))));
  return unique.slice(0, 3);
}

function nextMoveCopy(mode: DemoResult["mode"], subject: string): string {
  if (mode === "verify") {
    return "Follow with operator-chain checks, sanctions screening, and a fresh imagery pass before you treat the site as cleared.";
  }
  if (mode === "monitor") {
    return "Keep the satellite map as the operational frame, then add recurring imagery and movement feeds before you claim the trend is real.";
  }
  if (subject === "traffic") {
    return "Use this to adjust access planning, route assumptions, or site timing, then add a live traffic feed before you make hard operational calls.";
  }
  if (subject === "construction" || subject === "port" || subject === "storage") {
    return "The next honest step is time-series collection, not more narrative polish. This already tells you where to point it.";
  }
  return "Use this to decide whether the site deserves another hour of analyst time, not to skip the next layer of diligence.";
}

function shortSource(source: string): string {
  return source.split("·")[0].trim();
}
