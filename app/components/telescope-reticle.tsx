"use client";

export function TelescopeReticle() {
  return (
    <div className="telescope" aria-hidden>
      <div className="telescope-vignette" />
      <div className="orbital-haze orbital-haze--left" />
      <div className="orbital-haze orbital-haze--right" />
      <div className="orbital-shard orbital-shard--one" />
      <div className="orbital-shard orbital-shard--two" />
      <div className="orbital-shard orbital-shard--three" />
      <div className="orbital-signal orbital-signal--one" />
      <div className="orbital-signal orbital-signal--two" />
    </div>
  );
}
