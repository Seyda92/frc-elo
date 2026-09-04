import Link from "next/link";
import { getAllEvents, getClubs, getPlayersForMatchEntry, getRefereePlayerIds } from "@/db/queries";
import { TeamBuilderForm } from "./TeamBuilderForm";

export const metadata = { title: "Match anlegen" };

export default async function CreatePlannedMatchPage() {
  const [players, events, clubs, refereePlayerIds] = await Promise.all([
    getPlayersForMatchEntry(),
    getAllEvents(),
    getClubs(),
    getRefereePlayerIds(),
  ]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Match anlegen
            </h1>
            <p className="mt-1 text-sm text-foam-muted">
              Teams zusammenstellen — die Wertung folgt erst beim Bewerten.
            </p>
          </div>
          <Link
            href="/admin/spiele"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          {players.length < 2 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Es müssen mindestens zwei aktive Spieler angelegt sein.{" "}
              <Link href="/admin/spieler" className="text-amber hover:text-amber-hot">
                Spieler anlegen →
              </Link>
            </p>
          ) : (
            <TeamBuilderForm
              players={players}
              events={events}
              clubs={clubs}
              refereePlayerIds={refereePlayerIds}
            />
          )}
        </section>
      </div>
    </div>
  );
}
