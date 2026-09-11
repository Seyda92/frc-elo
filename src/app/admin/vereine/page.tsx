import { AdminPageHeader } from "@/components/AdminPageHeader";
import { AdminListRow } from "@/components/AdminListRow";
import { getClubs } from "@/db/queries";
import { ClubForm } from "./ClubForm";

export const metadata = { title: "Vereine" };

export default async function AdminClubsPage() {
  const clubs = await getClubs();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Vereine"
        meta={`${clubs.length} Vereine`}
        backHref="/admin"
      />

      <div className="border-b border-line px-[14px] py-4">
        <h2 className="font-display text-lg text-amber">Neuer Verein</h2>
        <ClubForm />
      </div>

      {clubs.length === 0 ? (
        <p className="px-[14px] py-4 text-sm text-foam-muted">Noch kein Verein angelegt.</p>
      ) : (
        <ul className="divide-y divide-line">
          {clubs.map((club) => (
            <AdminListRow
              key={club.id}
              title={club.name}
              meta={club.location ?? undefined}
              href={`/admin/vereine/${club.id}/bearbeiten`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
