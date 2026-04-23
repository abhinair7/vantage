"use client";

export function TelescopeReticle() {
  return (
    <div className="telescope" aria-hidden>
      <div className="telescope-vignette" />
      <div className="stellar-rift" />
      <div className="stellar-rift-core" />
      <div className="stellar-arc" />
      <div className="stellar-cloud stellar-cloud--slate" />
      <div className="stellar-cloud stellar-cloud--cyan" />
      <div className="stellar-cloud stellar-cloud--ivory" />
      <div className="stellar-dust" />
    </div>
  );
}
