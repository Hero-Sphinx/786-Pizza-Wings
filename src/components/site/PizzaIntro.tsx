"use client";

import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";

// Opening animation: a whole pizza lands on a plate, every slice is pulled away at once,
// revealing the logo on the plate, then the site. Pure CSS (see .intro-* in globals.css), so it
// plays from the first paint and finishes by itself even before JavaScript loads.

const LANDING_PAGES = ["/", "/menu", "/about"];
const C = 200; // centre of the 400x400 drawing
const R = 180; // pizza radius
const SLICES = 8;

const polar = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)] as const;
};
const pt = (r: number, deg: number) => polar(r, deg).map((n) => n.toFixed(2)).join(",");

// Slight per-slice variation so the pull feels hand-made, not mechanical (fixed values: SSR-safe).
const TWIST = [-24, 18, -12, 28, -20, 14, -30, 22];
const SPEED = [1.02, 0.96, 1.05, 0.98, 1.0, 1.04, 0.95, 1.01];

const slices = Array.from({ length: SLICES }, (_, i) => {
  const start = (360 / SLICES) * i - 90;
  const end = start + 360 / SLICES;
  const mid = (start + end) / 2;
  return {
    mid,
    wedge: `M${C},${C} L${pt(R, start)} A${R},${R} 0 0 1 ${pt(R, end)} Z`,
    crust: `M${pt(R - 7, start + 0.6)} A${R - 7},${R - 7} 0 0 1 ${pt(R - 7, end - 0.6)}`,
    pepperoni: [polar(122, mid + 6), polar(66, mid - 9)],
    olive: polar(150, mid - 12),
    basil: i % 2 === 0 ? { at: polar(98, mid - 14), angle: mid + 40 } : null,
    pepper: i % 2 === 1 ? { at: polar(100, mid + 12), angle: mid - 30 } : null,
    style: { "--a": `${mid}deg`, "--r": `${TWIST[i]}deg`, "--s": SPEED[i] } as CSSProperties,
  };
});

export function PizzaIntro() {
  const pathname = usePathname();
  // Decided once, on the first page of the visit; client-side navigation never replays it.
  const [show, setShow] = useState(() => LANDING_PAGES.includes(pathname));
  if (!show) return null;

  return (
    <div
      className="intro"
      aria-hidden="true"
      onClick={() => setShow(false)}
      onAnimationEnd={(e) => {
        if (e.animationName === "intro-out") setShow(false);
      }}
    >
      <svg className="intro-pizza" viewBox="0 0 400 400" role="presentation">
        <defs>
          <radialGradient id="intro-cheese" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffe59a" />
            <stop offset="70%" stopColor="#fbc94f" />
            <stop offset="100%" stopColor="#eea83a" />
          </radialGradient>
          <radialGradient id="intro-pep" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#d9463b" />
            <stop offset="100%" stopColor="#9e231c" />
          </radialGradient>
        </defs>

        {/* The plate, with the logo that the slices reveal. */}
        <circle cx={C} cy={C} r={198} fill="#fffaf1" />
        <circle cx={C} cy={C} r={186} fill="none" stroke="#f1e3c9" strokeWidth={3} />
        <image className="intro-logo" href="/images/logo.webp" x={C - 72} y={C - 90} width={144} height={180} />

        {slices.map((s, i) => (
          <g key={i} className="intro-slice" style={s.style}>
            <path d={s.wedge} fill="url(#intro-cheese)" stroke="#f3b545" strokeWidth={1.5} strokeLinejoin="round" />
            <path d={s.crust} fill="none" stroke="#c77d2c" strokeWidth={15} strokeLinecap="round" />
            <path d={s.crust} fill="none" stroke="#e3a24c" strokeWidth={6} strokeLinecap="round" opacity={0.8} />
            {s.pepperoni.map(([x, y], j) => (
              <g key={j}>
                <circle cx={x} cy={y} r={15} fill="url(#intro-pep)" />
                <circle cx={x - 4} cy={y - 3} r={2.2} fill="#7d1a15" opacity={0.6} />
                <circle cx={x + 5} cy={y + 4} r={1.8} fill="#7d1a15" opacity={0.6} />
              </g>
            ))}
            <circle cx={s.olive[0]} cy={s.olive[1]} r={6.5} fill="none" stroke="#2b2622" strokeWidth={4} />
            {s.basil && (
              <ellipse cx={s.basil.at[0]} cy={s.basil.at[1]} rx={11} ry={5.5} fill="#2f8f3a" transform={`rotate(${s.basil.angle} ${s.basil.at[0]} ${s.basil.at[1]})`} />
            )}
            {s.pepper && (
              <path
                d={`M${s.pepper.at[0] - 10},${s.pepper.at[1]} q10,-9 20,0`}
                fill="none"
                stroke="#3ea04a"
                strokeWidth={4}
                strokeLinecap="round"
                transform={`rotate(${s.pepper.angle} ${s.pepper.at[0]} ${s.pepper.at[1]})`}
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
