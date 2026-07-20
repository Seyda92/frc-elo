import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-amber">404</p>
          <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
            Spiel nicht gefunden
          </h1>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-block bg-amber px-5 py-3 font-display uppercase tracking-wide text-asphalt"
        >
          Zum Leaderboard
        </Link>
      </div>
    </div>
  );
}
