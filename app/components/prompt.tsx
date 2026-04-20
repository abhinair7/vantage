"use client";

import { useEffect, useRef, useState } from "react";
import { EXAMPLE_PROMPTS } from "../lib/demo-results";

type Props = {
  onSubmit: (q: string) => void;
  compact?: boolean;      // renders the small top version once a result is visible
  initialValue?: string;
};

/**
 * The one and only input surface. Two presentations:
 *   - compact:false  → giant centered hero (idle state)
 *   - compact:true   → slim top bar (result visible)
 */
export function Prompt({ onSubmit, compact, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Autofocus the hero input on mount (desktop only — avoids mobile keyboard)
  useEffect(() => {
    if (compact) return;
    if (!ref.current) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) ref.current.focus();
  }, [compact]);

  // Sync with parent if parent changes initialValue (e.g., after Reset)
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
      <div
        className="page"
        style={{
          paddingTop: "1.4rem",
          paddingBottom: "1rem",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          style={{
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "0.35rem 0.35rem 0.35rem 1.1rem",
          }}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Ask Earth anything"
            placeholder="Ask a new question…"
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--fg-1)",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              letterSpacing: "-0.01em",
              padding: "0.55rem 0",
              maxHeight: 120,
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "0.55rem 1.1rem" }}
            disabled={!value.trim()}
          >
            Ask
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* Top masthead — editorial wordmark + standfirst */}
      <header
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "1.6rem",
          paddingBottom: "0.6rem",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--fg-1)",
          }}
        >
          Vantage
        </span>
        <span className="eyebrow">Earth Observation · Volume 01</span>
      </header>

      {/* Hero — asymmetric editorial. Headline flush-left, meta flush-right. */}
      <section
        className="page"
        style={{
          paddingTop: "clamp(3.5rem, 11vh, 7.5rem)",
          paddingBottom: "clamp(2rem, 5vh, 3rem)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.618fr) minmax(0, 1fr)",
            columnGap: "clamp(1.5rem, 4vw, 3rem)",
            rowGap: "2.4rem",
            alignItems: "end",
          }}
        >
          {/* Left: the headline. Serif, italic mid-word, left-aligned, huge. */}
          <div>
            <div className="eyebrow" style={{ marginBottom: "1.4rem" }}>
              <span className="editorial-num">01.</span>{" "}
              <span style={{ marginLeft: 6 }}>THE QUESTION</span>
            </div>
            <h1 className="display-serif" style={{ margin: 0, maxWidth: "14ch" }}>
              Ask <em>Earth</em> anything.
            </h1>
          </div>

          {/* Right: the standfirst, aligned to the bottom baseline of the headline. */}
          <aside style={{ paddingBottom: "0.6rem" }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.05rem, 1.35vw, 1.2rem)",
                lineHeight: 1.45,
                color: "var(--fg-2)",
                letterSpacing: "-0.01em",
                maxWidth: "36ch",
              }}
            >
              A chat-first interface to satellite imagery, vessel positions, and
              the entity graph. Every answer carries its source.
            </p>
          </aside>
        </div>

        {/* Thin rule — framing principle, separates the headline block from the input */}
        <hr className="rule" style={{ marginTop: "clamp(2rem, 5vh, 3.5rem)" }} />

        {/* Input — left-aligned at full width, with the numbered examples as an
            editorial list underneath, not a centered chip soup. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          style={{
            marginTop: "clamp(1.8rem, 4vh, 2.4rem)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.618fr) minmax(0, 1fr)",
            columnGap: "clamp(1.5rem, 4vw, 3rem)",
            rowGap: "1.6rem",
            alignItems: "start",
          }}
        >
          <div>
            <label
              className="eyebrow"
              htmlFor="vantage-prompt"
              style={{ display: "block", marginBottom: "0.7rem" }}
            >
              <span className="editorial-num">02.</span>{" "}
              <span style={{ marginLeft: 6 }}>ENTER A PROMPT</span>
            </label>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-end",
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                padding: "0.9rem 0.9rem 0.9rem 1.25rem",
                transition: "border-color var(--t-quick) var(--ease-apple)",
              }}
            >
              <textarea
                id="vantage-prompt"
                ref={ref}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                aria-label="Ask Earth anything"
                placeholder="e.g. Has construction at Mundra Port increased over the last 6 months?"
                style={{
                  flex: 1,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--fg-1)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 19,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.4,
                  padding: "0.25rem 0",
                  maxHeight: 240,
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                aria-label="Ask"
                disabled={!value.trim()}
                style={{
                  height: 42,
                  width: 42,
                  padding: 0,
                  borderRadius: 999,
                  fontSize: 18,
                }}
              >
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
          </div>

          {/* Right column: numbered example list, editorial, left-aligned */}
          <div>
            <div className="eyebrow" style={{ marginBottom: "0.7rem" }}>
              <span className="editorial-num">03.</span>{" "}
              <span style={{ marginLeft: 6 }}>OR PICK ONE</span>
            </div>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0,
                borderTop: "1px solid var(--line)",
              }}
            >
              {EXAMPLE_PROMPTS.map((p, i) => (
                <li key={p.query} style={{ borderBottom: "1px solid var(--line)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(p.query);
                      window.setTimeout(() => onSubmit(p.query), 60);
                    }}
                    style={{
                      all: "unset",
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      columnGap: "0.8rem",
                      alignItems: "baseline",
                      padding: "0.75rem 0.1rem",
                      cursor: "pointer",
                      color: "var(--fg-1)",
                      transition: "color var(--t-quick) var(--ease-apple)",
                      fontFamily: "var(--font-serif)",
                      fontSize: 15,
                      letterSpacing: "-0.008em",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-1)";
                    }}
                  >
                    <span className="editorial-num" style={{ color: "var(--fg-4)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{p.label}</span>
                    <span
                      aria-hidden
                      style={{ color: "var(--fg-4)", fontSize: 14, lineHeight: 1 }}
                    >
                      ↗
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </form>
      </section>

      {/* Second band — editorial "what it does". Numbered trio, serif
          propositions, the same typographic vocabulary as the hero so the page
          reads as one issue, not a landing page with a features grid. */}
      <section
        className="page"
        style={{
          paddingTop: "clamp(3rem, 8vh, 5rem)",
          paddingBottom: "clamp(3rem, 8vh, 5rem)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: "2rem" }}>
          WHAT VANTAGE ANSWERS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            columnGap: "clamp(1.5rem, 4vw, 3rem)",
            rowGap: "2.2rem",
          }}
        >
          {CAPABILITIES.map((c, i) => (
            <article key={c.title} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              <span className="editorial-num" style={{ color: "var(--fg-3)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.35rem, 2vw, 1.65rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.1,
                  color: "var(--fg-1)",
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  letterSpacing: "-0.008em",
                  color: "var(--fg-3)",
                  maxWidth: "32ch",
                }}
              >
                {c.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

/** The three editorial propositions below the hero. Kept as data so the
 *  layout stays typographic, not prose. */
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
