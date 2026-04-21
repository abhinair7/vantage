"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CUSTOMER_PIPELINE } from "../lib/pipeline";
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
  const total = CUSTOMER_PIPELINE.length;
  // Stretch a bit per step so the six-beat rhythm feels deliberate, not
  // rushed — but never faster than the pretend-latency on the result.
  const perStep = Math.max(260, Math.round(result.tookMs / total));

  useEffect(() => {
    let i = 0;
    setStep(0);
    const tick = window.setInterval(() => {
      i += 1;
      if (i >= total) {
        window.clearInterval(tick);
        window.setTimeout(onDone, 420);
        return;
      }
      setStep(i);
    }, perStep);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  const progress = Math.min(1, (step + 1) / total);
  const activeStep = CUSTOMER_PIPELINE[Math.min(step, total - 1)];

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
          {CUSTOMER_PIPELINE.slice(0, step + 1).map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.div
                key={s.id}
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
                <span className="overlay-idx mono">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="overlay-copy">
                  <span className="overlay-name">{s.label}</span>
                  <span className="overlay-sub">{s.sublabel}</span>
                </div>
                <span
                  className="overlay-kind mono"
                  data-touch={s.touch.toLowerCase()}
                >
                  {s.touch}
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
            {activeStep.label}
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
