import Link from "next/link";

/** Einheitlicher Seitenkopf für Verwaltungslisten/-formulare: Overline im
 *  Rollenkontext (warn = Schiri, danger = Owner), H1, optionale Metazeile,
 *  Zurück-Link. Ersetzt das bisher pro Seite handkopierte Header-Markup. */
export function AdminPageHeader({
  eyebrow,
  eyebrowTone = "warn",
  title,
  meta,
  backHref,
  backLabel = "Zurück",
}: {
  eyebrow: string;
  eyebrowTone?: "warn" | "danger";
  title: string;
  meta?: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-asphalt-raised/80 px-[14px] py-4">
      <div className="min-w-0">
        <p
          className={`text-[10px] uppercase tracking-[0.2em] ${
            eyebrowTone === "danger" ? "text-clay" : "text-signal-yellow"
          }`}
        >
          {eyebrow}
        </p>
        <h1 className="mt-[6px] truncate font-display text-[21px] text-foam">{title}</h1>
        {meta ? <p className="mt-[5px] text-xs text-foam-muted">{meta}</p> : null}
      </div>
      <Link
        href={backHref}
        className="shrink-0 border border-line px-3 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
      >
        {backLabel}
      </Link>
    </div>
  );
}
