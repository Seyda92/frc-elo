import Link from "next/link";
import { notFound } from "next/navigation";
import { getClubs, getPlayerById } from "@/db/queries";
import { EditPlayerForm } from "./EditPlayerForm";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | undefined {
  const n = Number(id);
  return Number.isInteger(n) ? n : undefined;
}

export const metadata = { title: "Spieler bearbeiten" };

export default async function EditPlayerPage({ params }: Props) {
  const { id } = await params;
  const playerId = parseId(id);
  const [playerDetail, clubs] =
    playerId != null ? await Promise.all([getPlayerById(playerId), getClubs()]) : [undefined, []];
  if (!playerDetail) notFound();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Spieler bearbeiten
            </h1>
          </div>
          <Link
            href="/admin/spieler"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <EditPlayerForm player={playerDetail} clubs={clubs} />
        </section>
      </div>
    </div>
  );
}
