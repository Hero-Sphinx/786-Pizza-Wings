import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div>
        <Image src="/images/logo.webp" alt="786 Pizza & Wings" width={400} height={500} className="mx-auto h-28 w-auto" />
        <h1 className="h-display mt-6 text-4xl">This slice is missing</h1>
        <p className="mt-2 text-ink-soft">We couldn&apos;t find that page.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn btn-outline">
            Home
          </Link>
          <Link href="/menu" className="btn btn-primary">
            See the menu
          </Link>
        </div>
      </div>
    </div>
  );
}
