import Link from "next/link";
import { getMatchesGroupedByEvent } from "@/db/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { backLinkParam } from "@/lib/back-link";

export const metadata = { title: "Spiele" };

const GROUPS_PER_PAGE = 5;

type Props = {
  searchParams: Promise<{ groups?: string }>;
};

function parseGroupCount(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > GROUPS_PER_PAGE ? n : GROUPS_PER_PAGE;
}

export default async function MatchesPage({ searchParams }: Props) {
  const { groups: rawGroups } = await searchParams;
  const groupCount = parseGroupCount(rawGroups);

  const { groups, totalGroups } = await getMatchesGroupedByEvent(0, groupCount);
  const hasMore = groupCount < totalGroups;

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80 px-[14px] py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber">Spiele</p>
        <h1 className="mt-[6px] font-display text-[26px] text-foam">Nach Event</h1>
      </div>

      {groups.length === 0 ? (
        <p className="px-[14px] py-4 text-sm text-foam-muted">Noch kein Match erfasst.</p>
      ) : (
        groups.map((group) => (
          <section key={group.eventId ?? "none"}>
            <header className="flex items-baseline justify-between gap-2 border-b border-line bg-[var(--color-header)] px-[14px] py-[12px] pb-[8px]">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] text-signal-yellow">
                  {group.eventName}
                </p>
                <p className="mt-[3px] text-[11px] uppercase tracking-[0.14em] text-foam-muted">
                  {formatDate(group.latestPlayedAt)}
                </p>
              </div>
              {group.eventId ? (
                <Link
                  href="/events"
                  className="shrink-0 text-[11px] text-amber transition hover:text-amber-hot"
                >
                  Event ›
                </Link>
              ) : null}
            </header>
            <ul className="divide-y divide-line">
              {group.matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/spiel/${m.id}${backLinkParam("spiele")}`}
                    className="flex min-h-[60px] items-center gap-2 px-[14px] py-[10px] transition hover:bg-rubber/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm text-foam">
                        {m.teamAName} vs. {m.teamBName}
                      </p>
                      <p className="mt-[3px] text-xs text-foam-muted">
                        {m.status === "planned" ? "Geplant" : formatDateTime(m.playedAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-display text-[13px] ${
                        m.status === "planned" ? "text-signal-yellow" : "text-foam"
                      }`}
                    >
                      {m.scoreLabel}
                    </span>
                    <span className="shrink-0 text-amber" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {hasMore ? (
        <Link
          href={`/spiele?groups=${groupCount + GROUPS_PER_PAGE}`}
          className="block px-[14px] py-4 text-center text-xs text-foam-muted transition hover:text-amber"
        >
          Ältere Events laden
        </Link>
      ) : null}
    </div>
  );
}
