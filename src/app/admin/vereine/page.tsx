import Link from "next/link";
import { getClubs } from "@/db/queries";
import { ClubForm } from "./ClubForm";

export const metadata = { title: "Vereine" };

export default async function AdminClubsPage() {
  const clubs = await getClubs();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Vereine
            </h1>
          </div>
          <Link
            href="/admin"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Neuer Verein
            </h2>
          </header>
          <ClubForm />
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Bestand ({clubs.length})
            </h2>
          </header>
          {clubs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Noch kein Verein angelegt.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {clubs.map((club) => (
                <li key={club.id} className="px-4 py-4 sm:px-5">
                  <p className="font-display text-xl text-foam sm:text-2xl">{club.name}</p>
                  {club.location ? (
                    <p className="mt-1 text-sm text-foam-muted">{club.location}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
