import Link from "next/link";
import { AdminPageHeader } from "@/components/AdminPageHeader";
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
      <AdminPageHeader
        eyebrow="Spiel anlegen"
        title="Teams zuordnen"
        meta="Zeitpunkt, Event und Kader festlegen — die Wertung folgt erst beim Bewerten."
        backHref="/admin/spiele"
      />

      <div className="px-[14px] py-4">
        {players.length < 2 ? (
          <p className="text-sm text-foam-muted">
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
      </div>
    </div>
  );
}
