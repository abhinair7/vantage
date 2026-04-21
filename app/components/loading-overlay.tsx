"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PIPELINE, LLM_NODE_IDS } from "../lib/pipeline";
import type { DemoResult } from "../lib/demo-results";

type Props = {
  query: string;
  result: DemoResult;
  onDone: () => void;
};

/**
 * The pipeline animation, reborn as a popup.
 *
 * Instead of a dedicated "running" page, the overlay slides up over
 * whatever's already on screen while the pipeline works. Total duration
 * scales with result.tookMs. When the last node settles, we fade out.
 *
 * The pipeline is presented as a vertical stream of log lines that
 * progressively reveal — it feels like a real AI tool watching itself
 * think, not a progress bar pretending to be busy.
 */
export function LoadingOverlay({ query, result, onDone }: Props) {
  const [step, setStep] = useState(0);
  const total = PIPELINE.length;
  const perStep = Math.max(140, Math.round(result.tookMs / total));

  useEffect(() => {
    let i = 0;
    setStep(0);
    const tick = window.setInterval(() => {
      i += 1;
      if (i >= total) {
        window.clearInterval(tick);
        window.setTimeout(onDone, 380);
        return;
      }
      setStep(i);
    }, perStep);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  const progress = Math.min(1, (step + 1) / total);
  const activeNode = PIPELINE[Math.min(step, total - 1)];

  return (
    <motion.div
      className="overlay-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.div
        className="overlay-card"
        initial={{ y: 28, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Header: the question, quietly */}
        <div className="overlay-head">
          <span className="eyebrow" style={{ color: "var(--fg-4)" }}>
            ANALYZING
          </span>
          <div className="overlay-q">{query}</div>
        </div>

        {/* Log stream — the "I'm thinking out loud" view */}
        <div className="overlay-log">
          {PIPELINE.slice(0, step + 1).map((node, i) => {
            const done = i < step;
            const active = i === step;
            const isLLM = LLM_NODE_IDS.has(node.id);
            return (
              <motion.div
                key={node.id}
                className={`overlay-line ${active ? "is-active" : ""} ${
                  done ? "is-done" : ""
                }`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <span className="overlay-badge">
                  {done ? "✓" : active ? "" : "·"}
                </span>
                <span className="overlay-idx mono">{node.id}</span>
                <span className="overlay-name">
                  {node.processing.split(". ")[0]}.
                </span>
                <span
                  className="overlay-kind mono"
                  data-touch={node.touch.toLowerCase()}
                >
                  {isLLM ? "LLM" : node.touch}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom rail */}
        <div className="overlay-foot">
          <div className="overlay-progress">
            <motion.div
              className="overlay-progress-fill"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
            />
          </div>
          <span className="mono" style={{ color: "var(--fg-4)", fontSize: 11 }}>
            {String(step + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} ·{" "}
            {activeNode.name}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** A small helper so AnimatePresence has a keyed child even when null */
export function LoadingOverlayPortal({
  active,
  ...props
}: Props & { active: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {active ? <LoadingOverlay key="loading" {...props} /> : null}
    </AnimatePresence>
  );
}
