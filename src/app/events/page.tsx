import { getAllEvents, getPlannedMatches } from "@/db/queries";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const [events, upcoming] = await Promise.all([getAllEvents(), getPlannedMatches()]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Übersicht</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Events &amp; Planung
            </h1>
          </div>
          <span className="text-sm text-foam-muted">{events.length} Events insgesamt</span>
        </div>
      </div>

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Events
            </h2>
          </header>
          {events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Noch kein Event angelegt.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((eventItem) => (
                <li key={eventItem.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-xl text-foam sm:text-2xl">
                      {eventItem.name}
                    </p>
                    <span
                      className={`text-xs uppercase tracking-[0.14em] ${
                        eventItem.status === "ongoing" ? "text-amber" : "text-foam-muted"
                      }`}
                    >
                      {eventItem.status === "ongoing"
                        ? "Läuft"
                        : eventItem.status === "upcoming"
                          ? "Geplant"
                          : "Vorbei"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foam-muted">
                    {eventItem.startsAt ? formatDate(eventItem.startsAt) : "Termin offen"}
                    {eventItem.endsAt && eventItem.endsAt !== eventItem.startsAt
                      ? ` – ${formatDate(eventItem.endsAt)}`
                      : ""}{" "}
                    · {eventItem.location}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Geplante Matches
            </h2>
          </header>
          {upcoming.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Kein Match geplant.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((match) => (
                <li key={match.id} className="px-4 py-4 sm:px-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber">
                    {formatDateTime(match.playedAt)}
                  </p>
                  {match.name && (
                    <p className="mt-1 font-display text-lg text-foam">{match.name}</p>
                  )}
                  <p className="mt-2 text-sm text-foam-muted">
                    {match.teamA.map((p) => p.name.split(" ")[0]).join(", ")}
                    <span className="mx-2 font-display text-amber">VS</span>
                    {match.teamB.map((p) => p.name.split(" ")[0]).join(", ")}
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
