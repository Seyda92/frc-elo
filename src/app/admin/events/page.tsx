import { AdminPageHeader } from "@/components/AdminPageHeader";
import { AdminListRow } from "@/components/AdminListRow";
import { getAllEvents, getClubs } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { EventForm } from "./EventForm";

export const metadata = { title: "Events" };

const statusLabels = {
  ongoing: "Läuft",
  upcoming: "Geplant",
  past: "Vorbei",
} as const;

export default async function AdminEventsPage() {
  const [clubs, events] = await Promise.all([getClubs(), getAllEvents()]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Events"
        meta={`${events.length} Events insgesamt`}
        backHref="/admin"
      />

      <div className="border-b border-line px-[14px] py-4">
        <h2 className="font-display text-lg text-amber">Neues Event</h2>
        <EventForm clubs={clubs} />
      </div>

      {events.length === 0 ? (
        <p className="px-[14px] py-4 text-sm text-foam-muted">Noch kein Event angelegt.</p>
      ) : (
        <ul className="divide-y divide-line">
          {events.map((event) => {
            const dateRange = `${event.startsAt ? formatDate(event.startsAt) : "Termin offen"}${
              event.endsAt && event.endsAt !== event.startsAt ? ` – ${formatDate(event.endsAt)}` : ""
            }${event.location ? ` · ${event.location}` : ""}`;
            return (
              <AdminListRow
                key={event.id}
                title={`${event.name} · ${statusLabels[event.status]}`}
                meta={dateRange}
                href={`/admin/events/${event.id}/bearbeiten`}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
