"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { EXAMPLE_PROMPTS } from "../lib/demo-results";

type Props = {
  onSubmit: (q: string) => void;
  compact?: boolean;
  initialValue?: string;
};

/**
 * The Prompt surface — hero + compact header share the same component.
 *
 * Hero (idle):
 *   - Dark cinematic first viewport, Earth visible through the scrim.
 *   - As the user scrolls, text dissolves and the globe takes the stage.
 *   - Second viewport is white editorial paper with numbered propositions.
 *
 * Compact (a query is in flight or answered):
 *   - A slim glass header pinned to the top of the answer screen.
 */
export function Prompt({ onSubmit, compact, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Autofocus on desktop (not mobile — avoids keyboard jumping in)
  useEffect(() => {
    if (compact || !ref.current) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) ref.current.focus();
  }, [compact]);

  // Keep local value in sync when the parent pushes a new initial (Reset, etc.)
  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  };
  useEffect(() => {
    autoGrow();
  }, [value]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (compact) {
    return (
      <motion.div
        className="page"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ paddingTop: "1.3rem", paddingBottom: "1rem" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="compact-bar"
        >
          <span className="compact-brand">Vantage</span>
          <span className="compact-divider" />
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Ask Earth anything"
            placeholder="Ask a new question…"
            className="compact-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "0.5rem 1.1rem", fontSize: 14 }}
            disabled={!value.trim()}
          >
            Ask
          </button>
        </form>
      </motion.div>
    );
  }

  return <HeroFull value={value} setValue={setValue} submit={submit} onSubmit={onSubmit} inputRef={ref} onKeyDown={onKeyDown} />;
}

/* ------------------------------------------------------------------ */
/* The full hero.                                                      */
/* ------------------------------------------------------------------ */

function HeroFull({
  value,
  setValue,
  submit,
  onSubmit,
  inputRef,
  onKeyDown,
}: {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  onSubmit: (q: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const { scrollY } = useScroll();
  // Hero content dissolves as we scroll past it
  const heroOpacity = useTransform(scrollY, [0, 240, 480], [1, 0.6, 0]);
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroBlur = useTransform(scrollY, [0, 500], [0, 6]);
  const scrimOpacity = useTransform(scrollY, [0, 400], [1, 0.55]);

  return (
    <>
      {/* Masthead — fixed over the globe */}
      <header className="masthead">
        <span className="masthead-brand">Vantage</span>
        <span className="masthead-meta">
          <span>EARTH OBSERVATION</span>
          <span className="masthead-dot" />
          <span>VOLUME 01</span>
        </span>
      </header>

      {/* Hero — full viewport, text over the 3D globe */}
      <motion.section
        className="hero"
        style={{ opacity: heroOpacity, y: heroY, filter: useTransform(heroBlur, (b) => `blur(${b}px)`) }}
      >
        {/* Legibility scrim — radial dim around the centre so text stays crisp */}
        <motion.div className="hero-scrim" style={{ opacity: scrimOpacity }} aria-hidden />

        <div className="hero-content page">
          <motion.div
            className="hero-kicker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <span className="hero-kicker-dot" />
            <span>A chat-first interface to Earth observation</span>
          </motion.div>

          <motion.h1
            className="display-serif hero-headline"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
          >
            Ask <em>Earth</em> anything.
          </motion.h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          >
            Satellite imagery, vessel positions, and the entity graph — resolved
            through one prompt. Every answer carries its source, or it says so.
          </motion.p>

          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="hero-input-wrap"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="hero-input">
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                aria-label="Ask Earth anything"
                placeholder="e.g. Has construction at Mundra Port increased over the last 6 months?"
              />
              <button type="submit" aria-label="Ask" disabled={!value.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 19V5M12 5l-6 6M12 5l6 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </motion.form>

          <motion.div
            className="hero-scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            <span>scroll to explore</span>
            <span className="hero-scroll-line" />
          </motion.div>
        </div>
      </motion.section>

      {/* Examples band — on the white paper, scrolled into view */}
      <section className="band band-white">
        <div className="page band-inner">
          <div className="eyebrow" style={{ marginBottom: "2rem" }}>
            OR PICK ONE
          </div>
          <ol className="editorial-list">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <motion.li
                key={p.query}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setValue(p.query);
                    window.setTimeout(() => onSubmit(p.query), 60);
                  }}
                  className="editorial-row"
                >
                  <span className="editorial-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="editorial-label">{p.label}</span>
                  <span className="editorial-arrow" aria-hidden>↗</span>
                </button>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Capabilities band */}
      <section className="band band-white">
        <div className="page band-inner">
          <div className="eyebrow" style={{ marginBottom: "2rem" }}>
            WHAT VANTAGE ANSWERS
          </div>
          <div className="capability-grid">
            {CAPABILITIES.map((c, i) => (
              <motion.article
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
                className="capability"
              >
                <span className="editorial-num" style={{ color: "var(--fg-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer ink */}
      <footer className="band-footer">
        <div className="page" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>
            © Vantage · prototype
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>
            Every answer carries its source.
          </span>
        </div>
      </footer>
    </>
  );
}

const CAPABILITIES: Array<{ title: string; body: string }> = [
  {
    title: "Ports, in motion.",
    body:
      "Berth occupancy, vessel dwell times, quay construction — resolved down to the ship and the crane.",
  },
  {
    title: "Commodities, measured.",
    body:
      "Oil tank fills, stockpile volumes, acreage planted. Every number backed by a pixel and a timestamp.",
  },
  {
    title: "Activity, sourced.",
    body:
      "Vehicle counts, thermal signatures, nightlights. Answers carry their evidence or the system refuses to guess.",
  },
];
