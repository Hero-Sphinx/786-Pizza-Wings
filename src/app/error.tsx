"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div>
        <h1 className="h-display text-4xl">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">Please try again. If it keeps happening, call us at (905) 453-0786 to order.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-outline">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
