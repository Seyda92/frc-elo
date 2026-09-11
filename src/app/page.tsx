import Link from "next/link";
import { getLeaderboard, getPrimaryClub } from "@/db/queries";
import {
  LEADERBOARD_SORT_KEYS,
  SORT_DIRECTIONS,
  type LeaderboardSortKey,
  type SortDirection,
} from "@/lib/format";
import { LeaderboardRow } from "@/components/LeaderboardRow";

const SORT_LABELS: Record<LeaderboardSortKey, string> = {
  elo: "Elo",
  quote: "Quote",
  games: "Spiele",
  bonusBeers: "Bonusbiere",
  wins: "Siege",
};

function parseSortBy(raw: string | undefined): LeaderboardSortKey {
  return (LEADERBOARD_SORT_KEYS as readonly string[]).includes(raw ?? "")
    ? (raw as LeaderboardSortKey)
    : "elo";
}

function parseDirection(raw: string | undefined): SortDirection {
  return (SORT_DIRECTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as SortDirection)
    : "desc";
}

type Props = {
  searchParams: Promise<{ sort?: string; dir?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { sort: rawSort, dir: rawDir } = await searchParams;
  const sortBy = parseSortBy(rawSort);
  const direction = parseDirection(rawDir);

  const club = await getPrimaryClub();
  const clubId = club ? Number(club.id) : undefined;

  const ranked = clubId != null ? await getLeaderboard(clubId, sortBy, direction) : [];

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              Rangliste
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              1. FRC Leaderboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foam-muted">{ranked.length} Spieler</span>
            <Link
              href="/live"
              className="bg-amber px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt transition hover:bg-amber-hot"
            >
              Live-Spieltag
            </Link>
          </div>
        </div>
      </div>

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
                ELO-Tabelle
              </h2>
              <p className="mt-1 text-sm text-foam-muted">{club?.name}</p>
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 sm:px-5">
            {LEADERBOARD_SORT_KEYS.map((key) => {
              const isActive = key === sortBy;
              const nextDir = isActive && direction === "desc" ? "asc" : "desc";
              return (
                <Link
                  key={key}
                  href={`/?sort=${key}&dir=${nextDir}`}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                    isActive
                      ? "bg-amber text-asphalt"
                      : "border border-line text-foam-muted hover:border-amber hover:text-amber"
                  }`}
                >
                  {SORT_LABELS[key]}
                  {isActive ? (direction === "desc" ? " ↓" : " ↑") : ""}
                </Link>
              );
            })}
          </div>

          <ul className="rank-stagger">
            {ranked.map((player, index) => (
              <LeaderboardRow
                key={player.id}
                player={player}
                rank={index + 1}
                showRankDelta={sortBy === "elo"}
              />
            ))}
          </ul>
        </section>

        <p className="text-center text-sm text-foam-muted">{club?.name}</p>
      </div>
    </div>
  );
}
