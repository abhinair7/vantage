"use client";

export function TelescopeReticle() {
  return (
    <div className="telescope" aria-hidden>
      <div className="telescope-vignette" />
      <div className="cockpit-frame cockpit-frame--left" />
      <div className="cockpit-frame cockpit-frame--right" />
      <div className="cockpit-spine" />

      <div className="cockpit-reflection cockpit-reflection--primary" />
      <div className="cockpit-reflection cockpit-reflection--secondary" />

      <div className="cockpit-console">
        <div className="cockpit-console__wing cockpit-console__wing--left" />
        <div className="cockpit-console__wing cockpit-console__wing--right" />
        <div className="cockpit-console__deck" />
        <div className="cockpit-console__grid cockpit-console__grid--left">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="cockpit-console__grid cockpit-console__grid--right">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
