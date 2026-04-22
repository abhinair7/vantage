"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DemoResult, NarrativeChunk } from "../lib/demo-results";
import { detectSubject, subjectLabel } from "../lib/query-intel";
import { MapView, type MapHandle } from "./map-view";

const EASE = [0.22, 0.61, 0.36, 1] as const;
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});
const shortSource = (source: string) => source.split("·")[0].trim();

type Props = {
  result: DemoResult;
  onReset: () => void;
};

type BriefCard = {
  label: string;
  title: string;
  body: string;
};

type NarrativeSection = NarrativeChunk & {
  title: string;
};

export function Result({ result, onReset }: Props) {
  const isInsufficient = result.kind === "insufficient";
  const mapRef = useRef<MapHandle | null>(null);
  const sourcesRef = useRef<HTMLDetailsElement | null>(null);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);
  const briefCards = useMemo(() => deriveBriefCards(result), [result]);
  const sections = useMemo(() => deriveSections(result), [result]);

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
        gap: "1.5rem",
        maxWidth: 1040,
        margin: "0 auto",
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

      {!isInsufficient && result.aoi && (
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
              window.setTimeout(() => setHoveredRef((value) => (value === id ? null : value)), 1400);
            }}
          />
        </motion.div>
      )}

      <motion.div {...reveal(0.05)}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginBottom: "0.9rem",
            flexWrap: "wrap",
          }}
        >
          <span
            className="eyebrow"
            style={{
              color: isInsufficient ? "var(--bad)" : "var(--good)",
            }}
          >
            {isInsufficient ? "INSUFFICIENT EVIDENCE" : `DECISION BRIEF · ${result.mode.toUpperCase()}`}
          </span>
          <span className="mono" style={{ color: "var(--fg-4)", fontSize: 11 }}>
            {(result.tookMs / 1000).toFixed(2)}s
          </span>
          {!isInsufficient && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              aria-label={`Confidence ${(result.confidence * 100).toFixed(0)} percent`}
            >
              <span className="mono" style={{ color: "var(--fg-3)", fontSize: 11 }}>
                {(result.confidence * 100).toFixed(0)}%
              </span>
              <div
                aria-hidden
                style={{
                  flex: "0 0 120px",
                  height: 3,
                  background: "var(--line)",
                  borderRadius: 999,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${Math.round(result.confidence * 100)}%`,
                    background: "var(--accent)",
                    borderRadius: 999,
                    transition: "width var(--t-slow) var(--ease-apple)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <h2
          className="display-md"
          style={{
            marginTop: 0,
            marginBottom: 0,
            letterSpacing: "-0.028em",
            color: "var(--fg-1)",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 36,
            lineHeight: 1.08,
            maxWidth: "18ch",
          }}
        >
          {result.headline}
        </h2>
      </motion.div>

      <motion.div
        {...reveal(0.12)}
        className="result-brief-grid"
      >
        {briefCards.map((card) => (
          <article key={card.label} className="card-tight result-brief-card">
            <span className="eyebrow">{card.label}</span>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </motion.div>

      <div className="result-analysis-grid">
        {sections.map((section, index) => (
          <motion.article
            key={`${section.title}-${index}`}
            {...reveal(0.18 + index * 0.08)}
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

      {!isInsufficient && result.evidence.length > 0 && (
        <motion.details
          {...reveal(0.42)}
          ref={sourcesRef}
          className="card-tight result-accordion"
        >
          <summary className="result-accordion-summary">
            <span>Sourced evidence</span>
            <span className="mono">{result.evidence.length}</span>
          </summary>

          <div className="result-source-list">
            {result.evidence.map((e) => {
              const isFocused = hoveredRef === e.id;
              return (
                <button
                  type="button"
                  key={e.id}
                  id={e.id}
                  className={`result-source-row${isFocused ? " is-focused" : ""}`}
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
              );
            })}
          </div>
        </motion.details>
      )}

      {result.methodology.length > 0 && (
        <motion.details
          {...reveal(0.5)}
          className="card-tight result-accordion"
        >
          <summary className="result-accordion-summary">
            <span>How this was built</span>
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
  const labelsByMode: Record<DemoResult["mode"], string[]> = {
    investigate: ["Executive call", "Commercial implication", "Decision use", "Counter-case"],
    verify: ["Verification call", "Risk relevance", "Decision use", "Residual uncertainty"],
    monitor: ["Trend call", "Business implication", "What to watch next", "What could change the call"],
  };

  const fallbackLabels = labelsByMode[result.mode];
  return result.narrative.map((chunk, index) => ({
    ...chunk,
    title:
      result.kind === "insufficient"
        ? "Why the answer was withheld"
        : fallbackLabels[index] ?? `Supporting point ${index + 1}`,
  }));
}

function deriveBriefCards(result: DemoResult): BriefCard[] {
  const subject = detectSubject(result.query);
  const subjectText = subjectLabel(subject);

  if (result.kind === "insufficient") {
    return [
      {
        label: "Decision",
        title: "Hold",
        body: "Do not treat this as decision-grade yet. The grounded signal did not clear the bar.",
      },
      {
        label: "Why",
        title: "Evidence gap",
        body: "The system could not resolve enough location or source context to make a credible call.",
      },
      {
        label: "Next move",
        title: "Add specificity",
        body: "Include the operator, coordinates, or a cleaner place reference before running this again.",
      },
    ];
  }

  const decisionTitle =
    result.mode === "verify"
      ? "Proceed to diligence"
      : result.mode === "monitor"
        ? "Add to watchlist"
        : "Escalate selectively";

  const impactTitle =
    subject === "port" || subject === "vessel"
      ? "Supply-chain exposure"
      : subject === "storage" || subject === "refinery" || subject === "power"
        ? "Market-moving asset"
        : "Strategic site relevance";

  const nextMoveTitle =
    result.mode === "verify"
      ? "Check ownership and counterparties"
      : result.mode === "monitor"
        ? "Stand up recurring collection"
        : "Point deeper EO here";

  return [
    {
      label: "Decision",
      title: decisionTitle,
      body: `Confidence is ${(result.confidence * 100).toFixed(0)}%, which is enough to use this as a triage input rather than a final memo.`,
    },
    {
      label: "Business impact",
      title: impactTitle,
      body: `The question is really about a ${subjectText} signal and whether it matters enough to move risk, spend, or timing.`,
    },
    {
      label: "Next move",
      title: nextMoveTitle,
      body: nextMoveCopy(result.mode, subject),
    },
  ];
}

function nextMoveCopy(mode: DemoResult["mode"], subject: string): string {
  if (mode === "verify") {
    return "Follow with operator-chain checks, sanctions screening, and a fresh imagery pass before you treat the site as cleared.";
  }
  if (mode === "monitor") {
    return "Keep the satellite map as the operational frame, then add recurring imagery and traffic feeds to turn this into a real watchlist signal.";
  }
  if (subject === "construction" || subject === "port" || subject === "storage") {
    return "The next honest step is time-series collection, not more prose. This already tells you where to point it.";
  }
  return "Use this to decide whether the site deserves another hour of analyst time, not to skip the next layer of diligence.";
}
