import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/AdminPageHeader";
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
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Spieler bearbeiten"
        backHref="/admin/spieler"
      />
      <div className="px-[14px] py-4">
        <EditPlayerForm player={playerDetail} clubs={clubs} />
      </div>
    </div>
  );
}
