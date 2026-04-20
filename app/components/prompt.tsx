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
    <section
      className="page"
      style={{
        paddingTop: "clamp(4rem, 14vh, 9rem)",
        paddingBottom: "clamp(2rem, 6vh, 3.5rem)",
        textAlign: "center",
      }}
    >
      <div
        className="eyebrow"
        style={{ marginBottom: "1.4rem", color: "var(--fg-4)" }}
      >
        VANTAGE · INTERFACE LAYER FOR EARTH OBSERVATION
      </div>

      <h1 className="display-xl" style={{ maxWidth: 18 + "ch", margin: "0 auto" }}>
        Ask Earth anything.
      </h1>

      <p
        style={{
          maxWidth: 640,
          margin: "1.4rem auto 0",
          fontSize: 19,
          lineHeight: 1.47,
          color: "var(--fg-3)",
          letterSpacing: "-0.012em",
        }}
      >
        A chat-first interface to satellite imagery, vessel positions, and the
        entity graph. Every answer carries its source. When the evidence
        isn&rsquo;t there, the answer says so.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          marginTop: "2.6rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.3rem",
        }}
      >
        <div
          style={{
            width: "min(780px, 100%)",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-end",
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 22,
            padding: "1rem 1rem 1rem 1.4rem",
            transition: "border-color var(--t-quick) var(--ease-apple)",
          }}
        >
          <textarea
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
              fontFamily: "var(--font-display)",
              fontSize: 20,
              letterSpacing: "-0.015em",
              lineHeight: 1.35,
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
              height: 44,
              width: 44,
              padding: 0,
              borderRadius: 999,
              fontSize: 18,
            }}
          >
            {/* arrow up */}
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

        {/* Suggestion chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            justifyContent: "center",
          }}
        >
          <span
            className="eyebrow"
            style={{ alignSelf: "center", marginRight: "0.3rem", color: "var(--fg-4)" }}
          >
            TRY
          </span>
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p.query}
              type="button"
              className="chip"
              onClick={() => {
                setValue(p.query);
                // Submit on the next tick so the input visibly updates first
                window.setTimeout(() => onSubmit(p.query), 60);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
