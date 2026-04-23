"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EXAMPLE_PROMPTS } from "../lib/demo-results";

type Props = {
  onSubmit: (q: string) => void;
  compact?: boolean;
  initialValue?: string;
  loading?: boolean;
};



/**
 * The Prompt surface — hero + compact header share the same component.
 *
 * Hero:
 *   - One strong viewport, no lower editorial section.
 *   - Rotating examples sit inside the hero itself.
 *   - The search box cycles through example prompts while empty.
 *
 * Compact:
 *   - A slim glass header pinned to the top of the answer screen.
 */
export function Prompt({ onSubmit, compact, initialValue, loading = false }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [exampleIndex, setExampleIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (compact || !ref.current) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) ref.current.focus();
  }, [compact]);

  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  useEffect(() => {
    if (compact || value.trim()) return;
    const interval = window.setInterval(() => {
      setExampleIndex((current) => (current + 1) % EXAMPLE_PROMPTS.length);
    }, 2400);
    return () => window.clearInterval(interval);
  }, [compact, value]);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, compact ? 120 : 240) + "px";
  };

  useEffect(() => {
    autoGrow();
  }, [compact, value]);

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

  return (
    <HeroFull
      value={value}
      setValue={setValue}
      submit={submit}
      inputRef={ref}
      onKeyDown={onKeyDown}
      ghostPrompt={EXAMPLE_PROMPTS[exampleIndex]?.query ?? ""}
      loading={loading}
    />
  );
}

function HeroFull({
  value,
  setValue,
  submit,
  inputRef,
  onKeyDown,
  ghostPrompt,
  loading,
}: {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  ghostPrompt: string;
  loading: boolean;
}) {
  return (
    <section className="hero">
      <div className="hero-scrim" aria-hidden />
      <div className="hero-header">
        <h1 className="hero-wordmark">VANTAGE</h1>
      </div>

      <div className="hero-content">
        <div className="hero-shell hero-shell--centered">
          <div className="hero-copy hero-copy--centered">
            <p className="hero-sub hero-sub--premium">
              Grounded open geospatial and public-record evidence for any site,
              corridor, or region.
            </p>
          </div>

          <div className="hero-panel">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="hero-input-wrap"
            >
              <div className="hero-input">
                <div className="hero-input-shell">
                  <AnimatePresence mode="wait">
                    {!value.trim() && (
                      <motion.div
                        key={ghostPrompt}
                        className="hero-input-ghost"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                      >
                        {ghostPrompt}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    aria-label="Ask Earth anything"
                    placeholder=""
                  />
                </div>

                <button type="submit" aria-label="Ask" disabled={!value.trim() || loading}>
                  {loading ? (
                    <span className="hero-spinner" aria-hidden />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 19V5M12 5l-6 6M12 5l6 6"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </form>

            <AnimatePresence>
              {loading && (
                <motion.p
                  key="analyzing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="hero-analyzing"
                >
                  <span className="hero-analyzing-dot" aria-hidden />
                  Analyzing…
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
