"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import type { DemoResult } from "../lib/demo-results";
import { MapView, type MapHandle } from "./map-view";

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
      className="page-wide fade-up"
      style={{
        paddingTop: "0.6rem",
        paddingBottom: "4rem",
        display: "grid",
        gridTemplateColumns: isInsufficient
          ? "1fr"
          : "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: "1.6rem",
      }}
    >
      {!isInsufficient && result.aoi && (
        <div
          className="card"
          style={{
            minHeight: 520,
            position: "relative",
            padding: 0,
            overflow: "hidden",
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
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
        {/* Headline + meta */}
        <div>
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
              <>
                <span className="mono" style={{ color: "var(--fg-4)", fontSize: 11 }}>
                  confidence {(result.confidence * 100).toFixed(0)}%
                </span>
                <div
                  aria-hidden
                  style={{
                    flex: "0 0 120px",
                    height: 4,
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
                      background:
                        result.confidence >= 0.85
                          ? "var(--good)"
                          : result.confidence >= 0.7
                          ? "var(--accent)"
                          : "var(--warn)",
                      borderRadius: 999,
                      transition: "width var(--t-slow) var(--ease-apple)",
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <h2
            className="display-md"
            style={{
              marginTop: 0,
              letterSpacing: "-0.018em",
              color: "var(--fg-1)",
              fontWeight: 600,
              fontSize: 26,
              lineHeight: 1.2,
            }}
          >
            {result.headline}
          </h2>
        </div>

        {/* Narrative with clickable citation chips */}
        {!isInsufficient && (
          <div
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
              <p
                key={i}
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
              </p>
            ))}
          </div>
        )}

        {/* Insufficient branch — single "we refused to guess" paragraph */}
        {isInsufficient && (
          <p
            style={{
              margin: 0,
              color: "var(--fg-2)",
              fontSize: 16,
              lineHeight: 1.55,
              letterSpacing: "-0.011em",
            }}
          >
            {result.narrative[0].text}
          </p>
        )}

        {/* Evidence ledger — rows are clickable and hoverable */}
        {!isInsufficient && result.evidence.length > 0 && (
          <div className="card-tight" style={{ padding: "1rem 1.1rem" }}>
            <div
              className="eyebrow"
              style={{
                color: "var(--fg-4)",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>EVIDENCE LEDGER</span>
              <span style={{ color: "var(--fg-4)" }}>
                {result.evidence.length} records · click to locate
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {result.evidence.map((e) => {
                const isFocused = hoveredRef === e.id;
                return (
                  <button
                    type="button"
                    key={e.id}
                    id={e.id}
                    onClick={() => focusEvidence(e.id)}
                    onMouseEnter={() => setHoveredRef(e.id)}
                    onMouseLeave={() => setHoveredRef(null)}
                    style={{
                      all: "unset",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "0.8rem",
                      alignItems: "baseline",
                      padding: "0.55rem 0.7rem",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isFocused ? "rgba(0, 113, 227, 0.06)" : "transparent",
                      boxShadow: isFocused
                        ? "inset 0 0 0 1px rgba(0, 113, 227, 0.25)"
                        : "inset 0 0 0 1px transparent",
                      transition:
                        "background var(--t-quick) var(--ease-apple), box-shadow var(--t-quick) var(--ease-apple)",
                    }}
                  >
                    <span
                      className="evidence-ref"
                      style={{ alignSelf: "start", marginTop: 2 }}
                    >
                      {e.id}
                    </span>
                    <div>
                      <div
                        style={{
                          color: "var(--fg-1)",
                          fontSize: 14,
                          letterSpacing: "-0.01em",
                          marginBottom: 2,
                        }}
                      >
                        {e.claim}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 11, color: "var(--fg-4)" }}
                      >
                        {e.kind.toUpperCase()} · {e.source}
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--fg-4)",
                        whiteSpace: "nowrap",
                      }}
                      title="source content hash"
                    >
                      {e.hash}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Methodology */}
        <details className="card-tight" style={{ padding: "0.9rem 1.1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--fg-2)",
              fontSize: 14,
              letterSpacing: "-0.01em",
            }}
          >
            <span>How this was computed</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>
              methodology
            </span>
          </summary>
          <ul
            style={{
              margin: "0.8rem 0 0",
              paddingLeft: "1.1rem",
              color: "var(--fg-3)",
              fontSize: 14,
              lineHeight: 1.55,
              letterSpacing: "-0.01em",
            }}
          >
            {result.methodology.map((m, i) => (
              <li key={i} style={{ marginBottom: "0.3rem" }}>
                {m}
              </li>
            ))}
          </ul>
        </details>

        <div style={{ display: "flex", gap: "0.6rem", paddingTop: "0.4rem" }}>
          <button
            type="button"
            className="btn"
            onClick={onReset}
            style={{ fontSize: 14 }}
          >
            Ask another
          </button>
        </div>
      </div>
    </section>
  );
}
