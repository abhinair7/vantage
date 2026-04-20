"use client";

import { Fragment, useMemo } from "react";
import type { DemoResult } from "../lib/demo-results";
import { MapView } from "./map-view";

type Props = {
  result: DemoResult;
  onReset: () => void;
};

/**
 * The answer pane.
 * Left: map with AOI overlays (before/after polygons).
 * Right: headline, narrative with inline evidence refs, evidence ledger,
 *        confidence + methodology + reset.
 *
 * If the result is an "insufficient" verdict there's no map; the methodology
 * bullets take over and the pane stays intentionally sparse — silence is a
 * feature (Technical Report §7.7).
 */
export function Result({ result, onReset }: Props) {
  const isInsufficient = result.kind === "insufficient";

  return (
    <section
      className="page-wide fade-up"
      style={{
        paddingTop: "0.6rem",
        paddingBottom: "4rem",
        display: "grid",
        gridTemplateColumns: isInsufficient ? "1fr" : "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: "1.6rem",
      }}
    >
      {!isInsufficient && result.aoi && (
        <div
          className="card"
          style={{
            minHeight: 460,
            position: "relative",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <MapView aoi={result.aoi} />

          {/* Map chrome — corner badges for the polygons */}
          <div
            style={{
              position: "absolute",
              top: "0.8rem",
              left: "0.8rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              pointerEvents: "none",
            }}
          >
            {result.aoi.polygons.map((p) => (
              <div
                key={p.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.3rem 0.6rem",
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 11.5,
                  color: "var(--fg-2)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background:
                      p.accent === "current"
                        ? "rgba(0, 113, 227, 0.3)"
                        : "rgba(110, 110, 115, 0.25)",
                    border:
                      p.accent === "current"
                        ? "1.5px solid #0071E3"
                        : "1.5px dashed #6E6E73",
                  }}
                />
                <span className="mono" style={{ fontSize: 11 }}>
                  {p.date}
                </span>
                <span style={{ color: "var(--fg-3)" }}>· {p.label}</span>
              </div>
            ))}
          </div>
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
            }}
          >
            <span
              className="eyebrow"
              style={{
                color: isInsufficient ? "var(--bad)" : "var(--good)",
              }}
            >
              {isInsufficient ? "INSUFFICIENT EVIDENCE" : `ANSWER · ${result.mode.toUpperCase()}`}
            </span>
            <span
              className="mono"
              style={{ color: "var(--fg-4)", fontSize: 11 }}
            >
              {(result.tookMs / 1000).toFixed(2)}s
            </span>
            {!isInsufficient && (
              <span
                className="mono"
                style={{ color: "var(--fg-4)", fontSize: 11 }}
              >
                confidence {(result.confidence * 100).toFixed(0)}%
              </span>
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

        {/* Narrative with inline citation chips */}
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
              <p key={i} style={{ margin: 0 }}>
                {chunk.text}
                {chunk.refs.length > 0 && (
                  <>
                    {" "}
                    {chunk.refs.map((ref, j) => (
                      <Fragment key={ref}>
                        <a
                          className="evidence-ref"
                          href={`#${ref}`}
                          aria-label={`Evidence ${ref}`}
                        >
                          {ref}
                        </a>
                        {j < chunk.refs.length - 1 ? " " : ""}
                      </Fragment>
                    ))}
                  </>
                )}
              </p>
            ))}
          </div>
        )}

        {/* Insufficient branch — narrative is the single "we refused to guess" paragraph */}
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

        {/* Evidence ledger */}
        {!isInsufficient && result.evidence.length > 0 && (
          <div className="card-tight" style={{ padding: "1rem 1.1rem" }}>
            <div
              className="eyebrow"
              style={{ color: "var(--fg-4)", marginBottom: "0.75rem" }}
            >
              EVIDENCE LEDGER
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {result.evidence.map((e) => (
                <div
                  key={e.id}
                  id={e.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "0.8rem",
                    alignItems: "baseline",
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
                </div>
              ))}
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
