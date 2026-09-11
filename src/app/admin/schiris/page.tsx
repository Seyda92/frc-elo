import { AdminPageHeader } from "@/components/AdminPageHeader";
import { requireOwner } from "@/lib/auth";
import { getAllPlayers, getAppUsers } from "@/db/queries";
import { RefereeForm } from "./RefereeForm";
import { RefereeList } from "./RefereeList";

export const metadata = { title: "Schiris" };

export default async function AdminRefereesPage() {
  const session = await requireOwner();
  const [users, players] = await Promise.all([getAppUsers(), getAllPlayers()]);
  const ownerCount = users.filter((u) => u.role === "owner").length;

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Owner"
        eyebrowTone="danger"
        title="Schiris"
        meta={`${users.length} Zugänge · ${ownerCount} Owner`}
        backHref="/admin"
      />

      <div className="border-b border-line px-[14px] py-4">
        <h2 className="font-display text-lg text-foam">Neuer Schiri</h2>
        <p className="mt-1 text-xs text-foam-muted">
          Mindestens 6 Zeichen Passwort. Der Owner-Status wird hier nicht vergeben.
        </p>
        <RefereeForm players={players} />
      </div>

      {users.length === 0 ? (
        <p className="px-[14px] py-4 text-sm text-foam-muted">Noch kein Konto angelegt.</p>
      ) : (
        <RefereeList users={users} ownUserId={session.userId} players={players} />
      )}

      <p className="px-[14px] py-4 text-[11.5px] text-foam-muted">
        Rolle ändern, Passwort zurücksetzen und Zugang deaktivieren stehen pro Zeile — Löschen nur,
        wenn der Schiri kein Spiel bewertet hat.
      </p>
    </div>
  );
}
