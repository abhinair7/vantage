"use client";

export function TelescopeReticle() {
  return (
    <div className="telescope" aria-hidden>
      <div className="telescope-vignette" />
      <div className="lensing-halo" />
      <div className="lensing-core" />
      <div className="lensing-flare" />
      <div className="lensing-trail" />
      <div className="space-glow space-glow--teal" />
      <div className="space-glow space-glow--ivory" />
      <div className="space-particles" />
      <div className="ship-surface" />
      <div className="ship-wing" />
      <div className="ship-panel ship-panel--left" />
      <div className="ship-panel ship-panel--center" />
      <div className="ship-panel ship-panel--right" />
    </div>
  );
}
