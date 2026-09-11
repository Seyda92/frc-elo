import Link from "next/link";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Mehr" };

type MehrItem = { href: string; title: string; sub: string };

export default async function MehrPage() {
  const session = await getSession();
  const isStaff = session?.role === "admin" || session?.role === "owner";

  const items: MehrItem[] = [
    { href: "/spiele", title: "Suche", sub: "Spieler, Spiele, Events" },
    { href: "/events", title: "Events", sub: "Turniere und Spieltage" },
  ];

  if (isStaff) {
    items.push(
      { href: "/admin/vereine", title: "Vereine", sub: "Vereinsverwaltung" },
      { href: "/admin", title: "Schiri-Bereich", sub: "Spiele anlegen, bewerten, verwalten" },
    );
  }

  if (session) {
    items.push({ href: "/passwort-aendern", title: "Passwort ändern", sub: session.username });
  } else {
    items.push({ href: "/login", title: "Login", sub: "Für Schiris und Vereinsleitung" });
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised px-[14px] py-4">
        <h1 className="font-display text-[26px] text-foam">Mehr</h1>
      </div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-[56px] items-center justify-between gap-[10px] px-[14px] transition hover:bg-rubber/30"
            >
              <span>
                <span className="block font-display text-[15px] text-foam">{item.title}</span>
                <span className="mt-[2px] block text-xs text-foam-muted">{item.sub}</span>
              </span>
              <span className="text-[15px] text-amber" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
