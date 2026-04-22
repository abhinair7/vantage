"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EXAMPLE_PROMPTS } from "../lib/demo-results";

type Props = {
  onSubmit: (q: string) => void;
  compact?: boolean;
  initialValue?: string;
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
export function Prompt({ onSubmit, compact, initialValue }: Props) {
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
      onSubmit={onSubmit}
      inputRef={ref}
      onKeyDown={onKeyDown}
      ghostPrompt={EXAMPLE_PROMPTS[exampleIndex]?.query ?? ""}
    />
  );
}

function HeroFull({
  value,
  setValue,
  submit,
  onSubmit,
  inputRef,
  onKeyDown,
  ghostPrompt,
}: {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  onSubmit: (q: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  ghostPrompt: string;
}) {
  return (
    <section className="hero">
      <div className="hero-scrim" aria-hidden />

      <div className="hero-content">
        <div className="hero-shell hero-shell--centered">
          <div className="hero-copy hero-copy--centered">
            <div className="hero-caption">
              <h1 className="display-serif hero-headline hero-headline--pastel">
                See the site.<br />
                <em>Know</em> the story.
              </h1>
              <p className="hero-sub hero-sub--pastel">
                One prompt pulls satellite imagery, infrastructure footprints, operator
                records, and ownership graphs — then writes the brief so you can move
                on the deal, not the research.
              </p>
            </div>
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
                  <span className="hero-input-label">TRY</span>

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
            </form>

            <div className="hero-example-row">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt.query}
                  type="button"
                  className="hero-example-chip"
                  onClick={() => {
                    setValue(prompt.query);
                    window.setTimeout(() => onSubmit(prompt.query), 80);
                  }}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
