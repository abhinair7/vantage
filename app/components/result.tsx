"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DemoResult } from "../lib/demo-results";
import { MapView, type MapHandle } from "./map-view";

/** Shared easing and stagger config — keep motion feeling like one system. */
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

/**
 * The answer pane.
 * Left: map with AOI overlays + interactive chrome (basemap toggle, swipe
 *       slider, fit-to-AOI, evidence markers).
 * Right: headline, narrative with clickable evidence chips, evidence ledger,
 *        confidence + methodology + reset.
 *
 * Cross-linking:
 *   - Click an evidence chip (e1, s3 …) → map flies to the backing feature
 *     and the ledger row is scrolled into view.
 *   - Hover a narrative chunk or ledger row → the matching chips highlight.
 *   - Click a polygon / marker on the map → the ledger row is scrolled into
 *     view, same highlight effect.
 *
 * If the result is an "insufficient" verdict there's no map; methodology
 * bullets take over and the pane stays intentionally sparse (§7.7).
 */
export function Result({ result, onReset }: Props) {
  const isInsufficient = result.kind === "insufficient";
  const mapRef = useRef<MapHandle | null>(null);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);

  /** Scroll the matching evidence-ledger row into view and flash it. */
  const scrollToLedgerRow = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("is-flashed");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("is-flashed");
  }, []);

  /** A click on any evidence chip or map feature routes through here. */
  const focusEvidence = useCallback(
    (id: string) => {
      mapRef.current?.flyToEvidence(id);
      scrollToLedgerRow(id);
    },
    [scrollToLedgerRow]
  );

  return (
    <section
      className="page-wide result-shell"
      style={{
        paddingTop: "0.2rem",
        paddingBottom: "4rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.6rem",
        maxWidth: 960,
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
            maxHeight: 360,
            width: "100%",
          }}
        >
          <MapView
            ref={mapRef}
            aoi={result.aoi}
            onFeatureClick={(id) => {
              scrollToLedgerRow(id);
              setHoveredRef(id);
              window.setTimeout(() => setHoveredRef((v) => (v === id ? null : v)), 1400);
            }}
          />
        </motion.div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
        {/* Headline + meta */}
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
              {isInsufficient
                ? "INSUFFICIENT EVIDENCE"
                : `ANSWER · ${result.mode.toUpperCase()}`}
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
              letterSpacing: "-0.028em",
              color: "var(--fg-1)",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 34,
              lineHeight: 1.08,
            }}
          >
            {result.headline}
          </h2>
        </motion.div>

        {/* Narrative with clickable citation chips */}
        {!isInsufficient && (
          <motion.div
            {...reveal(0.18)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              color: "var(--fg-2)",
              fontSize: 16,
              lineHeight: 1.55,
              letterSpacing: "-0.011em",
            }}
          >
            {result.narrative.map((chunk, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22 + i * 0.08, ease: EASE }}
                style={{ margin: 0 }}
                onMouseEnter={() => setHoveredRef(chunk.refs[0] ?? null)}
                onMouseLeave={() => setHoveredRef(null)}
              >
                {chunk.text}
                {chunk.refs.length > 0 && (
                  <>
                    {" "}
                    {chunk.refs.map((ref, j) => (
                      <Fragment key={ref}>
                        <button
                          type="button"
                          className={`evidence-ref ${
                            hoveredRef === ref ? "is-hovered" : ""
                          }`}
                          onClick={() => focusEvidence(ref)}
                          onMouseEnter={() => setHoveredRef(ref)}
                          onMouseLeave={() => setHoveredRef(null)}
                          aria-label={`Focus evidence ${ref}`}
                          style={{ border: 0, font: "inherit" }}
                        >
                          {ref}
                        </button>
                        {j < chunk.refs.length - 1 ? " " : ""}
                      </Fragment>
                    ))}
                  </>
                )}
              </motion.p>
            ))}
          </motion.div>
        )}

        {/* Insufficient branch — single "we refused to guess" paragraph */}
        {isInsufficient && (
          <motion.p
            {...reveal(0.15)}
            style={{
              margin: 0,
              color: "var(--fg-2)",
              fontSize: 16,
              lineHeight: 1.55,
              letterSpacing: "-0.011em",
            }}
          >
            {result.narrative[0].text}
          </motion.p>
        )}

        {/* Evidence ledger — compact reference strip */}
        {!isInsufficient && result.evidence.length > 0 && (
          <motion.div {...reveal(0.35)} style={{ marginTop: "0.4rem" }}>
            <div
              className="eyebrow"
              style={{
                color: "var(--fg-4)",
                marginBottom: "0.55rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <span>SOURCES</span>
              <span
                aria-hidden
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--line)",
                }}
              />
              <span style={{ color: "var(--fg-4)" }}>
                {result.evidence.length}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
              }}
            >
              {result.evidence.map((e, i) => {
                const isFocused = hoveredRef === e.id;
                return (
                  <motion.button
                    type="button"
                    key={e.id}
                    id={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.45 + i * 0.04, ease: EASE }}
                    onClick={() => focusEvidence(e.id)}
                    onMouseEnter={() => setHoveredRef(e.id)}
                    onMouseLeave={() => setHoveredRef(null)}
                    title={`${e.claim} — ${e.source}`}
                    style={{
                      all: "unset",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      padding: "0.28rem 0.55rem 0.28rem 0.35rem",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 11.5,
                      color: isFocused ? "var(--fg-1)" : "var(--fg-3)",
                      background: isFocused ? "rgba(0, 113, 227, 0.10)" : "rgba(255, 255, 255, 0.03)",
                      boxShadow: isFocused
                        ? "inset 0 0 0 1px rgba(0, 113, 227, 0.35)"
                        : "inset 0 0 0 1px var(--line)",
                      transition:
                        "background var(--t-quick) var(--ease-apple), box-shadow var(--t-quick) var(--ease-apple), color var(--t-quick) var(--ease-apple)",
                    }}
                  >
                    <span className="evidence-ref">{e.id}</span>
                    <span className="mono" style={{ fontSize: 10.5 }}>
                      {e.kind.toUpperCase()}
                    </span>
                    <span style={{ color: "var(--fg-4)" }}>·</span>
                    <span style={{ letterSpacing: "-0.005em" }}>
                      {shortSource(e.source)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

      </div>
    </section>
  );
}
