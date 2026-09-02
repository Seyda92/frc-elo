import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getAppUsers } from "@/db/queries";
import { RefereeForm } from "./RefereeForm";
import { RefereeList } from "./RefereeList";

export const metadata = { title: "Schiris" };

export default async function AdminRefereesPage() {
  const session = await requireOwner();
  const users = await getAppUsers();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Schiris
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
              Neuer Schiri
            </h2>
            <p className="mt-1 text-sm text-foam-muted">
              Mindestens 12 Zeichen Passwort. Der Owner-Status wird hier nicht vergeben.
            </p>
          </header>
          <RefereeForm />
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Bestand ({users.length})
            </h2>
          </header>
          {users.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">Noch kein Konto angelegt.</p>
          ) : (
            <RefereeList users={users} ownUserId={session.userId} />
          )}
        </section>
      </div>
    </div>
  );
}
