"use client";

import { useEffect, useState } from "react";
import { acceptsAsap, formatDayLabel, formatTime, nextOpening, windowAt, type HoursConfig } from "@/lib/hours";

/** "Open now · until 11:30 PM" / "Closed · opens today at 11:30 AM". Computed in the browser so cached pages stay correct. */
export function OpenStatus({ hours, className = "" }: { hours: HoursConfig; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // The server can't know the visitor's "now" for a cached page, so this renders after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className={className}>&nbsp;</span>;

  const w = windowAt(now, hours);
  if (w && acceptsAsap(now, hours)) {
    return (
      <span className={className}>
        <span className="mr-1.5 inline-block size-2 rounded-full bg-brand-500 align-middle" aria-hidden />
        Open now · until {formatTime(w.closes, hours.timezone)}
      </span>
    );
  }
  const next = nextOpening(now, hours);
  return (
    <span className={className}>
      <span className="mr-1.5 inline-block size-2 rounded-full bg-tomato-500 align-middle" aria-hidden />
      Closed{next ? ` · opens ${formatDayLabel(next.opens, now, hours.timezone).toLowerCase()} at ${formatTime(next.opens, hours.timezone)}` : ""}
    </span>
  );
}
