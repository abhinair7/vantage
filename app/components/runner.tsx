"use client";

import { useEffect, useState } from "react";
import { PIPELINE, LLM_NODE_IDS } from "../lib/pipeline";
import type { DemoResult } from "../lib/demo-results";

type Props = {
  query: string;
  result: DemoResult;
  onDone: () => void;
};

/**
 * The pipeline runner — an inline animation that walks through the 10
 * nodes of the Vantage pipeline. Total duration scales with result.tookMs
 * so faster analyses feel faster.
 *
 * Visually: a horizontal rail of labelled dots. Active dot pulses. Done
 * dots fill in green. LLM-touch nodes (0, F) pick up an inner ring —
 * honoring Steve's "tell the user when the model speaks" brief.
 */
export function Runner({ query, result, onDone }: Props) {
  const [step, setStep] = useState(-1); // -1 = pre-start
  const total = PIPELINE.length;
  const perStep = Math.max(180, Math.round(result.tookMs / total));

  useEffect(() => {
    let i = 0;
    setStep(0);
    const interval = window.setInterval(() => {
      i += 1;
      if (i >= total - 1) {
        // Last node is now active — let it hold for one tick, then release
        window.clearInterval(interval);
        window.setTimeout(onDone, 320);
      }
      setStep(Math.min(i, total - 1));
    }, perStep);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  const safeStep = Math.min(Math.max(step, 0), total - 1);
  const activeNode = PIPELINE[safeStep];
  const progressed = step >= 0 ? safeStep + 1 : 0;

  return (
    <section
      className="page"
      style={{
        paddingTop: "2.4rem",
        paddingBottom: "2.6rem",
      }}
    >
      {/* The question being analyzed — small, quiet, not the hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
          marginBottom: "2.2rem",
        }}
      >
        <span className="eyebrow" style={{ color: "var(--fg-4)" }}>
          ANALYZING
        </span>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            letterSpacing: "-0.018em",
            color: "var(--fg-1)",
            lineHeight: 1.3,
          }}
        >
          {query}
        </div>
      </div>

      {/* Pipeline rail */}
      <div className="card" style={{ padding: "1.4rem 1.4rem 1.2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.7rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 500,
                color: "var(--fg-1)",
                letterSpacing: "-0.012em",
              }}
            >
              {activeNode.name}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-4)",
              }}
            >
              {String(progressed).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
          <span
            className="eyebrow"
            style={{
              color:
                activeNode.touch === "LLM"
                  ? "var(--warn)"
                  : activeNode.touch === "ML"
                  ? "var(--accent)"
                  : "var(--fg-4)",
            }}
          >
            {activeNode.touch === "LLM"
              ? "LLM · ON A LEASH"
              : activeNode.touch === "ML"
              ? "VISION MODEL"
              : "DETERMINISTIC"}
          </span>
        </div>

        {/* Rail of dots */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.7rem 0 1.4rem",
          }}
        >
          {/* Track line behind the dots */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 5,
              right: 5,
              top: "50%",
              height: 2,
              background: "var(--line)",
              borderRadius: 999,
              transform: "translateY(-50%)",
            }}
          />
          {/* Progress fill */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 5,
              top: "50%",
              height: 2,
              background: "var(--accent)",
              borderRadius: 999,
              transform: "translateY(-50%)",
              width: `calc((100% - 10px) * ${Math.max(
                0,
                Math.min(1, step / (total - 1))
              )})`,
              transition: "width var(--t-base) var(--ease-apple)",
            }}
          />

          {PIPELINE.map((node, idx) => {
            const done = idx < step;
            const active = idx === step;
            const isLLM = LLM_NODE_IDS.has(node.id);
            return (
              <div
                key={node.id}
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <span
                  className={`node-dot ${done ? "is-done" : ""} ${
                    active ? "is-active" : ""
                  } ${isLLM ? "is-llm" : ""}`}
                  style={{
                    outline: active
                      ? "4px solid rgba(0, 113, 227, 0.16)"
                      : "none",
                  }}
                  aria-label={node.name}
                />
                <span
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    color: active ? "var(--fg-1)" : "var(--fg-4)",
                    letterSpacing: "0.02em",
                    transition: "color var(--t-quick) var(--ease-apple)",
                  }}
                >
                  {node.id}
                </span>
              </div>
            );
          })}
        </div>

        {/* What's happening line */}
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: "0.9rem",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "var(--fg-1)",
              letterSpacing: "-0.01em",
              marginBottom: 2,
            }}
          >
            {activeNode.processing.split(". ")[0]}.
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-4)",
            }}
          >
            {activeNode.sectionRef}
          </div>
        </div>
      </div>
    </section>
  );
}
