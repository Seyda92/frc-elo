import Link from "next/link";

/** Einheitliche Zeile für Verwaltungslisten: Titel über Meta, rechts ein
 *  "bearbeiten ›"-Link (in ink/muted statt accent bei inaktiven Einträgen). */
export function AdminListRow({
  title,
  meta,
  href,
  linkLabel = "bearbeiten",
  inactive,
}: {
  title: string;
  meta?: string;
  href: string;
  linkLabel?: string;
  inactive?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-[14px] py-3">
      <div className="min-w-0">
        <p className={`truncate font-display text-[13.5px] ${inactive ? "text-foam-muted" : "text-foam"}`}>
          {title}
        </p>
        {meta ? <p className="mt-[2px] text-[11px] text-foam-muted">{meta}</p> : null}
      </div>
      <Link
        href={href}
        className={`shrink-0 text-[11px] uppercase tracking-[0.1em] transition ${
          inactive ? "text-foam-muted hover:text-amber" : "text-amber hover:text-amber-hot"
        }`}
      >
        {linkLabel} ›
      </Link>
    </li>
  );
}
