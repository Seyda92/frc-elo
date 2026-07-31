import Link from "next/link";
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
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Events
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

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-6 sm:py-8 lg:space-y-6">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Neues Event
            </h2>
          </header>
          <EventForm clubs={clubs} />
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Bestand ({events.length})
            </h2>
          </header>
          {events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Noch kein Event angelegt.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-xl text-foam sm:text-2xl">
                      {event.name}
                    </p>
                    <span
                      className={`text-xs uppercase tracking-[0.14em] ${
                        event.status === "ongoing" ? "text-amber" : "text-foam-muted"
                      }`}
                    >
                      {statusLabels[event.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foam-muted">
                    {event.startsAt ? formatDate(event.startsAt) : "Termin offen"}
                    {event.endsAt && event.endsAt !== event.startsAt
                      ? ` – ${formatDate(event.endsAt)}`
                      : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
