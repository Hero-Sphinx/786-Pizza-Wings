"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreInfo } from "@/lib/store-types";
import { ChevronIcon } from "../icons";

type Promo = StoreInfo["promos"][number];

/** Promo slider: swipe (scroll-snap), dots, arrows, auto-advance that pauses on hover/focus and for reduced motion. */
export function HeroCarousel({ promos }: { promos: Promo[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = el.children.length;
    const next = ((i % n) + n) % n;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused || promos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(index + 1), 6000);
    return () => clearTimeout(t);
  }, [index, paused, go, promos.length]);

  if (promos.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Specials"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {promos.map((p, i) => (
          <div
            key={p.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${promos.length}`}
            className="relative w-full shrink-0 snap-start overflow-hidden bg-ink text-white"
          >
            <div className="container-page grid min-h-[30rem] items-center gap-6 py-10 md:min-h-[32rem] md:grid-cols-2 md:py-14">
              <div className="relative z-10 order-2 md:order-1">
                {p.eyebrow && <p className="font-display text-lg font-bold text-gold-400 sm:text-xl">{p.eyebrow}</p>}
                <h2 className="h-display mt-1 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">{p.title}</h2>
                {p.priceText && (
                  <p className="mt-4 inline-block -rotate-1 rounded-2xl bg-gold-400 px-4 py-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{p.priceText}</p>
                )}
                {p.body && <p className="mt-4 max-w-md text-lg text-white/85">{p.body}</p>}
                {p.ctaLabel && p.ctaHref && (
                  <Link href={p.ctaHref} className="btn btn-primary mt-6 text-lg" tabIndex={i === index ? 0 : -1}>
                    {p.ctaLabel}
                  </Link>
                )}
              </div>
              <div className="relative order-1 mx-auto aspect-square w-64 sm:w-80 md:order-2 md:w-full md:max-w-md">
                <div className="absolute inset-0 rounded-full bg-gold-400/20 blur-2xl" aria-hidden />
                <Image
                  src={p.image}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(min-width: 768px) 448px, 320px"
                  className="rounded-full object-cover ring-8 ring-white/10"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {promos.length > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {promos.map((p, i) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => go(i)}
                className="grid size-8 place-items-center"
                aria-label={`Show special ${i + 1}`}
                aria-current={i === index}
              >
                <span className={`block h-2.5 rounded-full transition-all ${i === index ? "w-7 bg-gold-400" : "w-2.5 bg-white/50"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 md:grid" aria-label="Previous special">
            <ChevronIcon className="rotate-180" />
          </button>
          <button type="button" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 md:grid" aria-label="Next special">
            <ChevronIcon />
          </button>
        </>
      )}
    </section>
  );
}
